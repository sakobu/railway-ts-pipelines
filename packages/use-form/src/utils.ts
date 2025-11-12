import type { FieldPath } from './types';

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
export const getValueByPath = <
  TObj extends Record<string, unknown>,
  TValue = unknown,
>(
  obj: TObj,
  path: FieldPath
): TValue | undefined => {
  if (!path) return obj as unknown as TValue;

  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalizedPath.split('.').filter(Boolean);

  let current: unknown = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current as TValue | undefined;
};

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
  value: TValue
): TObj => {
  if (!path) return value as unknown as TObj;

  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalizedPath.split('.').filter(Boolean);

  // Clone the root (array/object)
  const result: unknown = Array.isArray(obj)
    ? [...(obj as unknown[])]
    : { ...obj };
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
        currNew[key] = value as unknown;
      } else if (!Array.isArray(currNew) && typeof key === 'string') {
        currNew[key] = value as unknown;
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
      nextNew = Array.isArray(nextOld)
        ? [...(nextOld as unknown[])]
        : { ...(nextOld as Record<string, unknown>) };
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
export const isPathAffected = (
  path: FieldPath,
  changePath: FieldPath
): boolean => {
  if (path === changePath) return true;

  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  const normalizedChangePath = changePath.replace(/\[(\d+)\]/g, '.$1');

  // Parent affects child
  return (
    normalizedPath === normalizedChangePath ||
    normalizedPath.startsWith(`${normalizedChangePath}.`)
  );
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
 * Leaf values (primitives, Date, RegExp, null, undefined) are treated as terminal nodes.
 * Arrays are traversed with bracket notation, objects with dot notation.
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
 * // Returns: ["contacts", "contacts[0]", "contacts[0].email", "contacts[1]", "contacts[1].email"]
 *
 * @example
 * // Mixed nesting
 * const form = {
 *   user: { name: "John" },
 *   tags: ["react", "typescript"]
 * };
 * collectFieldPaths(form);
 * // Returns: ["user", "user.name", "tags", "tags[0]", "tags[1]"]
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

  const isLeaf = (v: unknown) =>
    v == null ||
    typeof v !== 'object' ||
    v instanceof Date ||
    v instanceof RegExp;

  const visit = (value: unknown, path: string) => {
    if (path) paths.push(path);

    if (isLeaf(value)) return;

    if (Array.isArray(value)) {
      value.forEach((item, i) => visit(item, `${path}[${i}]`));
      return;
    }

    const entries = Object.entries(value as Record<string, unknown>);
    for (const [k, v] of entries) {
      const childPath = path ? `${path}.${k}` : k;
      visit(v, childPath);
    }
  };

  visit(obj, prefix);
  return paths;
};
