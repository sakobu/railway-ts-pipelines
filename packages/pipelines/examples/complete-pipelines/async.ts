import { pipeAsync } from '@/composition';
import { flatMapWith, fromPromise, mapErr, match, ok, type Result } from '@/result';
import {
  formatErrors,
  object,
  required,
  chain,
  string,
  minLength,
  parseNumber,
  min,
  validate,
  type ValidationError,
  type InferSchemaType,
} from '@/schema';

// Schema
const createPostSchema = object({
  title: required(chain(string(), minLength(5, 'Title too short'))),
  body: required(chain(string(), minLength(10, 'Body too short'))),
  userId: required(chain(parseNumber(), min(1, 'Invalid user ID'))),
});

type PostInput = InferSchemaType<typeof createPostSchema>;

// Small pure helper to surface non-2xx responses as errors in schema validation results with path "api"
const toJsonIfOk = (res: Response) => (res.ok ? res.json() : Promise.reject(`HTTP ${res.status}`));

// API call wrapped in Result
const createPost = async (data: PostInput): Promise<Result<PostInput, ValidationError[]>> => {
  const result = await fromPromise(
    fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    }).then(toJsonIfOk),
  );

  return mapErr(result, (msg) => [{ path: ['api'], message: String(msg) }]);
};

// Failing API variant to demo non-validation failure (e.g., 404)
const createPostFailing = async (data: PostInput): Promise<Result<PostInput, ValidationError[]>> => {
  const result = await fromPromise(
    fetch('https://jsonplaceholder.typicode.com/bad-endpoint', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    }).then(toJsonIfOk),
  );

  return mapErr(result, (msg) => [{ path: ['api'], message: String(msg) }]);
};

// Define an enriched post type
type EnrichedPost = PostInput & { createdAt: string };

// Optional enrichment step to demonstrate chained steps
const addTimestamp = async (post: PostInput): Promise<Result<EnrichedPost, ValidationError[]>> => {
  // Simulate async work
  await new Promise((resolve) => setTimeout(resolve, 50));
  return ok({ ...post, createdAt: new Date().toISOString() });
};

// Main pipeline
const validateAndCreate = async (input: unknown) => {
  const validationResult = validate(input, createPostSchema);

  const result = await pipeAsync(validationResult, flatMapWith(createPost), flatMapWith(addTimestamp));

  return match(result, {
    ok: (post) => ({ valid: true as const, data: post }),
    err: (errors) => ({ valid: false as const, errors: formatErrors(errors) }),
  });
};

// Main pipeline (API failure demo)
const validateAndCreateWithApiFailure = async (input: unknown) => {
  const validationResult = validate(input, createPostSchema);

  const result = await pipeAsync(validationResult, flatMapWith(createPostFailing), flatMapWith(addTimestamp));

  return match(result, {
    ok: (post) => ({ valid: true as const, data: post }),
    err: (errors) => ({ valid: false as const, errors: formatErrors(errors) }),
  });
};

// === validateAndCreate: Valid Input ===
console.log('=== validateAndCreate: Valid Input ===');

const validInput = {
  title: 'Hello World',
  body: 'This is my first post content',
  userId: '1',
};

console.log(await validateAndCreate(validInput));

// === validateAndCreate: Invalid Input ===
console.log('\n=== validateAndCreate: Invalid Input ===');

const invalidInput = {
  title: 'Hi',
  body: 'Short',
  userId: '0',
};

console.log(await validateAndCreate(invalidInput));

// === validateAndCreate: API Failure ===
console.log('\n=== validateAndCreate: API Failure ===');

console.log(await validateAndCreateWithApiFailure(validInput));
