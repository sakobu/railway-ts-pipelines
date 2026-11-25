import { describe, test, expect } from 'bun:test';
import { runInNewContext } from 'node:vm';

import {
  getValueByPath,
  setValueByPath,
  isPathAffected,
  pathsOverlap,
  collectFieldPaths,
  deepMerge,
  deepEqual,
  isPromiseLike,
  own,
} from '../../src/utils';

// Shaped like a dayjs value: a date picker creates a new one on every pick
class DayjsLike {
  $d: Date;
  $y: number;
  constructor(iso: string) {
    this.$d = new Date(iso);
    this.$y = this.$d.getUTCFullYear();
  }
}

// A record built from a class, with fields the form edits
class Address {
  street = '1 Main';
  city = 'LA';
}

describe('getValueByPath', () => {
  test('gets top-level property', () => {
    const obj = { name: 'John', age: 30 };
    expect(getValueByPath<typeof obj, string>(obj, 'name')).toBe('John');
    expect(getValueByPath<typeof obj, number>(obj, 'age')).toBe(30);
  });

  test('gets nested property with dot notation', () => {
    const obj = { user: { name: 'John', address: { city: 'NYC' } } };
    expect(getValueByPath<typeof obj, string>(obj, 'user.name')).toBe('John');
    expect(getValueByPath<typeof obj, string>(obj, 'user.address.city')).toBe('NYC');
  });

  test('gets array element with bracket notation', () => {
    const obj = { items: ['a', 'b', 'c'] };
    expect(getValueByPath<typeof obj, string>(obj, 'items[0]')).toBe('a');
    expect(getValueByPath<typeof obj, string>(obj, 'items[2]')).toBe('c');
  });

  test('gets nested property in array element', () => {
    const obj = {
      users: [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' },
      ],
    };
    expect(getValueByPath<typeof obj, string>(obj, 'users[0].name')).toBe('John');
    expect(getValueByPath<typeof obj, string>(obj, 'users[1].email')).toBe('jane@example.com');
  });

  test('returns undefined for non-existent path', () => {
    const obj = { name: 'John' };
    expect(getValueByPath(obj, 'age')).toBeUndefined();
    expect(getValueByPath(obj, 'address.city')).toBeUndefined();
  });

  test('returns undefined for null or undefined intermediate values', () => {
    const obj = { user: null };
    expect(getValueByPath(obj, 'user.name')).toBeUndefined();
  });

  test('handles empty path', () => {
    const obj = { name: 'John' };
    expect(getValueByPath<typeof obj, typeof obj>(obj, '')).toEqual(obj);
  });
});

