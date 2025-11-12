# Recipes

Common patterns and practical examples.

## Basic CRUD Form

```tsx
import { useForm } from '@railway-ts/use-form';
import {
  object,
  string,
  required,
  chain,
  nonEmpty,
  minLength,
  email,
  optional,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

const userValidator = object({
  username: required(chain(string(), nonEmpty(), minLength(3))),
  email: required(chain(string(), nonEmpty(), email())),
  bio: optional(string()),
});

type UserForm = InferSchemaType<typeof userValidator>;

function CreateUserForm() {
  const form = useForm<UserForm>(userValidator, {
    initialValues: { username: '', email: '', bio: '' },
    onSubmit: async (values) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errors = await response.json();
        form.setServerErrors(errors);
      }
    },
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <div>
        <label>Username</label>
        <input {...form.getFieldProps('username')} />
        {form.touched.username && form.errors.username && (
          <span>{form.errors.username}</span>
        )}
      </div>

      <div>
        <label>Email</label>
        <input type="email" {...form.getFieldProps('email')} />
        {form.touched.email && form.errors.email && (
          <span>{form.errors.email}</span>
        )}
      </div>

      <div>
        <label>Bio</label>
        <textarea {...form.getFieldProps('bio')} rows={4} />
      </div>

      <button type="submit" disabled={form.isSubmitting || !form.isValid}>
        Create User
      </button>
    </form>
  );
}
```

## Nested Objects

```tsx
const addressValidator = object({
  street: required(string()),
  city: required(string()),
  state: required(string()),
  zip: required(string()),
});

const profileValidator = object({
  name: required(string()),
  email: required(email()),
  address: required(addressValidator),
});

type Profile = InferSchemaType<typeof profileValidator>;

function ProfileForm() {
  const form = useForm<Profile>(profileValidator, {
    initialValues: {
      name: '',
      email: '',
      address: { street: '', city: '', state: '', zip: '' },
    },
  });

  return (
    <form onSubmit={form.handleSubmit}>
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

## Dynamic Arrays

```tsx
const contactValidator = object({
  name: required(string()),
  email: required(email()),
  phone: optional(string()),
});

const contactsValidator = object({
  contacts: array(contactValidator),
});

type ContactsForm = InferSchemaType<typeof contactsValidator>;

