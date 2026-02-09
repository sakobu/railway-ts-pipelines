import {
  array,
  chain,
  email,
  matches,
  minLength,
  object,
  optional,
  parseBool,
  parseDate,
  parseNumber,
  pattern,
  required,
  string,
  stringEnum,
  validateAndFormatResult,
  nonEmpty,
} from '@/schema';

const invalidInput = {
  username: 'jo', // too short
  email: 'not-an-email', // invalid format
  password: 'password', // not complex enough
  age: '25', // string that will be parsed to a number
  birthdate: '1995-05-15', // string that will be parsed to a Date
  termsAccepted: 'yes', // string that will be parsed to boolean true
  address: {
    street: '123 Main St',
    city: 'A', // too short
    zipCode: '1234', // invalid format
  },
  contacts: ['email', 'phone', 'fax'], // fax is not a valid option
};

const validInput = {
  username: 'john_doe',
  email: 'valid@email.com',
  password: 'ComplexPassword123!',
  age: 30,
  birthdate: new Date('1995-05-15'),
  hasAcceptedTerms: true,
  role: 'user',
  address: {
    street: '123 Main St',
    city: 'New York',
    zipCode: '10001',
  },
  contacts: ['email', 'phone'],
};

export const addressSchema = object({
  street: optional(chain(string(), minLength(3))),
  city: optional(chain(string(), minLength(2))),
  zipCode: optional(chain(string(), pattern(/^\d{5}$/))),
});

export const userSchema = object({
  username: required(chain(string(), nonEmpty(), minLength(3))),
  email: required(chain(string(), nonEmpty(), email())),
  password: required(chain(string(), nonEmpty(), minLength(8))),
  age: required(parseNumber()),
  birthdate: required(parseDate()),
  hasAcceptedTerms: required(chain(parseBool(), matches(true, 'You must check this field'))),
  role: required(stringEnum(['admin', 'user'])),
  address: optional(addressSchema),
  contacts: optional(array(stringEnum(['email', 'phone']))),
});

// === validateAndFormatResult: Valid Input ===
console.log('=== validateAndFormatResult: Valid Input ===');

const valid = validateAndFormatResult(validInput, userSchema);
console.log(valid);

// === validateAndFormatResult: Invalid Input ===
console.log('\n=== validateAndFormatResult: Invalid Input ===');

const invalid = validateAndFormatResult(invalidInput, userSchema);
console.log(invalid);
