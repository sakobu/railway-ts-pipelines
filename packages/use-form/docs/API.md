# API Reference

Complete API documentation for @railway-ts/use-form.

## useForm

Main hook for form management.

### Signature

```typescript
function useForm<TValues extends Record<string, unknown>>(
  validator:
    | MaybeAsyncValidator<unknown, TValues>
    | StandardSchemaV1<unknown, TValues>,
  options: FormOptions<TValues>
): FormReturn<TValues>;
```

### Parameters

#### validator

Type: `MaybeAsyncValidator<unknown, TValues> | StandardSchemaV1<unknown, TValues>`

A Railway-oriented validator from @railway-ts/pipelines, **or** any Standard Schema v1 compliant object (Zod 3.23+, Valibot v1+, ArkType 2.0+). Standard Schema objects are detected automatically by checking for the `~standard` property -- no adapters needed.

```typescript
// Railway-ts schema
import { object, string, required } from '@railway-ts/pipelines/schema';
const validator = object({
  email: required(string()),
  password: required(string()),
});

// Or a Zod schema (Standard Schema v1)
import { z } from 'zod';
const validator = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Or a Valibot schema (Standard Schema v1)
import * as v from 'valibot';
const validator = v.object({
  email: v.pipe(v.string(), v.email()),
  password: v.pipe(v.string(), v.minLength(8)),
});
```

#### options

Type: `FormOptions<TValues>`

Configuration object.

```typescript
{
  initialValues: TValues;
  onSubmit?: (values: TValues) => void | Promise<void>;
  validationMode?: "live" | "blur" | "mount" | "submit";
  fieldValidators?: Partial<Record<ExtractFieldPaths<TValues>, FieldValidator>>;
}
```

### Return Value

Returns an object with form state, methods, and field binding helpers.

## FormOptions

Configuration options for useForm.

### Properties

#### initialValues

Type: `TValues`
Required

Initial values for form fields. Used when form is reset.

```typescript
initialValues: {
  email: "",
  password: "",
}
```

#### onSubmit

Type: `(values: TValues) => void | Promise<void>`
Optional

Callback invoked when form is submitted with valid data.

```typescript
onSubmit: async (values) => {
  await api.submit(values);
};
```

#### validationMode

Type: `"live" | "blur" | "mount" | "submit"`
Optional, Default: `"live"`

Controls when validation occurs.

- `live` - Validate on change and blur, mark touched on change
- `blur` - Validate on blur only
- `mount` - Validate once on mount, mark all fields touched
- `submit` - Validate only on submit

#### fieldValidators

Type: `Partial<Record<ExtractFieldPaths<TValues>, (value: unknown, values: TValues) => string | undefined | Promise<string | undefined>>>`
Optional

Per-field validator functions for field-level async validation. Run independently from the main schema validator, only for the changed field. A field validator only runs when the schema produces **no error** for that field (schema passes first, then the field validator runs).

Return `undefined` for valid, or an error message string for invalid.

```typescript
const form = useForm(userSchema, {
  initialValues: { username: '', email: '' },
  fieldValidators: {
    username: async (value) => {
      const available = await checkUsernameAvailable(value as string);
      return available ? undefined : 'Username is already taken';
    },
  },
});

// Track per-field validation state
{form.validatingFields.username && <span>Checking...</span>}
```

Field validator errors are stored in `fieldErrors` and merged into `errors` with priority above schema errors but below server errors.

## Form State

Properties returned by useForm.

### values

Type: `TValues`

Current form field values.

```typescript
form.values.email; // "user@example.com"
form.values.password; // "password123"
```

### touched

Type: `Record<FieldPath, boolean>`

Record of which fields have been interacted with.

```typescript
form.touched.email; // true
form.touched.password; // false
```

### errors

Type: `Record<FieldPath, string>`

Combined client and server errors. Server errors take precedence.

```typescript
form.errors.email; // "Email is required"
form.errors['addresses.0.city']; // "City is required"
```

