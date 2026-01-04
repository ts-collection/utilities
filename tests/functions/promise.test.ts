import { describe, expect, it, vi } from 'vitest';
import { withConcurrency } from '../../src/functions/promise';

describe('withConcurrency', () => {
  describe('basic functionality', () => {
    it('should handle empty array', async () => {
      const result = await withConcurrency([]);
      expect(result).toEqual({
        results: [],
        errors: [],
        succeeded: 0,
        failed: 0,
        duration: 0,
      });
    });

    it('should handle empty object', async () => {
      const result = await withConcurrency({});
      expect(result).toEqual({
        results: {},
        errors: [],
        succeeded: 0,
        failed: 0,
        duration: 0,
      });
    });

    it('should handle single successful task', async () => {
      const task = vi.fn().mockResolvedValue('success');
      const result = await withConcurrency([task]);
      expect(result.results).toEqual(['success']);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(task).toHaveBeenCalledTimes(1);
    });

    it('should handle single failed task', async () => {
      const task = vi.fn().mockRejectedValue(new Error('failed'));
      const result = await withConcurrency([task]);
      expect(result.results).toEqual([]);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toBe('failed');
    });

    it('should handle multiple successful tasks', async () => {
      const task1 = vi.fn().mockResolvedValue(1);
      const task2 = vi.fn().mockResolvedValue(2);
      const task3 = vi.fn().mockResolvedValue(3);
      const result = await withConcurrency([task1, task2, task3]);
      expect(result.results).toEqual([1, 2, 3]);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('should preserve order for array tasks', async () => {
      const delays = [30, 0, 15];
      const tasks = delays.map(
        (delay, i) => () =>
          new Promise<number>((resolve) => setTimeout(() => resolve(i), delay)),
      );
      const result = await withConcurrency(tasks, { concurrency: 2 });
      expect(result.results).toEqual([0, 1, 2]);
    });

    it('should preserve order for array tasks with extreme delays', async () => {
      const tasks = [
        () => new Promise((resolve) => setTimeout(() => resolve('last'), 100)),
        () => new Promise((resolve) => setTimeout(() => resolve('first'), 0)),
        () => new Promise((resolve) => setTimeout(() => resolve('middle'), 50)),
      ];
      const result = await withConcurrency(tasks, { concurrency: 3 });
      expect(result.results).toEqual(['last', 'first', 'middle']);
    });

    it('should preserve order for array tasks with mixed success/failure', async () => {
      const tasks = [
        () => new Promise((resolve) => setTimeout(() => resolve('a'), 20)),
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('fail')), 5),
          ),
        () => new Promise((resolve) => setTimeout(() => resolve('b'), 10)),
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('fail2')), 0),
          ),
        () => new Promise((resolve) => setTimeout(() => resolve('c'), 15)),
      ];
      const result = await withConcurrency(tasks, { concurrency: 3 });
      expect(result.results).toEqual(['a', 'b', 'c']);
      expect(result.failed).toBe(2);
    });

    it('should preserve order for array tasks with retry', async () => {
      const tasks = [
        () => new Promise((resolve) => setTimeout(() => resolve('a'), 0)),
        () =>
          new Promise((_, reject) => {
            let count = 0;
            const attempt = () => {
              count++;
              if (count < 3) {
                setTimeout(() => attempt(), 10);
              } else {
                setTimeout(() => reject(new Error('fail')), 0);
              }
            };
            attempt();
          }),
        () => new Promise((resolve) => setTimeout(() => resolve('b'), 5)),
      ];
      const result = await withConcurrency(tasks, { concurrency: 2, retry: 2 });
      expect(result.results).toEqual(['a', 'b']);
      expect(result.failed).toBe(1);
    });

    it('should preserve insertion order for object task keys', async () => {
      const tasks = {
        first: () =>
          new Promise((resolve) => setTimeout(() => resolve('last'), 100)),
        second: () =>
          new Promise((resolve) => setTimeout(() => resolve('middle'), 50)),
        third: () =>
          new Promise((resolve) => setTimeout(() => resolve('first'), 0)),
      };
      const result = await withConcurrency(tasks, { concurrency: 3 });
      expect(result.results).toEqual({
        first: 'last',
        second: 'middle',
        third: 'first',
      });
    });

    it('should handle object tasks', async () => {
      const task1 = vi.fn().mockResolvedValue('a');
      const task2 = vi.fn().mockResolvedValue('b');
      const task3 = vi.fn().mockResolvedValue('c');
      const result = await withConcurrency({ t1: task1, t2: task2, t3: task3 });
      expect(result.results).toEqual({ t1: 'a', t2: 'b', t3: 'c' });
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('should measure duration', async () => {
      const tasks = [
        () => new Promise((resolve) => setTimeout(resolve, 20)),
        () => new Promise((resolve) => setTimeout(resolve, 30)),
      ];
      const result = await withConcurrency(tasks, { concurrency: 1 });
      expect(result.duration).toBeGreaterThanOrEqual(50);
    });
  });

  describe('concurrency', () => {
    it('should run tasks with default concurrency (Infinity)', async () => {
      const order: number[] = [];
      const tasks = Array.from({ length: 5 }, (_, i) => async () => {
        order.push(i);
        await new Promise((resolve) => setTimeout(resolve, 10));
        return i;
      });
      await withConcurrency(tasks);
      expect(order).toEqual([0, 1, 2, 3, 4]);
    });

    it('should respect concurrency limit', async () => {
      const runningCount = { value: 0 };
      const maxRunning = { value: 0 };
      const tasks = Array.from({ length: 10 }, (_, i) => async () => {
        runningCount.value++;
        maxRunning.value = Math.max(maxRunning.value, runningCount.value);
        await new Promise((resolve) => setTimeout(resolve, 50));
        runningCount.value--;
        return i;
      });
      await withConcurrency(tasks, { concurrency: 3 });
      expect(maxRunning.value).toBe(3);
    });

    it('should run sequentially with concurrency 1', async () => {
      const order: number[] = [];
      const tasks = Array.from({ length: 3 }, (_, i) => async () => {
        order.push(i);
        await new Promise((resolve) => setTimeout(resolve, 50));
        return i;
      });
      await withConcurrency(tasks, { concurrency: 1 });
      expect(order).toEqual([0, 1, 2]);
    });
  });

  describe('timeout', () => {
    it('should timeout after specified duration', async () => {
      const task = vi.fn(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );
      await expect(withConcurrency([task], { timeout: 50 })).rejects.toThrow(
        'Concurrence timed out after 50ms',
      );
    });

    it('should complete before timeout', async () => {
      const task = vi.fn().mockResolvedValue('quick');
      const result = await withConcurrency([task], { timeout: 100 });
      expect(result.results).toEqual(['quick']);
      expect(result.failed).toBe(0);
    });

    it('should stop in-flight tasks on timeout', async () => {
      let completed = 0;
      const tasks = Array.from(
        { length: 5 },
        (_, i) => () =>
          new Promise((resolve) =>
            setTimeout(() => {
              completed++;
              resolve(i);
            }, 100),
          ),
      );
      await expect(
        withConcurrency(tasks, { timeout: 50, concurrency: 5 }),
      ).rejects.toThrow();
      expect(completed).toBeLessThan(5);
    });

    it('should not timeout with Infinity', async () => {
      const task = vi.fn().mockResolvedValue('ok');
      const result = await withConcurrency([task], { timeout: Infinity });
      expect(result.results).toEqual(['ok']);
      expect(result.failed).toBe(0);
    });
  });

  describe('abort signal', () => {
    it('should abort when signal is already aborted', async () => {
      const abortController = new AbortController();
      abortController.abort();
      const task = vi.fn().mockResolvedValue('never');
      await withConcurrency([task], { signal: abortController.signal });
      expect(task).not.toHaveBeenCalled();
    });

    it('should abort during execution', async () => {
      const abortController = new AbortController();
      let started = 0;
      const tasks = Array.from({ length: 10 }, (_, i) => async () => {
        started++;
        if (i === 2) abortController.abort();
        await new Promise((resolve) => setTimeout(resolve, 50));
        return i;
      });
      await withConcurrency(tasks, { signal: abortController.signal });
      expect(started).toBeLessThan(10);
    });

    it('should handle abort during retry delay', async () => {
      const abortController = new AbortController();
      let attempts = 0;
      const task = vi.fn(() => {
        attempts++;
        if (attempts === 1) {
          abortController.abort();
        }
        throw new Error('fail');
      });
      await withConcurrency([task], {
        signal: abortController.signal,
        retry: 2,
        retryDelay: 100,
      });
      expect(attempts).toBeGreaterThanOrEqual(1);
    });
  });

  describe('retry logic', () => {
    it('should retry failed tasks', async () => {
      const task = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      const result = await withConcurrency([task], { retry: 2 });
      expect(task).toHaveBeenCalledTimes(3);
      expect(result.results).toEqual(['success']);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should not retry when retry is 0', async () => {
      const task = vi.fn().mockRejectedValue(new Error('fail'));
      const result = await withConcurrency([task], { retry: 0 });
      expect(task).toHaveBeenCalledTimes(1);
      expect(result.failed).toBe(1);
    });

    it('should exhaust retries and fail', async () => {
      const task = vi.fn().mockRejectedValue(new Error('fail'));
      const result = await withConcurrency([task], { retry: 2 });
      expect(task).toHaveBeenCalledTimes(3);
      expect(result.failed).toBe(1);
      expect(result.errors[0]?.message).toBe('fail');
    });

    it('should delay between retries', async () => {
      const task = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      const startTime = Date.now();
      await withConcurrency([task], { retry: 1, retryDelay: 100 });
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should not delay when retryDelay is 0', async () => {
      const task = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      await withConcurrency([task], { retry: 1, retryDelay: 0 });
      expect(task).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should throw on first error when throwOnFirstError is true', async () => {
      const task1 = vi.fn().mockResolvedValue('ok');
      const task2 = vi.fn().mockRejectedValue(new Error('first error'));
      const task3 = vi.fn().mockResolvedValue('ok');
      await expect(
        withConcurrency([task1, task2, task3], { throwOnFirstError: true }),
      ).rejects.toThrow('first error');
    });

    it('should not throw on first error when throwOnFirstError is false', async () => {
      const task1 = vi.fn().mockResolvedValue('ok');
      const task2 = vi.fn().mockRejectedValue(new Error('error'));
      const task3 = vi.fn().mockResolvedValue('ok');
      const result = await withConcurrency([task1, task2, task3], {
        throwOnFirstError: false,
      });
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should collect all errors when ignoreErrors is false', async () => {
      const task1 = vi.fn().mockRejectedValue(new Error('error1'));
      const task2 = vi.fn().mockRejectedValue(new Error('error2'));
      const task3 = vi.fn().mockRejectedValue(new Error('error3'));
      const result = await withConcurrency([task1, task2, task3]);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0]?.message).toBe('error1');
      expect(result.errors[1]?.message).toBe('error2');
      expect(result.errors[2]?.message).toBe('error3');
    });

    it('should continue on errors when ignoreErrors is true', async () => {
      const task1 = vi.fn().mockRejectedValue(new Error('error'));
      const task2 = vi.fn().mockResolvedValue('ok');
      const result = await withConcurrency([task1, task2], {
        ignoreErrors: true,
      });
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(task2).toHaveBeenCalled();
    });

    it('should handle non-Error throws', async () => {
      const task = vi.fn().mockRejectedValue('string error');
      const result = await withConcurrency([task]);
      expect(result.errors[0]).toBeInstanceOf(Error);
      expect(result.errors[0]?.message).toBe('string error');
    });

    it('should handle null throws', async () => {
      const task = vi.fn().mockRejectedValue(null);
      const result = await withConcurrency([task]);
      expect(result.errors[0]).toBeInstanceOf(Error);
      expect(result.errors[0]?.message).toBe('null');
    });

    it('should throw on first error even when retrying', async () => {
      const task = vi.fn().mockRejectedValue(new Error('error'));
      await expect(
        withConcurrency([task], { retry: 2, throwOnFirstError: true }),
      ).rejects.toThrow('error');
    });
  });

  describe('result structure', () => {
    it('should return correct counts for mixed success/failure', async () => {
      const tasks = [
        vi.fn().mockResolvedValue('ok'),
        vi.fn().mockRejectedValue(new Error('fail')),
        vi.fn().mockResolvedValue('ok'),
        vi.fn().mockRejectedValue(new Error('fail')),
        vi.fn().mockResolvedValue('ok'),
      ];
      const result = await withConcurrency(tasks);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(2);
      expect(result.results).toEqual(['ok', 'ok', 'ok']);
      expect(result.errors).toHaveLength(2);
    });

    it('should maintain order for successful results in array', async () => {
      const tasks = [
        () => new Promise((resolve) => setTimeout(() => resolve('a'), 50)),
        vi.fn().mockRejectedValue(new Error('fail')),
        () => new Promise((resolve) => setTimeout(() => resolve('b'), 0)),
        vi.fn().mockRejectedValue(new Error('fail')),
        () => new Promise((resolve) => setTimeout(() => resolve('c'), 25)),
      ];
      const result = await withConcurrency(tasks);
      expect(result.results).toEqual(['a', 'b', 'c']);
    });

    it('should return object results with correct keys', async () => {
      const tasks = {
        a: vi.fn().mockResolvedValue('a'),
        b: vi.fn().mockRejectedValue(new Error('fail')),
        c: vi.fn().mockResolvedValue('c'),
      };
      const result = await withConcurrency(tasks);
      expect(result.results).toEqual({ a: 'a', c: 'c' });
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle tasks returning different types', async () => {
      const tasks = [
        vi.fn().mockResolvedValue(1),
        vi.fn().mockResolvedValue('string'),
        vi.fn().mockResolvedValue({ key: 'value' }),
        vi.fn().mockResolvedValue(true),
        vi.fn().mockResolvedValue(null),
      ];
      const result = await withConcurrency(tasks);
      expect(result.results).toEqual([
        1,
        'string',
        { key: 'value' },
        true,
        null,
      ]);
      expect(result.succeeded).toBe(5);
    });

    it('should handle tasks with varying completion times', async () => {
      const tasks = [
        () => new Promise((resolve) => setTimeout(() => resolve(3), 30)),
        () => new Promise((resolve) => setTimeout(() => resolve(1), 10)),
        () => new Promise((resolve) => setTimeout(() => resolve(2), 20)),
      ];
      const result = await withConcurrency(tasks);
      expect(result.results).toEqual([3, 1, 2]);
    });

    it('should handle large number of tasks', async () => {
      const tasks = Array.from({ length: 100 }, (_, i) =>
        vi.fn().mockResolvedValue(i),
      );
      const result = await withConcurrency(tasks, { concurrency: 10 });
      expect(result.results).toHaveLength(100);
      expect(result.succeeded).toBe(100);
      expect(result.failed).toBe(0);
    });

    it('should handle concurrent tasks with different retry counts', async () => {
      const task1 = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success1');
      const task2 = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success2');
      const task3 = vi.fn().mockResolvedValue('success3');
      const result = await withConcurrency([task1, task2, task3], { retry: 2 });
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
    });
  });

  describe('combined options', () => {
    it('should handle concurrency + retry', async () => {
      const runningCount = { value: 0 };
      const maxRunning = { value: 0 };
      const tasks = Array.from({ length: 6 }, (_, i) => () => {
        runningCount.value++;
        maxRunning.value = Math.max(maxRunning.value, runningCount.value);
        return new Promise<number>((resolve, reject) => {
          setTimeout(() => {
            runningCount.value--;
            if (i % 2 === 0) reject(new Error('fail'));
            else resolve(i);
          }, 50);
        });
      });
      const result = await withConcurrency(tasks, { concurrency: 2, retry: 1 });
      expect(maxRunning.value).toBe(2);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(3);
    });

    it('should handle timeout + abort', async () => {
      const abortController = new AbortController();
      const tasks = Array.from(
        { length: 5 },
        (_, i) => () =>
          new Promise((resolve) => setTimeout(() => resolve(i), 100)),
      );
      setTimeout(() => abortController.abort(), 50);
      await expect(
        withConcurrency(tasks, {
          timeout: 200,
          signal: abortController.signal,
          concurrency: 3,
        }),
      ).rejects.toThrow();
    });

    it('should handle all options together', async () => {
      const abortController = new AbortController();
      setTimeout(() => abortController.abort(), 150);

      const tasks = [
        vi.fn().mockResolvedValue('ok1'),
        vi
          .fn()
          .mockRejectedValueOnce(new Error('fail1'))
          .mockResolvedValue('ok2'),
        vi.fn().mockRejectedValue(new Error('fail2')),
        vi.fn().mockResolvedValue('ok3'),
      ];

      const result = await withConcurrency(tasks, {
        concurrency: 2,
        timeout: 300,
        signal: abortController.signal,
        retry: 1,
        retryDelay: 10,
        throwOnFirstError: false,
        ignoreErrors: false,
      });

      expect(result.succeeded).toBeGreaterThan(0);
      expect(result.failed).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle throwOnFirstError + ignoreErrors (ignoreErrors takes precedence)', async () => {
      const task1 = vi.fn().mockRejectedValue(new Error('error1'));
      const task2 = vi.fn().mockResolvedValue('ok');
      const result = await withConcurrency([task1, task2], {
        throwOnFirstError: true,
        ignoreErrors: true,
      });
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results).toEqual(['ok']);
    });
  });

  describe('default options', () => {
    it('should use default options when none provided', async () => {
      const task = vi.fn().mockResolvedValue('ok');
      const result = await withConcurrency([task]);
      expect(result.results).toEqual(['ok']);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
    });
  });

  describe('real-world scenarios', () => {
    it('should simulate API requests with retry and concurrency', async () => {
      let requestCount = 0;
      const apiCall = vi.fn(() => {
        requestCount++;
        if (requestCount <= 2) {
          return Promise.reject(new Error('network error'));
        }
        return Promise.resolve({ data: 'success' });
      });

      const result = await withConcurrency([apiCall], {
        retry: 3,
        retryDelay: 10,
      });

      expect(apiCall).toHaveBeenCalledTimes(3);
      expect(result.results[0]).toEqual({ data: 'success' });
      expect(result.succeeded).toBe(1);
    });

    it('should simulate batch processing with concurrency limit', async () => {
      const items = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        value: `item-${i}`,
      }));
      const processed: number[] = [];
      const maxConcurrent = { value: 0 };
      let currentConcurrent = 0;

      const processor = async (item: { id: number; value: string }) => {
        currentConcurrent++;
        maxConcurrent.value = Math.max(maxConcurrent.value, currentConcurrent);
        await new Promise((resolve) => setTimeout(resolve, 10));
        processed.push(item.id);
        currentConcurrent--;
        return item.value;
      };

      const tasks = items.map((item) => () => processor(item));
      const result = await withConcurrency(tasks, { concurrency: 5 });

      expect(maxConcurrent.value).toBe(5);
      expect(result.results).toHaveLength(20);
      expect(result.succeeded).toBe(20);
    });

    it('should simulate parallel data fetching with fallback', async () => {
      const sources = [
        {
          name: 'primary',
          fn: vi.fn().mockRejectedValue(new Error('timeout')),
        },
        { name: 'secondary', fn: vi.fn().mockResolvedValue('data') },
        {
          name: 'tertiary',
          fn: vi.fn().mockRejectedValue(new Error('unavailable')),
        },
      ];

      const tasks = sources.map((s) => () => s.fn());
      const result = await withConcurrency(tasks, { ignoreErrors: false });

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.results).toEqual(['data']);
    });
  });

  describe('type safety', () => {
    it('should handle typed array tasks', async () => {
      const tasks: (() => Promise<number>)[] = [
        () => Promise.resolve(1),
        () => Promise.resolve(2),
        () => Promise.resolve(3),
      ];
      const result = await withConcurrency(tasks);
      expect(result.results).toEqual([1, 2, 3]);
    });

    it('should handle typed object tasks', async () => {
      const tasks: Record<string, () => Promise<string>> = {
        a: () => Promise.resolve('a'),
        b: () => Promise.resolve('b'),
        c: () => Promise.resolve('c'),
      };
      const result = await withConcurrency(tasks);
      expect(result.results).toEqual({ a: 'a', b: 'b', c: 'c' });
    });
  });
});
