import { describe, expect, it, vi } from 'vitest';
import {
  convertToNormalCase,
  convertToSlug,
  debounce,
  escapeRegExp,
  normalizeText,
  printf,
  sleep,
  throttle,
  unwrap,
} from '../../src/functions/utils-core';

describe('convertToNormalCase', () => {
  it('should convert various cases to normal case', () => {
    expect(convertToNormalCase('helloWorld')).toBe('Hello World');
    expect(convertToNormalCase('hello_world')).toBe('Hello World');
    expect(convertToNormalCase('hello-world')).toBe('Hello World');
  });
});

describe('convertToSlug', () => {
  it('should convert strings to URL slugs', () => {
    expect(convertToSlug('Hello World!')).toBe('hello-world');
    expect(convertToSlug('Déjà Vu')).toBe('deja-vu');
  });
});

describe('sleep', () => {
  it('should sleep for specified time', async () => {
    const start = Date.now();
    await sleep(10);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(8);
  });

  it('should be cancellable with AbortSignal', async () => {
    const controller = new AbortController();
    const start = Date.now();

    setTimeout(() => controller.abort(), 5);

    await sleep(50, controller.signal);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(40);
  });
});

describe('debounce', () => {
  it('should debounce function calls', async () => {
    const mockFn = vi.fn();
    const debounced = debounce(mockFn, 10);

    debounced();
    debounced();
    debounced();

    await sleep(15);

    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  it('should throttle function calls', async () => {
    const mockFn = vi.fn();
    const throttled = throttle(mockFn, 10);

    throttled();
    throttled();
    throttled();

    await sleep(15);

    expect(mockFn).toHaveBeenCalledTimes(2); // leading + trailing
  });

  it('should respect isPending property', () => {
    const mockFn = vi.fn();
    const throttled = throttle(mockFn, 50);

    throttled();
    expect(throttled.isPending).toBe(false); // not pending immediately after call

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(throttled.isPending).toBe(false);
        resolve();
      }, 60);
    });
  });
});

describe('printf', () => {
  it('should format strings with placeholders', () => {
    expect(printf('%s love %s', 'I', 'Bangladesh')).toBe('I love Bangladesh');
    expect(printf('%s %s', 'Hello', 'World')).toBe('Hello World');
  });
});

describe('escapeRegExp', () => {
  it('should escape special regex characters', () => {
    expect(escapeRegExp('a.b')).toBe('a\\.b');
  });
});

describe('normalizeText', () => {
  it('should normalize text', () => {
    expect(normalizeText('Café')).toBe('cafe');
    expect(normalizeText('  Hello!  ')).toBe('hello');
  });
});

describe('unwrap', () => {
  it('should return direct value as-is', () => {
    expect(unwrap('hello')).toBe('hello');
    expect(unwrap(42)).toBe(42);
    expect(unwrap(null)).toBe(null);
    expect(unwrap({ key: 'value' })).toEqual({ key: 'value' });
  });

  it('should call function and return result', () => {
    expect(unwrap(() => 'hello')).toBe('hello');
    expect(unwrap((name: string) => `Hello, ${name}`, 'World')).toBe(
      'Hello, World',
    );
    expect(unwrap((a: number, b: number) => a + b, 2, 3)).toBe(5);
  });

  it('should handle functions with multiple arguments', () => {
    const concat = (a: string, b: string, c: string) => `${a}-${b}-${c}`;
    expect(unwrap(concat, 'x', 'y', 'z')).toBe('x-y-z');
  });

  it('should handle functions that return objects', () => {
    const createObject = (id: number) => ({ id, name: `Item ${id}` });
    expect(unwrap(createObject, 1)).toEqual({ id: 1, name: 'Item 1' });
  });
});
