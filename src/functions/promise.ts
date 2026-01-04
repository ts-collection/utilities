import { sleep } from './utils-core';

export type ConcurrenceResult<T> = {
  results: T;
  errors: Error[];
  succeeded: number;
  failed: number;
  duration: number;
};

export type ConcurrenceOptions = {
  concurrency?: number;
  timeout?: number;
  signal?: AbortSignal;
  retry?: number;
  retryDelay?: number;
  throwOnFirstError?: boolean;
  ignoreErrors?: boolean;
};

type TaskMap = {
  [key: string]: () => Promise<unknown>;
};

export async function withConcurrency<T>(
  tasks: readonly (() => Promise<T>)[],
  options?: ConcurrenceOptions,
): Promise<ConcurrenceResult<T[]>>;

export async function withConcurrency<T>(
  tasks: Record<string, () => Promise<T>>,
  options?: ConcurrenceOptions,
): Promise<ConcurrenceResult<Record<string, T>>>;

export async function withConcurrency<T>(
  tasks: readonly (() => Promise<T>)[] | Record<string, () => Promise<T>>,
  options: ConcurrenceOptions = {},
): Promise<ConcurrenceResult<T[]> | ConcurrenceResult<Record<string, T>>> {
  const {
    concurrency = Infinity,
    timeout = Infinity,
    signal,
    retry = 0,
    retryDelay = 0,
    throwOnFirstError = false,
    ignoreErrors = false,
  } = options;

  const isArray = Array.isArray(tasks);
  const taskMap: TaskMap = {};

  if (isArray) {
    tasks.forEach((task, idx) => {
      taskMap[idx.toString()] = task;
    });
  } else {
    Object.entries(tasks).forEach(([key, task]) => {
      taskMap[key] = task;
    });
  }

  const taskKeys = Object.keys(taskMap);

  if (taskKeys.length === 0) {
    return {
      results: (isArray ? [] : {}) as any,
      errors: [],
      succeeded: 0,
      failed: 0,
      duration: 0,
    } as any;
  }

  const start = Date.now();
  const resultEntries: [string, T][] = [];
  const errors: Error[] = [];

  let taskIndex = 0;
  let succeeded = 0;
  let failed = 0;
  let stopped = false;

  let firstError: Error | null | undefined = throwOnFirstError
    ? null
    : undefined;

  const runTask = async (key: string): Promise<void> => {
    let attempt = 0;

    while (attempt <= retry && !stopped) {
      try {
        const result = await taskMap[key]!();
        resultEntries.push([key, result as T]);
        succeeded++;
        return;
      } catch (err) {
        if (attempt === retry) {
          const error = err instanceof Error ? err : new Error(String(err));
          errors.push(error);
          failed++;

          if (!ignoreErrors && throwOnFirstError && !firstError) {
            firstError = error;
            stopped = true;
          }
          return;
        }

        attempt++;
        if (retryDelay > 0) {
          await sleep(retryDelay, signal);
        }
      }
    }
  };

  const worker = async (): Promise<void> => {
    while (!stopped) {
      const i = taskIndex++;
      if (i >= taskKeys.length) return;
      if (signal?.aborted) {
        stopped = true;
        return;
      }

      await runTask(taskKeys[i]!);
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, taskKeys.length) },
    worker,
  );

  const mainPromise = Promise.all(workers);

  if (timeout !== Infinity) {
    await Promise.race([
      mainPromise,
      sleep(timeout, signal).then(() => {
        stopped = true;
        throw new Error(`Concurrence timed out after ${timeout}ms`);
      }),
    ]);
  } else {
    await mainPromise;
  }

  if (firstError && throwOnFirstError) {
    throw firstError;
  }

  if (isArray) {
    return {
      results: resultEntries
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([, value]) => value),
      errors,
      succeeded,
      failed,
      duration: Date.now() - start,
    };
  }

  return {
    results: Object.fromEntries(resultEntries) as Record<string, T>,
    errors,
    succeeded,
    failed,
    duration: Date.now() - start,
  };
}
