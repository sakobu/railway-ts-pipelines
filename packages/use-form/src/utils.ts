import type { FieldPath } from './types';

/**
 * Canonical (dot) form for a field path. Numeric bracket segments are
 * rewritten as dot segments: "users[0].name" → "users.0.name".
 *
 * Path-keyed maps stored in form state (touched, clientErrors, serverErrors,
 * and the field checks and validators) are keyed by this canonical form, so
 * lookups using either "r1.0" or "r1[0]" resolve to the same entry once normalized.
 */
export const normalizePath = (path: FieldPath): FieldPath => path.replace(/\[(\d+)\]/g, '.$1');

/**
 * Returns a new map whose keys have been rewritten to canonical dot form.
 * Used at boundaries where bracket-keyed errors enter form state (e.g. the
 * output of `formatErrors` from `@railway-ts/pipelines/schema`).
 */
export const normalizePathKeys = <T>(map: Record<FieldPath, T>): Record<FieldPath, T> => {
  const out: Record<FieldPath, T> = {};
  for (const k of Object.keys(map)) {
    out[normalizePath(k)] = map[k] as T;
  }
  return out;
};

/**
 * The record's own entry at `key`, for a record keyed by field path. A field may be named after an `Object.prototype`
 * member, such as `constructor`, so a plain read would find the inherited member where the field has no entry.
 */
export const own = <T>(record: Readonly<Record<FieldPath, T>>, key: FieldPath): T | undefined =>
  Object.hasOwn(record, key) ? record[key] : undefined;

/**
 * Whether a validator's answer settles later: a promise, or any other thenable. `instanceof Promise` misses a
 * library's promise and one from another realm, such as an iframe's. `Promise.resolve` turns one into a native promise.
 */
export const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof (value as { then?: unknown } | null | undefined)?.then === 'function';

/**
 * Applies `onAnswer` to an answer now, or once it settles. An answer that settles later, whatever thenable it is,
 * becomes a native promise, and `onFail`, when given, handles its rejection. A sync throw from `onAnswer` reaches the
 * caller.
 *
 * @param answer - The answer, or a thenable of it
 * @param onAnswer - Maps the settled answer
 * @param onFail - Handles a rejection. Without it, the promise rejects.
 * @returns What `onAnswer` returned, or a native promise of it
 */
export const mapAnswer = <T, U>(
  answer: T | PromiseLike<T>,
  onAnswer: (settled: T) => U,
  onFail?: (error: unknown) => U,
): U | Promise<U> => (isPromiseLike(answer) ? Promise.resolve(answer).then(onAnswer, onFail) : onAnswer(answer));

/**
 * Retrieves a value from a nested object using a path string.
 * Supports both dot notation for object properties and bracket notation for array indices.
 * Returns undefined if any part of the path doesn't exist.
 *
 * Internally normalizes bracket notation to dot notation (e.g., "arr[0]" → "arr.0")
 * and traverses the object tree to find the value.
 *
 * @template TObj - The object type to extract from
 * @template TValue - The expected return value type
 *
 * @param obj - The object to extract value from
 * @param path - Path to the value using dot or bracket notation
 * @returns The value at the path, or undefined if not found
 *
 * @example
 * // Simple dot notation
 * const user = { name: "John", age: 30 };
 * getValueByPath(user, "name"); // "John"
 *
 * @example
 * // Nested dot notation
 * const user = { address: { city: "NYC", zip: "10001" } };
 * getValueByPath(user, "address.city"); // "NYC"
 *
 * @example
 * // Bracket notation for arrays
 * const user = { contacts: ["email@example.com", "phone@example.com"] };
 * getValueByPath(user, "contacts[0]"); // "email@example.com"
 *
 * @example
 * // Combined notation for deeply nested structures
 * const user = { teams: [{ name: "Engineering", members: [{ name: "Alice" }] }] };
 * getValueByPath(user, "teams[0].members[0].name"); // "Alice"
 *
 * @example
 * // Missing path returns undefined
 * const user = { name: "John" };
 * getValueByPath(user, "address.city"); // undefined
 */
