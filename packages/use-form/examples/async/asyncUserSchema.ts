import {
  object,
  required,
  chain,
  chainAsync,
  string,
  nonEmpty,
  minLength,
  email,
  stringEnum,
  refineAtAsync,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

// Simulated server-side check: is this username taken at this org?
const checkUsernameAtOrg = async (
  username: string,
  org: string
): Promise<boolean> => {
  await new Promise((r) => setTimeout(r, 500));
  const taken: Record<string, string[]> = {
    'acme-corp': ['admin', 'alice'],
    globex: ['admin', 'bob'],
    initech: ['admin', 'carol'],
  };
  return !(taken[org] ?? []).includes(username.toLowerCase());
};

// Define base schema first so we can infer the type for refineAtAsync
const baseSchema = object({
  username: required(
    chain(string(), nonEmpty('Username is required'), minLength(3))
  ),
  email: required(chain(string(), nonEmpty('Email is required'), email())),
  organization: required(stringEnum(['acme-corp', 'globex', 'initech'])),
});

export type AsyncUser = InferSchemaType<typeof baseSchema>;

// Wrap with cross-field async check.
// This fires on ANY field change — so changing the org dropdown re-checks automatically.
// fieldValidators can't do this: they only fire when their own field changes.
export const asyncUserSchema = chainAsync(
  baseSchema,
  refineAtAsync<AsyncUser>(
    'username',
    async (data) => checkUsernameAtOrg(data.username, data.organization),
    'Username is already taken at this organization'
  )
);
