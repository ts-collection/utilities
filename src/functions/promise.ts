import { sleep } from './utils-core';

type AwaitedTuple<T extends readonly (() => Promise<any>)[] | []> = {
  -readonly [P in keyof T]: Awaited<ReturnType<T[P]>>;
};

type ObjectValues<T extends Record<string, () => Promise<any>>> = {
  [K in keyof T]: Awaited<ReturnType<T[K]>>;
};

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

export async function withConcurrency<
  T extends readonly (() => Promise<any>)[] | [],
>(
  tasks: T,
  options?: ConcurrenceOptions,
): Promise<ConcurrenceResult<AwaitedTuple<T>>>;

export async function withConcurrency<
  T extends Record<string, () => Promise<any>>,
>(
  tasks: T,
  options?: ConcurrenceOptions,
): Promise<ConcurrenceResult<ObjectValues<T>>>;

export async function withConcurrency(
  tasks: readonly (() => Promise<any>)[] | Record<string, () => Promise<any>>,
  options: ConcurrenceOptions = {},
): Promise<
  ConcurrenceResult<unknown[]> | ConcurrenceResult<Record<string, unknown>>
> {
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
  const resultEntries: [string, unknown][] = [];
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
        resultEntries.push([key, result]);
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
    results: Object.fromEntries(resultEntries) as Record<string, unknown>,
    errors,
    succeeded,
    failed,
    duration: Date.now() - start,
  };
}
