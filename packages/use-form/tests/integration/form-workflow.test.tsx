import { describe, test, expect, mock } from 'bun:test';
import { render, screen, waitFor } from '../fixtures/test-utils';
import { userEvent } from '@testing-library/user-event';
import { useForm } from '../../src/useForm';
import { userValidator, type UserForm } from '../fixtures/validators';

// Test component that uses the form hook
function UserFormComponent({
  onSubmitSuccess,
}: {
  onSubmitSuccess: (values: UserForm) => void;
}) {
  const form = useForm(userValidator, {
    initialValues: { name: '', email: '', age: 0 },
    onSubmit: onSubmitSuccess,
    validationMode: 'live',
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <div>
        <label htmlFor="name">Name</label>
        <input {...form.getFieldProps('name')} data-testid="name-input" />
        {form.touched.name && form.errors.name && (
          <span data-testid="name-error">{form.errors.name}</span>
        )}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input {...form.getFieldProps('email')} data-testid="email-input" />
        {form.touched.email && form.errors.email && (
          <span data-testid="email-error">{form.errors.email}</span>
        )}
      </div>

      <div>
        <label htmlFor="age">Age</label>
        <input
          type="number"
          {...form.getFieldProps('age')}
          data-testid="age-input"
        />
        {form.touched.age && form.errors.age && (
          <span data-testid="age-error">{form.errors.age}</span>
        )}
      </div>

      <button type="submit" disabled={form.isSubmitting}>
        {form.isSubmitting ? 'Submitting...' : 'Submit'}
      </button>

      <button
        type="button"
        onClick={() => form.resetForm()}
        data-testid="reset-button"
      >
        Reset
      </button>
    </form>
  );
}

describe('Form Workflow Integration', () => {
  test('complete form fill and submit workflow', async () => {
    const onSubmitSuccess = mock((values: UserForm) => {});
    const user = userEvent.setup();

    render(<UserFormComponent onSubmitSuccess={onSubmitSuccess} />);

    const nameInput = screen.getByTestId('name-input');
    const emailInput = screen.getByTestId('email-input');
    const ageInput = screen.getByTestId('age-input');
    const submitButton = screen.getByRole('button', { name: /submit/i });

    // Fill in the form
    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.type(ageInput, '25');

    // Submit the form
    await user.click(submitButton);

    // Wait for submission
    await waitFor(() => {
      expect(onSubmitSuccess).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        age: 25,
      });
    });
  });

  test('displays validation errors on invalid submit', async () => {
    const onSubmitSuccess = mock((_values: UserForm) => {});
    const user = userEvent.setup();

    render(<UserFormComponent onSubmitSuccess={onSubmitSuccess} />);

    const submitButton = screen.getByRole('button', { name: /submit/i });

    // Submit empty form
    await user.click(submitButton);

    // Wait for errors to appear
    await waitFor(() => {
      expect(screen.getByTestId('name-error')).toHaveTextContent(
        'Name is required'
      );
      expect(screen.getByTestId('email-error')).toHaveTextContent(
        'Email is required'
      );
      expect(screen.getByTestId('age-error')).toHaveTextContent(
        'Must be 18 or older'
      );
    });

    // onSubmit should not be called
    expect(onSubmitSuccess).not.toHaveBeenCalled();
  });

  test('shows validation errors in live mode on blur', async () => {
    const onSubmitSuccess = mock((values: UserForm) => {});
    const user = userEvent.setup();

    render(<UserFormComponent onSubmitSuccess={onSubmitSuccess} />);

    const nameInput = screen.getByTestId('name-input');

    // Focus and blur without entering value
    await user.click(nameInput);
    await user.tab();

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByTestId('name-error')).toHaveTextContent(
        'Name is required'
      );
    });
  });

  test('clears validation errors when corrected', async () => {
    const onSubmitSuccess = mock((_values: UserForm) => {});
    const user = userEvent.setup();

    render(<UserFormComponent onSubmitSuccess={onSubmitSuccess} />);

    const nameInput = screen.getByTestId('name-input');
    const submitButton = screen.getByRole('button', { name: /submit/i });

    // Submit to trigger validation errors
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByTestId('name-error')).toHaveTextContent(
        'Name is required'
      );
    });

    // Fix the error
    await user.type(nameInput, 'John Doe');

    // Error should disappear
    await waitFor(() => {
      expect(screen.queryByTestId('name-error')).not.toBeInTheDocument();
    });
  });

  test('validates email format', async () => {
    const onSubmitSuccess = mock((_values: UserForm) => {});
    const user = userEvent.setup();

    render(<UserFormComponent onSubmitSuccess={onSubmitSuccess} />);

    const emailInput = screen.getByTestId('email-input');
    const submitButton = screen.getByRole('button', { name: /submit/i });

    // Enter invalid email
    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByTestId('email-error')).toHaveTextContent(
        'Email must be valid'
      );
    });
  });

  test('validates age requirements', async () => {
    const onSubmitSuccess = mock((values: UserForm) => {});
    const user = userEvent.setup();

    render(<UserFormComponent onSubmitSuccess={onSubmitSuccess} />);

    const ageInput = screen.getByTestId('age-input');
    const submitButton = screen.getByRole('button', { name: /submit/i });

    // Enter age below 18
    await user.clear(ageInput);
    await user.type(ageInput, '15');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByTestId('age-error')).toHaveTextContent(
        'Must be 18 or older'
      );
    });

    // Fix the age
    await user.clear(ageInput);
    await user.type(ageInput, '25');

    // Error should disappear
    await waitFor(() => {
      expect(screen.queryByTestId('age-error')).not.toBeInTheDocument();
    });
  });

  test('resets form to initial values', async () => {
    const onSubmitSuccess = mock((values: UserForm) => {});
    const user = userEvent.setup();

    render(<UserFormComponent onSubmitSuccess={onSubmitSuccess} />);

    const nameInput = screen.getByTestId('name-input') as HTMLInputElement;
    const emailInput = screen.getByTestId('email-input') as HTMLInputElement;
    const ageInput = screen.getByTestId('age-input') as HTMLInputElement;
    const resetButton = screen.getByTestId('reset-button');

    // Fill in the form
    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.clear(ageInput);
    await user.type(ageInput, '25');

    // Verify values changed
    expect(nameInput.value).toBe('John Doe');
    expect(emailInput.value).toBe('john@example.com');
    expect(ageInput.value).toBe('25');

    // Reset the form
    await user.click(resetButton);

    // Values should be back to initial
    expect(nameInput.value).toBe('');
    expect(emailInput.value).toBe('');
    expect(ageInput.value).toBe('0');
  });

  test('disables submit button while submitting', async () => {
    let resolveSubmit: () => void;
    const submitPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });

    const onSubmitSuccess = mock(async (values: UserForm) => {
      await submitPromise;
    });

    const user = userEvent.setup();

    render(<UserFormComponent onSubmitSuccess={onSubmitSuccess} />);

    const nameInput = screen.getByTestId('name-input');
    const emailInput = screen.getByTestId('email-input');
    const ageInput = screen.getByTestId('age-input');
    const submitButton = screen.getByRole('button', { name: /submit/i });

    // Fill in valid data
    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.clear(ageInput);
    await user.type(ageInput, '25');

    // Submit
    await user.click(submitButton);

    // Button should be disabled with loading text
    await waitFor(() => {
      expect(submitButton).toHaveTextContent('Submitting...');
      expect(submitButton).toBeDisabled();
    });

    // Resolve submission
    resolveSubmit!();

    // Button should be enabled again
    await waitFor(() => {
      expect(submitButton).toHaveTextContent('Submit');
      expect(submitButton).not.toBeDisabled();
    });
  });
});
