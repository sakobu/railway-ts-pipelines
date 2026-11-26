/**
 * Cross-field async validation example.
 *
 * This example shows schema-level async validation (refineAtAsync). The server check
 * depends on both `username` and `organization`, and changing the org dropdown
 * re-runs the username availability check because the whole schema re-validates on
 * every change. The alternative is a field validator made with
 * withDeps(['organization'], …), which runs only when username or organization
 * changes.
 */
import { useForm } from '../../src/';

import { asyncUserSchema, type AsyncUser } from './asyncUserSchema';

export default function AsyncUserForm() {
  const form = useForm<AsyncUser>(asyncUserSchema, {
    initialValues: {
      username: '',
      email: '',
      organization: '',
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
        <label htmlFor={form.getFieldId('username')}>Username *</label>
        <input
          type="text"
          placeholder="Try 'admin' at any org, or 'alice' at acme-corp"
          {...form.getFieldProps('username')}
        />
        {form.isValidating && <span className="validating">Checking...</span>}
        {form.getFieldError('username') && <span className="error">{form.getFieldError('username')}</span>}
      </div>

      {/* Email — standard sync validation */}
      <div className="field">
        <label htmlFor={form.getFieldId('email')}>Email *</label>
        <input type="email" placeholder="user@example.com" {...form.getFieldProps('email')} />
        {form.getFieldError('email') && <span className="error">{form.getFieldError('email')}</span>}
      </div>

      {/* Organization — changing this re-triggers the username check */}
      <div className="field">
        <label htmlFor={form.getFieldId('organization')}>Organization *</label>
        <select {...form.getSelectFieldProps('organization')}>
          <option value="">Select an organization...</option>
          <option value="acme-corp">Acme Corp</option>
          <option value="globex">Globex</option>
          <option value="initech">Initech</option>
        </select>
        {form.getFieldError('organization') && <span className="error">{form.getFieldError('organization')}</span>}
      </div>

      {/* Form Actions */}
      <div className="actions">
        <button type="submit" disabled={form.isSubmitting || form.isValidating}>
          {form.isSubmitting ? 'Submitting...' : 'Register'}
        </button>

        <button type="button" onClick={form.resetForm} disabled={form.isSubmitting}>
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
          2,
        )}
      </pre>
    </form>
  );
}
