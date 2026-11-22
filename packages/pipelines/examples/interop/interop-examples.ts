import { pipe } from '@/composition';
import { fromNullable, mapToResult, match as matchOption, none, some } from '@/option';
import { err, mapToOption, match as matchResult, ok } from '@/result';

// === mapToResult: Option to Result ===
console.log('=== mapToResult: Option to Result ===');

type Users = Partial<Record<string, string>>;
const users: Users = { '1': 'Alice', '2': 'Bob' };
const findUser = (id: string) => fromNullable(users[id]);

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

// === mapToOption: Result to Option ===
console.log('\n=== mapToOption: Result to Option ===');

function parseNumber(input: string) {
  const num = Number(input);
  return isNaN(num) ? err('Not a valid number') : ok(num);
}

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

// === Mixed Workflow: Option + Result ===
console.log('\n=== Mixed Workflow: Option + Result ===');

const config = { apiKey: 'secret123' };
const getApiKey = () => (config.apiKey ? some(config.apiKey) : none<string>());

function makeApiCall(apiKey: string) {
  return apiKey === 'secret123' ? ok('API response data') : err('Invalid API key');
}

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

const missingConfig = { apiKey: undefined as string | undefined };
const getApiKey2 = () => (missingConfig.apiKey ? some(missingConfig.apiKey) : none());

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
