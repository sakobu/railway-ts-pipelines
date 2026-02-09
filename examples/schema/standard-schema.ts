import {
  chain,
  email,
  minLength,
  number,
  object,
  required,
  string,
  toStandardSchema,
  validate,
  type StandardSchemaV1,
  type InferSchemaType,
} from '@/schema';

// === object + chain: Building a Validator ===
console.log('=== object + chain: Building a Validator ===');

const userValidator = object({
  name: required(chain(string(), minLength(2))),
  email: required(chain(string(), email())),
  age: required(number()),
});

// Infer the type from your validator (railway-ts's own inference)
type User = InferSchemaType<typeof userValidator>;
// { name: string; email: string; age: number }

// === validate: Direct Usage ===
console.log('\n=== validate: Direct Usage ===');

const valid = validate({ name: 'Alice', email: 'alice@example.com', age: 30 }, userValidator);
console.log('Valid result:', valid);
// { ok: true, value: { name: "Alice", email: "alice@example.com", age: 30 } }

const invalid = validate({ name: 'A', email: 'not-an-email', age: 'thirty' }, userValidator);
console.log('Invalid result:', invalid);
// { ok: false, error: [ ...validation errors... ] }

// === toStandardSchema: Framework Handoff ===
console.log('\n=== toStandardSchema: Framework Handoff ===');

// One-liner bridge: wrap your validator for any Standard Schema consumer
const userSchema = toStandardSchema(userValidator);

// Simulated framework function — this is what a framework does internally.
// You don't write this code; the framework (tRPC, TanStack Form, etc.) does.
async function registerWithFramework(schema: StandardSchemaV1<unknown, User>) {
  console.log(
    'Framework received schema (version %d, vendor: %s)',
    schema['~standard'].version,
    schema['~standard'].vendor,
  );

  // Under the hood the framework calls ~standard.validate():
  const result = await schema['~standard'].validate({ name: 'Bob', email: 'bob@test.com', age: 25 });
  if (!('issues' in result) || !result.issues) {
    console.log('Framework parsed value:', result.value);
  }

  const badResult = await schema['~standard'].validate({ name: '', email: 'nope', age: null });
  if ('issues' in badResult && badResult.issues) {
    console.log('Framework caught %d issue(s):', badResult.issues.length);
    for (const issue of badResult.issues) {
      console.log('  [%s] %s', (issue.path ?? []).join('.'), issue.message);
    }
  }
}

// Pass the wrapped schema to the framework — you just hand it off.
await registerWithFramework(userSchema);