### clientErrors

Type: `Record<FieldPath, string>`

Validation errors from the validator function.

```typescript
form.clientErrors.email; // "Invalid email format"
```

### serverErrors

Type: `Record<FieldPath, string>`

Manually set errors from server responses.

```typescript
form.serverErrors.username; // "Username already taken"
```

### isValid

Type: `boolean`

True when there are no validation errors.

```typescript
<button disabled={!form.isValid}>Submit</button>
```

### isDirty

Type: `boolean`

True when any values have changed from initial state.

```typescript
<button disabled={!form.isDirty}>Save Changes</button>
```

### isSubmitting

Type: `boolean`

True when form is currently being submitted.

```typescript
<button disabled={form.isSubmitting}>
  {form.isSubmitting ? "Submitting..." : "Submit"}
</button>
```

### isValidating

Type: `boolean`

Derived property. True when **any** async validation is in progress -- either form-level (from an async schema like `chainAsync`) or field-level (from `fieldValidators`). Use this to disable the submit button during any async check.

```typescript
<button disabled={form.isSubmitting || form.isValidating || !form.isValid}>
  Submit
</button>
```

### validatingFields

Type: `Record<FieldPath, boolean>`

Per-field tracking for `fieldValidators` only. Shows which specific fields currently have async validators running. Use this to show inline loading indicators next to individual fields.

```typescript
{form.validatingFields.username && <span>Checking username...</span>}
```

**isValidating vs validatingFields:** `isValidating` is a single boolean covering all async validation (form-wide). `validatingFields` is a record that only tracks `fieldValidators` -- it won't show `true` for form-level async schemas.

### fieldErrors

Type: `Record<FieldPath, string>`

Errors from per-field validators (stored separately from schema errors).
These are merged into the `errors` object with priority above schema errors
but below server errors.

```typescript
form.fieldErrors.email; // "Email is already taken"
```

### submitCount

Type: `number`

Number of times the form has been submitted (via handleSubmit).
Useful in `submit` mode for patterns like `submitCount === 0 || form.isValid`.

```typescript
<button
  type="submit"
  disabled={form.submitCount > 0 && !form.isValid}
>
  Submit
</button>
```

## Form Methods

### setFieldValue

Update a single field value.

```typescript
setFieldValue<TValue>(
  field: FieldPath,
  value: TValue,
  shouldValidate?: boolean
): void
```

**Parameters:**

- `field` - Field path with autocomplete
- `value` - New value for the field (type-safe based on field type)
- `shouldValidate` - Whether to validate after update (default: based on validation mode)

**Example:**

```typescript
form.setFieldValue('email', 'user@example.com');
form.setFieldValue('addresses.0.city', 'New York', false);
```

### setFieldTouched

Mark a field as touched or untouched.

```typescript
setFieldTouched<TField extends ExtractFieldPaths<TValues>>(
  field: TField,
  isTouched?: boolean,
  shouldValidate?: boolean
): void
```

**Parameters:**

- `field` - Field path with autocomplete
- `isTouched` - Whether field is touched (default: true)
- `shouldValidate` - Whether to validate after update (default: false)

**Example:**

```typescript
form.setFieldTouched('email');
form.setFieldTouched('password', false);
```

### setValues

Update multiple field values at once. Nested objects are deep-merged so
sibling keys you don't mention are preserved.

```typescript
setValues(values: DeepPartial<TValues>, shouldValidate?: boolean): void
```

**Parameters:**

- `values` - Deep-partial object with new values (nested objects merge recursively; arrays, Dates, and primitives replace)
- `shouldValidate` - Whether to validate after update (default: based on validation mode)

**Example:**

```typescript
// Flat update
form.setValues({
  email: 'user@example.com',
  password: 'newpassword',
});

// Nested update — only city changes; street and zip are preserved
form.setValues({
  address: { city: 'NYC' },
});
```

### setServerErrors

Set server-side validation errors.