export const getValueByPath = <TObj extends Record<string, unknown>, TValue = unknown>(
  obj: TObj,
  path: FieldPath,
): TValue | undefined => {
  if (!path) return obj as unknown as TValue;

  const parts = normalizePath(path).split('.').filter(Boolean);

  let current: unknown = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current as TValue | undefined;
};

/**
 * The value at each path, read by {@link getValueByPath} and keyed by the path as given. Built with
 * `Object.fromEntries`, so a path named `__proto__` stays an own key.
 *
 * @param values - The values to read
 * @param paths - The paths to read them at
 * @returns Each path's value, by path
 */
export const valuesAt = (values: Record<string, unknown>, paths: readonly FieldPath[]): Record<FieldPath, unknown> =>
  Object.fromEntries(paths.map((path) => [path, getValueByPath(values, path)]));

/**
 * Sets a value in a nested object using a path string, returning a new object.
 * Creates intermediate objects and arrays as needed without mutating the original.
 * All updates are performed immutably using spreading.
 *
 * Internally normalizes bracket notation to dot notation and determines whether
 * to create objects or arrays based on whether the next path segment is numeric.
 *
 * @template TObj - The object type to update
 * @template TValue - The value type to set
 *
 * @param obj - The source object to set value in (not mutated)
 * @param path - Path to the value using dot or bracket notation
 * @param value - The value to set at the path
 * @returns A new object with the updated value
 *
 * @example
 * // Update existing nested property
 * const user = { name: "John", address: { city: "NYC" } };
 * const updated = setValueByPath(user, "address.city", "San Francisco");
 * // updated = { name: "John", address: { city: "San Francisco" } }
 * // user is unchanged (immutable)
 *
 * @example
 * // Create missing intermediate objects
 * const user = { name: "John" };
 * const updated = setValueByPath(user, "address.city", "NYC");
 * // updated = { name: "John", address: { city: "NYC" } }
 *
 * @example
 * // Update array element
 * const user = { contacts: ["old@example.com"] };
 * const updated = setValueByPath(user, "contacts[0]", "new@example.com");
 * // updated = { contacts: ["new@example.com"] }
 *
 * @example
 * // Create missing arrays and nested properties
 * const user = {};
 * const updated = setValueByPath(user, "teams[0].name", "Engineering");
 * // updated = { teams: [{ name: "Engineering" }] }
 *
 * @example
 * // Deep nested update
 * const form = { users: [{ address: { city: "NYC" } }] };
 * const updated = setValueByPath(form, "users[0].address.zip", "10001");
 * // updated = { users: [{ address: { city: "NYC", zip: "10001" } }] }
 */
export const setValueByPath = <TObj extends Record<string, unknown>, TValue>(
  obj: TObj,
  path: FieldPath,
  value: TValue,
): TObj => {
  if (!path) return value as unknown as TObj;

  const parts = normalizePath(path).split('.').filter(Boolean);

  // Clone the root (array/object)
  const result: unknown = Array.isArray(obj) ? [...(obj as unknown[])] : { ...obj };
  let currNew: Record<string, unknown> | unknown[] = Array.isArray(result)
    ? (result as unknown[])
    : (result as Record<string, unknown>);
  let currOld: unknown = obj;

  for (let i = 0; i < parts.length; i++) {
    const keyStr = parts[i]!;
    const isIndex = /^\d+$/.test(keyStr);
    const key: number | string = isIndex ? Number(keyStr) : keyStr;

    if (i === parts.length - 1) {
      // Final set
      if (Array.isArray(currNew) && typeof key === 'number') {
        currNew[key] = value;
      } else if (!Array.isArray(currNew) && typeof key === 'string') {
        currNew[key] = value;
      }
      break;
    }

    // Prepare next container
    let nextOld: unknown = undefined;
    if (currOld != null && typeof currOld === 'object') {
      if (Array.isArray(currOld) && typeof key === 'number') {
        nextOld = (currOld as unknown[])[key];
      } else if (!Array.isArray(currOld) && typeof key === 'string') {
        nextOld = (currOld as Record<string, unknown>)[key];
      }
    }
    let nextNew: Record<string, unknown> | unknown[];

    if (nextOld == null) {
      // Create missing container based on the next segment
      const nextIsIndex = /^\d+$/.test(parts[i + 1] ?? '');
      nextNew = nextIsIndex ? [] : {};
    } else {
      nextNew = Array.isArray(nextOld) ? [...(nextOld as unknown[])] : { ...(nextOld as Record<string, unknown>) };
    }

    if (Array.isArray(currNew) && typeof key === 'number') {
      currNew[key] = nextNew;
    } else if (!Array.isArray(currNew) && typeof key === 'string') {
      currNew[key] = nextNew;
    }

    currNew = nextNew;
    currOld = nextOld ?? (Array.isArray(nextNew) ? [] : {});
  }

  return result as TObj;
};

