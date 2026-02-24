import { isOk } from '@/result';
import {
  chain,
  chainAsync,
  email,
  type InferSchemaType,
  is,
  minLength,
  number,
  object,
  refineAsync,
  required,
  string,
  validate,
} from '@/schema';

// === Primitives ===
console.log('=== Primitives ===');

console.log('is("hello", string()):', is('hello', string())); // true
console.log('is(42, string()):', is(42, string())); // false
console.log('is(42, number()):', is(42, number())); // true
console.log('is("nope", number()):', is('nope', number())); // false

// === Chained validators ===
console.log('\n=== Chained validators ===');

const shortString = chain(string(), minLength(5));
console.log('is("hello", minLength(5)):', is('hello', shortString)); // true
console.log('is("hi", minLength(5)):', is('hi', shortString)); // false

// === Objects ===
console.log('\n=== Objects ===');

const userSchema = object({
  name: required(chain(string(), minLength(2))),
  email: required(chain(string(), email())),
});

export type IsUser = InferSchemaType<typeof userSchema>;
// { name: string; email: string }

console.log('valid user:', is({ name: 'Alice', email: 'alice@example.com' }, userSchema)); // true
console.log('bad email:', is({ name: 'Alice', email: 'nope' }, userSchema)); // false
console.log('missing name:', is({ email: 'alice@example.com' }, userSchema)); // false

// === Nested objects ===
console.log('\n=== Nested objects ===');

const profileSchema = object({
  user: required(userSchema),
  bio: required(chain(string(), minLength(5))),
});

export type IsProfile = InferSchemaType<typeof profileSchema>;
// { user: { name: string; email: string }; bio: string }

console.log('valid profile:', is({ user: { name: 'Alice', email: 'a@b.com' }, bio: 'Hello world' }, profileSchema)); // true
console.log('bad nested:', is({ user: { name: 'Alice', email: 'nope' }, bio: 'Hello world' }, profileSchema)); // false

// === vs validate() ===
console.log('\n=== is() vs validate() ===');

// is() is a shorthand for the common "just tell me if it's valid" pattern:
const value = 'alice@example.com';
const emailValidator = chain(string(), email());

const withValidate = isOk(validate(value, emailValidator));
const withIs = is(value, emailValidator);

console.log('isOk(validate(...)):', withValidate); // true
console.log('is(...):', withIs); // true
// Both return the same boolean — is() is just shorter.

// === Async validators ===
console.log('\n=== Async validators ===');

const takenUsernames = new Set(['alice', 'bob']);

const usernameValidator = chainAsync(
  string(),
  minLength(3),
  refineAsync(async (name) => !takenUsernames.has(name), 'Username taken'),
);

// is() returns a Promise when given an async validator
console.log('await is("dave", asyncValidator):', await is('dave', usernameValidator)); // true
console.log('await is("alice", asyncValidator):', await is('alice', usernameValidator)); // false
