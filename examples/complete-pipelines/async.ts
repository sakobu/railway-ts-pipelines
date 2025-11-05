import { pipe } from '@/composition';
import { err, fromPromise, match, ok, andThen, type Result } from '@/result';
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
  type ValidationResult,
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

  return match(result, {
    ok: (post) => ok(post),
    err: (msg) => err([{ path: ['api'], message: msg }]),
  });
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

  return match(result, {
    ok: (post) => ok(post),
    err: (msg) => err([{ path: ['api'], message: String(msg) }]),
  });
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

  const result = await pipe(
    validationResult,
    (r) => andThen(r, createPost),
    (r) => andThen(r, addTimestamp),
  );

  return match<EnrichedPost, ValidationError[], ValidationResult<EnrichedPost>>(result, {
    ok: (post) => ({ valid: true, data: post }),
    err: (errors) => ({ valid: false, errors: formatErrors(errors) }),
  });
};

// Main pipeline (API failure demo)
const validateAndCreateWithApiFailure = async (input: unknown) => {
  const validationResult = validate(input, createPostSchema);

  const result = await pipe(
    validationResult,
    (r) => andThen(r, createPostFailing),
    (r) => andThen(r, addTimestamp),
  );

  return match<EnrichedPost, ValidationError[], ValidationResult<EnrichedPost>>(result, {
    ok: (post) => ({ valid: true, data: post }),
    err: (errors) => ({ valid: false, errors: formatErrors(errors) }),
  });
};

// Usage
const validInput = {
  title: 'Hello World',
  body: 'This is my first post content',
  userId: '1',
};

const invalidInput = {
  title: 'Hi',
  body: 'Short',
  userId: '0',
};

console.log('Valid:', await validateAndCreate(validInput));
console.log('Invalid:', await validateAndCreate(invalidInput));
console.log('API Fail:', await validateAndCreateWithApiFailure(validInput));