/**
 * Checks if a field path is affected by changes to another path.
 * Used internally for determining which errors to clear when a field value changes.
 *
 * A path is considered affected if:
 * 1. It exactly matches the change path
 * 2. The change path is a parent of the path (e.g., "address" affects "address.city")
 *
 * Paths are normalized before comparison so bracket notation is handled correctly.
 *
 * @param path - The path to check if affected (e.g., error path)
 * @param changePath - The path that was changed (e.g., field that was updated)
 * @returns True if the path is affected by the change, false otherwise
 *
 * @example
 * // Exact match
 * isPathAffected("email", "email"); // true
 *
 * @example
 * // Parent affects child
 * isPathAffected("address.city", "address"); // true
 * isPathAffected("address.city", "address.city"); // true
 *
 * @example
 * // Child does not affect parent
 * isPathAffected("address", "address.city"); // false
 *
 * @example
 * // Unrelated paths
 * isPathAffected("address.city", "name"); // false
 *
 * @example
 * // Array notation (normalized internally)
 * isPathAffected("contacts[0].email", "contacts"); // true
 * isPathAffected("contacts[0].email", "contacts[0]"); // true
 * isPathAffected("contacts[0].email", "contacts[1]"); // false
 *
 * @example
 * // Practical use case: clearing server errors
 * const serverErrors = {
 *   "address.city": "City is required",
 *   "address.zip": "Invalid ZIP"
 * };
 * // When user updates "address", both errors should be cleared
 * Object.keys(serverErrors).filter(path => isPathAffected(path, "address"));
 * // Returns ["address.city", "address.zip"]
 */
export const isPathAffected = (path: FieldPath, changePath: FieldPath): boolean => {
  if (path === changePath) return true;

  const normalizedPath = normalizePath(path);
  const normalizedChangePath = normalizePath(changePath);

  // Parent affects child
  return normalizedPath === normalizedChangePath || normalizedPath.startsWith(`${normalizedChangePath}.`);
};

/**
 * Checks whether two paths overlap: one is the other, or one contains the other.
 * Symmetric form of {@link isPathAffected}.
 *
 * @param a - First path (dot or bracket notation)
 * @param b - Second path (dot or bracket notation)
 * @returns `true` if either path is affected by a change at the other
 *
 * @example
 * pathsOverlap("address.city", "address"); // true
 * pathsOverlap("address", "address.city"); // true
 * pathsOverlap("address.city", "address.zip"); // false
 */
export const pathsOverlap = (a: FieldPath, b: FieldPath): boolean => isPathAffected(a, b) || isPathAffected(b, a);

/**
 * Whether a path overlaps any of `paths` ({@link pathsOverlap}).
 *
 * @example
 * overlapsAny("address.city", ["name", "address"]); // true
 * overlapsAny("address.city", ["address.zip"]); // false
 */
