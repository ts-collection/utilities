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
