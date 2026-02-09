import { isErr } from '@/result';
import {
  chain,
  chainAsync,
  email,
  formatErrors,
  minLength,
  object,
  refineAsync,
  refineAtAsync,
  required,
  string,
  validate,
  validateAndFormatResult,
  type InferSchemaType,
} from '@/schema';

// Simulated async lookups (in-memory "database")
const existingUsernames = new Set(['alice', 'bob', 'charlie']);
const existingEmails = new Map([
  ['alice@acme.com', 'acme'],
  ['bob@widgets.com', 'widgets'],
]);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isUsernameAvailable = async (username: string): Promise<boolean> => {
  await delay(10);
  return !existingUsernames.has(username.toLowerCase());
};

const isEmailAvailableForOrg = async (email: string, org: string): Promise<boolean> => {
  await delay(10);
  const registeredOrg = existingEmails.get(email.toLowerCase());
  return registeredOrg !== org;
};

// === refineAsync: Single-field async validation ===
console.log('=== refineAsync: Username Availability ===');

// Compose sync validators with an async refinement
const usernameValidator = chainAsync(
  string(),
  minLength(3),
  refineAsync<string>(isUsernameAvailable, 'Username is already taken'),
);

// Validate usernames
const available = await validate('dave', usernameValidator);
const taken = await validate('alice', usernameValidator);
const tooShort = await validate('ab', usernameValidator);

console.log('dave:', available.ok ? 'available' : formatErrors(available.error)); // available
console.log('alice:', taken.ok ? 'available' : formatErrors(taken.error)); // { "": "Username is already taken" }
console.log('ab:', tooShort.ok ? 'available' : formatErrors(tooShort.error)); // { "": "Must be at least 3 characters" }

// === Object schema with mixed sync/async fields ===
console.log('\n=== Object Schema with Async Fields ===');

// When any field uses an async validator, the object schema automatically returns a Promise
const registrationSchema = object({
  username: required(
    chainAsync(string(), minLength(3), refineAsync<string>(isUsernameAvailable, 'Username is already taken')),
  ),
  email: required(chain(string(), email())), // sync field
  password: required(chain(string(), minLength(8))), // sync field
  organization: required(string()), // sync field
});

export type RegistrationData = InferSchemaType<typeof registrationSchema>;
// Inferred: { username: string; email: string; password: string; organization: string }

const validInput = {
  username: 'dave',
  email: 'dave@example.com',
  password: 'securepass123',
  organization: 'acme',
};

const invalidInput = {
  username: 'al', // too short
  email: 'not-an-email', // invalid format
  password: 'short', // too short
  organization: 'acme',
};

// validate() returns a Promise when the schema is async
const validResult = await validate(validInput, registrationSchema);
const invalidResult = await validate(invalidInput, registrationSchema);

console.log('Valid input:', validResult.ok ? 'passed' : 'failed');
// "Valid input: passed"

if (isErr(invalidResult)) {
  console.log('Invalid input errors:', formatErrors(invalidResult.error));
  // { username: "Must be at least 3 characters", email: "Invalid email format", password: "Must be at least 8 characters" }
}

// === refineAtAsync: Cross-field async validation ===
console.log('\n=== refineAtAsync: Cross-field Async Validation ===');

// Scenario: Check if email is already registered for the given organization
const orgRegistrationSchema = chainAsync(
  object({
    email: required(chain(string(), email())),
    organization: required(string()),
  }),
  refineAtAsync(
    'email',
    async (data: { email: string; organization: string }) => {
      return isEmailAvailableForOrg(data.email, data.organization);
    },
    'Email is already registered for this organization',
  ),
);

export type OrgRegistrationData = InferSchemaType<typeof orgRegistrationSchema>;
// Inferred: { email: string; organization: string }

const newOrgEmail = await validate({ email: 'dave@example.com', organization: 'acme' }, orgRegistrationSchema);
console.log('New email for org:', newOrgEmail.ok ? 'passed' : formatErrors(newOrgEmail.error));
// "New email for org: passed"

const existingOrgEmail = await validate({ email: 'alice@acme.com', organization: 'acme' }, orgRegistrationSchema);
console.log('Existing email for org:', existingOrgEmail.ok ? 'passed' : formatErrors(existingOrgEmail.error));
// "Existing email for org: { email: "Email is already registered for this organization" }"

// === validateAndFormatResult with async schemas ===
console.log('\n=== validateAndFormatResult with Async Schemas ===');

// validateAndFormatResult works with async schemas too — returns Promise<ValidationResult>
const formResult = await validateAndFormatResult(invalidInput, registrationSchema);

if (formResult.valid) {
  console.log('Form data:', formResult.data);
} else {
  console.log('Form errors:', formResult.errors);
  // { username: "Must be at least 3 characters", email: "Invalid email format", password: "Must be at least 8 characters" }
}

const successResult = await validateAndFormatResult(validInput, registrationSchema);

if (successResult.valid) {
  console.log('Registration data:', successResult.data);
  // { username: "dave", email: "dave@example.com", password: "securepass123", organization: "acme" }
}