export const overlapsAny = (path: FieldPath, paths: readonly FieldPath[]): boolean =>
  paths.some((other) => pathsOverlap(path, other));

/**
 * A path-keyed record without the entries whose path `drops` matches, or the record itself when it matches none, so
 * an unchanged record keeps its identity. Built with `Object.fromEntries`, so a path named `__proto__` stays an own key.
 *
 * @example
 * withoutPaths({ "address.city": "Required", name: "Too short" }, (path) => isPathAffected(path, "address"));
 * // { name: "Too short" }
 */
export const withoutPaths = <T>(
  record: Readonly<Record<FieldPath, T>>,
  drops: (path: FieldPath) => boolean,
): Readonly<Record<FieldPath, T>> => {
  const entries = Object.entries(record);
  const kept = entries.filter(([path]) => !drops(path));
  return kept.length === entries.length ? record : Object.fromEntries(kept);
};

/**
 * Whether a value is a plain object: an object literal, or one with a `null` prototype.
 * Its prototype is a root object, so objects from another realm count too: an iframe,
 * `node:vm`, or a test runner reading JSON from Node's own `fetch`.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === null || Object.getPrototypeOf(proto) === null;
};

/**
 * Whether a value keeps its contents out of its own fields, even when it has some: a `Date`'s
 * time, a `RegExp`'s pattern, a file's contents, a `Map`'s or `Set`'s entries, or a typed array's
 * bytes, which would be one field each.
 */
const hidesContents = (value: object): boolean =>
  value instanceof Date ||
  value instanceof RegExp ||
  value instanceof Map ||
  value instanceof Set ||
  value instanceof WeakMap ||
  value instanceof WeakSet ||
  ArrayBuffer.isView(value) ||
  (typeof Blob !== 'undefined' && value instanceof Blob);

/**
 * Whether the form looks inside a value, or treats it as one value. `setValues` ({@link deepMerge}),
 * {@link deepEqual}, {@link replacedPaths}, {@link changedPaths} and {@link collectFieldPaths} all follow it, so they
 * agree on the shape of form values.
 *
 * The form looks inside arrays and objects that keep their state in their own fields: plain
 * objects, and class instances with fields, such as a record class or a dayjs value. That's how
 * `setFieldValue` edits them. Every other value is one value: primitives, `Date`, `RegExp`, `File`,
 * `Blob`, `Map`, `Set`, typed arrays, and objects with no fields of their own, such as Temporal
 * values and classes with only private fields.
 *
 * A value it looks inside is typed as a record read by key, as any object can be: each field reads as `unknown`.
 *
 * @param value - Any form value
 * @returns Whether the form looks inside the value
 */
const isBranch = (value: unknown): value is Readonly<Record<string, unknown>> => {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value) || isPlainObject(value)) return true;
  return !hidesContents(value) && Object.keys(value).length > 0;
};