describe('setValueByPath', () => {
  test('clones an array root without mutating it', () => {
    const root = [{ name: 'Ann' }, { name: 'Bob' }];
    const result: unknown = setValueByPath(root as unknown as Record<string, unknown>, '1.name', 'Cy');
    expect(result).toEqual([{ name: 'Ann' }, { name: 'Cy' }]);
    expect(result).not.toBe(root);
    expect(root[1]!.name).toBe('Bob');
  });

  test('sets top-level property', () => {
    const obj = { name: 'John', age: 30 };
    const result = setValueByPath(obj, 'name', 'Jane');
    expect(result.name).toBe('Jane');
    expect(result.age).toBe(30);
    // Original unchanged (immutability)
    expect(obj.name).toBe('John');
  });

  test('sets nested property with dot notation', () => {
    const obj = { user: { name: 'John', age: 30 } };
    const result = setValueByPath(obj, 'user.name', 'Jane');
    expect(result.user.name).toBe('Jane');
    expect(result.user.age).toBe(30);
    // Original unchanged
    expect(obj.user.name).toBe('John');
  });

  test('sets array element with bracket notation', () => {
    const obj = { items: ['a', 'b', 'c'] };
    const result = setValueByPath(obj, 'items[1]', 'x');
    expect(result.items).toEqual(['a', 'x', 'c']);
    // Original unchanged
    expect(obj.items).toEqual(['a', 'b', 'c']);
  });

  test('sets nested property in array element', () => {
    const obj = { users: [{ name: 'John' }, { name: 'Jane' }] };
    const result = setValueByPath(obj, 'users[0].name', 'Bob');
    expect(result.users[0]?.name).toBe('Bob');
    expect(result.users[1]?.name).toBe('Jane');
    // Original unchanged
    expect(obj.users[0]?.name).toBe('John');
  });

  test('creates missing intermediate objects', () => {
    const obj = {};
    const result = setValueByPath(obj, 'user.address.city', 'NYC');
    expect(result).toEqual({
      user: {
        address: {
          city: 'NYC',
        },
      },
    });
  });

  test('creates missing intermediate arrays', () => {
    const obj = {};
    const result = setValueByPath(obj, 'items[0]', 'first');
    expect(result).toEqual({
      items: ['first'],
    });
  });

  test('creates deeply nested structure', () => {
    const obj = {};
    const result = setValueByPath(obj, 'users[0].address.city', 'NYC');
    expect(result).toEqual({
      users: [{ address: { city: 'NYC' } }],
    });
  });

  test('handles empty path by replacing entire object', () => {
    const obj = { name: 'John' };
    const result = setValueByPath(obj, '', { age: 30 }) as unknown as {
      age: number;
    };
    expect(result).toEqual({ age: 30 });
  });

  test('maintains immutability at all levels', () => {
    const obj = {
      level1: {
        level2: {
          level3: 'value',
        },
      },
    };
    const result = setValueByPath(obj, 'level1.level2.level3', 'new value');

    // Check that all levels are new objects
    expect(result).not.toBe(obj);
    expect(result.level1).not.toBe(obj.level1);
    expect(result.level1.level2).not.toBe(obj.level1.level2);
    expect(obj.level1.level2.level3).toBe('value');
    expect(result.level1.level2.level3).toBe('new value');
  });
});

describe('isPathAffected', () => {
  test('returns true for exact match', () => {
    expect(isPathAffected('name', 'name')).toBe(true);
    expect(isPathAffected('user.name', 'user.name')).toBe(true);
  });

  test('returns true when changePath is parent', () => {
    expect(isPathAffected('user.name', 'user')).toBe(true);
    expect(isPathAffected('user.address.city', 'user')).toBe(true);
    expect(isPathAffected('user.address.city', 'user.address')).toBe(true);
  });

  test('returns false for unrelated paths', () => {
    expect(isPathAffected('name', 'email')).toBe(false);
    expect(isPathAffected('user.name', 'user.email')).toBe(false);
    expect(isPathAffected('address.city', 'user.city')).toBe(false);
  });

  test('handles bracket notation', () => {
    expect(isPathAffected('contacts[0].email', 'contacts')).toBe(true);
    expect(isPathAffected('contacts[0].email', 'contacts[0]')).toBe(true);
    expect(isPathAffected('contacts[0].email', 'contacts[0].email')).toBe(true);
    expect(isPathAffected('contacts[0].email', 'contacts[1]')).toBe(false);
  });

  test('does not consider child as affecting parent', () => {
    expect(isPathAffected('user', 'user.name')).toBe(false);
    expect(isPathAffected('address', 'address.city')).toBe(false);
  });
});

describe('pathsOverlap', () => {
  test.each([
    ['name', 'name', true],
    ['address.city', 'address', true],
    ['address', 'address.city', true],
    ['items.0.name', 'items', true],
    ['items', 'items[0].name', true],
    ['email', 'name', false],
    ['address.city', 'address.zip', false],
    ['r2', 'r20.0', false],
  ])('pathsOverlap(%p, %p) is %p', (a, b, expected) => {
    expect(pathsOverlap(a, b)).toBe(expected);
  });
});

