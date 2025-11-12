# Getting Started

## Installation

```bash
bun add @railway-ts/use-form @railway-ts/pipelines react
```

### Peer Dependencies

- `@railway-ts/pipelines` ^0.1.5
- `react` ^18.0.0

## Basic Form

```tsx
import { useForm } from '@railway-ts/use-form';
import {
  object,
  string,
  required,
  chain,
  nonEmpty,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

// 1. Define validator
const formValidator = object({
  name: required(chain(string(), nonEmpty('Name is required'))),
  email: required(chain(string(), nonEmpty('Email is required'))),
});

// 2. Infer type from validator
type FormData = InferSchemaType<typeof formValidator>;

// 3. Create form
function MyForm() {
  const form = useForm<FormData>(formValidator, {
    initialValues: { name: '', email: '' },
    onSubmit: async (values) => {
      console.log(values);
    },
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <div>
        <label htmlFor="field-name">Name</label>
        <input type="text" {...form.getFieldProps('name')} />
        {form.touched.name && form.errors.name && (
          <span className="error">{form.errors.name}</span>
        )}
      </div>

      <div>
        <label htmlFor="field-email">Email</label>
        <input type="email" {...form.getFieldProps('email')} />
        {form.touched.email && form.errors.email && (
          <span className="error">{form.errors.email}</span>
        )}
      </div>

      <button type="submit" disabled={form.isSubmitting || !form.isValid}>
        Submit
      </button>
    </form>
  );
}
```

## Core Concepts

### Type Inference from Schema

Instead of manually defining interfaces, derive types from validators:

```typescript
// Schema defines validation AND types
const validator = object({
  username: required(string()),
  email: required(email()),
  age: required(parseNumber()),
});

// Type is automatically derived
type Form = InferSchemaType<typeof validator>;
// { username: string; email: string; age: number; }
```

Benefits:

- Single source of truth
- No type drift
- Less boilerplate
- Refactoring safety

### Railway-Oriented Validation

Validators compose and accumulate errors:

```typescript
const validator = object({
  email: required(
    chain(
      string(),
      nonEmpty('Email is required'),
      email('Invalid email format')
    )
  ),
  password: required(
    chain(
      string(),
      nonEmpty('Password is required'),
      minLength(8, 'Must be at least 8 characters')
    )
  ),
});
```

All validators run and collect all errors in a single pass.

Learn more at [@railway-ts/pipelines](https://github.com/sakobu/railway-ts-pipelines)

### Cross-Field Validation

For validation that depends on multiple fields (password confirmation, date ranges, conditional requirements), use `refineAt` from `@railway-ts/pipelines/schema`:

```typescript
import { chain, refineAt } from '@railway-ts/pipelines/schema';

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

See [Recipes](./docs/RECIPES.md#dependent-fields) for more examples.

### Validation Modes

Control when validation occurs:

#### live (default)

```typescript
const form = useForm(validator, {
  validationMode: 'live',
});
```

- Validates on change and blur
- Marks fields touched on change
- Best for immediate feedback

#### blur

```typescript
const form = useForm(validator, {
  validationMode: 'blur',
});
```

- Validates on blur only
- Less intrusive during typing
- Good for longer forms

#### mount

```typescript
const form = useForm(validator, {
  validationMode: 'mount',
});
```

- Validates once on mount
- Marks all fields touched immediately
- Good for editing existing records

#### submit

```typescript
const form = useForm(validator, {
  validationMode: 'submit',
});
```

- Validates only on submit
- Marks all fields touched on submit
- Good for simple forms

## Form State

The form hook returns state and methods:

### State Properties

```typescript
form.values; // Current field values
form.touched; // Which fields have been interacted with
form.errors; // Combined client + server errors
form.clientErrors; // Validation errors
form.serverErrors; // Server-side errors
form.isValid; // No validation errors
form.isDirty; // Values changed from initial
form.isSubmitting; // Currently submitting
```

### Field Methods

```typescript
// Update single field
form.setFieldValue('email', 'user@example.com');

// Mark field as touched
form.setFieldTouched('email', true);

// Update multiple fields
form.setValues({ email: 'user@example.com', name: 'John' });
```

### Server Error Methods

```typescript
// Set server errors
form.setServerErrors({
  email: 'Email already exists',
  username: 'Username taken',
});

// Clear server errors
form.clearServerErrors();
```

Server errors auto-clear when affected fields change.

### Form Methods

```typescript
// Submit form (validates first)
form.handleSubmit(event);

// Reset to initial values
form.resetForm();

// Manual validation
const result = form.validateForm(form.values);
```

## Field Props Factories

Get props for native HTML elements:

### Text Inputs

```tsx
<input type="text" {...form.getFieldProps("username")} />
<input type="email" {...form.getFieldProps("email")} />
<input type="password" {...form.getFieldProps("password")} />
<textarea {...form.getFieldProps("bio")} />
```

Returns: `{ id, name, value, onChange, onBlur }`

### Checkboxes

```tsx
<input type="checkbox" {...form.getCheckboxProps('agreeToTerms')} />
```

Returns: `{ id, name, checked, onChange, onBlur }`

### Select

```tsx
<select {...form.getSelectFieldProps('country')}>
  <option value="us">United States</option>
  <option value="ca">Canada</option>
</select>
```

### Slider

```tsx
<input type="range" {...form.getSliderProps('volume')} min={0} max={100} />
```

### Switch (Checkbox styled as toggle)

```tsx
<input type="checkbox" {...form.getSwitchProps('notifications')} />
```

## Nested Objects

Access nested fields with dot notation:

```typescript
const validator = object({
  user: required(object({
    name: required(string()),
    address: required(object({
      city: required(string()),
      zip: required(string()),
    })),
  })),
});

// Access nested fields
<input {...form.getFieldProps("user.name")} />
<input {...form.getFieldProps("user.address.city")} />
<input {...form.getFieldProps("user.address.zip")} />

// Error paths match field paths
{form.errors["user.address.city"]}
```

## Arrays

Use array helpers for dynamic lists:

```typescript
const validator = object({
  contacts: array(
    object({
      name: required(string()),
      email: required(email()),
    })
  ),
});

function ContactsForm() {
  const form = useForm(validator, {
    initialValues: { contacts: [] },
  });

  const helpers = form.arrayHelpers("contacts");

  return (
    <div>
      {helpers.values.map((contact, index) => (
        <div key={index}>
          <input {...helpers.getFieldProps(index, "name")} />
          <input {...helpers.getFieldProps(index, "email")} />
          <button onClick={() => helpers.remove(index)}>Remove</button>
        </div>
      ))}

      <button onClick={() => helpers.push({ name: "", email: "" })}>
        Add Contact
      </button>
    </div>
  );
}
```

Array helpers provide:

- `push(item)` - Add to end
- `remove(index)` - Remove by index
- `insert(index, item)` - Insert at position
- `swap(indexA, indexB)` - Swap two items
- `move(from, to)` - Move item
- `replace(index, item)` - Replace item
- `getFieldProps(index, field)` - Get props for item field

## Error Display

Show errors only when fields are touched:

```tsx
{
  form.touched.email && form.errors.email && (
    <span className="error">{form.errors.email}</span>
  );
}
```

Or always show if dirty:

```tsx
{
  form.isDirty && form.errors.email && (
    <span className="error">{form.errors.email}</span>
  );
}
```

## Next Steps

- [Recipes](./docs/RECIPES.md) - Common patterns
- [Advanced](./docs/ADVANCED.md) - Complex use cases
- [API Reference](./docs/API.md) - Complete API
