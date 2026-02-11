/**
 * Cross-field async validation example.
 *
 * Why schema-level async instead of fieldValidators?
 * fieldValidators only fire when their OWN field changes. Here the server check
 * depends on both `username` and `organization` — changing the org dropdown must
 * re-run the username availability check. Only schema-level async validation
 * (via refineAtAsync) can do this, because it re-validates the whole schema on
 * every change.
 */
import { useForm } from '../../src/';
import { asyncUserSchema, type AsyncUser } from './asyncUserSchema';

export default function AsyncUserForm() {
  const form = useForm<AsyncUser>(asyncUserSchema, {
    initialValues: {
      username: '',
      email: '',
      organization: '' as AsyncUser['organization'],
    },
    onSubmit: (values) => {
      console.log('Submit:', values);
    },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <h2>Cross-field Async Validation</h2>

      {/* Username — async cross-field check with organization */}
      <div className="field">
        <label htmlFor={form.getFieldProps('username').id}>Username *</label>
        <input
          type="text"
          placeholder="Try 'admin' at any org, or 'alice' at acme-corp"
          {...form.getFieldProps('username')}
        />
        {form.isValidating && <span className="validating">Checking...</span>}
        {form.touched.username && form.errors.username && (
          <span className="error">{form.errors.username}</span>
        )}
      </div>

      {/* Email — standard sync validation */}
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

      {/* Organization — changing this re-triggers the username check */}
      <div className="field">
        <label htmlFor={form.getSelectFieldProps('organization').id}>Organization *</label>
        <select {...form.getSelectFieldProps('organization')}>
          <option value="">Select an organization...</option>
          <option value="acme-corp">Acme Corp</option>
          <option value="globex">Globex</option>
          <option value="initech">Initech</option>
        </select>
        {form.touched.organization && form.errors.organization && (
          <span className="error">{form.errors.organization}</span>
        )}
      </div>

      {/* Form Actions */}
      <div className="actions">
        <button
          type="submit"
          disabled={form.isSubmitting || form.isValidating || !form.isValid}
        >
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
        {JSON.stringify(
          {
            values: form.values,
            errors: form.errors,
            isValidating: form.isValidating,
          },
          null,
          2
        )}
      </pre>
    </form>
  );
}
