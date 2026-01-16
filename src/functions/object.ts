import type { NestedKeyOf } from '../types';

/**
 * Type representing a path split into segments
 * @template S - The original path string type
 */
type SplitPath<S extends string> = S extends `${infer First}.${infer Rest}`
  ? [First, ...SplitPath<Rest>]
  : [S];

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
 * @template S - Valid path string type constrained by object structure
 * @template D - Default value type
 * @param obj - Source object
 * @param path - Dot-separated path string (constrained to valid paths)
 * @param defaultValue - Fallback value if path not found
 * @returns Value at path or default value
 *
 * @example
 * // use as const for better type safety for arrays
 * getObjectValue({a: [{b: 1}]} as const, 'a.0.b', 2) // 1
 * getObjectValue({a: {b: 1}}, 'a.b', 2) // 1
 */
export function getObjectValue<
  const T extends object,
  S extends NestedKeyOf<T>,
  D,
>(
  obj: T,
  path: S,
  defaultValue: D,
): Exclude<GetValue<T, SplitPath<S>>, undefined> | D;

/**
 * Get a nested value from an object using dot notation path
 * @template T - Object type
 * @template S - Valid path string type constrained by object structure
 * @param obj - Source object
 * @param path - Dot-separated path string (constrained to valid paths)
 * @returns Value at path or undefined
 *
 * @example
 * getObjectValue({a: [{b: 1}]}, 'a.0.b') // 1
 */
export function getObjectValue<
  const T extends object,
  S extends NestedKeyOf<T>,
>(obj: T, path: S): GetValue<T, SplitPath<S>> | undefined;

/**
 * Get multiple nested values from an object using dot notation paths
 * @template T - Object type
 * @template S - Array of path strings
 * @template D - Default value type
 * @param obj - Source object
 * @param paths - Array of dot-separated path strings
 * @param defaultValue - Fallback value if any path not found
 * @returns Array of values at paths or default values
 *
 * @example
 * getObjectValue({a: [{b: 1}, {b: 2}]}, ['a.0.b', 'a.1.b'], 0) // [1, 2]
 */
export function getObjectValue<
  const T extends object,
  const S extends readonly string[],
  D,
>(
  obj: T,
  paths: S,
  defaultValue: D,
): { readonly [K in keyof S]: GetValue<T, SplitPath<S[K] & string>> | D };

/**
 * Get multiple nested values from an object using dot notation paths
 * @template T - Object type
 * @template S - Array of path strings
 * @param obj - Source object
 * @param paths - Array of dot-separated path strings
 * @returns Array of values at paths or undefined
 *
 * @example
 * getObjectValue({a: [{b: 1}, {b: 2}]}, ['a.0.b', 'a.1.b']) // [1, 2]
 */
export function getObjectValue<
  const T extends object,
  const S extends readonly string[],
>(
  obj: T,
  paths: S,
): {
  readonly [K in keyof S]: GetValue<T, SplitPath<S[K] & string>> | undefined;
};

/**
 * Core implementation of getObjectValue with runtime type checking.
 *
 * Handles dot-notation strings and arrays of strings with support for nested objects and arrays.
 * Performs validation and safe navigation to prevent runtime errors.
 *
 * @param obj - The source object to traverse
 * @param path - Path as dot-separated string or array of such strings
 * @param defaultValue - Value to return if path doesn't exist
 * @returns The value at the specified path(s), or defaultValue if not found
 *
 * @example
 * ```ts
 * getObjectValue({ a: { b: 1 } }, 'a.b') // 1
 * getObjectValue({ a: [{ b: 1 }] }, 'a.0.b') // 1
 * getObjectValue({}, 'missing.path', 'default') // 'default'
 * getObjectValue({ a: [{ b: 1 }, { b: 2 }] }, ['a.0.b', 'a.1.b']) // [1, 2]
 * ```
 */
export function getObjectValue(
  obj: any,
  path: string | string[],
  defaultValue?: any,
): any {
  // Handle array of paths
  if (Array.isArray(path)) {
    return path.map((p) => getObjectValue(obj, p, defaultValue));
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

/**
 * Extend an object or function with additional properties while
 * preserving the original type information.
 *
 * Works with both plain objects and callable functions since
 * functions in JavaScript are objects too. Also handles nullable types.
 *
 * @template T The base object or function type (can be null/undefined)
 * @template P The additional properties type
 *
 * @param base - The object or function to extend (can be null/undefined)
 * @param props - An object containing properties to attach
 *
 * @returns The same object/function, augmented with the given properties, or the original value if null/undefined
 *
 * @example
 * ```ts
 * // Extend a plain object
 * const config = extendProps({ apiUrl: '/api' }, { timeout: 5000 });
 * // config has both apiUrl and timeout properties
 *
 * // Extend a function with metadata
 * const fetchData = (url: string) => fetch(url).then(r => r.json());
 * const enhancedFetch = extendProps(fetchData, {
 *   description: 'Data fetching utility',
 *   version: '1.0'
 * });
 * // enhancedFetch is callable and has description/version properties
 *
 * // Create plugin system
 * const basePlugin = { name: 'base', enabled: true };
 * const authPlugin = extendProps(basePlugin, {
 *   authenticate: (token: string) => validateToken(token)
 * });
 *
 * // Build configuration objects
 * const defaultSettings = { theme: 'light', lang: 'en' };
 * const userSettings = extendProps(defaultSettings, {
 *   theme: 'dark',
 *   notifications: true
 * });
 *
 * // Handle nullable types (e.g., Supabase Session | null)
 * const session: Session | null = getSession();
 * const extendedSession = extendProps(session, { customProp: 'value' });
 * // extendedSession is (Session & { customProp: string }) | null
 * ```
 */
export function extendProps<T, P extends object>(
  base: T,
  props: P,
): T extends null | undefined ? T : T & P {
  if (base == null) return base as T extends null | undefined ? T : never;
  return Object.assign(base, props) as T extends null | undefined
    ? never
    : T & P;
}
