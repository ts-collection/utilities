import type { MaybeFunction } from '../types';

/**
 * Converts various case styles (camelCase, PascalCase, kebab-case, snake_case) into readable normal case.
 *
 * Transforms technical naming conventions into human-readable titles by:
 * - Adding spaces between words
 * - Capitalizing the first letter of each word
 * - Handling common separators (-, _, camelCase boundaries)
 *
 * @param inputString - The string to convert (supports camelCase, PascalCase, kebab-case, snake_case).
 * @returns The converted string in normal case (title case).
 *
 * @example
 * ```ts
 * convertToNormalCase('camelCase') // 'Camel Case'
 * convertToNormalCase('kebab-case') // 'Kebab Case'
 * convertToNormalCase('snake_case') // 'Snake Case'
 * convertToNormalCase('PascalCase') // 'Pascal Case'
 * ```
 */
export function convertToNormalCase(inputString: string) {
  const splittedString = inputString.split('.').pop();
  const string = splittedString || inputString;
  const words = string.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[-_|�\s]+/);
  const capitalizedWords = words.map(
    (word) => word.charAt(0).toUpperCase() + word.slice(1),
  );
  return capitalizedWords.join(' ');
}

const from = 'àáãäâèéëêìíïîòóöôùúüûñç·/_,:;';
const to = 'aaaaaeeeeiiiioooouuuunc------';

/**
 * Converts a string to a URL-friendly slug by trimming, converting to lowercase,
 * replacing diacritics, removing invalid characters, and replacing spaces with hyphens.
 * @param {string} [str] - The input string to convert.
 * @returns {string} The generated slug.
 * @example
 * convertToSlug("Hello World!"); // "hello-world"
 * convertToSlug("Déjà Vu"); // "deja-vu"
 */
export const convertToSlug = (str: string): string => {
  if (typeof str !== 'string') {
    throw new TypeError('Input must be a string');
  }

  // Trim the string and convert it to lowercase.
  let slug = str.trim().toLowerCase();

  // Build a mapping of accented characters to their non-accented equivalents.
  const charMap: Record<string, string> = {};
  for (let i = 0; i < from.length; i++) {
    charMap[from.charAt(i)] = to.charAt(i);
  }

  // Replace all accented characters using the mapping.
  slug = slug.replace(
    new RegExp(`[${from}]`, 'g'),
    (match) => charMap[match] || match,
  );

  return (
    slug
      .replace(/[^a-z0-9 -]/g, '') // Remove invalid characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse consecutive hyphens
      .replace(/^-+/, '') // Remove leading hyphens
      .replace(/-+$/, '') || // Remove trailing hyphens
    ''
  );
};

/**
 * Pauses execution for the specified time.
 *
 * `signal` allows cancelling the sleep via AbortSignal.
 *
 * @param time - Time in milliseconds to sleep (default is 1000ms)
 * @param signal - Optional AbortSignal to cancel the sleep early
 * @returns - A Promise that resolves after the specified time or when aborted
 */
export const sleep = (time = 1000, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();

    const id = setTimeout(() => {
      cleanup();
      resolve();
    }, time);

    function onAbort() {
      clearTimeout(id);
      cleanup();
      resolve();
    }

    function cleanup() {
      signal?.removeEventListener('abort', onAbort);
    }

    // only add listener if a signal was supplied
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });

type DebouncedFunction<F extends (...args: any[]) => any> = {
  (...args: Parameters<F>): ReturnType<F> | undefined;
  readonly isPending: boolean;
};

/**
 * Creates a debounced function that delays invoking the provided function until
 * after the specified `wait` time has elapsed since the last invocation.
 *
 * If the `immediate` option is set to `true`, the function will be invoked immediately
 * on the leading edge of the wait interval. Subsequent calls during the wait interval
 * will reset the timer but not invoke the function until the interval elapses again.
 *
 * The returned function includes the `isPending` property to check if the debounce
 * timer is currently active.
 *
 * @typeParam F - The type of the function to debounce.
 *
 * @param function_ - The function to debounce.
 * @param wait - The number of milliseconds to delay (default is 100ms).
 * @param options - An optional object with the following properties:
 *   - `immediate` (boolean): If `true`, invokes the function on the leading edge
 *     of the wait interval instead of the trailing edge.
 *
 * @returns A debounced version of the provided function, enhanced with the `isPending` property.
 *
 * @throws {TypeError} If the first parameter is not a function.
 * @throws {RangeError} If the `wait` parameter is negative.
 *
 * @example
 * ```ts
 * // Basic debouncing
 * const log = debounce((message: string) => console.log(message), 200);
 * log('Hello'); // Logs "Hello" after 200ms if no other call is made.
 * console.log(log.isPending); // true if the timer is active.
 *
 * // Immediate execution
 * const save = debounce(() => saveToServer(), 500, { immediate: true });
 * save(); // Executes immediately, then waits 500ms for subsequent calls
 *
 * // Check pending state
 * const debouncedSearch = debounce(searchAPI, 300);
 * debouncedSearch('query');
 * if (debouncedSearch.isPending) {
 *   showLoadingIndicator();
 * }
 * ```
 */
