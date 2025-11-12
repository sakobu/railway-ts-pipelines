import { describe, test, expect, mock } from 'bun:test';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useForm } from '../../src/useForm';
import {
  userValidator,
  userWithAddressValidator,
  alwaysValidValidator,
  type UserForm,
  type UserWithAddressForm,
} from '../fixtures/validators';

describe('useForm', () => {
  describe('initialization', () => {
    test('initializes with default values', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: {},
        })
      );

      expect(result.current.values).toEqual({});
      expect(result.current.touched).toEqual({});
      expect(result.current.errors).toEqual({});
      expect(result.current.isValid).toBe(true);
      expect(result.current.isDirty).toBe(false);
      expect(result.current.isSubmitting).toBe(false);
    });

    test('initializes with provided values', () => {
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };
      const { result } = renderHook(() =>
        useForm(userValidator, { initialValues })
      );

      expect(result.current.values).toEqual(initialValues);
    });

    test('validates on mount when validationMode is mount', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: '', email: '', age: 0 },
          validationMode: 'mount',
        })
      );

      expect(result.current.errors.name).toBe('Name is required');
      expect(result.current.errors.email).toBe('Email is required');
      expect(result.current.isValid).toBe(false);
    });
  });

  describe('setFieldValue', () => {
    test('updates field value', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        })
      );

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      expect(result.current.values.name).toBe('Jane');
      expect(result.current.isDirty).toBe(true);
    });

    test('validates on change in live mode', async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: '', email: '', age: 0 },
          validationMode: 'live',
        })
      );

      act(() => {
        result.current.setFieldValue('name', 'John');
      });

      await waitFor(() => {
        expect(result.current.errors.name).toBeUndefined();
      });
    });

    test('does not validate on change in blur mode', async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: '', email: '', age: 0 },
          validationMode: 'blur',
        })
      );

      act(() => {
        result.current.setFieldValue('name', 'John');
      });

      // Errors should not be cleared automatically
      expect(result.current.errors.name).toBeUndefined();
    });
  });

  describe('setValues', () => {
    test('updates multiple values', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        })
      );

      act(() => {
        result.current.setValues({ name: 'Jane', email: 'jane@example.com' });
      });

      expect(result.current.values.name).toBe('Jane');
      expect(result.current.values.email).toBe('jane@example.com');
      expect(result.current.isDirty).toBe(true);
    });
  });

  describe('setFieldTouched', () => {
    test('marks field as touched', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        })
      );

      act(() => {
        result.current.setFieldTouched('name', true);
      });

      expect(result.current.touched.name).toBe(true);
    });

    test('validates on blur in live mode', async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: '', email: '', age: 0 },
          validationMode: 'live',
        })
      );

      act(() => {
        result.current.setFieldTouched('name', true);
      });

      await waitFor(() => {
        expect(result.current.errors.name).toBe('Name is required');
      });
    });
  });

  describe('handleSubmit', () => {
    test('calls onSubmit with valid data', async () => {
      const onSubmit = mock((values: UserForm) => {});
      const validValues = { name: 'John', email: 'john@example.com', age: 25 };

      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: validValues,
          onSubmit,
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).toHaveBeenCalledWith(validValues);
    });

    test('does not call onSubmit with invalid data', async () => {
      const onSubmit = mock((values: UserForm) => {});
      const invalidValues = { name: '', email: '', age: 0 };

      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: invalidValues,
          onSubmit,
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).not.toHaveBeenCalled();
      expect(result.current.errors.name).toBe('Name is required');
      expect(result.current.errors.email).toBe('Email is required');
    });

    test('marks all fields as touched on submit', async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.touched.name).toBe(true);
      expect(result.current.touched.email).toBe(true);
      expect(result.current.touched.age).toBe(true);
    });

    test('sets isSubmitting during submission', async () => {
      const onSubmit = mock(async (values: UserForm) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
          onSubmit,
        })
      );

      act(() => {
        result.current.handleSubmit();
      });

      expect(result.current.isSubmitting).toBe(true);

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });
    });

    test('clears server errors on submit', async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        })
      );

      act(() => {
        result.current.setServerErrors({ name: 'Server error' });
      });

      expect(result.current.serverErrors.name).toBe('Server error');

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.serverErrors).toEqual({});
    });
  });

  describe('resetForm', () => {
    test('resets form to initial values', () => {
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };
      const { result } = renderHook(() =>
        useForm(userValidator, { initialValues })
      );

      // Modify the form
      act(() => {
        result.current.setFieldValue('name', 'Jane');
        result.current.setFieldTouched('name', true);
      });

      expect(result.current.values.name).toBe('Jane');
      expect(result.current.isDirty).toBe(true);

      // Reset
      act(() => {
        result.current.resetForm();
      });

      expect(result.current.values).toEqual(initialValues);
      expect(result.current.touched).toEqual({});
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('server errors', () => {
    test('setServerErrors adds server errors', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        })
      );

      act(() => {
        result.current.setServerErrors({
          name: 'Name already exists',
          email: 'Email already exists',
        });
      });

      expect(result.current.serverErrors.name).toBe('Name already exists');
      expect(result.current.serverErrors.email).toBe('Email already exists');
    });

    test('clearServerErrors removes all server errors', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        })
      );

      act(() => {
        result.current.setServerErrors({
          name: 'Name error',
          email: 'Email error',
        });
      });

      act(() => {
        result.current.clearServerErrors();
      });

      expect(result.current.serverErrors).toEqual({});
    });

    test('server errors take precedence over client errors', async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: '', email: '', age: 0 },
        })
      );

      // Trigger validation to get client errors
      await act(async () => {
        await result.current.validateForm(result.current.values);
      });

      expect(result.current.clientErrors.name).toBe('Name is required');

      // Add server error for the same field
      act(() => {
        result.current.setServerErrors({ name: 'Server error' });
      });

      // Server error should be shown in combined errors
      expect(result.current.errors.name).toBe('Server error');
    });

    test('server errors are cleared when field value changes', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        })
      );

      act(() => {
        result.current.setServerErrors({ name: 'Server error' });
      });

      expect(result.current.serverErrors.name).toBe('Server error');

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      expect(result.current.serverErrors.name).toBeUndefined();
    });
  });

  describe('nested fields', () => {
    test('handles nested field values', () => {
      const initialValues: UserWithAddressForm = {
        name: 'John',
        address: { street: '123 Main St', city: 'NYC', zip: '10001' },
      };

      const { result } = renderHook(() =>
        useForm(userWithAddressValidator, { initialValues })
      );

      act(() => {
        result.current.setFieldValue('address.city', 'LA');
      });

      expect(result.current.values.address?.city).toBe('LA');
    });

    test('validates nested fields', async () => {
      const initialValues: Partial<UserWithAddressForm> = {
        name: 'John',
        address: { street: '', city: '', zip: '' },
      };

      const { result } = renderHook(() =>
        useForm(userWithAddressValidator, {
          initialValues,
          validationMode: 'mount',
        })
      );

      await waitFor(() => {
        expect(result.current.errors['address.street']).toBe(
          'Street is required'
        );
        expect(result.current.errors['address.city']).toBe('City is required');
        expect(result.current.errors['address.zip']).toBe(
          'ZIP code is required'
        );
      });
    });
  });

  describe('native field props', () => {
    test('getFieldProps returns correct props', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        })
      );

      const props = result.current.getFieldProps('name');

      expect(props.id).toBe('field-name');
      expect(props.name).toBe('name');
      expect(props.value).toBe('John');
      expect(typeof props.onChange).toBe('function');
      expect(typeof props.onBlur).toBe('function');
    });

    test('getCheckboxProps returns correct props', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { newsletter: true },
        })
      );

      const props = result.current.getCheckboxProps('newsletter');

      expect(props.id).toBe('field-newsletter');
      expect(props.name).toBe('newsletter');
      expect(props.checked).toBe(true);
      expect(typeof props.onChange).toBe('function');
      expect(typeof props.onBlur).toBe('function');
    });
  });
});
