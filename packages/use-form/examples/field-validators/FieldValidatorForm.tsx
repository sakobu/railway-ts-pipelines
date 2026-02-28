// Alternative to schema-level async validation (AsyncUserForm).
// Uses fieldValidators for per-field async validation with targeted
// validatingFields tracking instead of form-wide isValidating.

import { useForm } from '../../src/';
import { fieldValidatorUserSchema, checkUsernameAvailable, type FieldValidatorUser } from './fieldValidatorSchema';
import { prepareForAPI } from '../utils';

export default function FieldValidatorForm() {
  const form = useForm<FieldValidatorUser>(fieldValidatorUserSchema, {
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
      console.log('Submit:', apiPayload);
    },
    // Per-field async validators — run after schema validation passes for that field
    fieldValidators: {
      username: async (value) => {
        const available = await checkUsernameAvailable(value);
        return available ? undefined : 'Username is already taken';
      },
    },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <h2>Field Validator Registration</h2>

      {/* Username — uses per-field validatingFields tracking */}
      <div className="field">
        <label htmlFor={form.getFieldId('username')}>Username *</label>
        <input type="text" placeholder="Enter username (try 'admin' or 'taken')" {...form.getFieldProps('username')} />
        {form.validatingFields.username && <span className="validating">Checking username...</span>}
        {form.getFieldError('username') && <span className="error">{form.getFieldError('username')}</span>}
      </div>

      {/* Email Input */}
      <div className="field">
        <label htmlFor={form.getFieldId('email')}>Email *</label>
        <input type="email" placeholder="user@example.com" {...form.getFieldProps('email')} />
        {form.getFieldError('email') && <span className="error">{form.getFieldError('email')}</span>}
      </div>

      {/* Password Input */}
      <div className="field">
        <label htmlFor={form.getFieldId('password')}>Password *</label>
        <input type="password" placeholder="Minimum 8 characters" {...form.getFieldProps('password')} />
        {form.getFieldError('password') && <span className="error">{form.getFieldError('password')}</span>}
      </div>

      {/* Number Input - Age */}
      <div className="field">
        <label htmlFor={form.getFieldId('age')}>Age *</label>
        <input type="number" min={0} max={120} {...form.getFieldProps('age')} />
        {form.getFieldError('age') && <span className="error">{form.getFieldError('age')}</span>}
      </div>

      {/* Date Input - Birthdate */}
      <div className="field">
        <label htmlFor={form.getFieldId('birthdate')}>Birthdate *</label>
        <input type="date" {...form.getFieldProps('birthdate')} />
        {form.getFieldError('birthdate') && <span className="error">{form.getFieldError('birthdate')}</span>}
      </div>

      {/* Select Input - Role */}
      <div className="field">
        <label htmlFor={form.getFieldId('role')}>Role *</label>
        <select {...form.getSelectFieldProps('role')}>
          <option value="">Select a role...</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        {form.getFieldError('role') && <span className="error">{form.getFieldError('role')}</span>}
      </div>

      {/* Nested Object - Address */}
      <fieldset>
        <legend>Address (Optional)</legend>

        <div className="field">
          <label htmlFor={form.getFieldId('address.street')}>Street</label>
          <input type="text" placeholder="123 Main St" {...form.getFieldProps('address.street')} />
          {form.getFieldError('address.street') && (
            <span className="error">{form.getFieldError('address.street')}</span>
          )}
        </div>

        <div className="field">
          <label htmlFor={form.getFieldId('address.city')}>City</label>
          <input type="text" placeholder="New York" {...form.getFieldProps('address.city')} />
          {form.getFieldError('address.city') && <span className="error">{form.getFieldError('address.city')}</span>}
        </div>

        <div className="field">
          <label htmlFor={form.getFieldId('address.zipCode')}>ZIP Code</label>
          <input type="text" placeholder="12345" {...form.getFieldProps('address.zipCode')} />
          {form.getFieldError('address.zipCode') && (
            <span className="error">{form.getFieldError('address.zipCode')}</span>
          )}
        </div>
      </fieldset>

      {/* Array Field - Contact Methods (checkbox group) */}
      <fieldset>
        <legend>Contact Methods (Optional)</legend>
        <div className="field">
          <label htmlFor={form.getFieldId('contacts', 'email')}>
            <input type="checkbox" {...form.getCheckboxGroupOptionProps('contacts', 'email')} />
            Email
          </label>
          <label htmlFor={form.getFieldId('contacts', 'phone')}>
            <input type="checkbox" {...form.getCheckboxGroupOptionProps('contacts', 'phone')} />
            Phone
          </label>
          {form.getFieldError('contacts') && <span className="error">{form.getFieldError('contacts')}</span>}
        </div>
      </fieldset>

      {/* Checkbox - Terms Acceptance */}
      <div className="field">
        <label>
          <input type="checkbox" {...form.getCheckboxProps('hasAcceptedTerms')} />I accept the terms and conditions *
        </label>
        {form.getFieldError('hasAcceptedTerms') && (
          <span className="error">{form.getFieldError('hasAcceptedTerms')}</span>
        )}
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
            validatingFields: form.validatingFields,
          },
          null,
          2,
        )}
      </pre>
    </form>
  );
}