describe('collectFieldPaths', () => {
  test('collects top-level fields', () => {
    const obj = { name: 'John', age: 30, email: 'john@example.com' };
    const paths = collectFieldPaths(obj);
    expect(paths).toContain('name');
    expect(paths).toContain('age');
    expect(paths).toContain('email');
  });

  test('collects nested object paths', () => {
    const obj = {
      user: {
        name: 'John',
        address: {
          city: 'NYC',
          zip: '10001',
        },
      },
    };
    const paths = collectFieldPaths(obj);
    expect(paths).toContain('user');
    expect(paths).toContain('user.name');
    expect(paths).toContain('user.address');
    expect(paths).toContain('user.address.city');
    expect(paths).toContain('user.address.zip');
  });

  test('collects array paths with indices', () => {
    const obj = {
      items: ['a', 'b', 'c'],
    };
    const paths = collectFieldPaths(obj);
    expect(paths).toContain('items');
    expect(paths).toContain('items.0');
    expect(paths).toContain('items.1');
    expect(paths).toContain('items.2');
  });

  test('collects nested paths in arrays', () => {
    const obj = {
      users: [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' },
      ],
    };
    const paths = collectFieldPaths(obj);
    expect(paths).toContain('users');
    expect(paths).toContain('users.0');
    expect(paths).toContain('users.0.name');
    expect(paths).toContain('users.0.email');
    expect(paths).toContain('users.1');
    expect(paths).toContain('users.1.name');
    expect(paths).toContain('users.1.email');
  });

  test('handles empty objects', () => {
    const obj = {};
    const paths = collectFieldPaths(obj);
    expect(paths).toEqual([]);
  });

  test('handles null and undefined values', () => {
    const obj = { name: 'John', address: null, phone: undefined };
    const paths = collectFieldPaths(obj);
    expect(paths).toContain('name');
    expect(paths).toContain('address');
    expect(paths).toContain('phone');
  });

  test('stops at Date objects (treats as leaf)', () => {
    const obj = { createdAt: new Date('2024-01-01') };
    const paths = collectFieldPaths(obj);
    expect(paths).toContain('createdAt');
    expect(paths.length).toBe(1);
  });

  test('stops at a File, Map or Set, and walks the fields of a class instance', () => {
    const obj = {
      avatar: new File(['a'], 'a.txt'),
      tags: new Map([['a', 1]]),
      ids: new Set([1]),
      address: new Address(),
    };
    expect(collectFieldPaths(obj)).toEqual(['avatar', 'tags', 'ids', 'address', 'address.street', 'address.city']);
  });

  test('stops at a typed array instead of listing every byte', () => {
    expect(collectFieldPaths({ bytes: new Uint8Array(3) })).toEqual(['bytes']);
  });

  test('lists a value that contains itself once, and a value shared by two fields under both', () => {
    const root: Record<string, unknown> = { name: 'a' };
    root.self = root;
    const shared = { x: 1 };

    expect(collectFieldPaths(root)).toEqual(['name', 'self']);
    expect(collectFieldPaths({ p: shared, q: shared })).toEqual(['p', 'p.x', 'q', 'q.x']);
  });

  test('handles complex nested structures', () => {
    const obj = {
      user: {
        name: 'John',
        contacts: [
          { type: 'email', value: 'john@example.com' },
          { type: 'phone', value: '555-1234' },
        ],
      },
    };
    const paths = collectFieldPaths(obj);
    expect(paths).toContain('user');
    expect(paths).toContain('user.name');
    expect(paths).toContain('user.contacts');
    expect(paths).toContain('user.contacts.0');
    expect(paths).toContain('user.contacts.0.type');
    expect(paths).toContain('user.contacts.0.value');
    expect(paths).toContain('user.contacts.1');
    expect(paths).toContain('user.contacts.1.type');
    expect(paths).toContain('user.contacts.1.value');
  });
});

