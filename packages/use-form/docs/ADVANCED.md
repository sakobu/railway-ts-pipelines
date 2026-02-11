# Advanced Patterns

Complex use cases, performance optimization, and integration patterns.

## Discriminated Unions

Handle forms with different shapes based on a type field:

```typescript
import { discriminatedUnion } from "@railway-ts/pipelines/schema";

const paymentValidator = discriminatedUnion("method", {
  card: object({
    method: literal("card"),
    cardNumber: required(chain(string(), nonEmpty())),
    expiryDate: required(string()),
    cvv: required(string()),
  }),
  paypal: object({
    method: literal("paypal"),
    email: required(email()),
  }),
  bank: object({
    method: literal("bank"),
    accountNumber: required(string()),
    routingNumber: required(string()),
  }),
});

type Payment = InferSchemaType<typeof paymentValidator>;

function PaymentForm() {
  const form = useForm<Payment>(paymentValidator, {
    initialValues: {
      method: "card",
      cardNumber: "",
      expiryDate: "",
      cvv: "",
    },
  });

  const method = form.values.method;

  return (
    <form onSubmit={form.handleSubmit}>
      <select {...form.getSelectFieldProps("method")}>
        <option value="card">Credit Card</option>
        <option value="paypal">PayPal</option>
        <option value="bank">Bank Transfer</option>
      </select>

      {method === "card" && (
        <>
          <input
            {...form.getFieldProps("cardNumber")}
            placeholder="Card Number"
          />
          <input {...form.getFieldProps("expiryDate")} placeholder="MM/YY" />
          <input {...form.getFieldProps("cvv")} placeholder="CVV" />
        </>
      )}

      {method === "paypal" && (
        <input {...form.getFieldProps("email")} placeholder="PayPal Email" />
      )}

      {method === "bank" && (
        <>
          <input
            {...form.getFieldProps("accountNumber")}
            placeholder="Account Number"
          />
          <input
            {...form.getFieldProps("routingNumber")}
            placeholder="Routing Number"
          />
        </>
      )}

      <button type="submit">Pay</button>
    </form>
  );
}
```

## Custom Validators

Create reusable validation functions:

```typescript
import { refine, err, ok } from '@railway-ts/pipelines/schema';

// Note: When using refine on individual fields, use path: ""
// The validation library attaches the error to the field automatically

// Password strength validator
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

// Phone number validator
const phoneNumber = (message = 'Invalid phone number') =>
  refine<string>((value: unknown) => {
    if (!value || typeof value !== 'string') return ok(value as string);
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return ok(value);
    }
    return err([{ path: '', message }]);
  });

// Credit card validator
const creditCard = (message = 'Invalid credit card') =>
  refine<string>((value: unknown) => {
    if (!value || typeof value !== 'string') return ok(value as string);

    const cleaned = value.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(cleaned)) {
      return err([{ path: '', message }]);
    }

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

// Use in validators
const validator = object({
  password: required(chain(string(), strongPassword())),
  phone: optional(chain(string(), phoneNumber())),
  card: optional(chain(string(), creditCard())),
});
```

## Cross-Field Validation

Validate one field against another using `refineAt` from `@railway-ts/pipelines/schema`:

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

type RegistrationData = {
  password: string;
  confirmPassword: string;
  startDate: string;
  endDate: string;
};

const registrationValidator = chain(
  object({
    password: required(chain(string(), minLength(8))),
    confirmPassword: required(string()),
    startDate: required(string()),
    endDate: required(string()),
  }),
  // Validate password match
  refineAt<RegistrationData>(
    'confirmPassword',
    (data) => data.password === data.confirmPassword,
    'Passwords must match'
  ),
  // Validate date range
  refineAt<RegistrationData>(
    'endDate',
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return new Date(data.endDate) > new Date(data.startDate);
    },
    'End date must be after start date'
  )
);
```

### Understanding Validation Paths

**Single-field validation** (validating the field itself):

- Use `path: ""`
- The library attaches error to the field automatically
- Example: `avatar: required(fileValidator)` where fileValidator checks the file

**Cross-field validation** (validating based on other fields):

- Use `chain` at the object level with `refineAt`
- Specify target field path explicitly as string or array
- Path is kept as array internally, not joined to string
- Example: password confirmation, dependent fields, date ranges

## Async Validation

Check server-side constraints:

```typescript
const checkUsernameAvailable = async (username: string): Promise<boolean> => {
  const response = await fetch(`/api/check-username?username=${username}`);
  const data = await response.json();
  return data.available;
};