```typescript
setServerErrors(errors: Record<FieldPath, string>): void
```

**Parameters:**

- `errors` - Object mapping field paths to error messages

**Example:**

```typescript
form.setServerErrors({
  email: 'Email already exists',
  username: 'Username taken',
});
```

Server errors automatically clear when affected fields change.

### clearServerErrors

Clear all server-side errors.

```typescript
clearServerErrors(): void
```

**Example:**

```typescript
form.clearServerErrors();
```

### handleSubmit

Submit form with validation. Returns a Railway `Result` so you can pattern-match on the outcome.

```typescript
handleSubmit(e?: FormEvent): Promise<Result<TValues, ValidationError[]>>
```

**Parameters:**

- `e` - Optional form event (will call `preventDefault`)

**Returns:** `Promise<Result<TValues, ValidationError[]>>` -- `Ok` with validated data on success, `Err` with validation errors on failure.

**What it does:**

1. Calls `preventDefault` on the event (if provided)
2. Marks all fields as touched
3. Clears existing server errors
4. Runs schema validation (awaits if async)
5. If schema passes and `fieldValidators` are configured, runs all field validators in parallel
6. If everything passes, calls `onSubmit` (if provided)
7. Returns the `Result`

**Example:**

```typescript
// Basic: use onSubmit callback
<form onSubmit={(e) => void form.handleSubmit(e)}>{/* fields */}</form>

// React 19: wrap in void to satisfy form action types
<form onSubmit={(e) => void form.handleSubmit(e)}>{/* fields */}</form>

// Advanced: pattern-match on the result
import { match } from "@railway-ts/pipelines/result";

const result = await form.handleSubmit();
match(result, {
  ok: (values) => {
    console.log("Submitted:", values);
    navigate("/success");
  },
  err: (errors) => {
    console.error("Validation errors:", errors);
    scrollToFirstError();
  },
});
```

> **React 19 note:** React 19 form actions expect `onSubmit` handlers to not return a Promise. Use `(e) => void form.handleSubmit(e)` to discard the returned Promise and satisfy the type checker.

### resetForm

Reset form to initial values and clear errors.

```typescript
resetForm(): void
```

**Example:**

```typescript
<button onClick={() => form.resetForm()}>Reset</button>
```

### validateForm

Manually trigger validation.

```typescript
validateForm(values: TValues): Result<TValues, ValidationError[]>
```

**Parameters:**

- `values` - Values to validate

**Returns:**
Railway Result type with validated data or errors.

**Example:**

```typescript
import { isOk } from '@railway-ts/pipelines/result';

const result = form.validateForm(form.values);
if (isOk(result)) {
  console.log('Valid:', result.value);
} else {
  console.log('Errors:', result.error);
}
```

## Field Props Factories

Methods that return props for native HTML elements.

### getFieldProps

Props for text inputs and textareas.

```typescript
getFieldProps<TField extends ExtractFieldPaths<TValues>>(
  field: TField
): NativeFieldProps
```

**Returns:**

```typescript
{
  id: string;
  name: string;
  value: string | number;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur: () => void;
}
```

**Example:**

```typescript
<input type="text" {...form.getFieldProps("username")} />
<input type="email" {...form.getFieldProps("email")} />
<textarea {...form.getFieldProps("bio")} />
```

### getSelectFieldProps

Props for select elements.

```typescript
getSelectFieldProps<TField extends ExtractFieldPaths<TValues>>(
  field: TField
): NativeSelectProps
```

**Returns:**

```typescript
{
  id: string;
  name: string;
  value: string | number;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  onBlur: () => void;
}
```

**Example:**

```typescript
<select {...form.getSelectFieldProps("country")}>
  <option value="us">United States</option>
  <option value="ca">Canada</option>
</select>
```

### getCheckboxProps

Props for boolean checkbox fields.

```typescript
getCheckboxProps<TField extends ExtractFieldPaths<TValues>>(
  field: TField
): NativeCheckboxProps
```