describe('deepMerge', () => {
  test('shallow keys merge normally', () => {
    const target: Record<string, unknown> = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    expect(deepMerge(target, source)).toEqual({ a: 1, b: 3, c: 4 });
  });

  test('nested objects merge recursively (partial nested update preserves sibling keys)', () => {
    const target = {
      address: { street: '123 Main', city: 'LA', zip: '10001' },
    };
    const source = { address: { city: 'NYC' } };
    const result = deepMerge(target, source);
    expect(result).toEqual({
      address: { street: '123 Main', city: 'NYC', zip: '10001' },
    });
  });

  test('arrays replace entirely', () => {
    const target = { tags: ['a', 'b', 'c'] };
    const source = { tags: ['x'] };
    expect(deepMerge(target, source)).toEqual({ tags: ['x'] });
  });

  test('Date values replace entirely', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2025-06-15');
    const target = { createdAt: d1 };
    const source = { createdAt: d2 };
    expect(deepMerge(target, source)).toEqual({ createdAt: d2 });
  });

  test('null replaces an existing object', () => {
    const target = { address: { city: 'LA' } } as Record<string, unknown>;
    const source = { address: null } as Record<string, unknown>;
    expect(deepMerge(target, source)).toEqual({ address: null });
  });

  test('keys not in source are preserved', () => {
    const target = { a: 1, b: 2, c: 3 };
    const source = { b: 20 };
    expect(deepMerge(target, source)).toEqual({ a: 1, b: 20, c: 3 });
  });

  test('deeply nested merge', () => {
    const target = {
      user: {
        name: 'John',
        address: { street: '123 Main', city: 'LA', zip: '90001' },
        settings: { theme: 'dark', lang: 'en' },
      },
    };
    const source = {
      user: {
        address: { city: 'NYC' },
        settings: { theme: 'light' },
      },
    };
    expect(deepMerge(target, source)).toEqual({
      user: {
        name: 'John',
        address: { street: '123 Main', city: 'NYC', zip: '90001' },
        settings: { theme: 'light', lang: 'en' },
      },
    });
  });

  test('does not mutate target', () => {
    const target = { address: { city: 'LA' } };
    const source = { address: { city: 'NYC' } };
    deepMerge(target, source);
    expect(target.address.city).toBe('LA');
  });

  test('a File replaces the File before it', () => {
    const next = new File(['b'], 'b.txt');
    const result = deepMerge({ avatar: new File(['a'], 'a.txt') }, { avatar: next });
    expect(result.avatar).toBe(next);
  });

  test('a Map, Set or class instance replaces the value before it', () => {
    const tags = new Map([['b', 2]]);
    const ids = new Set([2]);
    const when = new DayjsLike('2025-01-01');
    const target = { tags: new Map([['a', 1]]), ids: new Set([1]), when: new DayjsLike('2024-01-01') };
    const result = deepMerge(target, { tags, ids, when });
    expect(result.tags).toBe(tags);
    expect(result.ids).toBe(ids);
    expect(result.when).toBe(when);
  });

  test('a plain object merges into the fields of a class instance, as setFieldValue on each key would', () => {
    const result = deepMerge({ address: new Address() }, { address: { city: 'NYC' } });
    expect(result).toEqual({ address: { street: '1 Main', city: 'NYC' } });
  });

  test('a plain object replaces a value the form does not look inside', () => {
    const tags = { a: 2 };
    const target: Record<string, unknown> = { tags: new Map([['a', 1]]) };
    expect(deepMerge(target, { tags }).tags).toBe(tags);
  });

  test('a plain object from another realm merges like any plain object', () => {
    // As from an iframe, node:vm, or a test runner reading JSON from Node's own fetch
    const source = runInNewContext('({ address: { city: "NYC" } })') as Record<string, unknown>;
    const result = deepMerge({ address: { street: '1 Main', city: 'LA' } }, source);
    expect(result).toEqual({ address: { street: '1 Main', city: 'NYC' } });
  });

  test('a __proto__ key in the data is skipped, so the values keep their prototype', () => {
    const source = JSON.parse('{ "name": "Ann", "__proto__": { "isAdmin": true } }') as Record<string, unknown>;
    const result: Record<string, unknown> = deepMerge({ name: '' }, source);

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result.isAdmin).toBeUndefined();
    expect(result).toEqual({ name: 'Ann' });
  });

  test('a class instance replaces a plain object instead of being merged into', () => {
    const when = new DayjsLike('2025-01-01');
    const target: Record<string, unknown> = { when: { $d: new Date('2024-01-01'), note: 'x' } };
    const result = deepMerge(target, { when });
    expect(result.when).toBe(when);
  });

  test('null-prototype objects merge like plain objects', () => {
    const address = Object.assign(Object.create(null) as Record<string, unknown>, { city: 'NYC' });
    const result = deepMerge({ address: { street: '1 Main', city: 'LA' } }, { address });
    expect(result).toEqual({ address: { street: '1 Main', city: 'NYC' } });
  });
});