export function debounce<F extends (...args: any[]) => any>(
  function_: F,
  wait = 100,
  options?: { immediate: boolean },
): DebouncedFunction<F> {
  if (typeof function_ !== 'function') {
    throw new TypeError(
      `Expected the first parameter to be a function, got \`${typeof function_}\`.`,
    );
  }

  if (wait < 0) {
    throw new RangeError('`wait` must not be negative.');
  }

  const immediate = options?.immediate ?? false;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Parameters<F> | undefined;
  let lastContext: ThisParameterType<F> | undefined;
  let result: ReturnType<F> | undefined;

  function run(this: ThisParameterType<F>): ReturnType<F> | undefined {
    result = function_.apply(lastContext, lastArgs!);
    lastArgs = undefined;
    lastContext = undefined;
    return result;
  }

  const debounced = function (
    this: ThisParameterType<F>,
    ...args: Parameters<F>
  ): ReturnType<F> | undefined {
    lastArgs = args;
    lastContext = this;

    if (timeoutId === undefined && immediate) {
      result = run.call(this);
    }

    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(run.bind(this), wait);
    return result;
  } as DebouncedFunction<F>;

  Object.defineProperty(debounced, 'isPending', {
    get() {
      return timeoutId !== undefined;
    },
  });

  return debounced;
}

type ThrottledFunction<F extends (...args: any[]) => any> = {
  (...args: Parameters<F>): ReturnType<F> | undefined;
  readonly isPending: boolean;
};

/**
 * Creates a throttled function that invokes the provided function at most once
 * every `wait` milliseconds.
 *
 * If the `leading` option is set to `true`, the function will be invoked immediately
 * on the leading edge of the throttle interval. If the `trailing` option is set to `true`,
 * the function will also be invoked at the end of the throttle interval if additional
 * calls were made during the interval.
 *
 * The returned function includes the `isPending` property to check if the throttle
 * timer is currently active.
 *
 * @typeParam F - The type of the function to throttle.
 *
 * @param function_ - The function to throttle.
 * @param wait - The number of milliseconds to wait between invocations (default is 100ms).
 * @param options - An optional object with the following properties:
 *   - `leading` (boolean): If `true`, invokes the function on the leading edge of the interval.
 *   - `trailing` (boolean): If `true`, invokes the function on the trailing edge of the interval.
 *
 * @returns A throttled version of the provided function, enhanced with the `isPending` property.
 *
 * @throws {TypeError} If the first parameter is not a function.
 * @throws {RangeError} If the `wait` parameter is negative.
 *
 * @example
 * ```ts
 * // Basic throttling (leading edge by default)
 * const log = throttle((message: string) => console.log(message), 200);
 * log('Hello'); // Logs "Hello" immediately
 * log('World'); // Ignored for 200ms
 * console.log(log.isPending); // true if within throttle window
 *
 * // Trailing edge only
 * const trailingLog = throttle(() => console.log('trailing'), 200, {
 *   leading: false,
 *   trailing: true
 * });
 * trailingLog(); // No immediate execution
 * // After 200ms: logs "trailing"
 *
 * // Both edges
 * const bothLog = throttle(() => console.log('both'), 200, {
 *   leading: true,
 *   trailing: true
 * });
 * bothLog(); // Immediate execution
 * // After 200ms: executes again if called during window
 * ```
 */
export function throttle<F extends (...args: any[]) => any>(
  function_: F,
  wait = 100,
  options?: { leading?: boolean; trailing?: boolean },
): ThrottledFunction<F> {
  if (typeof function_ !== 'function') {
    throw new TypeError(
      `Expected the first parameter to be a function, got \`${typeof function_}\`.`,
    );
  }

  if (wait < 0) {
    throw new RangeError('`wait` must not be negative.');
  }

  const leading = options?.leading ?? true;
  const trailing = options?.trailing ?? true;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Parameters<F> | undefined;
  let lastContext: ThisParameterType<F> | undefined;
  let lastCallTime: number | undefined;
  let result: ReturnType<F> | undefined;

  function invoke() {
    lastCallTime = Date.now();
    result = function_.apply(lastContext, lastArgs!);
    lastArgs = undefined;
    lastContext = undefined;
  }

  function later() {
    timeoutId = undefined;
    if (trailing && lastArgs) {
      invoke();
    }
  }

  const throttled = function (
    this: ThisParameterType<F>,
    ...args: Parameters<F>
  ): ReturnType<F> | undefined {
    const now = Date.now();
    const timeSinceLastCall = lastCallTime
      ? now - lastCallTime
      : Number.POSITIVE_INFINITY;

    lastArgs = args;
    lastContext = this;

    if (timeSinceLastCall >= wait) {
      if (leading) {
        invoke();
      } else {
        timeoutId = setTimeout(later, wait);
      }
    } else if (!timeoutId && trailing) {
      timeoutId = setTimeout(later, wait - timeSinceLastCall);
    }

    return result;
  } as ThrottledFunction<F>;

  Object.defineProperty(throttled, 'isPending', {
    get() {
      return timeoutId !== undefined;
    },
  });

  return throttled;
}

