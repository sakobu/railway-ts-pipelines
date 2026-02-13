# Getting Started

A guided walkthrough. Each step introduces one concept, building to a complete form by the end.

---

## Step 1: Your First Form

Every `useForm` starts with a **schema** -- an object that describes what your form data looks like and how to validate it. The schema is the single source of truth: it defines both the validation rules and the TypeScript types at the same time.

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

// 1. Define a schema
const loginSchema = object({
  email: required(chain(string(), nonEmpty('Email is required'))),
  password: required(chain(string(), nonEmpty('Password is required'))),
});

// 2. Derive the TypeScript type from the schema -- no separate interface needed
type LoginForm = InferSchemaType<typeof loginSchema>;
// { email: string; password: string }
```

Here's what's happening:

- `object({...})` declares the shape -- each key is a field
- `required(...)` marks a field as mandatory
- `string()` checks that the value is a string
- `chain(...)` sequences validators left to right -- each one feeds into the next
- `nonEmpty('...')` ensures the string isn't blank, with a custom error message
- `InferSchemaType` extracts the TypeScript type so you never write it by hand

Now pass the schema and initial values to `useForm`:

```tsx
function LoginForm() {
  const form = useForm<LoginForm>(loginSchema, {
    initialValues: { email: '', password: '' },
    onSubmit: async (values) => {
      // values is typed as { email: string; password: string }
      console.log('Login:', values);
    },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <input type="email" placeholder="Email" />
      <input type="password" placeholder="Password" />
      <button type="submit">Log In</button>
    </form>
  );
}
```

The form validates and submits, but the inputs aren't wired up yet. That's the next step.

> **Want the full theory on schemas, Result types, and pipelines?** See the [@railway-ts/pipelines Getting Started](https://github.com/sakobu/railway-ts-pipelines/blob/main/docs/GETTING_STARTED.md). You don't need to read it first -- we'll explain enough here to follow along.

---

## Step 2: Field Bindings

`getFieldProps` returns everything a native HTML input needs -- `id`, `name`, `value`, `onChange`, `onBlur` -- in one object. Spread it onto the element and you're done:

```tsx
function LoginForm() {
  const form = useForm<LoginForm>(loginSchema, {
    initialValues: { email: '', password: '' },
    onSubmit: async (values) => {
      console.log('Login:', values);
    },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <div>
        <label htmlFor="field-email">Email</label>
        <input type="email" {...form.getFieldProps('email')} />
        {form.touched.email && form.errors.email && (
          <span className="error">{form.errors.email}</span>
        )}
      </div>

      <div>
        <label htmlFor="field-password">Password</label>
        <input type="password" {...form.getFieldProps('password')} />
        {form.touched.password && form.errors.password && (
          <span className="error">{form.errors.password}</span>
        )}
      </div>

      <button type="submit" disabled={form.isSubmitting || !form.isValid}>
        {form.isSubmitting ? 'Logging in...' : 'Log In'}
      </button>
    </form>
  );
}
```

The error display pattern is `touched && errors` -- show the error only after the user has interacted with the field. This prevents a wall of errors before they've typed anything.

There are specialized binding helpers for other input types:

| Input Type             | Helper                                      | Returns                                                |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------ |
| Text, email, textarea  | `getFieldProps(field)`                      | `id`, `name`, `value`, `onChange`, `onBlur`            |
| Select                 | `getSelectFieldProps(field)`                | `id`, `name`, `value`, `onChange`, `onBlur`            |
| Checkbox (boolean)     | `getCheckboxProps(field)`                   | `id`, `name`, `checked`, `onChange`, `onBlur`          |
| Switch (toggle)        | `getSwitchProps(field)`                     | `id`, `name`, `checked`, `onChange`, `onBlur`          |
| Slider (range)         | `getSliderProps(field)`                     | `id`, `name`, `type`, `value`, `onChange`, `onBlur`    |
| File                   | `getFileFieldProps(field)`                  | `id`, `name`, `onChange`, `onBlur`                     |
| Checkbox group (array) | `getCheckboxGroupOptionProps(field, value)` | `id`, `name`, `value`, `checked`, `onChange`, `onBlur` |
| Radio group            | `getRadioGroupOptionProps(field, value)`    | `id`, `name`, `value`, `checked`, `onChange`, `onBlur` |

All of them generate a stable `id` (e.g., `field-email`) that matches `<label htmlFor>` automatically.

---

## Step 3: Validation

Validators compose with `chain` -- each step runs left to right, and all errors are collected in a single pass:

```typescript
import {
  object,
  string,
  required,
  chain,
  nonEmpty,
  email,
  minLength,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

const signupSchema = object({
  email: required(
    chain(
      string(),
      nonEmpty('Email is required'),
      email('Must be a valid email')
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

If a user submits with an empty email and a 3-character password, they see both errors at once -- not one at a time. This is the "railway" approach: each field travels its own track, and errors accumulate across all fields rather than short-circuiting at the first failure.

Under the hood, validators return a `Result` -- either `Ok` with the validated value, or `Err` with an array of errors. You don't need to work with `Result` directly for basic forms (the hook handles it), but it's there when you want more control. See [Pattern-Matching Submit Results](./RECIPES.md#pattern-matching-submit-results) for an example.

> **Deep dive:** The [@railway-ts/pipelines Getting Started](https://github.com/sakobu/railway-ts-pipelines/blob/main/docs/GETTING_STARTED.md) explains `Result`, `chain`, `pipe`, and the full validation model.

---

## Step 4: Validation Modes

By default, validation runs on every change. That's great for short forms, but intrusive for long ones. The `validationMode` option controls when validation fires:

| Mode             | Validates on    | Marks touched on    | Best for                            |
| ---------------- | --------------- | ------------------- | ----------------------------------- |
| `live` (default) | Change and blur | Change              | Short forms, immediate feedback     |
| `blur`           | Blur only       | Blur                | Longer forms, less intrusive typing |
| `mount`          | Mount (once)    | Mount (all fields)  | Editing existing records            |
| `submit`         | Submit only     | Submit (all fields) | Simple forms, minimal interruption  |

```typescript
// Validate only when a field loses focus
const form = useForm(validator, {
  initialValues: {
    /* ... */
  },
  validationMode: 'blur',
});
```

```typescript
// Pre-fill a form for editing and show all errors immediately
const form = useForm(validator, {
  initialValues: existingUser,
  validationMode: 'mount',
});
```

```typescript
// Don't bother the user until they submit
const form = useForm(validator, {
  initialValues: {
    /* ... */
  },
  validationMode: 'submit',
});
```

---

## Step 5: Submission and Server Errors

When the user submits, `handleSubmit` validates the form, marks all fields as touched, and calls your `onSubmit` callback if validation passes. Server errors are set separately and display through the same `form.errors` object:

```tsx
function RegistrationForm() {
  const form = useForm<RegistrationForm>(registrationSchema, {
    initialValues: { username: '', email: '', password: '' },
    onSubmit: async (values) => {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errors = await response.json();
        // { username: "Username already taken", email: "Email in use" }
        form.setServerErrors(errors);
        return;
      }

      window.location.href = '/dashboard';
    },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <input {...form.getFieldProps('username')} />
      {form.touched.username && form.errors.username && (
        <span>{form.errors.username}</span>
      )}

      <input type="email" {...form.getFieldProps('email')} />
      {form.touched.email && form.errors.email && (
        <span>{form.errors.email}</span>
      )}

      <input type="password" {...form.getFieldProps('password')} />
      {form.touched.password && form.errors.password && (
        <span>{form.errors.password}</span>
      )}

      <button type="submit" disabled={form.isSubmitting}>
        {form.isSubmitting ? 'Registering...' : 'Register'}
      </button>
    </form>
  );
}
```

Three things to know about server errors:

1. **They auto-clear** -- when the user edits a field, its server error disappears
2. **They win** -- if a field has both a client error and a server error, the server error is displayed (server > fieldValidator > client)
3. **Form-level errors** -- use an empty string key `''` for errors not tied to a specific field

`handleSubmit` also returns a `Result`, so you can pattern-match on the outcome instead of using `onSubmit`. See [Recipes](./RECIPES.md#pattern-matching-submit-results) for that pattern.

> **React 19 note:** React 19 form actions expect `onSubmit` to not return a Promise. Use `(e) => void form.handleSubmit(e)` to satisfy the type checker.

---

## Step 6: Nested Objects

Use dot notation everywhere -- field props, errors, touched state:

```tsx
const profileSchema = object({
  name: required(string()),
  address: required(
    object({
      street: required(string()),
      city: required(chain(string(), nonEmpty('City is required'))),
      zip: required(chain(string(), nonEmpty('ZIP is required'))),
    })
  ),
});

type Profile = InferSchemaType<typeof profileSchema>;

function ProfileForm() {
  const form = useForm<Profile>(profileSchema, {
    initialValues: {
      name: '',
      address: { street: '', city: '', zip: '' },
    },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <input {...form.getFieldProps('name')} placeholder="Name" />

      <fieldset>
        <legend>Address</legend>
        <input {...form.getFieldProps('address.street')} placeholder="Street" />
        <input {...form.getFieldProps('address.city')} placeholder="City" />
        {form.touched['address.city'] && form.errors['address.city'] && (
          <span>{form.errors['address.city']}</span>
        )}
        <input {...form.getFieldProps('address.zip')} placeholder="ZIP" />
        {form.touched['address.zip'] && form.errors['address.zip'] && (
          <span>{form.errors['address.zip']}</span>
        )}
      </fieldset>

      <button type="submit">Save</button>
    </form>
  );
}
```

The field path autocomplete works through nested objects -- type `'address.'` and your editor suggests `street`, `city`, `zip`.

---

## Step 7: Arrays

Use `arrayHelpers` for dynamic lists. It gives you `push`, `remove`, `swap`, `move`, `insert`, `replace`, and its own `getFieldProps` that takes an index:

```tsx
import {
  object,
  string,
  required,
  email,
  array,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

const contactSchema = object({
  name: required(string()),
  email: required(email()),
});

const formSchema = object({
  contacts: array(contactSchema),
});

type ContactsForm = InferSchemaType<typeof formSchema>;

function ContactsForm() {
  const form = useForm<ContactsForm>(formSchema, {
    initialValues: { contacts: [{ name: '', email: '' }] },
  });

  const helpers = form.arrayHelpers('contacts');

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      {helpers.values.map((_, index) => (
        <div key={index}>
          <h3>Contact {index + 1}</h3>

          <input {...helpers.getFieldProps(index, 'name')} placeholder="Name" />
          {form.touched[`contacts.${index}.name`] &&
            form.errors[`contacts.${index}.name`] && (
              <span>{form.errors[`contacts.${index}.name`]}</span>
            )}

          <input
            {...helpers.getFieldProps(index, 'email')}
            placeholder="Email"
          />
          {form.touched[`contacts.${index}.email`] &&
            form.errors[`contacts.${index}.email`] && (
              <span>{form.errors[`contacts.${index}.email`]}</span>
            )}

          <button type="button" onClick={() => helpers.remove(index)}>
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => helpers.push({ name: '', email: '' })}
      >
        Add Contact
      </button>

      <button type="submit">Save All</button>
    </form>
  );
}
```

Array helpers provide full type safety -- `helpers.getFieldProps(index, 'name')` autocompletes to the fields of your contact schema.

**All array operations:**

| Method                        | What it does              |
| ----------------------------- | ------------------------- |
| `push(item)`                  | Add to end                |
| `remove(index)`               | Remove by index           |
| `insert(index, item)`         | Insert at position        |
| `swap(indexA, indexB)`        | Swap two items            |
| `move(from, to)`              | Move item to new position |
| `replace(index, item)`        | Replace item at index     |
| `getFieldProps(index, field)` | Get props for item field  |

---

## What's Next

You now know the core: schemas, field bindings, validation, submission, nesting, and arrays.

- **[Recipes](./RECIPES.md)** -- Patterns and techniques: Standard Schema (Zod/Valibot), per-field async validation, cross-field validation, UI library integration, multi-step wizards, and more
- **[API Reference](./API.md)** -- Complete API documentation