describe('deepEqual', () => {
  test('primitives: equal and unequal', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('hello', 'hello')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('a', 'b')).toBe(false);
    expect(deepEqual(true, false)).toBe(false);
  });

  test('Date comparison: same time and different times', () => {
    expect(deepEqual(new Date('2024-01-01'), new Date('2024-01-01'))).toBe(true);
    expect(deepEqual(new Date('2024-01-01'), new Date('2024-06-15'))).toBe(false);
  });

  test('RegExp comparison', () => {
    expect(deepEqual(/abc/gi, /abc/gi)).toBe(true);
    expect(deepEqual(/abc/, /def/)).toBe(false);
  });

  test('nested objects', () => {
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
    expect(deepEqual({ a: { b: 1 } }, { a: { c: 1 } })).toBe(false);
  });

  test('arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  test('mixed nesting', () => {
    const a = { users: [{ name: 'Alice', tags: ['admin'] }] };
    const b = { users: [{ name: 'Alice', tags: ['admin'] }] };
    const c = { users: [{ name: 'Alice', tags: ['user'] }] };
    expect(deepEqual(a, b)).toBe(true);
    expect(deepEqual(a, c)).toBe(false);
  });

  test('edge cases: null and undefined', () => {
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(undefined, undefined)).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual(null, { a: 1 })).toBe(false);
    expect(deepEqual({ a: 1 }, null)).toBe(false);
  });

  test('different types', () => {
    expect(deepEqual(1, '1')).toBe(false);
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual(0, false)).toBe(false);
    expect(deepEqual('', false)).toBe(false);
  });

  test('objects with different key counts', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  test('same reference returns true', () => {
    const obj = { a: 1 };
    expect(deepEqual(obj, obj)).toBe(true);
  });

  test('Files and Blobs compare by identity', () => {
    const file = new File(['a'], 'a.txt');
    expect(deepEqual(new File(['a'], 'a.txt'), new File(['a'], 'a.txt'))).toBe(false);
    expect(deepEqual(file, file)).toBe(true);
    expect(deepEqual(new Blob(['a']), new Blob(['a']))).toBe(false);
  });

  test('objects that hide their state compare by identity', () => {
    expect(deepEqual(new Map(), new Map())).toBe(false);
    expect(deepEqual(Temporal.PlainDate.from('2024-01-01'), Temporal.PlainDate.from('2024-01-02'))).toBe(false);
  });

  test('class instances with own fields compare by content', () => {
    expect(deepEqual(new DayjsLike('2024-01-01'), new DayjsLike('2024-01-01'))).toBe(true);
    expect(deepEqual(new DayjsLike('2024-01-01'), new DayjsLike('2024-06-15'))).toBe(false);
  });

  test('null-prototype objects compare by content', () => {
    const withName = (name: string) => Object.assign(Object.create(null) as Record<string, unknown>, { name });

    expect(deepEqual(withName('a'), withName('a'))).toBe(true);
    expect(deepEqual(withName('a'), withName('b'))).toBe(false);
    expect(deepEqual(Object.create(null), Object.create(null))).toBe(true);
  });

  test('a null-prototype object equals a plain object with the same content', () => {
    const bare = Object.assign(Object.create(null) as Record<string, unknown>, { name: 'a' });

    expect(deepEqual(bare, { name: 'a' })).toBe(true);
    expect(deepEqual({ name: 'a' }, bare)).toBe(true);
  });

  test('an array never equals an object with the same keys', () => {
    expect(deepEqual({ 0: 'x' }, ['x'])).toBe(false);
    expect(deepEqual(['x'], { 0: 'x' })).toBe(false);
    expect(deepEqual({ tags: { 0: 'x' } }, { tags: ['x'] })).toBe(false);
  });

  test("an object's class doesn't count: a class instance equals a plain copy of its fields", () => {
    // setFieldValue rebuilds the objects on a field's path as plain objects
    const address = new Address();
    const copy = { ...address };

    expect(deepEqual(copy, address)).toBe(true);
    expect(deepEqual(address, copy)).toBe(true);
  });

  test('two invalid Dates are equal', () => {
    expect(deepEqual(new Date(''), new Date(''))).toBe(true);
    expect(deepEqual(new Date(''), new Date('2024-01-01'))).toBe(false);
  });

  test('an object from another realm compares by content', () => {
    expect(deepEqual(runInNewContext('({})'), {})).toBe(true);
    expect(deepEqual(runInNewContext('({ name: "a" })'), { name: 'a' })).toBe(true);
  });

  test('a Map or Set compares by identity, even with fields of its own', () => {
    class Registry extends Map<string, number> {
      label = 'x';
    }
    class Tags extends Set<string> {
      label = 'x';
    }

    expect(deepEqual(new Registry([['a', 1]]), new Registry([['b', 2]]))).toBe(false);
    expect(deepEqual(new Tags(['a']), new Tags(['b']))).toBe(false);
  });

  test('typed arrays compare by identity', () => {
    const bytes = new Uint8Array([1, 2]);

    expect(deepEqual(bytes, bytes)).toBe(true);
    expect(deepEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(false);
  });

  test('values that contain themselves compare without overflowing the stack', () => {
    type TreeNode = { name: string; parent?: TreeNode; child?: TreeNode };
    const tree = (name: string): TreeNode => {
      const root: TreeNode = { name };
      root.child = { name: 'leaf', parent: root };
      return root;
    };

    expect(deepEqual(tree('a'), tree('a'))).toBe(true);
    expect(deepEqual(tree('a'), tree('b'))).toBe(false);
  });
});