function RegistrationForm() {
  const form = useForm(registrationValidator, {
    onSubmit: async (values) => {
      // Check username availability before submitting
      const available = await checkUsernameAvailable(values.username);

      if (!available) {
        form.setServerErrors({
          username: "Username is already taken",
        });
        return;
      }

      // Proceed with registration
      await fetch("/api/register", {
        method: "POST",
        body: JSON.stringify(values),
      });
    },
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <input {...form.getFieldProps("username")} />
      {form.touched.username && form.errors.username && (
        <span>{form.errors.username}</span>
      )}
      <button type="submit">Register</button>
    </form>
  );
}
```

## Complex Array Operations

Advanced array field manipulation:

```typescript
function TaskManager() {
  const form = useForm(tasksValidator, {
    initialValues: { tasks: [] },
  });

  const helpers = form.arrayHelpers("tasks");

  // Bulk operations
  const addMultipleTasks = () => {
    const newTasks = [
      { title: "Task 1", done: false },
      { title: "Task 2", done: false },
      { title: "Task 3", done: false },
    ];

    newTasks.forEach((task) => helpers.push(task));
  };

  const removeCompleted = () => {
    // Remove in reverse order to avoid index shifting
    for (let i = helpers.values.length - 1; i >= 0; i--) {
      if (helpers.values[i].done) {
        helpers.remove(i);
      }
    }
  };

  const markAllComplete = () => {
    helpers.values.forEach((_, index) => {
      form.setFieldValue(`tasks.${index}.done`, true);
    });
  };

  const reorderByPriority = () => {
    const sorted = [...helpers.values].sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );

    sorted.forEach((task, index) => {
      helpers.replace(index, task);
    });
  };

  return (
    <div>
      {helpers.values.map((task, index) => (
        <div key={index}>
          <input {...helpers.getCheckboxProps(index, "done")} />
          <input {...helpers.getFieldProps(index, "title")} />
          <input type="number" {...helpers.getFieldProps(index, "priority")} />
          <button onClick={() => helpers.remove(index)}>Delete</button>
          <button onClick={() => helpers.move(index, 0)}>Move to Top</button>
        </div>
      ))}

      <button onClick={addMultipleTasks}>Add 3 Tasks</button>
      <button onClick={removeCompleted}>Remove Completed</button>
      <button onClick={markAllComplete}>Mark All Complete</button>
      <button onClick={reorderByPriority}>Sort by Priority</button>
    </div>
  );
}
```

## Performance Optimization

### Memoize Field Props

```tsx
import { memo, useMemo } from 'react';

type FormFieldProps<TValues extends Record<string, unknown>> = {
  form: ReturnType<typeof useForm<TValues>>;
  field: string;
  label: string;
};

const FormField = memo(
  <TValues extends Record<string, unknown>>({
    form,
    field,
    label,
  }: FormFieldProps<TValues>) => {
    const props = useMemo(() => form.getFieldProps(field), [form, field]);
    const error = form.touched[field] && form.errors[field];

    return (
      <div>
        <label>{label}</label>
        <input {...props} />
        {error && <span>{error}</span>}
      </div>
    );
  }
);

function LargeForm() {
  const form = useForm(largeValidator, { initialValues: {} });

  return (
    <form onSubmit={form.handleSubmit}>
      <FormField form={form} field="field1" label="Field 1" />
      <FormField form={form} field="field2" label="Field 2" />
      {/* Many more fields */}
    </form>
  );
}
```

### Debounced Validation

```tsx
import { useDebounce } from '@railway-ts/use-form';