/**
 * Recursively collects all field paths from a nested object structure.
 * Traverses the entire object tree and generates path strings for every field,
 * including intermediate parent paths, nested objects, and array elements.
 *
 * Useful for operations that need to touch all fields in a form, such as:
 * - Marking all fields as touched on form submission
 * - Collecting all error paths for validation
 * - Iterating over all form values
 *
 * It looks inside the values the form looks inside (see {@link isBranch}). Every other value,
 * such as a primitive, `null`, `Date`, `File` or `Map`, is a leaf. All segments are joined with
 * dot notation; numeric array indices appear as their canonical dot form (e.g. "contacts.0.email"),
 * matching the rest of form state.
 *
 * @param obj - The object to collect paths from (typically form values)
 * @param prefix - Internal parameter for recursion, starting path prefix (default: "")
 * @returns Array of all field paths found in the object
 *
 * @example
 * // Simple object
 * const user = { name: "John", age: 30 };
 * collectFieldPaths(user);
 * // Returns: ["name", "age"]
 *
 * @example
 * // Nested object
 * const user = { name: "John", address: { city: "NYC", zip: "10001" } };
 * collectFieldPaths(user);
 * // Returns: ["name", "address", "address.city", "address.zip"]
 * // Note: "address" is included as a parent path
 *
 * @example
 * // Arrays with objects
 * const form = { contacts: [{ email: "a@example.com" }, { email: "b@example.com" }] };
 * collectFieldPaths(form);
 * // Returns: ["contacts", "contacts.0", "contacts.0.email", "contacts.1", "contacts.1.email"]
 *
 * @example
 * // Mixed nesting
 * const form = {
 *   user: { name: "John" },
 *   tags: ["react", "typescript"]
 * };
 * collectFieldPaths(form);
 * // Returns: ["user", "user.name", "tags", "tags.0", "tags.1"]
 *
 * @example
 * // Practical use: marking all fields as touched on submit
 * const handleSubmit = () => {
 *   const allPaths = collectFieldPaths(form.values);
 *   allPaths.forEach(path => form.setFieldTouched(path, true));
 *   // Now all validation errors will be visible
 * };
 *
 * @example
 * // Leaf values (Date, null) are treated as terminals
 * const form = { createdAt: new Date(), deletedAt: null };
 * collectFieldPaths(form);
 * // Returns: ["createdAt", "deletedAt"]
 * // Does not try to traverse into Date or null
 */
export const collectFieldPaths = (obj: unknown, prefix = ''): FieldPath[] => {
  const paths: FieldPath[] = [];
  // The values being walked, so a value that contains itself is listed once, where it repeats
  const ancestors = new Set<object>();

  const visit = (value: unknown, path: string) => {
    if (path) paths.push(path);

    if (!isBranch(value) || ancestors.has(value)) return;
    ancestors.add(value);

    if (Array.isArray(value)) {
      value.forEach((item, i) => visit(item, path ? `${path}.${i}` : `${i}`));
    } else {
      for (const [k, v] of Object.entries(value)) {
        visit(v, path ? `${path}.${k}` : k);
      }
    }

    ancestors.delete(value);
  };

  visit(obj, prefix);
  return paths;
};

/**
 * Whether a plain object in `setValues` merges into this value ({@link deepMerge}): a value the form
 * looks inside (see {@link isBranch}) that isn't an array. Its fields read as any object's do.
 */
const isMergeTarget = (value: unknown): value is Record<string, unknown> => isBranch(value) && !Array.isArray(value);

/**
 * Merges `source` into `target` for `setValues`, returning a new object.
 *
 * A plain object in `source` is a partial update. It merges into the object there, as
 * `setFieldValue` on each of its keys would, when that object is one the form looks inside
 * (see {@link isBranch}) and isn't an array. Every other value in `source` (an array, `Date`,
 * `File`, `Map`, `Set` or class instance) replaces the value before it, stored as given. A
 * `__proto__` key is skipped: `JSON.parse` makes it an own key, and assigning it would replace the
 * values' prototype.
 *
 * @param target - The current values (not mutated)
 * @param source - The values to write over them
 * @returns A new object with `source` merged in
 *
 * @example
 * deepMerge({ address: { city: "LA", zip: "90001" } }, { address: { city: "NYC" } });
 * // { address: { city: "NYC", zip: "90001" } }
 *
 * @example
 * deepMerge({ avatar: oldFile }, { avatar: newFile }); // { avatar: newFile }
 */
export const deepMerge = <T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T => {
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    if (key === '__proto__') continue;
    const value = source[key];
    const before = target[key];
    result[key] = isPlainObject(value) && isMergeTarget(before) ? deepMerge(before, value) : value;
  }

  return result as T;
};

/** The path of `key` inside the value at `path`, where `''` is the root. */
const join = (path: FieldPath, key: string | number): FieldPath => (path ? `${path}.${key}` : `${key}`);

