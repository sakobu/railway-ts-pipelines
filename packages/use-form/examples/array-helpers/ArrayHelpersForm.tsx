import { useForm } from '../../src/';
import { teamSchema, type Team } from './arrayHelpersSchema';

export default function ArrayHelpersForm() {
  const form = useForm<Team>(teamSchema, {
    initialValues: {
      teamName: '',
      teamMembers: [],
    },
    onSubmit: (values) => {
      console.log('Submit:', values);
    },
  });

  const helpers = form.arrayHelpers('teamMembers');

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <h2>Array Helpers</h2>

      {/* Team Name */}
      <div className="field">
        <label htmlFor={form.getFieldId('teamName')}>Team Name *</label>
        <input
          type="text"
          placeholder="Enter team name"
          {...form.getFieldProps('teamName')}
        />
        {form.getFieldError('teamName') && (
          <span className="error">{form.getFieldError('teamName')}</span>
        )}
      </div>

      {/* Team Members Array */}
      <fieldset>
        <legend>Team Members</legend>

        {helpers.values.length === 0 && (
          <p className="empty-message">
            No members yet. Click &ldquo;Add Member&rdquo; to get started.
          </p>
        )}

        {helpers.values.map((_, index) => (
          <div key={index} className="array-item">
            <div className="array-item-header">
              <span>Member {index + 1}</span>
              <div className="array-item-actions">
                <button
                  type="button"
                  className="array-btn"
                  disabled={index === 0}
                  onClick={() => helpers.swap(index, index - 1)}
                >
                  Move Up
                </button>
                <button
                  type="button"
                  className="array-btn"
                  disabled={index === helpers.values.length - 1}
                  onClick={() => helpers.swap(index, index + 1)}
                >
                  Move Down
                </button>
                <button
                  type="button"
                  className="array-btn array-btn-remove"
                  onClick={() => helpers.remove(index)}
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor={helpers.getFieldId(index, 'name')}>Name *</label>
              <input
                type="text"
                placeholder="Member name"
                {...helpers.getFieldProps(index, 'name')}
              />
              {helpers.getFieldError(index, 'name') && (
                <span className="error">
                  {helpers.getFieldError(index, 'name')}
                </span>
              )}
            </div>

            <div className="field">
              <label htmlFor={helpers.getFieldId(index, 'email')}>
                Email *
              </label>
              <input
                type="email"
                placeholder="member@example.com"
                {...helpers.getFieldProps(index, 'email')}
              />
              {helpers.getFieldError(index, 'email') && (
                <span className="error">
                  {helpers.getFieldError(index, 'email')}
                </span>
              )}
            </div>

            <div className="field">
              <label htmlFor={helpers.getFieldId(index, 'role')}>Role *</label>
              <select {...helpers.getSelectFieldProps(index, 'role')}>
                <option value="">Select a role...</option>
                <option value="developer">Developer</option>
                <option value="designer">Designer</option>
                <option value="manager">Manager</option>
              </select>
              {helpers.getFieldError(index, 'role') && (
                <span className="error">
                  {helpers.getFieldError(index, 'role')}
                </span>
              )}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            helpers.push({ name: '', email: '', role: 'developer' })
          }
        >
          Add Member
        </button>
      </fieldset>

      {/* Form Actions */}
      <div className="actions">
        <button type="submit" disabled={form.isSubmitting}>
          {form.isSubmitting ? 'Submitting...' : 'Submit'}
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
          },
          null,
          2
        )}
      </pre>
    </form>
  );
}