/**
 * Formats a string by replacing each '%s' placeholder with the corresponding argument.
 *
 * Mimics the basic behavior of C's printf for %s substitution. Supports both
 * variadic arguments and array-based argument passing. Extra placeholders
 * are left as-is, missing arguments result in empty strings.
 *
 * @param format - The format string containing '%s' placeholders.
 * @param args - The values to substitute, either as separate arguments or a single array.
 * @returns The formatted string with placeholders replaced by arguments.
 *
 * @example
 * ```ts
 * // Basic usage with separate arguments
 * printf("%s love %s", "I", "Bangladesh") // "I love Bangladesh"
 *
 * // Using array of arguments
 * printf("%s love %s", ["I", "Bangladesh"]) // "I love Bangladesh"
 *
 * // Extra placeholders remain unchanged
 * printf("%s %s %s", "Hello", "World") // "Hello World %s"
 *
 * // Missing arguments become empty strings
 * printf("%s and %s", "this") // "this and "
 *
 * // Multiple occurrences
 * printf("%s %s %s", "repeat", "repeat", "repeat") // "repeat repeat repeat"
 * ```
 */
export function printf(format: string, ...args: unknown[]): string {
  const replacements: unknown[] =
    args.length === 1 && Array.isArray(args[0]) ? (args[0] as unknown[]) : args;

  let idx = 0;
  return format.replace(/%s/g, () => {
    const arg = replacements[idx++];
    return arg === undefined ? '' : String(arg);
  });
}

/**
 * Escapes a string for use in a regular expression.
 *
 * @param str - The string to escape
 * @returns - The escaped string safe for use in RegExp constructor
 *
 * @example
 * ```ts
 * const escapedString = escapeRegExp('Hello, world!');
 * // escapedString === 'Hello\\, world!'
 *
 * const regex = new RegExp(escapeRegExp(userInput));
 * ```
 */

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizes a string by:
 * - Applying Unicode normalization (NFC)
 * - Optionally removing diacritic marks (accents)
 * - Optionally trimming leading/trailing non-alphanumeric characters
 * - Optionally converting to lowercase
 *
 * @param str - The string to normalize
 * @param options - Normalization options
 * @param options.lowercase - Whether to convert the result to lowercase (default: true)
 * @param options.removeAccents - Whether to remove diacritic marks like accents (default: true)
 * @param options.removeNonAlphanumeric - Whether to trim non-alphanumeric characters from the edges (default: true)
 * @returns The normalized string
 *
 * @example
 * ```ts
 * normalizeText('Café') // 'cafe'
 * normalizeText('  Hello!  ') // 'hello'
 * normalizeText('José', { removeAccents: false }) // 'josé'
 * ```
 */
export function normalizeText(
  str?: string | null,
  options: {
    lowercase?: boolean;
    removeAccents?: boolean;
    removeNonAlphanumeric?: boolean;
  } = {},
): string {
  if (!str) return '';

  const {
    lowercase = true,
    removeAccents = true,
    removeNonAlphanumeric = true,
  } = options;

  let result = str.normalize('NFC');

  if (removeAccents) {
    result = result.normalize('NFD').replace(/\p{M}/gu, ''); // decompose and remove accents
  }

  if (removeNonAlphanumeric) {
    result = result.replace(/^[^\p{L}\p{N}]*|[^\p{L}\p{N}]*$/gu, ''); // trim edges
  }

  if (lowercase) {
    result = result.toLocaleLowerCase();
  }

  return result;
}

/**
 * Unwraps a value that may be either a direct value or a function that returns that value.
 *
 * If the value is a function, it will be called with the provided arguments and its return
 * value will be returned. If the value is not a function, it will be returned as-is.
 *
 * This is useful for handling configuration options that can be either static values
 * or computed values based on context.
 *
 * @typeParam T - The type of the value
 * @typeParam A - The tuple type of arguments the function accepts (defaults to empty array)
 *
 * @param value - Either a direct value or a function that returns the value
 * @param args - Arguments to pass if the value is a function
 * @returns The unwrapped value
 *
 * @example
 * ```ts
 * // Direct value
 * const direct = unwrap('hello'); // 'hello'
 *
 * // Function value
 * const computed = unwrap((name: string) => `Hello, ${name}`, 'World'); // 'Hello, World'
 *
 * // No arguments needed
 * const lazy = unwrap(() => expensiveComputation()); // result of expensiveComputation()
 * ```
 */
export function unwrap<T, A extends unknown[] = []>(
  value: MaybeFunction<T, A>,
  ...args: A
): T {
  return typeof value === 'function'
    ? (value as (...args: A) => T)(...args)
    : value;
}