/**
 * The path of each leaf inside a value: each value the form doesn't look inside (see {@link isBranch}), and each
 * empty branch. A value that is itself a leaf or an empty branch is the one leaf, at `path`. A value met again inside
 * itself is a leaf where it repeats, so it is walked once.
 *
 * @param value - The value
 * @param path - The value's path
 * @returns Each leaf's path, in dot form
 */
const leavesOf = (value: unknown, path: FieldPath): FieldPath[] => {
  const leaves: FieldPath[] = [];
  // The values being walked, so a value that contains itself is walked once
  const ancestors = new Set<object>();
  const visit = (current: unknown, at: FieldPath): void => {
    const entries = isBranch(current) && !ancestors.has(current) ? Object.entries(current) : [];
    if (!isBranch(current) || entries.length === 0) {
      leaves.push(at);
      return;
    }
    ancestors.add(current);
    for (const [key, child] of entries) visit(child, join(at, key));
    ancestors.delete(current);
  };
  visit(value, path);
  return leaves;
};

/**
 * Walks two values by {@link deepEqual}'s rules, calling `found` at each path where they part, until it returns
 * `false`. They part where the walk can't go on into both: at a key or item only one side has, at a value the form
 * looks inside (see {@link isBranch}) against one it doesn't, at an array against an object, and at two other values
 * that differ. `found` gets the two values there, `undefined` for a side that lacks the key. A pair met again inside
 * itself is settled by the walk already running on it, so a value that contains itself is walked once.
 *
 * @param a - The first value
 * @param b - The second value
 * @param path - The path of the values walked, `''` at the root
 * @param running - The pairs of values whose walk is running, outermost first
 * @param found - Called with each path where the values part, and the values there. Returning `false` stops the walk.
 * @returns `false` when `found` stopped the walk, and `true` otherwise
 */
const walkDifferences = (
  a: unknown,
  b: unknown,
  path: FieldPath,
  running: Array<readonly [object, object]>,
  found: (path: FieldPath, before: unknown, after: unknown) => boolean,
): boolean => {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return Object.is(a.getTime(), b.getTime()) || found(path, a, b);
  if (a instanceof RegExp && b instanceof RegExp) return a.toString() === b.toString() || found(path, a, b);
  // Any other value the form doesn't look inside compares by identity, which Object.is has ruled out. The form's
  // edits keep an array an array.
  if (!isBranch(a) || !isBranch(b) || Array.isArray(a) !== Array.isArray(b)) return found(path, a, b);
  // Met again inside itself: the walk already running on this pair settles it
  if (running.some(([x, y]) => x === a && y === b)) return true;

  running.push([a, b]);
  try {
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const at = join(path, i);
        const walked =
          i < a.length && i < b.length ? walkDifferences(a[i], b[i], at, running, found) : found(at, a[i], b[i]);
        if (!walked) return false;
      }
      return true;
    }
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const inA = Object.hasOwn(a, key);
      const inB = Object.hasOwn(b, key);
      const at = join(path, key);
      const walked =
        inA && inB
          ? walkDifferences(a[key], b[key], at, running, found)
          : found(at, inA ? a[key] : undefined, inB ? b[key] : undefined);
      if (!walked) return false;
    }
    return true;
  } finally {
    running.pop();
  }
};

/**
 * Walks two values ({@link walkDifferences}) and collects the paths `pathsAt` gives for each place they part.
 *
 * @param before - The values before
 * @param after - The values after
 * @param pathsAt - The paths to collect where the values part, given the path there and the values on each side
 * @returns The paths collected, in the order the walk meets them
 */
const collectParted = (
  before: unknown,
  after: unknown,
  pathsAt: (path: FieldPath, before: unknown, after: unknown) => readonly FieldPath[],
): FieldPath[] => {
  const paths: FieldPath[] = [];
  walkDifferences(before, after, '', [], (path, from, to) => {
    for (const at of pathsAt(path, from, to)) paths.push(at);
    return true;
  });
  return paths;
};