function SearchForm() {
  const form = useForm(searchValidator, {
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
    />
  );
}
```

### Lazy Validation

Only validate fields that have been touched:

```typescript
const form = useForm(validator, {
  validationMode: 'blur', // Only validate on blur
});
```

## Integration with UI Libraries

UI libraries like Material-UI, Chakra UI, and others have different prop signatures than native HTML inputs. You need to manually map form state to their component APIs.

### Material-UI

```tsx
import { TextField, Button } from '@mui/material';

function MuiForm() {
  const form = useForm(validator, {
    initialValues: { email: '', password: '' },
  });

  return (
    <form onSubmit={form.handleSubmit}>
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
        name="password"
        type="password"
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

### Chakra UI

```tsx
import {
  FormControl,
  FormLabel,
  Input,
  FormErrorMessage,
  Button,
} from '@chakra-ui/react';

function ChakraForm() {
  const form = useForm(validator, {
    initialValues: { email: '', password: '' },
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <FormControl isInvalid={form.touched.email && Boolean(form.errors.email)}>
        <FormLabel>Email</FormLabel>
        <Input
          name="email"
          value={form.values.email || ''}
          onChange={(e) => form.setFieldValue('email', e.target.value)}
          onBlur={() => form.setFieldTouched('email')}
        />
        <FormErrorMessage>{form.errors.email}</FormErrorMessage>
      </FormControl>

      <FormControl
        isInvalid={form.touched.password && Boolean(form.errors.password)}
      >
        <FormLabel>Password</FormLabel>
        <Input
          name="password"
          type="password"
          value={form.values.password || ''}
          onChange={(e) => form.setFieldValue('password', e.target.value)}
          onBlur={() => form.setFieldTouched('password')}
        />
        <FormErrorMessage>{form.errors.password}</FormErrorMessage>
      </FormControl>

      <Button
        type="submit"
        isLoading={form.isSubmitting}
        isDisabled={!form.isValid}
      >
        Submit
      </Button>
    </form>
  );
}
```

### Shadcn/ui

Shadcn/ui components are based on Radix UI primitives and use native HTML under the hood, so they work with native props:

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

function ShadcnForm() {
  const form = useForm(validator, {
    initialValues: { email: '', password: '' },
  });

  return (
    <form onSubmit={form.handleSubmit} className="space-y-4">
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

## Type Extraction Patterns

Extract types from complex validators:

```typescript
// Extract nested object type
type Address = InferSchemaType<typeof addressValidator>;

// Extract array item type
type Contact = InferSchemaType<typeof contactValidator>;

// Use in other validators
const userValidator = object({
  addresses: array(addressValidator),
  primaryContact: required(contactValidator),
});

// Extract field types
type User = InferSchemaType<typeof userValidator>;
type UserAddresses = User['addresses'];
type UserContact = User['primaryContact'];
```

## Programmatic Field Updates

Update fields based on business logic:

```typescript
function CalculatorForm() {
  const form = useForm(calculatorValidator, {
    initialValues: { quantity: 0, price: 0, total: 0 },
  });

  useEffect(() => {
    const quantity = form.values.quantity || 0;
    const price = form.values.price || 0;
    const total = quantity * price;

    // Update total without triggering validation
    form.setFieldValue("total", total, false);
  }, [form.values.quantity, form.values.price]);

  return (
    <form onSubmit={form.handleSubmit}>
      <input type="number" {...form.getFieldProps("quantity")} />
      <input type="number" {...form.getFieldProps("price")} />
      <input type="number" {...form.getFieldProps("total")} readOnly />
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Form State Persistence

Save and restore form state:

```typescript
type FormData = {
  name: string;
  email: string;
};

function PersistentForm() {
  const form = useForm<FormData>(validator, {
    initialValues: JSON.parse(localStorage.getItem("formData") || "{}"),
  });

  // Save on every change
  useEffect(() => {
    localStorage.setItem("formData", JSON.stringify(form.values));
  }, [form.values]);

  // Clear on submit
  const handleSubmit = async (values: FormData) => {
    await api.submit(values);
    localStorage.removeItem("formData");
    form.resetForm();
  };

  return <form onSubmit={form.handleSubmit}>{/* fields */}</form>;
}
```

## Unsaved Changes Warning

Warn users about unsaved changes:

```typescript
function FormWithWarning() {
  const form = useForm(validator, { initialValues: {} });

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (form.isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form.isDirty]);

  return <form onSubmit={form.handleSubmit}>{/* fields */}</form>;
}
```

## Testing Forms

Test form behavior with Testing Library:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, test, expect } from "bun:test";

describe("LoginForm", () => {
  test("validates required fields", async () => {
    render(<LoginForm />);

    const submitButton = screen.getByRole("button", { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Email is required")).toBeInTheDocument();
      expect(screen.getByText("Password is required")).toBeInTheDocument();
    });
  });

  test("submits valid form", async () => {
    const onSubmit = jest.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
    });
  });

  test("handles server errors", async () => {
    const onSubmit = jest.fn().mockRejectedValue({
      email: "Email already exists",
    });

    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByText("Email already exists")).toBeInTheDocument();
    });
  });
});
```

## Custom Field Components

Create reusable form field components:

```tsx
type FieldProps<TValues extends Record<string, unknown>> = {
  form: ReturnType<typeof useForm<TValues>>;
  name: string;
  label: string;
  type?: string;
};

function Field<TValues extends Record<string, unknown>>({
  form,
  name,
  label,
  type = 'text',
}: FieldProps<TValues>) {
  const error = form.touched[name] && form.errors[name];

  return (
    <div className="field">
      <label htmlFor={`field-${name}`}>{label}</label>
      <input type={type} {...form.getFieldProps(name)} />
      {error && <span className="error">{error}</span>}
    </div>
  );
}

type LoginForm = {
  email: string;
  password: string;
};

function MyForm() {
  const form = useForm<LoginForm>(validator, {
    initialValues: { email: '', password: '' },
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <Field form={form} name="email" label="Email" type="email" />
      <Field form={form} name="password" label="Password" type="password" />
      <button type="submit">Submit</button>
    </form>
  );
}
```