**Returns:**

```typescript
{
  id: string;
  name: string;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}
```

**Example:**

```typescript
<input type="checkbox" {...form.getCheckboxProps("agreeToTerms")} />
```

### getSwitchProps

Props for toggle switches (styled checkboxes).

```typescript
getSwitchProps<TField extends ExtractFieldPaths<TValues>>(
  field: TField
): NativeSwitchProps
```

**Returns:**

```typescript
{
  id: string;
  name: string;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}
```

**Example:**

```typescript
<input type="checkbox" {...form.getSwitchProps("notifications")} />
```

### getSliderProps

Props for range inputs.

```typescript
getSliderProps<TField extends ExtractFieldPaths<TValues>>(
  field: TField
): NativeSliderProps
```

**Returns:**

```typescript
{
  id: string;
  name: string;
  value: number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}
```

**Example:**

```typescript
<input type="range" {...form.getSliderProps("volume")} min={0} max={100} />
```

### getCheckboxGroupOptionProps

Props for checkbox groups (arrays).

```typescript
getCheckboxGroupOptionProps<TField extends ExtractFieldPaths<TValues>>(
  field: TField,
  optionValue: string | number
): NativeCheckboxGroupOptionProps
```

**Parameters:**

- `field` - Path to array field
- `optionValue` - Value this checkbox represents

**Returns:**

```typescript
{
  id: string;
  name: string;
  checked: boolean;
  value: string | number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}
```

**Example:**

```typescript
<label>
  <input
    type="checkbox"
    {...form.getCheckboxGroupOptionProps("preferences", "email")}
  />
  Email Notifications
</label>
<label>
  <input
    type="checkbox"
    {...form.getCheckboxGroupOptionProps("preferences", "sms")}
  />
  SMS Notifications
</label>
```

### getRadioGroupOptionProps

Props for radio button groups.

```typescript
getRadioGroupOptionProps<TField extends ExtractFieldPaths<TValues>>(
  field: TField,
  optionValue: string | number
): NativeRadioGroupOptionProps
```

**Parameters:**

- `field` - Path to field
- `optionValue` - Value this radio button represents

**Returns:**

```typescript
{
  id: string;
  name: string;
  checked: boolean;
  value: string | number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}
```

**Example:**

```typescript
<label>
  <input type="radio" {...form.getRadioGroupOptionProps("theme", "light")} />
  Light
</label>
<label>
  <input type="radio" {...form.getRadioGroupOptionProps("theme", "dark")} />
  Dark
</label>
```

### getFileFieldProps

Props for file input elements.

```typescript
getFileFieldProps<TField extends ExtractFieldPaths<TValues>>(
  field: TField
): NativeFileFieldProps
```

**Returns:**

```typescript
{
  id: string;
  name: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}
```

**Example:**

```typescript
<input type="file" {...form.getFileFieldProps("avatar")} accept="image/*" />
```

## Array Helpers

### arrayHelpers

Get helpers for managing array fields.

```typescript
arrayHelpers<TField extends keyof TValues & string>(
  field: TField
): ArrayHelpers<GetArrayItemType<TValues, TField>, ExtractFieldPaths<GetArrayItemType<TValues, TField>>>
```

**Parameters:**

- `field` - Path to array field

**Returns:** `ArrayHelpers` object with methods and field binding helpers.

**Example:**

```typescript
const helpers = form.arrayHelpers('contacts');
```

### ArrayHelpers Methods

#### values

Type: `TItem[]`

Current array values.

```typescript
helpers.values; // [{ name: "John", email: "john@example.com" }, ...]
```

#### push

Add item to end of array.

```typescript
push(item: TItem): void
```

**Example:**

```typescript
helpers.push({ name: '', email: '' });
```

#### remove

Remove item by index.

```typescript
remove(index: number): void
```

**Example:**

```typescript
helpers.remove(2); // Remove third item
```

#### insert

Insert item at specific position.

