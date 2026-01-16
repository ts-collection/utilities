import type { NestedKeyOf } from '../types';

/**
 * Type representing a path split into segments
 * @template P - The original path string type
 */
type SplitPath<P extends string> = P extends `${infer First}.${infer Rest}`
  ? [First, ...SplitPath<Rest>]
  : [P];

/**
 * Recursive type to resolve nested object types based on path
 * @template T - Current object type
 * @template K - Array of path segments
 */
type GetValue<T, K extends Array<string | number>> = K extends [
  infer First,
  ...infer Rest,
]
  ? First extends keyof T
    ? GetValue<T[First], Rest extends Array<string | number> ? Rest : []>
    : First extends `${number}`
      ? T extends any[]
        ? GetValue<T[number], Rest extends Array<string | number> ? Rest : []>
        : undefined
      : undefined
  : T;

/**
 * Get a nested value from an object using dot notation path
 * @template T - Object type
 * @template P - Valid path string type constrained by object structure
 * @template D - Default value type
 * @param obj - Source object
 * @param path - Dot-separated path string (constrained to valid paths)
 * @param defaultValue - Fallback value if path not found
 * @returns Value at path or default value
 *
 * @example
 * // use as const for better type safety for arrays
 * extract({a: [{b: 1}]} as const, 'a.0.b', 2) // 1
 * extract({a: {b: 1}}, 'a.b', 2) // 1
 */
export function extract<const T extends object, P extends NestedKeyOf<T>, D>(
  obj: T,
  path: P,
  defaultValue: D,
): Exclude<GetValue<T, SplitPath<P>>, undefined> | D;

/**
 * Get a nested value from an object using dot notation path
 * @template T - Object type
 * @template P - Valid path string type constrained by object structure
 * @param obj - Source object
 * @param path - Dot-separated path string (constrained to valid paths)
 * @returns Value at path or undefined
 *
 * @example
 * extract({a: [{b: 1}]}, 'a.0.b') // 1
 */
export function extract<const T extends object, P extends NestedKeyOf<T>>(
  obj: T,
  path: P,
): GetValue<T, SplitPath<P>> | undefined;

/**
 * Get multiple nested values from an object using dot notation paths
 * @template T - Object type
 * @template P - Array of path strings
 * @template D - Default value type
 * @param obj - Source object
 * @param paths - Array of dot-separated path strings
 * @param defaultValue - Fallback value if any path not found
 * @returns Array of values at paths or default values
 *
 * @example
 * extract({a: [{b: 1}, {b: 2}]}, ['a.0.b', 'a.1.b'], 0) // [1, 2]
 */
export function extract<
  const T extends object,
  const P extends readonly string[],
  D,
>(
  obj: T,
  paths: P,
  defaultValue: D,
): { readonly [K in keyof P]: GetValue<T, SplitPath<P[K]>> | D };

/**
 * Get multiple nested values from an object using dot notation paths
 * @template T - Object type
 * @template P - Array of path strings
 * @param obj - Source object
 * @param paths - Array of dot-separated path strings
 * @returns Array of values at paths or undefined
 *
 * @example
 * extract({a: [{b: 1}, {b: 2}]}, ['a.0.b', 'a.1.b']) // [1, 2]
 */
export function extract<
  const T extends object,
  const P extends readonly string[],
>(
  obj: T,
  paths: P,
): {
  readonly [K in keyof P]: GetValue<T, SplitPath<P[K]>> | undefined;
};

/**
 * Get multiple nested values from an object using dot notation paths mapped to keys
 * @template T - Object type
 * @template P - Record mapping keys to path strings
 * @template D - Default value type
 * @param obj - Source object
 * @param paths - Record with keys as output keys and values as dot-separated path strings
 * @param defaultValue - Fallback value if any path not found
 * @returns Object with the same keys as paths, values at paths or default values
 *
 * @example
 * extract({a: [{b: 1}, {b: 2}]}, {first: 'a.0.b', second: 'a.1.b'}, 0) // {first: 1, second: 2}
 */
export function extract<
  const T extends object,
  const P extends Record<string, string>,
  D,
>(
  obj: T,
  paths: P,
  defaultValue: D,
): { readonly [K in keyof P]: GetValue<T, SplitPath<P[K]>> | D };

/**
 * Get multiple nested values from an object using dot notation paths mapped to keys
 * @template T - Object type
 * @template P - Record mapping keys to path strings
 * @param obj - Source object
 * @param paths - Record with keys as output keys and values as dot-separated path strings
 * @returns Object with the same keys as paths, values at paths or undefined
 *
 * @example
 * extract({a: [{b: 1}, {b: 2}]}, {first: 'a.0.b', second: 'a.1.b'}) // {first: 1, second: 2}
 */
export function extract<
  const T extends object,
  const P extends Record<string, string>,
>(
  obj: T,
  paths: P,
): { readonly [K in keyof P]: GetValue<T, SplitPath<P[K]>> | undefined };

/**
 * Core implementation of extract with runtime type checking.
 *
 * Handles dot-notation strings and arrays of strings with support for nested objects and arrays.
 * Performs validation and safe navigation to prevent runtime errors.
 *
 * @param obj - The source object to traverse
 * @param path - Path as dot-separated string, array of such strings, or record mapping keys to paths
 * @param defaultValue - Value to return if path doesn't exist
 * @returns The value at the specified path(s), or defaultValue if not found
 *
 * @example
 * ```ts
 * extract({ a: { b: 1 } }, 'a.b') // 1
 * extract({ a: [{ b: 1 }] }, 'a.0.b') // 1
 * extract({}, 'missing.path', 'default') // 'default'
 * extract({ a: [{ b: 1 }, { b: 2 }] }, ['a.0.b', 'a.1.b']) // [1, 2]
 * extract({ a: [{ b: 1 }, { b: 2 }] }, { first: 'a.0.b', second: 'a.1.b' }) // { first: 1, second: 2 }
 * ```
 */
export function extract(
  obj: any,
  path: string | string[] | Record<string, string>,
  defaultValue?: any,
): any {
  // Handle array of paths
  if (Array.isArray(path)) {
    return path.map((p) => extract(obj, p, defaultValue));
  }

  // Handle object mapping keys to paths
  if (typeof path === 'object' && path !== null && !Array.isArray(path)) {
    const result: any = {};
    for (const key in path) {
      if (path.hasOwnProperty(key)) {
        result[key] = extract(obj, path[key] as string, defaultValue);
      }
    }
    return result;
  }

  // Validate path type and handle edge cases
  if (typeof path !== 'string') {
    return defaultValue;
  }

  // Ensure pathArray is always an array
  const pathArray = (() => {
    if (path === '') return [];
    return path.split('.').filter((segment) => segment !== '');
  })();

  let current = obj;

  for (const key of pathArray) {
    if (current === null || current === undefined) {
      return defaultValue;
    }

    // Convert numeric strings to numbers for arrays
    const actualKey =
      typeof key === 'string' && Array.isArray(current) && /^\d+$/.test(key)
        ? Number.parseInt(key, 10)
        : key;

    current = current[actualKey as keyof typeof current];
  }

  return current !== undefined ? current : defaultValue;
}
