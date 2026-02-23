import { isErr } from '@/result';
import {
  array,
  chain,
  email,
  formatErrors,
  minLength,
  object,
  required,
  string,
  stringEnum,
  validate,
  validateAndFormatResult,
} from '@/schema';

// A schema with multiple required fields — bad input will trigger several errors
const userSchema = object({
  name: required(chain(string(), minLength(3))),
  email: required(chain(string(), email())),
  role: required(stringEnum(['admin', 'user'])),
});

const badInput = { name: '', email: 'nope', role: 'superadmin' };

// === validate(): default (all errors) vs abortEarly ===
console.log('=== validate(): default vs abortEarly ===');

const allErrors = validate(badInput, userSchema);
if (isErr(allErrors)) {
  console.log(`Default  — ${allErrors.error.length} error(s):`, formatErrors(allErrors.error));
  // 3 errors: name, email, role
}

const firstOnly = validate(badInput, userSchema, { abortEarly: true });
if (isErr(firstOnly)) {
  console.log(`abortEarly — ${firstOnly.error.length} error(s):`, formatErrors(firstOnly.error));
  // 1 error: name
}

// === validateAndFormatResult() + abortEarly ===
console.log('\n=== validateAndFormatResult() + abortEarly ===');

const full = validateAndFormatResult(badInput, userSchema);
if (!full.valid) console.log('Default errors:', full.errors);

const short = validateAndFormatResult(badInput, userSchema, { abortEarly: true });
if (!short.valid) console.log('abortEarly errors:', short.errors);

// === Nested objects ===
console.log('\n=== Nested objects ===');

const profileSchema = object({
  user: required(userSchema),
  bio: required(chain(string(), minLength(5))),
});

const badProfile = { user: { name: '', email: 'x', role: 'z' }, bio: '' };

const nestedAll = validateAndFormatResult(badProfile, profileSchema);
if (!nestedAll.valid) console.log('Nested default:', nestedAll.errors);

const nestedShort = validateAndFormatResult(badProfile, profileSchema, { abortEarly: true });
if (!nestedShort.valid) console.log('Nested abortEarly:', nestedShort.errors);

// === Arrays ===
console.log('\n=== Arrays ===');

const tagsSchema = array(chain(string(), minLength(2)));

const badTags = ['ok', 'x', 'y', 'z']; // items 1-3 are too short

const arrayAll = validate(badTags, tagsSchema);
if (isErr(arrayAll)) console.log(`Array default — ${arrayAll.error.length} error(s):`, formatErrors(arrayAll.error));

const arrayShort = validate(badTags, tagsSchema, { abortEarly: true });
if (isErr(arrayShort))
  console.log(`Array abortEarly — ${arrayShort.error.length} error(s):`, formatErrors(arrayShort.error));

// === validate() with path + options (4-arg overload) ===
console.log('\n=== validate() with path + options ===');

const nameValidator = required(chain(string(), minLength(3)));
const result = validate('ab', nameValidator, ['form', 'name'], { abortEarly: true });
if (isErr(result)) console.log('Path + abortEarly:', formatErrors(result.error));
// { "form.name": "Must be at least 3 characters" }