function ContactsList() {
  const form = useForm<ContactsForm>(contactsValidator, {
    initialValues: { contacts: [{ name: '', email: '', phone: '' }] },
  });

  const helpers = form.arrayHelpers('contacts');

  return (
    <form onSubmit={form.handleSubmit}>
      {helpers.values.map((contact, index) => (
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

          <input
            {...helpers.getFieldProps(index, 'phone')}
            placeholder="Phone"
          />

          <button type="button" onClick={() => helpers.remove(index)}>
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => helpers.push({ name: '', email: '', phone: '' })}
      >
        Add Contact
      </button>

      <button type="submit">Save All</button>
    </form>
  );
}
```

## Re-orderable List

```tsx
function TodoList() {
  const form = useForm(todosValidator, {
    initialValues: { todos: [] },
  });

  const helpers = form.arrayHelpers('todos');

  const moveUp = (index: number) => {
    if (index > 0) {
      helpers.swap(index, index - 1);
    }
  };

  const moveDown = (index: number) => {
    if (index < helpers.values.length - 1) {
      helpers.swap(index, index + 1);
    }
  };

  return (
    <div>
      {helpers.values.map((todo, index) => (
        <div key={index}>
          <input {...helpers.getFieldProps(index, 'text')} />
          <button onClick={() => moveUp(index)} disabled={index === 0}>
            Up
          </button>
          <button
            onClick={() => moveDown(index)}
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

## Checkbox Groups

```tsx
const preferencesValidator = object({
  notifications: array(stringEnum(['email', 'sms', 'push'])),
});

type Preferences = InferSchemaType<typeof preferencesValidator>;

function NotificationPreferences() {
  const form = useForm<Preferences>(preferencesValidator, {
    initialValues: { notifications: [] },
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <fieldset>
        <legend>Notification Methods</legend>

        <label>
          <input
            type="checkbox"
            {...form.getCheckboxGroupOptionProps('notifications', 'email')}
          />
          Email
        </label>

        <label>
          <input
            type="checkbox"
            {...form.getCheckboxGroupOptionProps('notifications', 'sms')}
          />
          SMS
        </label>

        <label>
          <input
            type="checkbox"
            {...form.getCheckboxGroupOptionProps('notifications', 'push')}
          />
          Push
        </label>
      </fieldset>

      <button type="submit">Save Preferences</button>
    </form>
  );
}
```

## Radio Groups

```tsx
const settingsValidator = object({
  theme: required(stringEnum(['light', 'dark', 'auto'])),
  language: required(stringEnum(['en', 'es', 'fr'])),
});

type Settings = InferSchemaType<typeof settingsValidator>;

function SettingsForm() {
  const form = useForm<Settings>(settingsValidator, {
    initialValues: { theme: 'light', language: 'en' },
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <fieldset>
        <legend>Theme</legend>

        <label>
          <input
            type="radio"
            {...form.getRadioGroupOptionProps('theme', 'light')}
          />
          Light
        </label>

        <label>
          <input
            type="radio"
            {...form.getRadioGroupOptionProps('theme', 'dark')}
          />
          Dark
        </label>

        <label>
          <input
            type="radio"
            {...form.getRadioGroupOptionProps('theme', 'auto')}
          />
          Auto
        </label>
      </fieldset>

      <fieldset>
        <legend>Language</legend>

        <label>
          <input
            type="radio"
            {...form.getRadioGroupOptionProps('language', 'en')}
          />
          English
        </label>

        <label>
          <input
            type="radio"
            {...form.getRadioGroupOptionProps('language', 'es')}
          />
          Spanish
        </label>

        <label>
          <input
            type="radio"
            {...form.getRadioGroupOptionProps('language', 'fr')}
          />
          French
        </label>
      </fieldset>

      <button type="submit">Save</button>
    </form>
  );
}
```

## File Uploads

```tsx
import { refine } from '@railway-ts/pipelines/schema';
import { ok, err } from '@railway-ts/pipelines/result';

// When validating a field directly, use empty path ""
// The library will attach the error to the correct field automatically
const fileValidator = refine((value: unknown) => {
  if (!value) return err([{ path: '', message: 'File is required' }]);
  if (!(value instanceof File))
    return err([{ path: '', message: 'Must be a file' }]);
  if (value.size > 5000000)
    return err([{ path: '', message: 'File too large (max 5MB)' }]);
  if (!value.type.startsWith('image/'))
    return err([{ path: '', message: 'Must be an image' }]);
  return ok(value as File);
});

const uploadValidator = object({
  avatar: required(fileValidator),
});

type UploadForm = InferSchemaType<typeof uploadValidator>;

function AvatarUpload() {
  const form = useForm<UploadForm>(uploadValidator, {
    initialValues: { avatar: null },
    onSubmit: async (values) => {
      const formData = new FormData();
      formData.append('avatar', values.avatar);
      await fetch('/api/upload', { method: 'POST', body: formData });
    },
  });

  return (
    <form onSubmit={form.handleSubmit}>
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

## Auto-Submit Form

```tsx
import { useAutoSubmitForm } from '@railway-ts/use-form';

const filterValidator = object({
  search: optional(string()),
  category: optional(string()),
  minPrice: optional(parseNumber()),
  maxPrice: optional(parseNumber()),
});

type Filters = InferSchemaType<typeof filterValidator>;

function ProductFilters() {
  const form = useForm<Filters>(filterValidator, {
    initialValues: {
      search: '',
      category: '',
      minPrice: undefined,
      maxPrice: undefined,
    },
    validationMode: 'live',
  });

  // Auto-submit after 500ms of inactivity
  useAutoSubmitForm(form, {
    debounceMs: 500,
    onSubmit: async (values) => {
      const params = new URLSearchParams();
      if (values.search) params.set('search', values.search);
      if (values.category) params.set('category', values.category);
      if (values.minPrice) params.set('minPrice', values.minPrice.toString());
      if (values.maxPrice) params.set('maxPrice', values.maxPrice.toString());

      const response = await fetch(`/api/products?${params}`);
      const products = await response.json();
      // Update UI with products
    },
  });

  return (
    <div>
      <input {...form.getFieldProps('search')} placeholder="Search..." />

      <select {...form.getSelectFieldProps('category')}>
        <option value="">All Categories</option>
        <option value="electronics">Electronics</option>
        <option value="clothing">Clothing</option>
      </select>

      <input
        type="number"
        {...form.getFieldProps('minPrice')}
        placeholder="Min Price"
      />
      <input
        type="number"
        {...form.getFieldProps('maxPrice')}
        placeholder="Max Price"
      />
    </div>
  );
}
```

## Search with Debounce

```tsx
function SearchBox() {
  const form = useForm(searchValidator, {
    initialValues: { query: '' },
    validationMode: 'live',
  });

  useAutoSubmitForm(form, {
    debounceMs: 300,
    onSubmit: async (values) => {
      if (!values.query) return;
      const results = await fetch(`/api/search?q=${values.query}`).then((r) =>
        r.json()
      );
      // Update search results
    },
  });

  return <input {...form.getFieldProps('query')} placeholder="Search..." />;
}
```

## Multi-Step Form

```tsx
import { isOk } from '@railway-ts/pipelines/result';

function MultiStepForm() {
  const [step, setStep] = useState(1);

  const form = useForm(wizardValidator, {
    initialValues: {
      personal: { name: '', email: '' },
      address: { street: '', city: '' },
      payment: { cardNumber: '' },
    },
  });

  const handleNext = async () => {
    const result = form.validateForm(form.values);
    if (isOk(result)) {
      setStep(step + 1);
    }
  };

  return (
    <form onSubmit={form.handleSubmit}>
      {step === 1 && (
        <div>
          <h2>Personal Info</h2>
          <input {...form.getFieldProps('personal.name')} />
          <input {...form.getFieldProps('personal.email')} />
          <button type="button" onClick={handleNext}>
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2>Address</h2>
          <input {...form.getFieldProps('address.street')} />
          <input {...form.getFieldProps('address.city')} />
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
          <input {...form.getFieldProps('payment.cardNumber')} />
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

## Dependent Fields

```tsx
import { useForm } from '@railway-ts/use-form';
import {
  object,
  string,
  required,
  optional,
  chain,
  refineAt,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

type ShippingData = {
  country: string;
  state?: string;
};

const shippingValidator = chain(
  object({
    country: required(string()),
    state: optional(string()),
  }),
  refineAt<ShippingData>(
    'state',
    (data) => data.country !== 'US' || !!data.state,
    'State is required for US addresses'
  )
);

type Shipping = InferSchemaType<typeof shippingValidator>;

function ShippingForm() {
  const form = useForm<Shipping>(shippingValidator, {
    initialValues: { country: '', state: '' },
  });

  const isUS = form.values.country === 'US';

  return (
    <form onSubmit={form.handleSubmit}>
      <select {...form.getSelectFieldProps('country')}>
        <option value="">Select Country</option>
        <option value="US">United States</option>
        <option value="CA">Canada</option>
        <option value="UK">United Kingdom</option>
      </select>

      {isUS && (
        <select {...form.getSelectFieldProps('state')}>
          <option value="">Select State</option>
          <option value="CA">California</option>
          <option value="NY">New York</option>
          <option value="TX">Texas</option>
        </select>
      )}

      <button type="submit">Continue</button>
    </form>
  );
}
```

## Server Error Handling

```tsx
function RegistrationForm() {
  const form = useForm(registrationValidator, {
    onSubmit: async (values) => {
      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });

        if (!response.ok) {
          // Handle validation errors from server
          const errors = await response.json();
          form.setServerErrors(errors);
          return;
        }

        // Success
        window.location.href = '/dashboard';
      } catch (error) {
        // Handle network errors
        form.setServerErrors({
          '': 'Network error. Please try again.',
        });
      }
    },
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <input {...form.getFieldProps('username')} />
      {form.touched.username && form.errors.username && (
        <span>{form.errors.username}</span>
      )}

      <input {...form.getFieldProps('email')} />
      {form.touched.email && form.errors.email && (
        <span>{form.errors.email}</span>
      )}

      <input type="password" {...form.getFieldProps('password')} />
      {form.touched.password && form.errors.password && (
        <span>{form.errors.password}</span>
      )}

      {form.errors[''] && <div className="form-error">{form.errors['']}</div>}

      <button type="submit" disabled={form.isSubmitting}>
        Register
      </button>
    </form>
  );
}
```

## Form with Reset

```tsx
function EditProfile() {
  const form = useForm(profileValidator, {
    initialValues: { name: 'John Doe', email: 'john@example.com' },
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <input {...form.getFieldProps('name')} />
      <input {...form.getFieldProps('email')} />

      <button type="submit">Save Changes</button>
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

## Conditional Validation

```tsx
import { useForm } from '@railway-ts/use-form';
import {
  object,
  string,
  required,
  optional,
  chain,
  stringEnum,
  refineAt,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

type AccountData = {
  accountType: 'personal' | 'business';
  companyName?: string;
  taxId?: string;
};

const accountValidator = chain(
  object({
    accountType: required(stringEnum(['personal', 'business'])),
    companyName: optional(string()),
    taxId: optional(string()),
  }),
  refineAt<AccountData>(
    'companyName',
    (data) => data.accountType === 'personal' || !!data.companyName,
    'Company name is required for business accounts'
  ),
  refineAt<AccountData>(
    'taxId',
    (data) => data.accountType === 'personal' || !!data.taxId,
    'Tax ID is required for business accounts'
  )
);

type Account = InferSchemaType<typeof accountValidator>;

function AccountForm() {
  const form = useForm<Account>(accountValidator, {
    initialValues: { accountType: 'personal', companyName: '', taxId: '' },
  });

  const isBusiness = form.values.accountType === 'business';

  return (
    <form onSubmit={form.handleSubmit}>
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
