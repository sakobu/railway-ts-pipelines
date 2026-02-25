import {
  object,
  required,
  chain,
  string,
  nonEmpty,
  minLength,
  email,
  stringEnum,
  array,
  optional,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

const memberSchema = object({
  name: required(chain(string(), nonEmpty('Name is required'), minLength(2))),
  email: required(chain(string(), nonEmpty('Email is required'), email())),
  role: required(stringEnum(['developer', 'designer', 'manager'] as const)),
});

export const teamSchema = object({
  teamName: required(
    chain(string(), nonEmpty('Team name is required'), minLength(2))
  ),
  teamMembers: optional(array(memberSchema)),
});

export type Team = InferSchemaType<typeof teamSchema>;
