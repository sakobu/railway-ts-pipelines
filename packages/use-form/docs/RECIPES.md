# Recipes

Patterns and techniques. Each recipe is self-contained.

---

## Table of Contents

1. [CRUD Form with Server Errors](#crud-form-with-server-errors)
2. [Nested Objects](#nested-objects)
3. [Dynamic Arrays](#dynamic-arrays)
4. [Checkbox and Radio Groups](#checkbox-and-radio-groups)
5. [File Uploads](#file-uploads)
6. [Auto-Submit and Debounced Search](#auto-submit-and-debounced-search)
7. [Multi-Step Wizard](#multi-step-wizard)
8. [Dependent Fields / Cross-Field Validation](#dependent-fields--cross-field-validation)
9. [Conditional Validation](#conditional-validation)
10. [Discriminated Unions](#discriminated-unions)
11. [Custom Validators](#custom-validators)
12. [Programmatic Field Updates](#programmatic-field-updates)
13. [Syncing Values to External State](#syncing-values-to-external-state)
14. [Reacting to Individual Field Changes](#reacting-to-individual-field-changes)
15. [submitCount Patterns](#submitcount-patterns)
16. [Understanding Error Priority](#understanding-error-priority)
17. [Standard Schema: Bring Your Own Validator](#standard-schema-bring-your-own-validator)
18. [Per-Field Async Validation (fieldValidators)](#per-field-async-validation-fieldvalidators)
19. [Pattern-Matching Submit Results](#pattern-matching-submit-results)
20. [Custom Field Components](#custom-field-components)
21. [Performance Patterns](#performance-patterns)
22. [UI Library Integration](#ui-library-integration)
23. [Testing Forms](#testing-forms)
24. [Form State Persistence](#form-state-persistence)
25. [Unsaved Changes Warning](#unsaved-changes-warning)
26. [Capstone: Full Registration Form (Result Pattern)](#capstone-full-registration-form-result-pattern)
27. [Capstone: Full Registration Form (React Query)](#capstone-full-registration-form-react-query)

---

## CRUD Form with Server Errors

**Problem:** You're building a create/edit form that talks to an API. The server might reject the data (duplicate email, username taken), and you need those errors to appear on the correct fields.

**Solution:** Use `onSubmit` to call the API, and `setServerErrors` to display backend validation errors. Server errors auto-clear when the user edits the affected field.

```tsx
import { useForm } from '@railway-ts/use-form';
import {
  object,
  string,
  required,
  optional,
  chain,
  nonEmpty,
  minLength,
  email,
  ROOT_ERROR_KEY,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

const userSchema = object({
  username: required(chain(string(), nonEmpty(), minLength(3))),
  email: required(chain(string(), nonEmpty(), email())),
  bio: optional(string()),
});

type UserForm = InferSchemaType<typeof userSchema>;

function CreateUserForm() {
  const form = useForm<UserForm>(userSchema, {
    initialValues: { username: '', email: '', bio: '' },
    onSubmit: async (values) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errors = await response.json();
        // e.g. { email: "Email already exists", username: "Username taken" }
        form.setServerErrors(errors);
        return;
      }

      window.location.reassign = '/users';
    },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <div>
        <label htmlFor="field-username">Username</label>
        <input {...form.getFieldProps('username')} />
        {form.touched.username && form.errors.username && (
          <span className="error">{form.errors.username}</span>
        )}
      </div>

      <div>
        <label htmlFor="field-email">Email</label>
        <input type="email" {...form.getFieldProps('email')} />
        {form.touched.email && form.errors.email && (
          <span className="error">{form.errors.email}</span>
        )}
      </div>

      <div>
        <label htmlFor="field-bio">Bio</label>
        <textarea {...form.getFieldProps('bio')} rows={4} />
      </div>

      {/* Form-level errors (not tied to a field) */}
      {form.errors[ROOT_ERROR_KEY] && (
        <div className="form-error">{form.errors[ROOT_ERROR_KEY]}</div>
      )}

      <button type="submit" disabled={form.isSubmitting}>
        {form.isSubmitting ? 'Saving...' : 'Create User'}
      </button>

      <button
        type="button"
        onClick={() => form.resetForm()}
        disabled={!form.isDirty}
      >
        Reset
      </button>
    </form>
  );
}
```

For form-level errors (network failures, rate limiting), use `ROOT_ERROR_KEY`:

```typescript
form.setServerErrors({ [ROOT_ERROR_KEY]: 'Network error. Please try again.' });
```

---

## Nested Objects

**Problem:** Your form has structured data like an address inside a profile.

**Solution:** Use `object()` nesting in the schema and dot-notation paths everywhere.

```tsx
const addressSchema = object({
  street: required(string()),
  city: required(string()),
  state: required(string()),
  zip: required(string()),
});

const profileSchema = object({
  name: required(string()),
  email: required(email()),
  address: required(addressSchema),
});

type Profile = InferSchemaType<typeof profileSchema>;

function ProfileForm() {
  const form = useForm<Profile>(profileSchema, {
    initialValues: {
      name: '',
      email: '',
      address: { street: '', city: '', state: '', zip: '' },
    },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <input {...form.getFieldProps('name')} placeholder="Name" />
      <input {...form.getFieldProps('email')} placeholder="Email" />

      <fieldset>
        <legend>Address</legend>
        <input {...form.getFieldProps('address.street')} placeholder="Street" />
        <input {...form.getFieldProps('address.city')} placeholder="City" />
        <input {...form.getFieldProps('address.state')} placeholder="State" />
        <input {...form.getFieldProps('address.zip')} placeholder="ZIP" />
      </fieldset>

      <button type="submit">Save</button>
    </form>
  );
}
```

Errors and touched state also use dot notation: `form.errors['address.city']`, `form.touched['address.zip']`.

---

## Dynamic Arrays

**Problem:** You need a list that users can add to, remove from, and reorder -- like contacts, line items, or todo lists.

**Solution:** `arrayHelpers` gives you mutation methods and field bindings for each item.

```tsx
const todosSchema = object({
  todos: array(
    object({
      text: required(chain(string(), nonEmpty('Task is required'))),
      done: required(boolean()),
    })
  ),
});

type TodosForm = InferSchemaType<typeof todosSchema>;

function TodoList() {
  const form = useForm<TodosForm>(todosSchema, {
    initialValues: { todos: [] },
  });

  const helpers = form.arrayHelpers('todos');

  return (
    <div>
      {helpers.values.map((todo, index) => (
        <div key={index}>
          <input type="checkbox" {...helpers.getCheckboxProps(index, 'done')} />
          <input {...helpers.getFieldProps(index, 'text')} />

          <button
            onClick={() => index > 0 && helpers.swap(index, index - 1)}
            disabled={index === 0}
          >
            Up
          </button>
          <button
            onClick={() =>
              index < helpers.values.length - 1 &&
              helpers.swap(index, index + 1)
            }
            disabled={index === helpers.values.length - 1}
          >
            Down
          </button>
          <button onClick={() => helpers.remove(index)}>Delete</button>
        </div>
      ))}

      <button onClick={() => helpers.push({ text: '', done: false })}>
        Add Todo
      </button>
    </div>
  );
}
```

**Bulk operations** work by calling helpers in sequence:

```typescript
// Add multiple items
const newTasks = [
  { text: 'Task 1', done: false },
  { text: 'Task 2', done: false },
];
newTasks.forEach((task) => helpers.push(task));

// Remove completed items (iterate in reverse to avoid index shifting)
for (let i = helpers.values.length - 1; i >= 0; i--) {
  if (helpers.values[i].done) helpers.remove(i);
}

// Mark all complete
helpers.values.forEach((_, index) => {
  form.setFieldValue(`todos.${index}.done`, true);
});
```

---

## Checkbox and Radio Groups

**Problem:** You need a group of checkboxes (multi-select into an array) or radio buttons (single-select from a set).

**Solution:** Use `getCheckboxGroupOptionProps` for checkboxes and `getRadioGroupOptionProps` for radios.

| Use case                         | Helper                                      | Field type               |
| -------------------------------- | ------------------------------------------- | ------------------------ |
| Multi-select (tags, permissions) | `getCheckboxGroupOptionProps(field, value)` | `string[]` or `number[]` |
| Single-select (theme, role)      | `getRadioGroupOptionProps(field, value)`    | `string` or `number`     |
| Boolean toggle                   | `getCheckboxProps(field)`                   | `boolean`                |

```tsx
const prefsSchema = object({
  notifications: array(stringEnum(['email', 'sms', 'push'])),
  theme: required(stringEnum(['light', 'dark', 'auto'])),
});

type Preferences = InferSchemaType<typeof prefsSchema>;

function PreferencesForm() {
  const form = useForm<Preferences>(prefsSchema, {
    initialValues: { notifications: [], theme: 'light' },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <fieldset>
        <legend>Notify me via</legend>
        {(['email', 'sms', 'push'] as const).map((method) => (
          <label key={method}>
            <input
              type="checkbox"
              {...form.getCheckboxGroupOptionProps('notifications', method)}
            />
            {method.charAt(0).toUpperCase() + method.slice(1)}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Theme</legend>
        {(['light', 'dark', 'auto'] as const).map((theme) => (
          <label key={theme}>
            <input
              type="radio"
              {...form.getRadioGroupOptionProps('theme', theme)}
            />
            {theme.charAt(0).toUpperCase() + theme.slice(1)}
          </label>
        ))}
      </fieldset>

      <button type="submit">Save Preferences</button>
    </form>
  );
}
```

---

## File Uploads

**Problem:** You need a file input with validation (type, size).

**Solution:** Use `getFileFieldProps` and chain `refine` predicates for validation. `required()` handles the "no file selected" case; each `refine` handles one check.

```tsx
import { chain, refine } from '@railway-ts/pipelines/schema';

const fileValidator = chain(
  refine<File>((value) => value instanceof File, 'Must be a file'),
  refine<File>((value) => value.size <= 5_000_000, 'File too large (max 5MB)'),
  refine<File>((value) => value.type.startsWith('image/'), 'Must be an image'),
);

const uploadSchema = object({
  avatar: required(fileValidator),
});

type UploadForm = InferSchemaType<typeof uploadSchema>;

function AvatarUpload() {
  const form = useForm<UploadForm>(uploadSchema, {
    initialValues: { avatar: null },
    onSubmit: async (values) => {
      const formData = new FormData();
      formData.append('avatar', values.avatar);
      await fetch('/api/upload', { method: 'POST', body: formData });
    },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <input
        type="file"
        accept="image/*"
        {...form.getFileFieldProps('avatar')}
      />
      {form.touched.avatar && form.errors.avatar && (
        <span>{form.errors.avatar}</span>
      )}
      <button type="submit">Upload</button>
    </form>
  );
}
```

Error paths are handled automatically: `object()` constructs the field path (e.g., `["avatar"]`) and passes it through `required()` -> `chain()` -> `refine()`. No manual path construction needed.

---

## Auto-Submit and Debounced Search

**Problem:** You want the form to submit automatically when values change -- for search boxes or filter panels.

**Solution:** `useFormAutoSubmission` watches form values and triggers `handleSubmit` after a debounce delay. For manual control, `useDebounce` wraps any callback.

| Tool                                 | Use case                | How it works                                                                |
| ------------------------------------ | ----------------------- | --------------------------------------------------------------------------- |
| `useFormAutoSubmission(form, delay)` | Auto-submit entire form | Watches `values`, waits `delay` ms, calls `handleSubmit` if valid and dirty |
| `useDebounce(callback, delay)`       | Debounce any function   | Returns debounced version that resets timer on each call                    |

```tsx
import { useForm, useFormAutoSubmission } from '@railway-ts/use-form';

function ProductFilters() {
  const form = useForm(filterSchema, {
    initialValues: {
      search: '',
      category: '',
      minPrice: undefined,
      maxPrice: undefined,
    },
    onSubmit: async (values) => {
      const params = new URLSearchParams();
      if (values.search) params.set('search', values.search);
      if (values.category) params.set('category', values.category);
      await fetch(`/api/products?${params}`);
    },
    validationMode: 'live',
  });

  // Auto-submit 500ms after the user stops typing
  useFormAutoSubmission(form, 500);

  return (
    <div>
      <input {...form.getFieldProps('search')} placeholder="Search..." />
      <select {...form.getSelectFieldProps('category')}>
        <option value="">All Categories</option>
        <option value="electronics">Electronics</option>
        <option value="clothing">Clothing</option>
      </select>
    </div>
  );
}
```

For a simple search box where you want to control the callback directly:

```tsx
import { useForm, useDebounce } from '@railway-ts/use-form';

function SearchBox() {
  const form = useForm(searchSchema, {
    initialValues: { query: '' },
  });

  const debouncedSearch = useDebounce((query: string) => {
    fetch(`/api/search?q=${query}`);
  }, 300);

  return (
    <input
      {...form.getFieldProps('query')}
      onChange={(e) => {
        form.setFieldValue('query', e.target.value);
        debouncedSearch(e.target.value);
      }}
      placeholder="Search..."
    />
  );
}
```

---

## Multi-Step Wizard

**Problem:** You have a long form split into steps. Each step should validate independently.

**Solution:** Use a single `useForm` with all fields. Validate on each "Next" click with `validateForm`, advance only if valid.

```tsx
import { useState } from 'react';
import { isOk } from '@railway-ts/pipelines/result';

function MultiStepForm() {
  const [step, setStep] = useState(1);

  const form = useForm(wizardSchema, {
    initialValues: {
      personal: { name: '', email: '' },
      address: { street: '', city: '' },
      payment: { cardNumber: '' },
    },
    onSubmit: async (values) => {
      await fetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify(values),
      });
    },
  });

  const handleNext = () => {
    const result = form.validateForm(form.values);
    if (isOk(result)) setStep(step + 1);
  };

  // Note: validateForm validates all fields, not just the current step.
  // This works here because each step only renders its own error messages.
  // If you need per-step validation gating (e.g., disable "Next" until
  // the current step is valid), check only the current step's fields in the result.

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      {step === 1 && (
        <div>
          <h2>Personal Info</h2>
          <input {...form.getFieldProps('personal.name')} placeholder="Name" />
          <input
            {...form.getFieldProps('personal.email')}
            placeholder="Email"
          />
          <button type="button" onClick={handleNext}>
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2>Address</h2>
          <input
            {...form.getFieldProps('address.street')}
            placeholder="Street"
          />
          <input {...form.getFieldProps('address.city')} placeholder="City" />
          <button type="button" onClick={() => setStep(1)}>
            Back
          </button>
          <button type="button" onClick={handleNext}>
            Next
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2>Payment</h2>
          <input
            {...form.getFieldProps('payment.cardNumber')}
            placeholder="Card Number"
          />
          <button type="button" onClick={() => setStep(2)}>
            Back
          </button>
          <button type="submit">Submit</button>
        </div>
      )}
    </form>
  );
}
```

---

## Dependent Fields / Cross-Field Validation

**Problem:** A field's validity depends on another field -- password confirmation, date ranges, conditional requirements.

**Solution:** Use `refineAt` from `@railway-ts/pipelines/schema`. It runs after the object validates, receives the whole object, and attaches the error to a specific field path.

```typescript
import {
  object,
  string,
  required,
  chain,
  refineAt,
  minLength,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

const registrationSchema = chain(
  object({
    password: required(chain(string(), minLength(8))),
    confirmPassword: required(string()),
    startDate: required(string()),
    endDate: required(string()),
  }),
  refineAt(
    'confirmPassword',
    (data) => data.password === data.confirmPassword,
    'Passwords must match'
  ),
  refineAt(
    'endDate',
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return new Date(data.endDate) > new Date(data.startDate);
    },
    'End date must be after start date'
  )
);

type RegistrationData = InferSchemaType<typeof registrationSchema>;
```

The key insight: `chain` at the **object level** (not the field level) gives `refineAt` access to all fields. The first argument to `refineAt` is the field path where the error should appear.

---

## Conditional Validation

**Problem:** Some fields are only required based on another field's value -- like company name and tax ID for business accounts.

**Solution:** Same technique as cross-field validation. Use `refineAt` to conditionally require fields.

```tsx
const accountSchema = chain(
  object({
    accountType: required(stringEnum(['personal', 'business'])),
    companyName: optional(string()),
    taxId: optional(string()),
  }),
  refineAt(
    'companyName',
    (data) => data.accountType === 'personal' || !!data.companyName,
    'Company name is required for business accounts'
  ),
  refineAt(
    'taxId',
    (data) => data.accountType === 'personal' || !!data.taxId,
    'Tax ID is required for business accounts'
  )
);

type AccountData = InferSchemaType<typeof accountSchema>;

function AccountForm() {
  const form = useForm<AccountData>(accountSchema, {
    initialValues: { accountType: 'personal', companyName: '', taxId: '' },
  });

  const isBusiness = form.values.accountType === 'business';

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <select {...form.getSelectFieldProps('accountType')}>
        <option value="personal">Personal</option>
        <option value="business">Business</option>
      </select>

      {isBusiness && (
        <>
          <input
            {...form.getFieldProps('companyName')}
            placeholder="Company Name"
          />
          {form.touched.companyName && form.errors.companyName && (
            <span>{form.errors.companyName}</span>
          )}

          <input {...form.getFieldProps('taxId')} placeholder="Tax ID" />
          {form.touched.taxId && form.errors.taxId && (
            <span>{form.errors.taxId}</span>
          )}
        </>
      )}

      <button type="submit">Create Account</button>
    </form>
  );
}
```

---

## Discriminated Unions

**Problem:** Your form's shape changes based on a discriminator field -- payment method, account type, entity kind.

**Solution:** Use `discriminatedUnion` from `@railway-ts/pipelines/schema`. Field path autocomplete includes paths from **all variants**, so `getFieldProps` works regardless of which variant is active.

```typescript
import { discriminatedUnion, literal } from '@railway-ts/pipelines/schema';

const paymentSchema = discriminatedUnion('method', {
  card: object({
    method: literal('card'),
    cardNumber: required(chain(string(), nonEmpty())),
    expiryDate: required(string()),
    cvv: required(string()),
  }),
  paypal: object({
    method: literal('paypal'),
    email: required(email()),
  }),
  bank: object({
    method: literal('bank'),
    accountNumber: required(string()),
    routingNumber: required(string()),
  }),
});

type Payment = InferSchemaType<typeof paymentSchema>;
```

```tsx
function PaymentForm() {
  const form = useForm<Payment>(paymentSchema, {
    initialValues: { method: 'card', cardNumber: '', expiryDate: '', cvv: '' },
  });

  const method = form.values.method;

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <select {...form.getSelectFieldProps('method')}>
        <option value="card">Credit Card</option>
        <option value="paypal">PayPal</option>
        <option value="bank">Bank Transfer</option>
      </select>

      {method === 'card' && (
        <>
          <input
            {...form.getFieldProps('cardNumber')}
            placeholder="Card Number"
          />
          <input {...form.getFieldProps('expiryDate')} placeholder="MM/YY" />
          <input {...form.getFieldProps('cvv')} placeholder="CVV" />
        </>
      )}

      {method === 'paypal' && (
        <input {...form.getFieldProps('email')} placeholder="PayPal Email" />
      )}

      {method === 'bank' && (
        <>
          <input
            {...form.getFieldProps('accountNumber')}
            placeholder="Account Number"
          />
          <input
            {...form.getFieldProps('routingNumber')}
            placeholder="Routing Number"
          />
        </>
      )}

      <button type="submit">Pay</button>
    </form>
  );
}
```

`ExtractFieldPaths<Payment>` includes paths from all variants -- `'method' | 'cardNumber' | 'expiryDate' | 'cvv' | 'email' | 'accountNumber' | 'routingNumber'`.

---

## Custom Validators

**Problem:** You need reusable validation functions beyond what's built in -- strong passwords, phone numbers, credit card numbers.

**Solution:** Create validators with `refine`. The predicate receives the typed value and returns a boolean -- the library handles error creation and path resolution internally.

```typescript
import { refine } from '@railway-ts/pipelines/schema';

const strongPassword = (message = 'Password is too weak') =>
  refine<string>((value) => {
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    const hasSpecial = /[!@#$%^&*]/.test(value);
    const isLongEnough = value.length >= 8;

    return hasUpper && hasLower && hasNumber && hasSpecial && isLongEnough;
  }, message);

const phoneNumber = (message = 'Invalid phone number') =>
  refine<string>((value) => {
    const cleaned = value.replace(/\D/g, '');
    return cleaned.length === 10;
  }, message);

const creditCard = (message = 'Invalid credit card') =>
  refine<string>((value) => {
    const cleaned = value.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(cleaned)) return false;

    // Luhn algorithm
    let sum = 0;
    let isEven = false;
    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned[i]);
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isEven = !isEven;
    }
    return sum % 10 === 0;
  }, message);

// Use in schemas
const schema = object({
  password: required(chain(string(), strongPassword())),
  phone: optional(chain(string(), phoneNumber())),
  card: optional(chain(string(), creditCard())),
});
```

`refine` validates a single field -- it receives the field's value and the error attaches to that field automatically. For cross-field validation (where you need access to the entire object), use `refineAt` instead -- see the [API Reference](./API.md#refineat).

---

## Programmatic Field Updates

**Problem:** You need to update computed fields (totals, derived values) without triggering validation.

**Solution:** Pass `false` as the third argument to `setFieldValue` to skip validation.

```typescript
function CalculatorForm() {
  const form = useForm(calculatorSchema, {
    initialValues: { quantity: 0, price: 0, total: 0 },
  });

  useEffect(() => {
    const total = (form.values.quantity || 0) * (form.values.price || 0);
    form.setFieldValue('total', total, false); // false = skip validation
  }, [form.values.quantity, form.values.price]);

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <input type="number" {...form.getFieldProps('quantity')} />
      <input type="number" {...form.getFieldProps('price')} />
      <input type="number" {...form.getFieldProps('total')} readOnly />
      <button type="submit">Submit</button>
    </form>
  );
}
```

---

## Syncing Values to External State

**Problem:** You need to keep an external store (Zustand, Redux, URL params)
in sync with form values without per-field `useEffect` hooks.

**Solution:** Use `onValuesChange` with `prevValues` for efficient diffing.

```tsx
const form = useForm(missionSchema, {
  initialValues: { altitude: 400, velocity: 8, name: '' },
  onValuesChange: (values, prev) => {
    if (values.altitude !== prev.altitude) {
      missionStore.setAltitude(Number(values.altitude));
    }
    if (values.velocity !== prev.velocity) {
      missionStore.setVelocity(Number(values.velocity));
    }
  },
  onSubmit: launchMission,
});
```

For simple cases where the sync is cheap (e.g., Zustand setters are no-ops
when the value hasn't changed), you can skip the diff:

```tsx
onValuesChange: (values) => {
  missionStore.setAltitude(Number(values.altitude));
  missionStore.setVelocity(Number(values.velocity));
},
```

> **Note:** Fires on mount with `(initialValues, initialValues)`. If your
> store is already seeded, this is a no-op.

---

## Reacting to Individual Field Changes

**Problem:** You want to run a side effect when a specific field changes —
analytics tracking, conditional field visibility, dependent field updates —
without watching the entire form.

**Solution:** Use `onFieldChange` for per-field reactions.

```tsx
const form = useForm(schema, {
  initialValues: { country: '', state: '', zip: '' },
  onFieldChange: (field, value, values) => {
    // Clear dependent fields when country changes
    if (field === 'country') {
      form.setFieldValue('state', '');
      form.setFieldValue('zip', '');
    }
    // Track field interactions
    analytics.track('field_edited', { field, formId: 'checkout' });
  },
  onSubmit: handleCheckout,
});
```

`onFieldChange` fires from all native bindings (inputs, selects, checkboxes,
sliders, radios, file inputs) and array helper operations (`push`, `remove`,
`insert`, `swap`, `replace`). It does **not** fire for batch updates via
`setValues` or `resetForm` — use `onValuesChange` for those.

---

## submitCount Patterns

**Problem:** In `submit` validation mode, the submit button starts disabled even though the user hasn't tried submitting yet.

**Solution:** Use `submitCount` to distinguish "hasn't submitted yet" from "submitted with errors." Before the first submit, keep the button enabled; after a failed submit, disable until errors are fixed.

```tsx
const form = useForm(schema, {
  initialValues: {
    /* ... */
  },
  validationMode: 'submit',
});

// Before first submit: button is enabled (haven't validated yet)
// After failed submit: button is disabled until errors are fixed
<button type="submit" disabled={form.submitCount > 0 && !form.isValid}>
  Submit
</button>;
```

---

## Understanding Error Priority

**Problem:** You're seeing unexpected error messages and need to understand which error layer takes precedence.

**Solution:** The `errors` object is a merged view of three separate layers. When multiple layers have an error for the same field, higher-priority layers win:

| Priority    | Source            | Property       | Populated when                                                                 |
| ----------- | ----------------- | -------------- | ------------------------------------------------------------------------------ |
| 1 (lowest)  | Schema validation | `clientErrors` | Schema validator runs (on change, blur, mount, or submit depending on mode)    |
| 2           | Field validators  | `fieldErrors`  | `fieldValidators` option runs for a field (after schema passes for that field) |
| 3 (highest) | Server errors     | `serverErrors` | You call `setServerErrors(...)`                                                |

**When each layer gets cleared:**

- `clientErrors` -- replaced on every schema validation run
- `fieldErrors` -- cleared per-field when the field validator re-runs or the field's schema error reappears
- `serverErrors` -- auto-cleared per-field when the user edits the affected field; bulk-cleared on `clearServerErrors()` or new `handleSubmit`

A server error stays visible until the user changes the field, even if client validation passes. That's intentional -- the server said it's wrong, and only editing should dismiss it.

For the full technical details, see the [API Reference: Error Priority](./API.md#error-priority).

---

## Standard Schema: Bring Your Own Validator

**Problem:** You already have Zod or Valibot schemas in your codebase and don't want to rewrite them.

**Solution:** Pass them directly to `useForm`. Any library that implements [Standard Schema v1](https://github.com/standard-schema/standard-schema) works without adapters.

### Zod

```tsx
import { z } from 'zod';
import { useForm } from '@railway-ts/use-form';

const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  age: z.coerce.number().min(18, 'Must be at least 18').max(120),
  role: z.enum(['admin', 'user']),
});

type User = z.infer<typeof userSchema>;

function ZodForm() {
  const form = useForm<User>(userSchema, {
    initialValues: {
      username: '',
      email: '',
      password: '',
      age: 0,
      role: 'user',
    },
    onSubmit: (values) => console.log('Submit:', values),
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <input {...form.getFieldProps('username')} />
      {form.touched.username && form.errors.username && (
        <span>{form.errors.username}</span>
      )}
      {/* ... other fields ... */}
      <button type="submit">Register</button>
    </form>
  );
}
```

### Valibot

```tsx
import * as v from 'valibot';
import { useForm } from '@railway-ts/use-form';

const userSchema = v.object({
  username: v.pipe(
    v.string(),
    v.minLength(3, 'Username must be at least 3 characters')
  ),
  email: v.pipe(v.string(), v.email('Invalid email address')),
  password: v.pipe(
    v.string(),
    v.minLength(8, 'Password must be at least 8 characters')
  ),
  age: v.pipe(
    v.unknown(),
    v.transform(Number),
    v.number(),
    v.minValue(18, 'Must be at least 18')
  ),
  role: v.picklist(['admin', 'user']),
});

type User = v.InferOutput<typeof userSchema>;

function ValibotForm() {
  const form = useForm<User>(userSchema, {
    initialValues: {
      username: '',
      email: '',
      password: '',
      age: 0,
      role: 'user',
    },
    onSubmit: (values) => console.log('Submit:', values),
  });

  // Same JSX as above -- the hook API is identical regardless of validator
  // ...
}
```

### Comparison

| Feature                | @railway-ts/pipelines         | Zod                        | Valibot                  |
| ---------------------- | ----------------------------- | -------------------------- | ------------------------ |
| Error accumulation     | All errors in one pass        | First error per field      | All errors in one pass   |
| Bundle size            | ~4 KB                         | ~13 KB                     | ~7 KB                    |
| Cross-field validation | `refineAt` (targeted)         | `.refine` / `.superRefine` | `v.forward` + `v.custom` |
| Async validation       | `chainAsync`, `refineAtAsync` | `.refine` with async       | `v.pipeAsync`            |
| Result type            | Native `Result<T, E>`         | Throws or `.safeParse`     | Throws or `.safeParse`   |
| Standard Schema        | `toStandardSchema()`          | Native (v3.23+, v4)        | Native (v1+)             |

---

## Per-Field Async Validation (fieldValidators)

**Problem:** You need to check a value against the server (username availability, coupon codes) without blocking the entire form. Schema-level async validation (`chainAsync`) validates the whole form -- you want per-field control with per-field loading indicators.

**Solution:** The `fieldValidators` option runs independent async checks for specific fields. Each field validator only runs when the schema produces no error for that field, and `validatingFields` tracks which fields are currently checking.

```tsx
const checkUsernameAvailable = async (username: string): Promise<boolean> => {
  const res = await fetch(`/api/check-username?username=${username}`);
  const data = await res.json();
  return data.available;
};

function RegistrationForm() {
  const form = useForm<UserForm>(userSchema, {
    initialValues: { username: '', email: '', password: '' },
    onSubmit: async (values) => {
      await fetch('/api/register', {
        method: 'POST',
        body: JSON.stringify(values),
      });
    },
    fieldValidators: {
      username: async (value) => {
        const available = await checkUsernameAvailable(value);
        return available ? undefined : 'Username is already taken';
      },
    },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <div>
        <input {...form.getFieldProps('username')} />
        {form.validatingFields.username && (
          <span className="validating">Checking username...</span>
        )}
        {form.touched.username && form.errors.username && (
          <span className="error">{form.errors.username}</span>
        )}
      </div>

      {/* ... other fields ... */}

      <button type="submit" disabled={form.isSubmitting || form.isValidating}>
        Register
      </button>
    </form>
  );
}
```

### fieldValidators vs schema-level async

|                     | `fieldValidators`                  | `chainAsync` / `refineAtAsync` |
| ------------------- | ---------------------------------- | ------------------------------ |
| **Scope**           | Single field                       | Entire form                    |
| **Runs when**       | After schema passes for that field | During schema validation       |
| **Loading state**   | `validatingFields.fieldName`       | `isValidating` (form-wide)     |
| **Race conditions** | Handled per-field (latest wins)    | Handled per-form (latest wins) |
| **Best for**        | Server lookups (username, email)   | Cross-field async checks       |

Field validators return `undefined` for valid, or an error message string for invalid. They receive the typed field value and the full form values object: `(value: FieldTypeAtPath<TValues, K>, values: TValues) => string | undefined | Promise<string | undefined>` — no cast needed.

---

## Pattern-Matching Submit Results

**Problem:** You want to handle the submit outcome programmatically rather than through `onSubmit` -- for example, to navigate on success or log errors.

**Solution:** `handleSubmit` returns a `Promise<Result<TValues, ValidationError[]>>`. Use `match` from `@railway-ts/pipelines/result` to branch on success or failure.

```tsx
import { match } from '@railway-ts/pipelines/result';

function RegistrationForm() {
  const form = useForm(registrationSchema, {
    initialValues: { email: '', password: '' },
    // No onSubmit needed -- we handle the result directly
  });

  const handleSave = async () => {
    const result = await form.handleSubmit();

    match(result, {
      ok: (values) => {
        console.log('Validated data:', values);
        // Navigate, show toast, etc.
      },
      err: (errors) => {
        console.error('Validation failed:', errors);
        // Log to analytics, show banner, etc.
      },
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
    >
      <input type="email" {...form.getFieldProps('email')} />
      <input type="password" {...form.getFieldProps('password')} />
      <button type="submit">Register</button>
    </form>
  );
}
```

You can also combine `onSubmit` (for the main action) with the returned `Result` (for side effects):

```typescript
const form = useForm(schema, {
  initialValues: {
    /* ... */
  },
  onSubmit: async (values) => {
    await api.createUser(values);
  },
});

// Later, in a handler:
const result = await form.handleSubmit();
match(result, {
  ok: () => navigate('/dashboard'),
  err: () => scrollToFirstError(),
});
```

---

## Custom Field Components

**Problem:** You're repeating the same label + input + error markup for every field.

**Solution:** Extract a reusable `Field` component that takes the form instance, field name, and label.

```tsx
import { useForm } from '@railway-ts/use-form';
import {
  object,
  required,
  chain,
  string,
  email,
  minLength,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

const loginSchema = object({
  email: required(chain(string(), email())),
  password: required(chain(string(), minLength(8))),
});

type LoginValues = InferSchemaType<typeof loginSchema>;

type FieldProps = {
  form: ReturnType<typeof useForm<LoginValues>>;
  name: keyof LoginValues & string;
  label: string;
  type?: string;
};

function Field({ form, name, label, type = 'text' }: FieldProps) {
  const error = form.touched[name] && form.errors[name];

  return (
    <div className="field">
      <label htmlFor={`field-${name}`}>{label}</label>
      <input type={type} {...form.getFieldProps(name)} />
      {error && <span className="error">{error}</span>}
    </div>
  );
}

// Usage
function LoginForm() {
  const form = useForm(loginSchema, {
    initialValues: { email: '', password: '' },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <Field form={form} name="email" label="Email" type="email" />
      <Field form={form} name="password" label="Password" type="password" />
      <button type="submit">Submit</button>
    </form>
  );
}
```

For more control, accept `children` or render props instead of hard-coding `<input>`.

---

## Performance Patterns

**Problem:** Large forms re-render the entire component tree on every keystroke.

### Memoize Field Components

Wrap field components in `React.memo` so they only re-render when their specific field changes:

```tsx
import { memo, useMemo } from 'react';
import { useForm } from '@railway-ts/use-form';
import {
  object,
  required,
  string,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

const largeFormSchema = object({
  field1: required(string()),
  field2: required(string()),
  // ... more fields
});

type LargeFormValues = InferSchemaType<typeof largeFormSchema>;

const MemoField = memo(function MemoField({
  form,
  name,
  label,
}: {
  form: ReturnType<typeof useForm<LargeFormValues>>;
  name: keyof LargeFormValues & string;
  label: string;
}) {
  const props = useMemo(() => form.getFieldProps(name), [form, name]);
  const error = form.touched[name] && form.errors[name];

  return (
    <div>
      <label>{label}</label>
      <input {...props} />
      {error && <span>{error}</span>}
    </div>
  );
});

function LargeForm() {
  const form = useForm(largeFormSchema, {
    initialValues: { field1: '', field2: '' },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <MemoField form={form} name="field1" label="Field 1" />
      <MemoField form={form} name="field2" label="Field 2" />
      {/* Many more fields */}
    </form>
  );
}
```

### Use Blur Mode for Long Forms

For forms with many fields, `validationMode: 'blur'` avoids re-validating on every keystroke:

```typescript
const form = useForm(schema, {
  initialValues: {
    /* ... */
  },
  validationMode: 'blur',
});
```

### Debounce Expensive Side Effects

Use `useDebounce` to throttle callbacks triggered by form value changes:

```tsx
import { useDebounce } from '@railway-ts/use-form';

const debouncedSearch = useDebounce((query: string) => {
  fetch(`/api/search?q=${query}`);
}, 300);
```

---

## UI Library Integration

UI libraries like Material-UI and Chakra UI use different prop names than native HTML. You need to manually map form state to their component APIs.

### Which approach to use

| Library                                     | Approach                                                    |
| ------------------------------------------- | ----------------------------------------------------------- |
| **Shadcn/ui, Radix, Headless UI**           | `getFieldProps` works directly (native HTML under the hood) |
| **Material-UI, Chakra UI (v3), Ant Design** | Map form state to component props manually                  |

### Material-UI

```tsx
import { TextField, Button } from '@mui/material';
import { useForm } from '@railway-ts/use-form';
import {
  object,
  required,
  chain,
  string,
  email,
  minLength,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

const loginSchema = object({
  email: required(chain(string(), email())),
  password: required(chain(string(), minLength(8))),
});

type LoginValues = InferSchemaType<typeof loginSchema>;

function MuiForm() {
  const form = useForm(loginSchema, {
    initialValues: { email: '', password: '' },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <TextField
        label="Email"
        name="email"
        value={form.values.email || ''}
        onChange={(e) => form.setFieldValue('email', e.target.value)}
        onBlur={() => form.setFieldTouched('email')}
        error={form.touched.email && Boolean(form.errors.email)}
        helperText={form.touched.email && form.errors.email}
        fullWidth
        margin="normal"
      />

      <TextField
        label="Password"
        type="password"
        name="password"
        value={form.values.password || ''}
        onChange={(e) => form.setFieldValue('password', e.target.value)}
        onBlur={() => form.setFieldTouched('password')}
        error={form.touched.password && Boolean(form.errors.password)}
        helperText={form.touched.password && form.errors.password}
        fullWidth
        margin="normal"
      />

      <Button
        type="submit"
        variant="contained"
        disabled={form.isSubmitting || !form.isValid}
      >
        Submit
      </Button>
    </form>
  );
}
```

### Chakra UI (v3)

```tsx
import { Field, Input, Button } from '@chakra-ui/react';
import { useForm } from '@railway-ts/use-form';
import {
  object,
  required,
  chain,
  string,
  email,
  minLength,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

const loginSchema = object({
  email: required(chain(string(), email())),
  password: required(chain(string(), minLength(8))),
});

type LoginValues = InferSchemaType<typeof loginSchema>;

function ChakraForm() {
  const form = useForm(loginSchema, {
    initialValues: { email: '', password: '' },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <Field.Root invalid={form.touched.email && Boolean(form.errors.email)}>
        <Field.Label>Email</Field.Label>
        <Input
          name="email"
          value={form.values.email || ''}
          onChange={(e) => form.setFieldValue('email', e.target.value)}
          onBlur={() => form.setFieldTouched('email')}
        />
        <Field.ErrorText>{form.errors.email}</Field.ErrorText>
      </Field.Root>

      <Button
        type="submit"
        loading={form.isSubmitting}
        disabled={!form.isValid}
      >
        Submit
      </Button>
    </form>
  );
}
```

### Shadcn/ui

Shadcn components use native HTML under the hood, so `getFieldProps` works directly:

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useForm } from '@railway-ts/use-form';
import {
  object,
  required,
  chain,
  string,
  email,
  minLength,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

const loginSchema = object({
  email: required(chain(string(), email())),
  password: required(chain(string(), minLength(8))),
});

type LoginValues = InferSchemaType<typeof loginSchema>;

function ShadcnForm() {
  const form = useForm(loginSchema, {
    initialValues: { email: '', password: '' },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)} className="space-y-4">
      <div>
        <Label htmlFor="field-email">Email</Label>
        <Input {...form.getFieldProps('email')} />
        {form.touched.email && form.errors.email && (
          <p className="text-sm text-destructive">{form.errors.email}</p>
        )}
      </div>

      <div>
        <Label htmlFor="field-password">Password</Label>
        <Input type="password" {...form.getFieldProps('password')} />
        {form.touched.password && form.errors.password && (
          <p className="text-sm text-destructive">{form.errors.password}</p>
        )}
      </div>

      <Button type="submit" disabled={form.isSubmitting || !form.isValid}>
        Submit
      </Button>
    </form>
  );
}
```

---

## Testing Forms

**Problem:** You want to test form behavior -- validation errors, submission, server error handling.

**Solution:** Use Testing Library to render the form, interact with it, and assert on the output.

```typescript
import { describe, test, expect, mock } from 'bun:test';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('LoginForm', () => {
  test('validates required fields on submit', async () => {
    render(<LoginForm />);

    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  test('submits valid form', async () => {
    const onSubmit = mock((_values: Record<string, string>) => {});
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
      });
    });
  });

  test('displays server errors', async () => {
    // Mock API that returns a server error
    global.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ email: 'Email already exists' }),
      })
    ) as typeof fetch;

    render(<RegistrationForm />);

    await userEvent.type(screen.getByLabelText(/email/i), 'taken@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument();
    });
  });
});
```

**Tips:**

- Test from the user's perspective (type, click, assert on visible text)
- Use `waitFor` for async operations (validation, submission)
- Mock `fetch` for server error scenarios
- Test the `touched && errors` pattern by interacting before asserting

---

## Form State Persistence

**Problem:** You want to preserve form state across page reloads (long forms, multi-step wizards).

**Solution:** Save values to `localStorage` on change, restore on mount.

```tsx
function PersistentForm() {
  const saved = JSON.parse(localStorage.getItem('draftForm') || '{}');

  const form = useForm(formSchema, {
    initialValues: { name: '', email: '', ...saved },
    onSubmit: async (values) => {
      await api.submit(values);
      localStorage.removeItem('draftForm');
      form.resetForm();
    },
  });

  // Save on every change
  useEffect(() => {
    localStorage.setItem('draftForm', JSON.stringify(form.values));
  }, [form.values]);

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <input {...form.getFieldProps('name')} />
      <input {...form.getFieldProps('email')} />
      <button type="submit">Submit</button>
    </form>
  );
}
```

---

## Unsaved Changes Warning

**Problem:** Users accidentally navigate away from a dirty form and lose their work.

**Solution:** Listen for `beforeunload` when the form is dirty.

```tsx
function FormWithWarning() {
  const form = useForm(schema, {
    initialValues: {
      /* ... */
    },
  });

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (form.isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [form.isDirty]);

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      {/* fields */}
      <button type="submit">Save</button>
    </form>
  );
}
```

For React Router or Next.js navigation, you'll also need to hook into the router's navigation events (e.g., `useBlocker` in React Router v6).

---

## Capstone: Full Registration Form (Result Pattern)

This recipe combines everything: schema validation, per-field async validators, server errors, cross-field validation (password confirmation), and Result pattern-matching on submit.

```tsx
import { useForm } from '@railway-ts/use-form';
import {
  ok,
  err,
  match,
  fromPromise,
  type Result,
} from '@railway-ts/pipelines/result';
import {
  object,
  string,
  required,
  chain,
  refineAt,
  nonEmpty,
  email,
  minLength,
  ROOT_ERROR_KEY,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

// --- Schema ---

const schema = chain(
  object({
    username: required(chain(string(), nonEmpty(), minLength(3))),
    email: required(chain(string(), nonEmpty(), email())),
    password: required(chain(string(), nonEmpty(), minLength(8))),
    confirmPassword: required(chain(string(), nonEmpty())),
  }),
  refineAt(
    'confirmPassword',
    (d) => d.password === d.confirmPassword,
    'Passwords must match'
  )
);

type Registration = InferSchemaType<typeof schema>;

// --- API layer ---

const checkUsername = (username: string) =>
  fromPromise<{ available: boolean }>(
    fetch(`/api/check-username?u=${encodeURIComponent(username)}`).then(
      (res) => (res.ok ? res.json() : Promise.reject(`HTTP ${res.status}`))
    )
  );

const registerUser = async (
  values: Registration
): Promise<Result<void, Record<string, string>>> => {
  const result = await fromPromise(
    fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
  );

  if (!result.ok)
    return err({ [ROOT_ERROR_KEY]: 'Network error. Please try again.' });

  const res = result.value;
  if (!res.ok) return err((await res.json()) as Record<string, string>);

  return ok(undefined);
};

// --- Component ---

export function RegistrationForm() {
  const form = useForm<Registration>(schema, {
    initialValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    fieldValidators: {
      username: async (value) => {
        const result = await checkUsername(value);
        return match(result, {
          ok: ({ available }) =>
            available ? undefined : 'Username is already taken',
          err: () => 'Unable to check username availability',
        });
      },
    },
    onSubmit: async (values) => {
      const result = await registerUser(values);
      match(result, {
        ok: () => {
          window.location.reassign = '/welcome';
        },
        err: (errors) => form.setServerErrors(errors),
      });
    },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <input {...form.getFieldProps('username')} />
      {form.validatingFields.username && <span>Checking...</span>}
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

      <input type="password" {...form.getFieldProps('confirmPassword')} />
      {form.touched.confirmPassword && form.errors.confirmPassword && (
        <span>{form.errors.confirmPassword}</span>
      )}

      {form.errors[ROOT_ERROR_KEY] && (
        <span>{form.errors[ROOT_ERROR_KEY]}</span>
      )}

      <button type="submit" disabled={form.isSubmitting || form.isValidating}>
        {form.isSubmitting ? 'Registering...' : 'Create Account'}
      </button>
    </form>
  );
}
```

This form demonstrates:

- **Schema validation** -- `chain` + `nonEmpty` + `email` + `minLength`
- **Cross-field validation** -- `refineAt` for password confirmation
- **Per-field async validation** -- `fieldValidators` for username availability with `validatingFields` loading state
- **Server errors** -- `setServerErrors` from API response, auto-clear on edit
- **Result handling** -- `fromPromise` for both API calls, explicit `ok`/`err` for registration, `match` for branching
- **React 19 compatibility** -- `(e) => void form.handleSubmit(e)` pattern

---

## Capstone: Full Registration Form (React Query)

The same registration form using React Query for server state and React Router for navigation -- no Result types, just idiomatic React patterns.

```tsx
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@railway-ts/use-form';
import {
  object,
  string,
  required,
  chain,
  refineAt,
  nonEmpty,
  email,
  minLength,
  ROOT_ERROR_KEY,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

// --- Schema ---

const schema = chain(
  object({
    username: required(chain(string(), nonEmpty(), minLength(3))),
    email: required(chain(string(), nonEmpty(), email())),
    password: required(chain(string(), nonEmpty(), minLength(8))),
    confirmPassword: required(chain(string(), nonEmpty())),
  }),
  refineAt(
    'confirmPassword',
    (d) => d.password === d.confirmPassword,
    'Passwords must match'
  )
);

type Registration = InferSchemaType<typeof schema>;

// --- API layer ---

const checkUsername = (username: string): Promise<{ available: boolean }> =>
  fetch(`/api/check-username?u=${encodeURIComponent(username)}`).then((res) =>
    res.ok ? res.json() : Promise.reject(`HTTP ${res.status}`)
  );

class ApiValidationError extends Error {
  constructor(public fieldErrors: Record<string, string>) {
    super('Validation failed');
  }
}

const registerUser = async (values: Registration): Promise<void> => {
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });

  if (!res.ok) throw new ApiValidationError(await res.json());
};

// --- Component ---

export function RegistrationForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: registerUser,
    onSuccess: () => navigate('/welcome'),
    onError: (error) => {
      if (error instanceof ApiValidationError) {
        form.setServerErrors(error.fieldErrors);
      } else {
        form.setServerErrors({
          [ROOT_ERROR_KEY]: 'Network error. Please try again.',
        });
      }
    },
  });

  const form = useForm<Registration>(schema, {
    initialValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    fieldValidators: {
      username: async (value) => {
        try {
          const { available } = await queryClient.fetchQuery({
            queryKey: ['check-username', value],
            queryFn: () => checkUsername(value),
            staleTime: 30_000,
          });
          return available ? undefined : 'Username is already taken';
        } catch {
          return 'Unable to check username availability';
        }
      },
    },
    onSubmit: (values) => mutation.mutate(values),
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <input {...form.getFieldProps('username')} />
      {form.validatingFields.username && <span>Checking...</span>}
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

      <input type="password" {...form.getFieldProps('confirmPassword')} />
      {form.touched.confirmPassword && form.errors.confirmPassword && (
        <span>{form.errors.confirmPassword}</span>
      )}

      {form.errors[ROOT_ERROR_KEY] && (
        <span>{form.errors[ROOT_ERROR_KEY]}</span>
      )}

      <button type="submit" disabled={mutation.isPending || form.isValidating}>
        {mutation.isPending ? 'Registering...' : 'Create Account'}
      </button>
    </form>
  );
}
```

This form demonstrates:

- **Schema validation** -- `chain` + `nonEmpty` + `email` + `minLength`
- **Cross-field validation** -- `refineAt` for password confirmation
- **Per-field async validation** -- `queryClient.fetchQuery` with `staleTime` for caching username checks
- **Server errors** -- `ApiValidationError` + `useMutation` `onError` → `setServerErrors`, auto-clear on edit
- **React Query integration** -- `useMutation` for submit, `fetchQuery` for field validation
- **React 19 compatibility** -- `(e) => void form.handleSubmit(e)` pattern

---

## What's Next

- **[API Reference](./API.md)** -- Complete API documentation
