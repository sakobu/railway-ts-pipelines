import {
  pipe,
  some,
  none,
  ok,
  err,
  mapToResult,
  mapToOption,
  matchResult,
  matchOption,
  fromNullableOption,
} from '@/index';

// Example 1: Option -> Result (Add error context)
console.log('=== Option -> Result: Adding Error Context ===');

// Problem: Option loses error information
type Users = Partial<Record<string, string>>;
const users: Users = { '1': 'Alice', '2': 'Bob' };
const findUser = (id: string) => fromNullableOption(users[id]);

// Solution: Convert to Result to provide specific error info
const getUserWithError = (id: string) => {
  const userOption = findUser(id);
  return mapToResult(userOption, `User with ID ${id} not found`);
};

const found = getUserWithError('1');
const missing = getUserWithError('3');

matchResult(found, {
  ok: (user) => console.log(`Found: ${user}`),
  err: (error) => console.log(`Error: ${error}`),
}); // "Found: Alice"

matchResult(missing, {
  ok: (user) => console.log(`Found: ${user}`),
  err: (error) => console.log(`Error: ${error}`),
}); // "Error: User with ID 3 not found"

// Example 2: Result -> Option (Drop error details)
console.log('\n=== Result -> Option: Simplify to Success/Failure ===');

// Problem: Sometimes you only care if something worked, not why it failed
function parseNumber(input: string) {
  const num = Number(input);
  return isNaN(num) ? err('Not a valid number') : ok(num);
}

// Solution: Convert Result to Option when error details don't matter
const tryParseNumber = (input: string) => mapToOption(parseNumber(input));

const validNum = tryParseNumber('42');
const invalidNum = tryParseNumber('not a number');

matchOption(validNum, {
  some: (num) => console.log(`Parsed: ${num}`),
  none: () => console.log('Failed to parse'),
}); // "Parsed: 42"

matchOption(invalidNum, {
  some: (num) => console.log(`Parsed: ${num}`),
  none: () => console.log('Failed to parse'),
}); // "Failed to parse"

// Example 3: Mixed Workflow
console.log('\n=== Mixed Workflow: Option + Result ===');

const config = { apiKey: 'secret123' };
const getApiKey = () => (config.apiKey ? some(config.apiKey) : none<string>());

function makeApiCall(apiKey: string) {
  // Simulate API call that might fail
  return apiKey === 'secret123' ? ok('API response data') : err('Invalid API key');
}

// Workflow: Option (config lookup) -> Result (API call with error details)
const apiResult = pipe(
  getApiKey(),
  (keyOption) => mapToResult(keyOption, 'API key not configured'),
  (keyResult) =>
    matchResult(keyResult, {
      ok: (key) => makeApiCall(key),
      err: (error) => err(error),
    }),
);

matchResult(apiResult, {
  ok: (data) => console.log(`API Success: ${data}`),
  err: (error) => console.log(`API Error: ${error}`),
}); // "API Success: API response data"

// Test with missing config
const missingConfig = { apiKey: undefined as string | undefined };
const getApiKey2 = () => (missingConfig.apiKey ? some(missingConfig.apiKey) : none<string>());

const apiResult2 = pipe(
  getApiKey2(),
  (keyOption) => mapToResult(keyOption, 'API key not configured'),
  (keyResult) =>
    matchResult(keyResult, {
      ok: (key) => makeApiCall(key),
      err: (error) => err(error),
    }),
);

matchResult(apiResult2, {
  ok: (data) => console.log(`API Success: ${data}`),
  err: (error) => console.log(`API Error: ${error}`),
}); // "API Error: API key not configured"