/**
 * Each path where two values part, by {@link deepEqual}'s rules: where the value there was replaced whole, so the
 * errors at, inside or above it no longer describe the values. It looks inside the values the form looks inside (see
 * {@link isBranch}) and stops where it can't go on into both: at a key or item only one side has, at an object or array
 * where the other side holds a value the form doesn't look inside, such as `undefined`, at an array against an object,
 * and at two other values that differ. So clearing or removing an object is a change at its own path.
 *
 * @param before - The values before
 * @param after - The values after
 * @returns Each path where the values part, in dot form
 *
 * @example
 * replacedPaths({ address: { city: "LA", zip: "1" } }, { address: { city: "NYC", zip: "1" } }); // ["address.city"]
 *
 * @example
 * replacedPaths({ address: { city: "LA" } }, { address: undefined }); // ["address"]
 *
 * @example
 * replacedPaths({ tags: ["a", "b"] }, { tags: ["a"] }); // ["tags.1"]
 */
export const replacedPaths = (before: unknown, after: unknown): FieldPath[] =>
  collectParted(before, after, (path) => [path]);

/**
 * Each path where two values differ, by {@link deepEqual}'s rules, so an edit re-checks only the validators whose
 * values it changed. Where the values part ({@link replacedPaths}) and only one side there is a value the form looks
 * inside (see {@link isBranch}), each leaf inside that side changed, and elsewhere the path where they part did. A side
 * that lacks the key counts as `undefined`. So a key holding `undefined` counts, and a missing object and one set to
 * `undefined` change the same paths.
 *
 * @param before - The values before
 * @param after - The values after
 * @returns Each path where the values differ, in dot form
 *
 * @example
 * changedPaths({ address: { city: "LA", zip: "1" } }, { address: { city: "NYC", zip: "1" } }); // ["address.city"]
 *
 * @example
 * changedPaths({ tags: ["a"] }, { tags: ["a", "b"] }); // ["tags.1"]
 *
 * @example
 * changedPaths({ address: { city: "LA" } }, {}); // ["address.city"]
 *
 * @example
 * changedPaths({ address: undefined }, { address: { city: "Oslo" } }); // ["address.city"]
 */
export const changedPaths = (before: unknown, after: unknown): FieldPath[] =>
  collectParted(before, after, (path, from, to) => {
    const branchFrom = isBranch(from);
    return branchFrom === isBranch(to) ? [path] : leavesOf(branchFrom ? from : to, path);
  });

/**
 * Compares two values the way the form sees them. Used for `isDirty`, for following new
 * `initialValues`, and for deciding whether a submit repeats the running one.
 *
 * - Values the form looks inside (see {@link isBranch}) compare by content: arrays item by item,
 *   objects field by field. An array only equals an array. An object's class doesn't count,
 *   since `setFieldValue` rebuilds the objects on a field's path as plain objects. Neither does
 *   state in a class's `#private` fields, which only the class can read.
 * - `Date` and `RegExp` compare by value. Two invalid Dates are equal.
 * - Every other value compares by identity: `File`, `Blob`, `Map`, `Set` and typed arrays, whose
 *   contents aren't in their fields, and objects with no fields of their own, such as Temporal
 *   values and classes with only private fields.
 * - A value that contains itself compares without looping: a pair met again inside itself is
 *   settled by the comparison already running on it.
 *
 * When unsure, it calls two values different. That costs at most an extra save or an
 * "unsaved changes" prompt, where calling them equal could drop a save.
 *
 * @param a - The first value
 * @param b - The second value
 * @returns Whether the two values are equal
 *
 * @example
 * deepEqual({ tags: ["a"] }, { tags: ["a"] }); // true
 * deepEqual(new Date("2024-01-01"), new Date("2024-01-01")); // true
 * deepEqual(new File(["a"], "a.txt"), new File(["a"], "a.txt")); // false: compared by identity
 */
export const deepEqual = (a: unknown, b: unknown): boolean => walkDifferences(a, b, '', [], () => false);