```typescript
insert(index: number, item: TItem): void
```

**Example:**

```typescript
helpers.insert(1, { name: 'Jane', email: 'jane@example.com' });
```

#### swap

Swap two items by index.

```typescript
swap(indexA: number, indexB: number): void
```

**Example:**

```typescript
helpers.swap(0, 2); // Swap first and third items
```

#### move

Move item from one position to another.

```typescript
move(from: number, to: number): void
```

**Example:**

```typescript
helpers.move(2, 0); // Move third item to first position
```

#### replace

Replace item at index.

```typescript
replace(index: number, item: TItem): void
```

**Example:**

```typescript
helpers.replace(1, { name: 'Updated', email: 'updated@example.com' });
```

### ArrayHelpers Field Props

Array helpers also provide field prop factories for array items.

#### getFieldProps

Get props for item field.

```typescript
getFieldProps<TField extends ExtractFieldPaths<TItem>>(
  index: number,
  field: TField
): NativeFieldProps
```

**Example:**

```typescript
<input {...helpers.getFieldProps(0, "name")} />
<input {...helpers.getFieldProps(0, "email")} />
```

#### getSelectFieldProps

Get select props for item field.

```typescript
getSelectFieldProps<TField extends ExtractFieldPaths<TItem>>(
  index: number,
  field: TField
): NativeSelectProps
```

**Example:**

```typescript
<select {...helpers.getSelectFieldProps(0, "country")}>
  <option value="us">US</option>
</select>
```

#### getCheckboxProps

Get checkbox props for item field.

```typescript
getCheckboxProps<TField extends ExtractFieldPaths<TItem>>(
  index: number,
  field: TField
): NativeCheckboxProps
```

**Example:**

```typescript
<input type="checkbox" {...helpers.getCheckboxProps(0, "active")} />
```

#### getSwitchProps

Get switch props for item field.

```typescript
getSwitchProps<TField extends ExtractFieldPaths<TItem>>(
  index: number,
  field: TField
): NativeSwitchProps
```

**Example:**

```typescript
<input type="checkbox" {...helpers.getSwitchProps(0, "enabled")} />
```

#### getSliderProps

Get slider props for item field.

```typescript
getSliderProps<TField extends ExtractFieldPaths<TItem>>(
  index: number,
  field: TField
): NativeSliderProps
```

**Example:**

```typescript
<input type="range" {...helpers.getSliderProps(0, "priority")} />
```

#### getFileFieldProps

Get file input props for item field.

```typescript
getFileFieldProps<TField extends ExtractFieldPaths<TItem>>(
  index: number,
  field: TField
): NativeFileFieldProps
```

**Example:**

```typescript
<input type="file" {...helpers.getFileFieldProps(0, "document")} />
```

#### getRadioGroupOptionProps

Get radio button props for item field.

```typescript
getRadioGroupOptionProps<TField extends ExtractFieldPaths<TItem>>(
  index: number,
  field: TField,
  optionValue: string | number
): NativeRadioGroupOptionProps
```

**Example:**

```typescript
<input
  type="radio"
  {...helpers.getRadioGroupOptionProps(0, "status", "active")}
/>
```

## useFormAutoSubmission

Hook for auto-submitting forms after debounced changes.
Monitors form values and automatically triggers submission when the form
is dirty, valid, and values have changed since the last validation.

### Signature

```typescript
function useFormAutoSubmission<T>(
  form: FormWithAutoSubmit<T>,
  delay?: number
): null;
```

### Parameters

#### form

A form instance from `useForm` (or any object with `values`, `isDirty`, `isValid`, `validateForm`, and `handleSubmit`).

#### delay

Type: `number`
Optional, Default: `200`

Debounce delay in milliseconds before auto-submitting.

### Example

```typescript
const form = useForm(validator, {
  initialValues: { search: '' },
  onSubmit: async (values) => {
    await fetch(`/api/search?q=${values.search}`);
  },
  validationMode: 'live',
});

// Auto-submit 500ms after the user stops typing
useFormAutoSubmission(form, 500);
```

