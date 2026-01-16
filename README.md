# @ts-utilities/core

![npm version](https://img.shields.io/npm/v/@ts-utilities/core)
![npm downloads](https://img.shields.io/npm/dm/@ts-utilities/core)
![License](https://img.shields.io/npm/l/@ts-utilities/core)
![Tests](https://github.com/ts-collection/utilities/actions/workflows/test.yml/badge.svg)

## Description

`@ts-utilities/core` is a collection of core utility functions and advanced TypeScript types designed for JavaScript/TypeScript projects. It provides essential utilities for object manipulation, async operations, data transformation, and type-level programming. The library is built with TypeScript and is fully typed, ensuring a smooth and error-free development experience.

## Features

- **Object Utilities**: Flexible value extraction from nested objects using paths, arrays, or key mappings
- **Data Transformation**: Deep merging, null-to-undefined conversion, and more
- **Async Operations**: Polling, scheduling, debouncing, throttling, and safe async execution
- **General Utilities**: Debounce, throttle, sleep, printf, and other common utilities
- **TypeScript Types**: Advanced utility types for deep partials, guards, and type-level logic gates
- **React Native Compatible**: All utilities are platform-agnostic and work in React Native environments

## Installation

You can install `@ts-utilities/core` using npm or yarn:

```bash
npm install @ts-utilities/core
```

or

```bash
yarn add @ts-utilities/core
```

## Usage

### Importing Utilities

You can import individual utilities or types as needed:

```typescript
import { deepmerge, poll, shield, sleep, debounce, throttle, extract, extendProps, hydrate, withConcurrency } from '@ts-utilities/core';
import type { DeepPartial, Primitive, KeysOfType } from '@ts-utilities/core';
```

### Examples

#### Object Utilities

```typescript
import { extract, extendProps } from '@ts-utilities/core';

const obj = { a: { b: { c: 1 } } };
const value = extract(obj, 'a.b.c'); // 1

// Extract multiple values as an array
const [first, second] = extract(obj, ['a.b.c', 'a.b']); // [1, { c: 1 }]

// Extract multiple values as an object
const { first: f, second: s } = extract(obj, { first: 'a.b.c', second: 'a.b' }); // { first: 1, second: { c: 1 } }

const extended = extendProps({ a: 1 }, { b: 'hello' }); // { a: 1, b: 'hello' }
```

#### Data Transformation

```typescript
import { hydrate, deepmerge } from '@ts-utilities/core';

const cleaned = hydrate({ a: null, b: { c: null } }); // { a: undefined, b: { c: undefined } }

// Deep merge objects
const merged = deepmerge({ user: { name: 'John' } }, { user: { age: 30 } });
// { user: { name: 'John', age: 30 } }

// Compose functions automatically
const composed = deepmerge(
  { onFinish() { console.log('first') } },
  { onFinish() { console.log('second') } },
  { functionMerge: 'compose' }
);
// composed.onFinish() logs 'first' then 'second'

// Merge functions with custom logic
const combined = deepmerge(
  { onFinish() { console.log('first') } },
  { onFinish(v) { console.log('second', v) } },
  {
    customMerge: (key, target, source) => {
      if (typeof target === 'function' && typeof source === 'function') {
        return (...args) => { target(...args); source(...args); };
      }
      return source;
    }
  }
);
// combined.onFinish('done') logs 'first' then 'second done'
```

#### Async Operations

```typescript
import { poll, shield, sleep, withConcurrency } from '@ts-utilities/core';

const result = await poll(async () => {
  const status = await checkStatus();
  return status === 'ready' ? status : null;
}, { interval: 2000, timeout: 30000 });

const [error, data] = await shield(fetchData());
```

#### Concurrent Operations

```typescript
import { withConcurrency } from '@ts-utilities/core';

// Execute tasks with concurrency limit
const tasks = [
  () => fetch('/api/users').then(r => r.json()),
  () => fetch('/api/posts').then(r => r.json()),
  () => fetch('/api/comments').then(r => r.json()),
];

const result = await withConcurrency(tasks, { concurrency: 2, retry: 2 });
// { results: [...], errors: [...], succeeded: 3, failed: 0, duration: 150 }

// Named tasks with object
const apiTasks = {
  users: () => fetch('/api/users').then(r => r.json()),
  posts: () => fetch('/api/posts').then(r => r.json()),
};

const { results, errors, succeeded, failed } = await withConcurrency(apiTasks, {
  concurrency: 3,
  timeout: 5000,
  retry: 1,
  throwOnFirstError: false
});
```

#### Debounce and Throttle

```typescript
import { debounce, throttle } from '@ts-utilities/core';

const debouncedFunction = debounce(() => console.log('Debounced!'), 300);
const throttledFunction = throttle(() => console.log('Throttled!'), 300);
```

#### TypeScript Types

```typescript
import type { DeepPartial, Nullable, KeysOfType, Primitive } from '@ts-utilities/core';

type PartialUser = DeepPartial<User>;
type NullableUser = Nullable<User>;
type StringKeys = KeysOfType<User, string>;
```

## API Documentation

### Functions

#### Object Utilities
```typescript
extract<const T extends object, S extends NestedKeyOf<T>, D>(
  obj: T,
  path: S,
  defaultValue: D
): Exclude<GetValue<T, SplitPath<S>>, undefined> | D;

extract<const T extends object, S extends NestedKeyOf<T>>(
  obj: T,
  path: S
): GetValue<T, SplitPath<S>> | undefined;

extract<const T extends object, const S extends readonly string[], D>(
  obj: T,
  paths: S,
  defaultValue: D
): { readonly [K in keyof S]: GetValue<T, SplitPath<S[K] & string>> | D };

extract<const T extends object, const S extends readonly string[]>(
  obj: T,
  paths: S
): { readonly [K in keyof S]: GetValue<T, SplitPath<S[K] & string>> | undefined };

extract<const T extends object, const S extends Record<string, string>, D>(
  obj: T,
  paths: S,
  defaultValue: D
): { readonly [K in keyof S]: GetValue<T, SplitPath<S[K]>> | D };

extract<const T extends object, const S extends Record<string, string>>(
  obj: T,
  paths: S
): { readonly [K in keyof S]: GetValue<T, SplitPath<S[K]>> | undefined };

extendProps<T, P extends object>(
  base: T,
  props: P
): T extends null | undefined ? T : T & P;
```

#### Data Transformation
```typescript
hydrate<T>(data: T): Hydrate<T>

deepmerge<T extends Record<string, any>, S extends Record<string, any>[]>(
  target: T,
  ...sources: S
): TMerged<T | S[number]>

deepmerge<T extends Record<string, any>, S extends Record<string, any>[]>(
  target: T,
  sources: S,
  options?: DeepMergeOptions
): TMerged<T | S[number]>
```

#### Async & Scheduling
```typescript
poll<T>(
  cond: () => Promise<T | null | false | undefined>,
  options?: {
    interval?: number;
    timeout?: number;
    signal?: AbortSignal;
    jitter?: boolean;
  }
): Promise<T>

schedule(task: Task, options?: ScheduleOpts): void

shield<T, E = Error>(operation: Promise<T>): Promise<[E | null, T | null]>
shield<T, E = Error>(operation: () => T): [E | null, T | null]

sleep(time?: number, signal?: AbortSignal): Promise<void>

debounce<F extends (...args: any[]) => any>(
  function_: F,
  wait?: number,
  options?: { immediate?: boolean }
): DebouncedFunction<F>

throttle<F extends (...args: any[]) => any>(
  function_: F,
  wait?: number,
  options?: { leading?: boolean; trailing?: boolean }
): ThrottledFunction<F>

withConcurrency<T>(
  tasks: readonly (() => Promise<T>)[],
  options?: ConcurrenceOptions
): Promise<ConcurrenceResult<T[]>>

withConcurrency<T>(
  tasks: Record<string, () => Promise<T>>,
  options?: ConcurrenceOptions
): Promise<ConcurrenceResult<Record<string, T>>>

type ConcurrenceResult<T> = {
  results: T;
  errors: Error[];
  succeeded: number;
  failed: number;
  duration: number;
}

type ConcurrenceOptions = {
  concurrency?: number;
  timeout?: number;
  signal?: AbortSignal;
  retry?: number;
  retryDelay?: number;
  throwOnFirstError?: boolean;
  ignoreErrors?: boolean;
}
```

### Types

#### Utility Types
```typescript
Keys<T extends object>: keyof T
Values<T extends object>: T[keyof T]
DeepPartial<T>: T with all properties optional recursively
SelectivePartial<T, K>: T with selected keys optional
DeepRequired<T>: T with all properties required recursively
SelectiveRequired<T, K>: T with selected keys required
Never<T>: Object with never values
Nullable<T>: T with null added to primitives
Optional<T>: T with undefined added to primitives
Nullish<T>: T with null|undefined added to primitives
Maybe<T>: T with all properties optional and nullish
DeepReadonly<T>: T with all properties readonly recursively
Mutable<T>: T with readonly removed
KeysOfType<T, U>: Keys of T where value is U
OmitByType<T, U>: T without properties of type U
RequiredKeys<T, K>: T with selected keys required
Diff<T, U>: Properties in T or U but not both
Intersection<T, U>: Common properties
Merge<T, U>: Merged object
Substract<T, U>: T without U properties
AllOrNone<T>: T or empty object
OneOf<T>: Union of single property objects
TwoOf<T>: Union of two property objects
Prettify<T>: Clean type representation
NestedKeyOf<T>: All nested keys as strings
Without<T, U>: T without U keys
```

#### Type Guards & Primitives
```typescript
Primitive: string | number | bigint | boolean | symbol | null | undefined
Falsy: false | '' | 0 | null | undefined

isFalsy(val: unknown): val is Falsy
isNullish(val: unknown): val is nullish
isPrimitive(val: unknown): val is Primitive
isPlainObject(value: unknown): value is Record<string, any>
```

#### Logic Gates
```typescript
BUFFER<T>: T
IMPLIES<T, U>: true if T extends U
XOR_Binary<T, U>: T | U with exclusions
XNOR_Binary<T, U>: T & U | neither
AND<T extends any[]>: All true
OR<T extends any[]>: At least one true
XOR<T extends any[]>: Odd number true
XNOR<T extends any[]>: Even number true
NOT<T>: Never properties
NAND<T extends any[]>: NOT AND
NOR<T extends any[]>: NOT OR
```

## React Native Compatibility

This package is designed to work in React Native environments. All included utilities are platform-agnostic and don't depend on DOM APIs.

## Contributing

Contributions are welcome! Please read the [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines on how to contribute to the project.

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Contact

- **Sohan Emon**: [sohanemon@outlook.com](mailto:sohanemon@outlook.com)
- **GitHub**: [ts-collection/utilities](https://github.com/ts-collection/utilities)
