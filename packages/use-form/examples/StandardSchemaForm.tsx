import { toStandardSchema } from '@railway-ts/pipelines/schema';
import { useForm } from '../src/';
import { userSchema, type User } from './userSchema';
import { prepareForAPI } from './utils';

// Convert the railway-ts pipeline validator into a Standard Schema v1 object,
// then pass it straight to useForm — demonstrating full round-trip interop.
const standardUserSchema = toStandardSchema(userSchema);

export default function StandardSchemaForm() {
  const form = useForm<User>(standardUserSchema, {
    initialValues: {
      username: '',
      email: '',
      password: '',
      age: 0,
      birthdate: new Date(),
      hasAcceptedTerms: false,
      role: 'user',
      contacts: [],
    },
    onSubmit: (values) => {
      const apiPayload = prepareForAPI(values);
      console.log('Submit (Standard Schema):', apiPayload);
    },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <h2>Standard Schema Registration</h2>

      {/* Text Input - Username */}
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

      {/* Email Input */}
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

      {/* Password Input */}
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

      {/* Number Input - Age */}
      <div className="field">
        <label htmlFor={form.getFieldProps('age').id}>Age *</label>
        <input type="number" min={0} max={120} {...form.getFieldProps('age')} />
        {form.touched.age && form.errors.age && (
          <span className="error">{form.errors.age}</span>
        )}
      </div>

      {/* Date Input - Birthdate */}
      <div className="field">
        <label htmlFor={form.getFieldProps('birthdate').id}>Birthdate *</label>
        <input type="date" {...form.getFieldProps('birthdate')} />
        {form.touched.birthdate && form.errors.birthdate && (
          <span className="error">{form.errors.birthdate}</span>
        )}
      </div>

      {/* Select Input - Role */}
      <div className="field">
        <label htmlFor={form.getSelectFieldProps('role').id}>Role *</label>
        <select {...form.getSelectFieldProps('role')}>
          <option value="">Select a role...</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        {form.touched.role && form.errors.role && (
          <span className="error">{form.errors.role}</span>
        )}
      </div>

      {/* Checkbox - Terms Acceptance */}
      <div className="field">
        <label>
          <input
            type="checkbox"
            {...form.getCheckboxProps('hasAcceptedTerms')}
          />
          I accept the terms and conditions *
        </label>
        {form.touched.hasAcceptedTerms && form.errors.hasAcceptedTerms && (
          <span className="error">{form.errors.hasAcceptedTerms}</span>
        )}
      </div>

      {/* Form Actions */}
      <div className="actions">
        <button type="submit" disabled={form.isSubmitting || !form.isValid}>
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