## useDebounce

Hook for debouncing a callback function.

### Signature

```typescript
function useDebounce<T extends (...args: Param) => Return>(
  callback: T,
  delay: number
): (...args: Param) => void;
```

### Parameters

- `callback` - The function to debounce
- `delay` - Milliseconds to wait before invoking the callback

### Returns

A debounced version of the callback. Calling it resets the delay timer; the original callback fires once the caller stops invoking for `delay` ms.

### Example

```typescript
const debouncedSearch = useDebounce((query: string) => {
  fetchSearchResults(query);
}, 300);

// In a handler:
<input onChange={(e) => debouncedSearch(e.target.value)} />
```

## Validation Functions

Functions from `@railway-ts/pipelines/schema` for cross-field validation.

### refineAt

Create validators that target specific fields with errors while accessing the entire object.

```typescript
function refineAt<T>(
  targetPath: string | string[],
  predicate: (value: T) => boolean,
  message: string
): Validator<T, T>;
```

**Parameters:**

- `targetPath` - Field path where error should be attached (string or array)
- `predicate` - Validation function receiving entire parent object, returns true if valid
- `message` - Error message when validation fails

**Returns:** Validator function for use with `chain` at object level

**Example:**

```typescript
import { chain, refineAt } from '@railway-ts/pipelines/schema';

// Password confirmation
const validator = chain(
  object({
    password: required(string()),
    confirmPassword: required(string()),
  }),
  refineAt(
    'confirmPassword',
    (data) => data.password === data.confirmPassword,
    'Passwords must match'
  )
);
```

**Example:**

```typescript
// Conditional required field
type AccountData = {
  accountType: 'personal' | 'business';
  taxId?: string;
};

const accountValidator = chain(
  object({
    accountType: required(stringEnum(['personal', 'business'])),
    taxId: optional(string()),
  }),
  refineAt<AccountData>(
    'taxId',
    (data) => data.accountType === 'personal' || !!data.taxId,
    'Tax ID is required for business accounts'
  )
);
```

**Example:**

```typescript
// Date range validation
const bookingValidator = chain(
  object({
    checkIn: required(parseDate()),
    checkOut: required(parseDate()),
  }),
  refineAt(
    'checkOut',
    (data) => data.checkOut > data.checkIn,
    'Check-out must be after check-in'
  )
);
```

**See also:** [Recipes - Dependent Fields](../RECIPES.md#dependent-fields) for more examples

## Type Utilities

### InferSchemaType

Extract TypeScript type from validator schema.

```typescript
import { type InferSchemaType } from '@railway-ts/pipelines/schema';

const validator = object({
  name: required(string()),
  age: required(parseNumber()),
});

type Form = InferSchemaType<typeof validator>;
// { name: string; age: number; }
```

### ExtractFieldPaths

Extract all valid field paths from a type.

```typescript
type User = {
  name: string;
  address: {
    city: string;
    zip: string;
  };
};

type Paths = ExtractFieldPaths<User>;
// "name" | "address" | "address.city" | "address.zip"
```

### FieldPath

String type for field paths.

```typescript
type FieldPath = string;
```

Supports dot notation and bracket notation:

- `"user.name"`
- `"addresses[0]"`
- `"users[2].email"`

## Railway Types

Types from @railway-ts/pipelines.

### Result

```typescript
type Result<T, E> = Ok<T> | Err<E>;
```

Railway result type representing success or failure.

### Validator

```typescript
type Validator<TInput, TOutput> = (
  value: TInput,
  path?: string[]
) => Result<TOutput, ValidationError[]>;
```

Function that validates input and returns typed output or errors.

### ValidationError

```typescript
type ValidationError = {
  path: string[];
  message: string;
};
```

Validation error with field path (as array) and message. The `formatErrors` function converts the path array to dot notation string for display.
