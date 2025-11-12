import { describe, test, expect } from 'bun:test';
import {
  getValueByPath,
  setValueByPath,
  isPathAffected,
  collectFieldPaths,
} from '../../src/utils';

describe('getValueByPath', () => {
  test('gets top-level property', () => {
    const obj = { name: 'John', age: 30 };
    expect(getValueByPath<typeof obj, string>(obj, 'name')).toBe('John');
    expect(getValueByPath<typeof obj, number>(obj, 'age')).toBe(30);
  });

  test('gets nested property with dot notation', () => {
    const obj = { user: { name: 'John', address: { city: 'NYC' } } };
    expect(getValueByPath<typeof obj, string>(obj, 'user.name')).toBe('John');
    expect(getValueByPath<typeof obj, string>(obj, 'user.address.city')).toBe(
      'NYC'
    );
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
    expect(getValueByPath<typeof obj, string>(obj, 'users[0].name')).toBe(
      'John'
    );
    expect(getValueByPath<typeof obj, string>(obj, 'users[1].email')).toBe(
      'jane@example.com'
    );
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
    expect(paths).toContain('items[0]');
    expect(paths).toContain('items[1]');
    expect(paths).toContain('items[2]');
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
    expect(paths).toContain('users[0]');
    expect(paths).toContain('users[0].name');
    expect(paths).toContain('users[0].email');
    expect(paths).toContain('users[1]');
    expect(paths).toContain('users[1].name');
    expect(paths).toContain('users[1].email');
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
    expect(paths).toContain('user.contacts[0]');
    expect(paths).toContain('user.contacts[0].type');
    expect(paths).toContain('user.contacts[0].value');
    expect(paths).toContain('user.contacts[1]');
    expect(paths).toContain('user.contacts[1].type');
    expect(paths).toContain('user.contacts[1].value');
  });
});
