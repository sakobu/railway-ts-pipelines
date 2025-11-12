import { describe, test, expect, mock } from 'bun:test';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFormAutoSubmission } from '../../src/useAutoSubmitForm';
import { useForm } from '../../src/useForm';
import {
  userValidator,
  alwaysValidValidator,
  alwaysInvalidValidator,
  type UserForm,
} from '../fixtures/validators';

describe('useFormAutoSubmission', () => {
  describe('basic auto-submission', () => {
    test('auto-submits valid dirty form after debounce delay', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form);
        return form;
      });

      // Make form dirty by changing a value
      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      // Wait for debounce + submission
      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalledTimes(1);
        },
        { timeout: 500 }
      );

      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Jane',
        email: 'john@example.com',
        age: 25,
      });
    });

    test('does not submit invalid form', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form);
        return form;
      });

      // Make form invalid
      act(() => {
        result.current.setFieldValue('name', '');
      });

      // Wait for potential submission attempt
      await waitFor(
        () => {
          expect(onSubmit).not.toHaveBeenCalled();
          expect(result.current.errors.name).toBe('Name is required');
        },
        { timeout: 300 }
      );
    });

    test('does not submit clean (not dirty) form', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form);
        return form;
      });

      // Wait for potential submission attempt
      await waitFor(
        () => {
          expect(onSubmit).not.toHaveBeenCalled();
          expect(result.current.isDirty).toBe(false);
        },
        { timeout: 300 }
      );
    });
  });

  describe('debounce behavior', () => {
    test('debounces rapid value changes', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form, 200);
        return form;
      });

      // Make multiple rapid changes
      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      act(() => {
        result.current.setFieldValue('name', 'Jenny');
      });

      // Wait for debounce + submission
      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalledTimes(1);
        },
        { timeout: 500 }
      );

      // Should only submit once with final value
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Jenny',
        email: 'john@example.com',
        age: 25,
      });
    });

    test('respects custom delay parameter', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form, 500); // Custom 500ms delay
        return form;
      });

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      // Check it hasn't submitted too early (wait exactly 250ms)
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(onSubmit).not.toHaveBeenCalled();

      // Wait for submission after full delay
      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalledTimes(1);
        },
        { timeout: 400 } // 250ms already passed, need up to 250ms more for 500ms total
      );
    });
  });

  describe('validation integration', () => {
    test('validates form before attempting submission', async () => {
      const onSubmit = mock((_values: Record<string, unknown>) => {});

      const { result } = renderHook(() => {
        const form = useForm(alwaysValidValidator, {
          initialValues: { name: 'John' },
          onSubmit,
          validationMode: 'live', // Enable live validation to track validation calls
        });

        useFormAutoSubmission(form);
        return form;
      });

      // Initially should be valid and not dirty
      expect(result.current.isValid).toBe(true);
      expect(result.current.isDirty).toBe(false);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      // Form should become dirty
      expect(result.current.isDirty).toBe(true);

      // Wait for submission
      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      // Verify it submitted with the correct values
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Jane' });
    });

    test('does not submit if validation fails', async () => {
      const onSubmit = mock(() => {});

      const { result } = renderHook(() => {
        const form = useForm(alwaysInvalidValidator, {
          initialValues: { name: 'John' },
          onSubmit,
        });
        useFormAutoSubmission(form);
        return form;
      });

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      // Wait for potential submission
      await waitFor(
        () => {
          expect(onSubmit).not.toHaveBeenCalled();
          expect(result.current.isValid).toBe(false);
        },
        { timeout: 300 }
      );
    });
  });

  describe('unchanged values optimization', () => {
    test('does not re-validate unchanged values', async () => {
      const onSubmit = mock((_values: Record<string, unknown>) => {});
      let validateCount = 0;

      const { result } = renderHook(() => {
        const form = useForm(alwaysValidValidator, {
          initialValues: { name: 'John' },
          onSubmit,
        });

        // Track validation calls
        const originalValidate = form.validateForm;
        form.validateForm = (values) => {
          validateCount++;
          return originalValidate(values);
        };

        useFormAutoSubmission(form);
        return form;
      });

      // First change
      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      await waitFor(
        () => {
          expect(validateCount).toBeGreaterThan(0);
        },
        { timeout: 500 }
      );

      const firstValidateCount = validateCount;

      // Wait a bit
      await waitFor(
        () => {
          // Validate count should not increase if values haven't changed
          expect(validateCount).toBe(firstValidateCount);
        },
        { timeout: 300 }
      );
    });
  });

  describe('form reset behavior', () => {
    test('stops auto-submit when form is reset immediately', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form, 500); // Longer delay to allow reset
        return form;
      });

      // Make form dirty and immediately reset
      act(() => {
        result.current.setFieldValue('name', 'Jane');
        result.current.resetForm();
      });

      // Wait for potential submission
      await waitFor(
        () => {
          // Should not have submitted because form was reset before debounce completed
          expect(onSubmit).not.toHaveBeenCalled();
          expect(result.current.isDirty).toBe(false);
        },
        { timeout: 600 }
      );
    });

    test('form becomes clean after reset and does not auto-submit on subsequent renders', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result, rerender } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form);
        return form;
      });

      // Make form dirty and wait for submission
      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalledTimes(1);
        },
        { timeout: 500 }
      );

      // Reset form
      act(() => {
        result.current.resetForm();
      });

      expect(result.current.isDirty).toBe(false);

      // Rerender and wait - should not trigger another submission
      rerender();
      await waitFor(
        () => {
          // Should still only have been called once (not called again after reset)
          expect(onSubmit).toHaveBeenCalledTimes(1);
        },
        { timeout: 300 }
      );
    });
  });

  describe('multiple field changes', () => {
    test('auto-submits after multiple field changes', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form);
        return form;
      });

      // Change multiple fields
      act(() => {
        result.current.setFieldValue('name', 'Jane');
        result.current.setFieldValue('email', 'jane@example.com');
        result.current.setFieldValue('age', 30);
      });

      // Wait for submission
      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalledTimes(1);
        },
        { timeout: 500 }
      );

      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Jane',
        email: 'jane@example.com',
        age: 30,
      });
    });
  });

  describe('hook return value', () => {
    test('returns null', () => {
      const { result } = renderHook(() => {
        const form = useForm(alwaysValidValidator, {
          initialValues: { name: 'John' },
        });
        return useFormAutoSubmission(form);
      });

      expect(result.current).toBe(null);
    });
  });
});
