import { pipe, pipeAsync, flowAsync } from '@/composition';
import { ok, err, match, type Result } from '@/result';

// === Async Composition with pipeAsync ===
console.log('=== Async Composition with pipeAsync ===');

// Simulated async operations
type User = { id: number; name: string; role: string };
type EnrichedUser = User & { permissions: string[] };

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchUser = async (userId: number) => {
  await delay(10);
  const users: Record<number, User> = {
    1: { id: 1, name: 'Alice', role: 'admin' },
    2: { id: 2, name: 'Bob', role: 'user' },
  };
  const user = users[userId];
  return user ? ok(user) : err(`User ${userId} not found`);
};

const validateUser = async (result: Result<User, string>) => {
  if (!result.ok) return result;
  await delay(10);
  return result.value.name.length > 0 ? ok(result.value) : err('Invalid user: empty name');
};

const enrichWithPermissions = async (result: Result<User, string>) => {
  if (!result.ok) return result;
  await delay(10);
  const permissionMap: Record<string, string[]> = {
    admin: ['read', 'write', 'delete'],
    user: ['read'],
  };
  return ok({ ...result.value, permissions: permissionMap[result.value.role] ?? [] });
};

const asyncPipeline = (userId: number) => pipeAsync(userId, fetchUser, validateUser, enrichWithPermissions);

const result1 = await asyncPipeline(1);
match(result1, {
  ok: (user) => console.log(`Found: ${user.name} with permissions: ${user.permissions.join(', ')}`),
  err: (error) => console.log(`Error: ${error}`),
}); // "Found: Alice with permissions: read, write, delete"

const result2 = await asyncPipeline(999);
match(result2, {
  ok: (user) => console.log(`Found: ${user.name}`),
  err: (error) => console.log(`Error: ${error}`),
}); // "Error: User 999 not found"

// === Reusable Composition with flowAsync ===
console.log('\n=== Reusable Composition with flowAsync ===');

// flowAsync creates a reusable composed function (like flow, but awaits between steps)
const processUser = flowAsync(fetchUser, validateUser, enrichWithPermissions);

// Now processUser is a standalone function that can be reused
const alice = await processUser(1);
const bob = await processUser(2);

match(alice, {
  ok: (user) => console.log(`${user.name}: ${user.permissions.join(', ')}`),
  err: (error) => console.log(`Error: ${error}`),
}); // "Alice: read, write, delete"

match(bob, {
  ok: (user) => console.log(`${user.name}: ${user.permissions.join(', ')}`),
  err: (error) => console.log(`Error: ${error}`),
}); // "Bob: read"

// === Mixing Sync and Async Steps ===
console.log('\n=== Mixing Sync and Async Steps ===');

// pipeAsync/flowAsync can mix sync and async steps freely
const formatUserName = (result: Result<EnrichedUser, string>) => {
  if (!result.ok) return result;
  return ok({ ...result.value, name: result.value.name.toUpperCase() });
};

const mixedPipeline = flowAsync(
  fetchUser,
  validateUser,
  enrichWithPermissions,
  formatUserName, // sync step — works seamlessly
);

const formatted = await mixedPipeline(1);
match(formatted, {
  ok: (user) => console.log(`Formatted: ${user.name}`),
  err: (error) => console.log(`Error: ${error}`),
}); // "Formatted: ALICE"

// === Comparison: pipe (sync) vs pipeAsync ===
console.log('\n=== Comparison: pipe vs pipeAsync ===');

// With sync pipe, you'd have to manually await each step:
const withSyncPipe = async (userId: number) =>
  pipe(
    await fetchUser(userId),
    async (r) => await validateUser(r),
    async (p) => await enrichWithPermissions(await p),
  );

// With pipeAsync, each step is automatically awaited:
const withAsyncPipe = (userId: number) => pipeAsync(userId, fetchUser, validateUser, enrichWithPermissions);

const syncResult = await withSyncPipe(1);
const asyncResult = await withAsyncPipe(1);

match(syncResult, {
  ok: (user) => console.log(`Sync pipe: ${user.name}`),
  err: (error) => console.log(`Error: ${error}`),
}); // "Sync pipe: Alice"

match(asyncResult, {
  ok: (user) => console.log(`Async pipe: ${user.name}`),
  err: (error) => console.log(`Error: ${error}`),
}); // "Async pipe: Alice"
