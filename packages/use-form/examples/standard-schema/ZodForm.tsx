// Bring your own Zod schema — useForm detects Standard Schema v1
// automatically, no adapters or wrappers needed.
//
// Zod v3.23+ implements Standard Schema v1 natively.

import { z } from 'zod';
import { useForm } from '../../src/';

// ── Your existing Zod schema — nothing special here ─────────

const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  age: z.coerce.number().min(18, 'Must be at least 18').max(120),
  role: z.enum(['admin', 'user']),
});

type User = z.infer<typeof userSchema>;

// ── Pass it straight to useForm — that's it ─────────────────

export default function ZodForm() {
  const form = useForm<User>(userSchema, {
    initialValues: {
      username: '',
      email: '',
      password: '',
      age: 0,
      role: 'user',
    },
    onSubmit: (values) => {
      console.log('Submit (Zod):', values);
    },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <h2>Zod Schema - useForm</h2>

      <div className="field">
        <label htmlFor={form.getFieldProps('username').id}>Username *</label>
        <input
          type="text"
          placeholder="Enter username"
          {...form.getFieldProps('username')}
        />
        {form.touched.username && form.errors.username && (
          <span className="error">{form.errors.username}</span>
        )}
      </div>

      <div className="field">
        <label htmlFor={form.getFieldProps('email').id}>Email *</label>
        <input
          type="email"
          placeholder="user@example.com"
          {...form.getFieldProps('email')}
        />
        {form.touched.email && form.errors.email && (
          <span className="error">{form.errors.email}</span>
        )}
      </div>

      <div className="field">
        <label htmlFor={form.getFieldProps('password').id}>Password *</label>
        <input
          type="password"
          placeholder="Minimum 8 characters"
          {...form.getFieldProps('password')}
        />
        {form.touched.password && form.errors.password && (
          <span className="error">{form.errors.password}</span>
        )}
      </div>

      <div className="field">
        <label htmlFor={form.getFieldProps('age').id}>Age *</label>
        <input type="number" min={0} max={120} {...form.getFieldProps('age')} />
        {form.touched.age && form.errors.age && (
          <span className="error">{form.errors.age}</span>
        )}
      </div>

      <div className="field">
        <label htmlFor={form.getSelectFieldProps('role').id}>Role *</label>
        <select {...form.getSelectFieldProps('role')}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {/* Form Actions */}
      <div className="actions">
        <button type="submit" disabled={form.isSubmitting}>
          {form.isSubmitting ? 'Submitting...' : 'Register'}
        </button>

        <button
          type="button"
          onClick={form.resetForm}
          disabled={form.isSubmitting}
        >
          Reset
        </button>
      </div>

      <pre>
        {JSON.stringify({ values: form.values, errors: form.errors }, null, 2)}
      </pre>
    </form>
  );
}
