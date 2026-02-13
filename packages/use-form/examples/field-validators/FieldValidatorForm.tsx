// Alternative to schema-level async validation (AsyncUserForm).
// Uses fieldValidators for per-field async validation with targeted
// validatingFields tracking instead of form-wide isValidating.

import { useForm } from '../../src/';
import {
  fieldValidatorUserSchema,
  checkUsernameAvailable,
  type FieldValidatorUser,
} from './fieldValidatorSchema';
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
        const available = await checkUsernameAvailable(value as string);
        return available ? undefined : 'Username is already taken';
      },
    },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <h2>Field Validator Registration</h2>

      {/* Username — uses per-field validatingFields tracking */}
      <div className="field">
        <label htmlFor={form.getFieldProps('username').id}>Username *</label>
        <input
          type="text"
          placeholder="Enter username (try 'admin' or 'taken')"
          {...form.getFieldProps('username')}
        />
        {form.validatingFields.username && (
          <span className="validating">Checking username...</span>
        )}
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

      {/* Nested Object - Address */}
      <fieldset>
        <legend>Address (Optional)</legend>

        <div className="field">
          <label htmlFor={form.getFieldProps('address.street').id}>
            Street
          </label>
          <input
            type="text"
            placeholder="123 Main St"
            {...form.getFieldProps('address.street')}
          />
          {form.touched['address.street'] && form.errors['address.street'] && (
            <span className="error">{form.errors['address.street']}</span>
          )}
        </div>

        <div className="field">
          <label htmlFor={form.getFieldProps('address.city').id}>City</label>
          <input
            type="text"
            placeholder="New York"
            {...form.getFieldProps('address.city')}
          />
          {form.touched['address.city'] && form.errors['address.city'] && (
            <span className="error">{form.errors['address.city']}</span>
          )}
        </div>

        <div className="field">
          <label htmlFor={form.getFieldProps('address.zipCode').id}>
            ZIP Code
          </label>
          <input
            type="text"
            placeholder="12345"
            {...form.getFieldProps('address.zipCode')}
          />
          {form.touched['address.zipCode'] &&
            form.errors['address.zipCode'] && (
              <span className="error">{form.errors['address.zipCode']}</span>
            )}
        </div>
      </fieldset>

      {/* Array Field - Contact Methods (checkbox group) */}
      <fieldset>
        <legend>Contact Methods (Optional)</legend>
        <div className="field">
          <label
            htmlFor={form.getCheckboxGroupOptionProps('contacts', 'email').id}
          >
            <input
              type="checkbox"
              {...form.getCheckboxGroupOptionProps('contacts', 'email')}
            />
            Email
          </label>
          <label
            htmlFor={form.getCheckboxGroupOptionProps('contacts', 'phone').id}
          >
            <input
              type="checkbox"
              {...form.getCheckboxGroupOptionProps('contacts', 'phone')}
            />
            Phone
          </label>
          {form.touched.contacts && form.errors.contacts && (
            <span className="error">{form.errors.contacts}</span>
          )}
        </div>
      </fieldset>

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
        <button type="submit" disabled={form.isSubmitting || form.isValidating}>
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
            validatingFields: form.validatingFields,
          },
          null,
          2
        )}
      </pre>
    </form>
  );
}
