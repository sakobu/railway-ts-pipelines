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

    test('calls preventDefault when event is provided', async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        })
      );

      const preventDefault = mock(() => {});
      const fakeEvent = { preventDefault } as unknown as React.FormEvent;

      await act(async () => {
        await result.current.handleSubmit(fakeEvent);
      });

      expect(preventDefault).toHaveBeenCalled();
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

    test('getSelectFieldProps returns correct props', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { country: 'US' },
        })
      );

      const props = result.current.getSelectFieldProps('country');

      expect(props.id).toBe('field-country');
      expect(props.name).toBe('country');
      expect(props.value).toBe('US');
      expect(typeof props.onChange).toBe('function');
      expect(typeof props.onBlur).toBe('function');
    });

    test('getSwitchProps returns correct props', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { darkMode: false },
        })
      );

      const props = result.current.getSwitchProps('darkMode');

      expect(props.id).toBe('field-darkMode');
      expect(props.name).toBe('darkMode');
      expect(props.checked).toBe(false);
      expect(typeof props.onChange).toBe('function');
      expect(typeof props.onBlur).toBe('function');
    });

    test('getSliderProps returns correct props', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { volume: 50 },
        })
      );

      const props = result.current.getSliderProps('volume');

      expect(props.id).toBe('field-volume');
      expect(props.name).toBe('volume');
      expect(props.type).toBe('range');
      expect(props.value).toBe(50);
      expect(typeof props.onChange).toBe('function');
      expect(typeof props.onBlur).toBe('function');
    });

    test('getCheckboxGroupOptionProps returns correct props', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { interests: ['sports'] },
        })
      );

      const props = result.current.getCheckboxGroupOptionProps(
        'interests',
        'sports'
      );

      expect(props.id).toBe('field-interests-sports');
      expect(props.name).toBe('interests');
      expect(props.value).toBe('sports');
      expect(props.checked).toBe(true);
      expect(typeof props.onChange).toBe('function');
      expect(typeof props.onBlur).toBe('function');
    });

    test('getFileFieldProps returns correct props', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { avatar: null },
        })
      );

      const props = result.current.getFileFieldProps('avatar');

      expect(props.id).toBe('field-avatar');
      expect(props.name).toBe('avatar');
      expect(typeof props.onChange).toBe('function');
      expect(typeof props.onBlur).toBe('function');
    });

    test('getRadioGroupOptionProps returns correct props', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { contactMethod: 'email' },
        })
      );

      const props = result.current.getRadioGroupOptionProps(
        'contactMethod',
        'email'
      );

      expect(props.id).toBe('field-contactMethod-email');
      expect(props.name).toBe('contactMethod');
      expect(props.value).toBe('email');
      expect(props.checked).toBe(true);
      expect(typeof props.onChange).toBe('function');
      expect(typeof props.onBlur).toBe('function');
    });
  });

  describe('resetForm', () => {
    test('validates on reset when validationMode is mount', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: '', email: '', age: 0 },
          validationMode: 'mount',
        })
      );

      // Modify the form to valid values
      act(() => {
        result.current.setFieldValue('name', 'John');
        result.current.setFieldValue('email', 'john@example.com');
        result.current.setFieldValue('age', 25);
      });

      expect(result.current.values.name).toBe('John');

      // Reset
      act(() => {
        result.current.resetForm();
      });

      // Should validate on reset and show errors for initial values
      expect(result.current.errors.name).toBe('Name is required');
      expect(result.current.errors.email).toBe('Email is required');
    });
  });

  describe('handleSubmit error handling', () => {
    test('catches and logs errors thrown in onSubmit', async () => {
      const consoleErrorSpy = mock(() => {});
      const originalConsoleError = console.error;
      console.error = consoleErrorSpy;

      const onSubmit = mock((_values: UserForm) => {
        throw new Error('Network error');
      });

      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
          onSubmit,
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Form submission error:',
        expect.any(Error)
      );

      console.error = originalConsoleError;
    });

    test('handles submit without onSubmit callback', async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        })
      );

      const submitResult = await act(async () => {
        return await result.current.handleSubmit();
      });

      // Should return validated data
      expect(submitResult).toEqual({
        name: 'John',
        email: 'john@example.com',
        age: 25,
      });
    });
  });

  describe('array helpers', () => {
    test('arrayHelpers push adds item to array', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { items: [] },
        })
      );

      const helpers = result.current.arrayHelpers('items');

      act(() => {
        // @ts-expect-error - Type inference limitation in test
        helpers.push('first');
      });

      expect(result.current.values.items).toEqual(['first']);
    });

    test('arrayHelpers remove deletes item from array', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { items: ['first', 'second', 'third'] },
        })
      );

      const helpers = result.current.arrayHelpers('items');

      act(() => {
        helpers.remove(1);
      });

      expect(result.current.values.items).toEqual(['first', 'third']);
    });

    test('arrayHelpers swap exchanges two items', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { items: ['a', 'b', 'c'] },
        })
      );

      const helpers = result.current.arrayHelpers('items');

      act(() => {
        helpers.swap(0, 2);
      });

      expect(result.current.values.items).toEqual(['c', 'b', 'a']);
    });

    test('arrayHelpers replace updates item at index', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { items: ['a', 'b', 'c'] },
        })
      );

      const helpers = result.current.arrayHelpers('items');

      act(() => {
        // @ts-expect-error - Type inference limitation in test
        helpers.replace(1, 'updated');
      });

      expect(result.current.values.items).toEqual(['a', 'updated', 'c']);
    });

    test('arrayHelpers insert adds item at index', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { items: ['a', 'c'] },
        })
      );

      const helpers = result.current.arrayHelpers('items');

      act(() => {
        // @ts-expect-error - Type inference limitation in test
        helpers.insert(1, 'b');
      });

      expect(result.current.values.items).toEqual(['a', 'b', 'c']);
    });

    test('arrayHelpers getFieldProps returns props for array item field', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: {
            contacts: [{ name: 'John', email: 'john@example.com' }],
          },
        })
      );

      const helpers = result.current.arrayHelpers('contacts');
      // @ts-expect-error - Type inference limitation in test
      const props = helpers.getFieldProps(0, 'name');

      expect(props.name).toBe('contacts[0].name');
      expect(props.value).toBe('John');
    });

    test('arrayHelpers getSelectFieldProps returns props for array item select', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { items: [{ category: 'electronics' }] },
        })
      );

      const helpers = result.current.arrayHelpers('items');
      // @ts-expect-error - Type inference limitation in test
      const props = helpers.getSelectFieldProps(0, 'category');

      expect(props.name).toBe('items[0].category');
      expect(props.value).toBe('electronics');
    });

    test('arrayHelpers getSliderProps returns props for array item slider', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { settings: [{ volume: 75 }] },
        })
      );

      const helpers = result.current.arrayHelpers('settings');
      // @ts-expect-error - Type inference limitation in test
      const props = helpers.getSliderProps(0, 'volume');

      expect(props.name).toBe('settings[0].volume');
      expect(props.value).toBe(75);
      expect(props.type).toBe('range');
    });

    test('arrayHelpers getCheckboxProps returns props for array item checkbox', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { settings: [{ enabled: true }] },
        })
      );

      const helpers = result.current.arrayHelpers('settings');
      // @ts-expect-error - Type inference limitation in test
      const props = helpers.getCheckboxProps(0, 'enabled');

      expect(props.name).toBe('settings[0].enabled');
      expect(props.checked).toBe(true);
    });

    test('arrayHelpers getSwitchProps returns props for array item switch', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { features: [{ active: false }] },
        })
      );

      const helpers = result.current.arrayHelpers('features');
      // @ts-expect-error - Type inference limitation in test
      const props = helpers.getSwitchProps(0, 'active');

      expect(props.name).toBe('features[0].active');
      expect(props.checked).toBe(false);
    });

    test('arrayHelpers getFileFieldProps returns props for array item file input', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { uploads: [{ file: null }] },
        })
      );

      const helpers = result.current.arrayHelpers('uploads');
      // @ts-expect-error - Type inference limitation in test
      const props = helpers.getFileFieldProps(0, 'file');

      expect(props.name).toBe('uploads[0].file');
    });

    test('arrayHelpers getRadioGroupOptionProps returns props for array item radio', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { preferences: [{ size: 'medium' }] },
        })
      );

      const helpers = result.current.arrayHelpers('preferences');
      // @ts-expect-error - Type inference limitation in test
      const props = helpers.getRadioGroupOptionProps(0, 'size', 'medium');

      expect(props.name).toBe('preferences[0].size');
      expect(props.value).toBe('medium');
      expect(props.checked).toBe(true);
    });
  });
});
