# Advanced Patterns

Most users won't need this. But if you're debugging error priority, building custom validators, or working with discriminated unions, here's what's going on.

---

## Error Priority and Merging

The `errors` object returned by `useForm` is a merged view of three separate error layers. When multiple layers have an error for the same field, higher-priority layers win:

| Priority | Source | Property | Populated when |
|---|---|---|---|
| 1 (lowest) | Schema validation | `clientErrors` | Schema validator runs (on change, blur, mount, or submit depending on mode) |
| 2 | Field validators | `fieldErrors` | `fieldValidators` option runs for a field (after schema passes for that field) |
| 3 (highest) | Server errors | `serverErrors` | You call `setServerErrors(...)` |

The merge is straightforward -- for each field path, the highest-priority non-empty error wins:

```typescript
// What useForm does internally:
const errors = {
  ...clientErrors,    // Schema errors (base)
  ...fieldErrors,     // Field validator errors (override schema for same field)
  ...serverErrors,    // Server errors (highest priority)
};
```

**When each layer gets cleared:**

- `clientErrors` -- replaced on every schema validation run (the entire object is swapped)
- `fieldErrors` -- cleared per-field when the field validator re-runs or the field's schema error reappears
- `serverErrors` -- auto-cleared per-field when the user edits the affected field; bulk-cleared on `clearServerErrors()` or new `handleSubmit`

This means a server error stays visible until the user changes the field, even if client validation passes. That's intentional -- the server said it's wrong, and only editing should dismiss it.

---

## Discriminated Unions

Handle forms whose shape changes based on a discriminator field (payment method, account type):

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

`ExtractFieldPaths<Payment>` includes paths from **all variants** -- `'method' | 'cardNumber' | 'expiryDate' | 'cvv' | 'email' | 'accountNumber' | 'routingNumber'`. This means `getFieldProps` autocomplete works regardless of which variant is active.

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
          <input {...form.getFieldProps('cardNumber')} placeholder="Card Number" />
          <input {...form.getFieldProps('expiryDate')} placeholder="MM/YY" />
          <input {...form.getFieldProps('cvv')} placeholder="CVV" />
        </>
      )}

      {method === 'paypal' && (
        <input {...form.getFieldProps('email')} placeholder="PayPal Email" />
      )}

      {method === 'bank' && (
        <>
          <input {...form.getFieldProps('accountNumber')} placeholder="Account Number" />
          <input {...form.getFieldProps('routingNumber')} placeholder="Routing Number" />
        </>
      )}

      <button type="submit">Pay</button>
    </form>
  );
}
```

---

## Custom Validators

Create reusable validation functions with `refine`. Use `path: ''` so the error attaches to the field being validated (the library maps it to the correct path automatically):

```typescript
import { refine } from '@railway-ts/pipelines/schema';
import { ok, err } from '@railway-ts/pipelines/result';

const strongPassword = (message = 'Password is too weak') =>
  refine<string>((value: unknown) => {
    if (!value || typeof value !== 'string') return ok(value as string);

    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    const hasSpecial = /[!@#$%^&*]/.test(value);
    const isLongEnough = value.length >= 8;

    if (hasUpper && hasLower && hasNumber && hasSpecial && isLongEnough) {
      return ok(value);
    }
    return err([{ path: '', message }]);
  });

const phoneNumber = (message = 'Invalid phone number') =>
  refine<string>((value: unknown) => {
    if (!value || typeof value !== 'string') return ok(value as string);
    const cleaned = value.replace(/\D/g, '');
    return cleaned.length === 10
      ? ok(value)
      : err([{ path: '', message }]);
  });

const creditCard = (message = 'Invalid credit card') =>
  refine<string>((value: unknown) => {
    if (!value || typeof value !== 'string') return ok(value as string);
    const cleaned = value.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(cleaned)) return err([{ path: '', message }]);

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
    return sum % 10 === 0 ? ok(value) : err([{ path: '', message }]);
  });

// Use in schemas
const schema = object({
  password: required(chain(string(), strongPassword())),
  phone: optional(chain(string(), phoneNumber())),
  card: optional(chain(string(), creditCard())),
});
```

---

## Understanding Validation Paths

There are two patterns for where validation errors land:

**Single-field validation** -- validating the field's own value:

- Use `path: ''` in the error object
- The library attaches the error to whatever field path this validator is nested under
- Example: `avatar: required(fileValidator)` where `fileValidator` returns `err([{ path: '', message: '...' }])`

**Cross-field validation** -- validating based on other fields:

- Use `chain` at the **object level** with `refineAt`
- The first argument to `refineAt` is the field path where the error should appear
- The predicate receives the entire parent object
- Example: `refineAt('confirmPassword', (data) => data.password === data.confirmPassword, '...')`

```typescript
// Single-field: error lands on the field itself
const strongPassword = refine<string>((value) => {
  if (isStrong(value)) return ok(value);
  return err([{ path: '', message: 'Too weak' }]); // path: '' = "this field"
});

// Cross-field: error lands on the specified target
const schema = chain(
  object({ password: required(string()), confirm: required(string()) }),
  refineAt('confirm', (d) => d.password === d.confirm, 'Must match') // target = 'confirm'
);
```

---

## Type Extraction Patterns

### InferSchemaType

Extract the output type from any schema:

```typescript
import { type InferSchemaType } from '@railway-ts/pipelines/schema';

const addressSchema = object({
  city: required(string()),
  zip: required(string()),
});

const userSchema = object({
  name: required(string()),
  addresses: array(addressSchema),
  primaryContact: required(contactSchema),
});

type User = InferSchemaType<typeof userSchema>;
type Address = InferSchemaType<typeof addressSchema>;
type UserAddresses = User['addresses']; // Address[]
```

### ExtractFieldPaths

Extract all valid dot-notation paths from a type:

```typescript
import { type ExtractFieldPaths } from '@railway-ts/use-form';

type User = {
  name: string;
  address: {
    city: string;
    zip: string;
  };
  tags: string[];
};

type Paths = ExtractFieldPaths<User>;
// "name" | "address" | "address.city" | "address.zip" | "tags"
```

Arrays and Dates are treated as terminal values -- `ExtractFieldPaths` returns `"tags"`, not `"tags[0]"`.

---

## Programmatic Field Updates

Update computed fields without triggering validation by passing `false` as the third argument to `setFieldValue`:

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

## submitCount Patterns

`submitCount` tracks how many times `handleSubmit` has been called. It's useful in `submit` validation mode where you want the submit button to be enabled before the first attempt but disabled after a failed one:

```tsx
const form = useForm(schema, {
  initialValues: { /* ... */ },
  validationMode: 'submit',
});

// Before first submit: button is enabled (haven't validated yet)
// After failed submit: button is disabled until errors are fixed
<button
  type="submit"
  disabled={form.submitCount > 0 && !form.isValid}
>
  Submit
</button>
```

This avoids the common UX problem where the submit button starts disabled on a `submit`-mode form even though the user hasn't tried submitting yet.

---

## What's Next

- **[Recipes](./RECIPES.md)** -- Practical patterns: Standard Schema, fieldValidators, UI library integration, testing, and more
- **[API Reference](./API.md)** -- Complete API documentation