describe('tuple field paths (runtime)', () => {
  test('getValueByPath reads tuple element by dot notation', () => {
    const obj = { position: [10, 20, 30] as [number, number, number] };
    expect(getValueByPath<typeof obj, number>(obj, 'position.0')).toBe(10);
    expect(getValueByPath<typeof obj, number>(obj, 'position.1')).toBe(20);
    expect(getValueByPath<typeof obj, number>(obj, 'position.2')).toBe(30);
  });

  test('setValueByPath sets tuple element immutably', () => {
    const obj = { position: [10, 20, 30] as [number, number, number] };
    const updated = setValueByPath(obj, 'position.1', 99);
    expect(updated.position[1]).toBe(99);
    expect(obj.position[1]).toBe(20); // original untouched
  });
});

describe('own', () => {
  test("reads the record's own entry, never an inherited member", () => {
    const record: Record<string, string> = { name: 'a' };

    expect(own(record, 'name')).toBe('a');
    expect(own(record, 'constructor')).toBeUndefined();
    expect(own({ constructor: 'b' }, 'constructor')).toBe('b');
  });
});

describe('isPromiseLike', () => {
  test('takes a native promise, a promise from another realm and any other thenable', () => {
    expect(isPromiseLike(Promise.resolve('a'))).toBe(true);
    expect(isPromiseLike(runInNewContext('Promise.resolve("a")'))).toBe(true);
    expect(isPromiseLike({ then: () => {} })).toBe(true);
  });

  test('takes no other value', () => {
    expect(isPromiseLike('a')).toBe(false);
    expect(isPromiseLike(undefined)).toBe(false);
    expect(isPromiseLike(null)).toBe(false);
    expect(isPromiseLike({ ok: true, value: 'a' })).toBe(false);
    expect(isPromiseLike({ then: 'a' })).toBe(false);
  });
});
