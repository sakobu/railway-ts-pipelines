import {
  object,
  required,
  optional,
  chain,
  chainAsync,
  refineAsync,
  string,
  nonEmpty,
  minLength,
  email,
  parseNumber,
  parseDate,
  parseBool,
  matches,
  stringEnum,
  array,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';
import { addressSchema } from './userSchema';

// Simulated server-side username check
const checkUsernameAvailable = async (username: string): Promise<boolean> => {
  await new Promise((r) => setTimeout(r, 500));
  return !['admin', 'taken'].includes(username.toLowerCase());
};

export const asyncUserSchema = object({
  username: required(
    chainAsync(
      string(),
      nonEmpty('Username is required'),
      minLength(3),
      refineAsync(checkUsernameAvailable, 'Username is already taken'),
    ),
  ),
  email: required(chain(string(), nonEmpty('Email is required'), email())),
  password: required(chain(string(), nonEmpty('Password is required'), minLength(8))),
  age: required(parseNumber()),
  birthdate: required(parseDate()),
  hasAcceptedTerms: required(chain(parseBool(), matches(true, 'You must check this field'))),
  role: required(stringEnum(['admin', 'user'])),
  address: optional(addressSchema),
  contacts: optional(array(stringEnum(['email', 'phone']))),
});

export type AsyncUser = InferSchemaType<typeof asyncUserSchema>;
