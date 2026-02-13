import {
  object,
  optional,
  chain,
  string,
  minLength,
  pattern,
  required,
  nonEmpty,
  email,
  parseNumber,
  parseDate,
  parseBool,
  matches,
  stringEnum,
  type InferSchemaType,
  array,
  min,
} from '@railway-ts/pipelines/schema';

export const addressSchema = object({
  street: optional(chain(string(), minLength(3))),
  city: optional(chain(string(), minLength(2))),
  zipCode: optional(chain(string(), pattern(/^\d{5}$/))),
});

export const userSchema = object({
  username: required(
    chain(string(), nonEmpty('Username is required'), minLength(3))
  ),
  email: required(chain(string(), nonEmpty('Email is required'), email())),
  password: required(
    chain(string(), nonEmpty('Password is required'), minLength(8))
  ),
  age: required(chain(parseNumber(), min(18, 'Must be 18 or older'))),
  birthdate: required(parseDate()),
  hasAcceptedTerms: required(
    chain(parseBool(), matches(true, 'You must check this field'))
  ),
  role: required(stringEnum(['admin', 'user'])),
  address: optional(addressSchema),
  contacts: optional(array(stringEnum(['email', 'phone']))),
});

export type User = InferSchemaType<typeof userSchema>;
