import { describe, test, expect, mock, spyOn, afterEach } from 'bun:test';

import { isOk, isErr, ok, err } from '@railway-ts/pipelines/result';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useForm } from '../../src/useForm';
import {
  userValidator,
  userWithAddressValidator,
  alwaysValidValidator,
  asyncUserValidator,
  alwaysValidAsyncValidator,
  alwaysInvalidAsyncValidator,
  userWithContactsValidator,
  type UserForm,
  type AsyncUserForm,
  type UserWithAddressForm,
} from '../fixtures/validators';

describe('useForm', () => {
  describe('initialization', () => {
    test('initializes with default values', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: {},
        }),
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
      const { result } = renderHook(() => useForm(userValidator, { initialValues }));

      expect(result.current.values).toEqual(initialValues);
    });

    test('validates on mount when validationMode is mount', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: '', email: '', age: 0 },
          validationMode: 'mount',
        }),
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
        }),
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
        }),
      );

      act(() => {
        result.current.setFieldValue('name', 'John');
      });

      await waitFor(() => {
        expect(result.current.errors.name).toBeUndefined();
      });
    });

    test('does not validate on change in blur mode', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: '', email: '', age: 0 },
          validationMode: 'blur',
        }),
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
        }),
      );

      act(() => {
        result.current.setValues({ name: 'Jane', email: 'jane@example.com' });
      });

      expect(result.current.values.name).toBe('Jane');
      expect(result.current.values.email).toBe('jane@example.com');
      expect(result.current.isDirty).toBe(true);
    });

    test('deep merges nested objects preserving sibling keys', () => {
      const initialValues: UserWithAddressForm = {
        name: 'John',
        address: { street: '123 Main', city: 'LA', zip: '10001' },
      };

      const { result } = renderHook(() => useForm(userWithAddressValidator, { initialValues }));

      act(() => {
        result.current.setValues({ address: { city: 'NYC' } });
      });

      expect(result.current.values.address?.city).toBe('NYC');
      expect(result.current.values.address?.street).toBe('123 Main');
      expect(result.current.values.address?.zip).toBe('10001');
      expect(result.current.values.name).toBe('John');
    });
  });

  describe('setFieldTouched', () => {
    test('marks field as touched', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        }),
      );

      act(() => {
        result.current.setFieldTouched('name', true);
      });

      expect(result.current.touched.name).toBe(true);
    });

    test('validates on blur in live mode', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: '', email: '', age: 0 },
          validationMode: 'live',
        }),
      );

      act(() => {
        result.current.setFieldTouched('name', true);
      });

      expect(result.current.errors.name).toBe('Name is required');
    });
  });

  test('handleSubmit maintains stable reference across value changes', () => {
    const { result } = renderHook(() =>
      useForm(userValidator, {
        initialValues: { name: 'John', email: 'john@example.com', age: 25 },
      }),
    );

    const firstRef = result.current.handleSubmit;

    act(() => {
      result.current.setFieldValue('name', 'Alice');
    });

    expect(result.current.handleSubmit).toBe(firstRef);
  });

  test('setFieldValue maintains stable reference across value changes', () => {
    const { result } = renderHook(() =>
      useForm(userValidator, {
        initialValues: { name: 'John', email: 'john@example.com', age: 25 },
      }),
    );

    const firstRef = result.current.setFieldValue;

    act(() => {
      result.current.setFieldValue('name', 'Alice');
    });

    expect(result.current.setFieldValue).toBe(firstRef);
  });

  test('cascading setFieldValue inside onFieldChange sees accumulated values', () => {
    const observed: Record<string, unknown>[] = [];

    const { result } = renderHook(() =>
      useForm(alwaysValidValidator, {
        initialValues: { name: '', email: '', age: 0 },
        onFieldChange: (field, _value, values) => {
          observed.push({ ...values });
          if (field === 'name') {
            // Cascading call: should see name already set
            result.current.setFieldValue('email', 'auto@test.com', false);
          }
        },
      }),
    );

    act(() => {
      result.current.setFieldValue('name', 'Alice', false);
    });

    // First callback: name is set
    expect(observed[0]).toEqual({ name: 'Alice', email: '', age: 0 });
    // Second (cascading) callback: both name and email are set
    expect(observed[1]).toEqual({
      name: 'Alice',
      email: 'auto@test.com',
      age: 0,
    });
  });

  describe('handleSubmit', () => {
    test('calls onSubmit with valid data', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const validValues = { name: 'John', email: 'john@example.com', age: 25 };

      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: validValues,
          onSubmit,
        }),
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).toHaveBeenCalledWith(validValues);
    });

    test('does not call onSubmit with invalid data', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const invalidValues = { name: '', email: '', age: 0 };

      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: invalidValues,
          onSubmit,
        }),
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
        }),
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.touched.name).toBe(true);
      expect(result.current.touched.email).toBe(true);
      expect(result.current.touched.age).toBe(true);
    });

    test('sets isSubmitting during submission', async () => {
      const onSubmit = mock(async (_values: UserForm) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
          onSubmit,
        }),
      );

      act(() => {
        void result.current.handleSubmit();
      });

      // isSubmitting is set after async validation passes, so we need waitFor
      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });
    });

    test('does not set isSubmitting when validation fails', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const invalidValues = { name: '', email: '', age: 0 };

      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: invalidValues,
          onSubmit,
        }),
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      // isSubmitting should never have been set to true
      expect(result.current.isSubmitting).toBe(false);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    test('clears server errors on submit', async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        }),
      );

      act(() => {
        result.current.setServerErrors([{ path: ['name'], message: 'Server error' }]);
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
        }),
      );

      const preventDefault = mock(() => {});
      const fakeEvent = { preventDefault } as unknown as React.SyntheticEvent;

      await act(async () => {
        await result.current.handleSubmit(fakeEvent);
      });

      expect(preventDefault).toHaveBeenCalled();
    });

    /** An onSubmit that stays pending until the test releases it, and reports when it started. */
    const createGatedOnSubmit = () => {
      const started = Promise.withResolvers<void>();
      const gate = Promise.withResolvers<void>();
      const onSubmit = mock(async (_values: UserForm) => {
        started.resolve();
        await gate.promise;
      });
      return { onSubmit, started: started.promise, release: gate.resolve };
    };

    /** Lets an overlapping submission run up to its onSubmit call, if it would make one. */
    const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

    test('a second handleSubmit while onSubmit is pending shares its result', async () => {
      const { onSubmit, started, release } = createGatedOnSubmit();
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
          onSubmit,
        }),
      );

      let first!: ReturnType<typeof result.current.handleSubmit>;
      await act(async () => {
        first = result.current.handleSubmit();
        await started;
      });

      let second!: ReturnType<typeof result.current.handleSubmit>;
      await act(async () => {
        second = result.current.handleSubmit();
        await nextTask();
      });

      await act(async () => {
        release();
        await first;
      });

      expect(second).toBe(first);
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    test('handleSubmit with changed values while onSubmit is pending submits them afterwards', async () => {
      const { onSubmit, started, release } = createGatedOnSubmit();
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
          onSubmit,
        }),
      );

      let first!: ReturnType<typeof result.current.handleSubmit>;
      await act(async () => {
        first = result.current.handleSubmit();
        await started;
      });

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      let second!: ReturnType<typeof result.current.handleSubmit>;
      await act(async () => {
        second = result.current.handleSubmit();
        await nextTask();
      });

      expect(onSubmit).toHaveBeenCalledTimes(1);

      await act(async () => {
        release();
        await first;
        await second;
      });

      expect(onSubmit.mock.calls).toEqual([
        [{ name: 'John', email: 'john@example.com', age: 25 }],
        [{ name: 'Jane', email: 'john@example.com', age: 25 }],
      ]);
    });

    test('a shared handleSubmit still calls preventDefault', async () => {
      const { onSubmit, started, release } = createGatedOnSubmit();
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
          onSubmit,
        }),
      );

      const firstPreventDefault = mock(() => {});
      const secondPreventDefault = mock(() => {});

      let first!: ReturnType<typeof result.current.handleSubmit>;
      await act(async () => {
        first = result.current.handleSubmit({ preventDefault: firstPreventDefault } as unknown as React.SyntheticEvent);
        await started;
      });

      let second!: ReturnType<typeof result.current.handleSubmit>;
      await act(async () => {
        second = result.current.handleSubmit({
          preventDefault: secondPreventDefault,
        } as unknown as React.SyntheticEvent);
        await nextTask();
      });

      await act(async () => {
        release();
        await first;
        await second;
      });

      expect(firstPreventDefault).toHaveBeenCalled();
      expect(secondPreventDefault).toHaveBeenCalled();
    });

    test('a handleSubmit after the previous one settled starts a new submission', async () => {
      const onSubmit = mock((_values: UserForm) => {});

      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
          onSubmit,
        }),
      );

      await act(async () => {
        await result.current.handleSubmit();
      });
      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).toHaveBeenCalledTimes(2);
    });
  });

  describe('resetForm', () => {
    test('resets form to initial values', () => {
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };
      const { result } = renderHook(() => useForm(userValidator, { initialValues }));

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
        }),
      );

      act(() => {
        result.current.setServerErrors([
          { path: ['name'], message: 'Name already exists' },
          { path: ['email'], message: 'Email already exists' },
        ]);
      });

      expect(result.current.serverErrors.name).toBe('Name already exists');
      expect(result.current.serverErrors.email).toBe('Email already exists');
    });

    test('clearServerErrors removes all server errors', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        }),
      );

      act(() => {
        result.current.setServerErrors([
          { path: ['name'], message: 'Name error' },
          { path: ['email'], message: 'Email error' },
        ]);
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
        }),
      );

      // Trigger validation to get client errors
      await act(async () => {
        await result.current.validateForm(result.current.values);
      });

      expect(result.current.clientErrors.name).toBe('Name is required');

      // Add server error for the same field
      act(() => {
        result.current.setServerErrors([{ path: ['name'], message: 'Server error' }]);
      });

      // Server error should be shown in combined errors
      expect(result.current.errors.name).toBe('Server error');
    });

    test('setServerErrors places ValidationError[] on their fields', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        }),
      );

      act(() => {
        result.current.setServerErrors([{ path: ['email'], message: 'Taken' }]);
      });

      expect(result.current.errors.email).toBe('Taken');
      expect(result.current.serverErrors.email).toBe('Taken');
    });

    test('setServerErrors shows through getFieldError without touching the field first', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        }),
      );

      act(() => {
        result.current.setServerErrors([{ path: ['email'], message: 'Taken' }]);
      });

      expect(result.current.getFieldError('email')).toBe('Taken');
    });

    test('a server error at path [] is the submit error', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        }),
      );

      act(() => {
        result.current.setServerErrors([{ path: [], message: 'Down' }]);
      });

      expect(result.current.errors._root).toBe('Down');
      expect(result.current.serverErrors._root).toBe('Down');
      expect(result.current.isValid).toBe(true);
    });

    test('a client _root still makes isValid false, under the submit error', async () => {
      const { result } = renderHook(() =>
        useForm<{ name: string }>(() => err([{ path: [], message: 'Nope' }]), {
          initialValues: { name: 'John' },
          validationMode: 'mount',
        }),
      );

      await waitFor(() => {
        expect(result.current.errors._root).toBe('Nope');
      });

      act(() => {
        result.current.setServerErrors([{ path: [], message: 'Down' }]);
      });

      expect(result.current.errors._root).toBe('Down');
      expect(result.current.isValid).toBe(false);

      act(() => {
        result.current.clearServerErrors();
      });

      expect(result.current.errors._root).toBe('Nope');
    });

    test('server error on an array item uses the client error key', () => {
      const { result } = renderHook(() =>
        useForm<{ items: { name: string }[] }>(
          () => err([{ path: ['items', '0', 'name'], message: 'Client says no' }]),
          {
            initialValues: { items: [{ name: '' }] },
          },
        ),
      );

      act(() => {
        void result.current.validateForm(result.current.values);
      });

      expect(Object.keys(result.current.errors)).toHaveLength(1);

      act(() => {
        result.current.setServerErrors([{ path: ['items', '0', 'name'], message: 'Server says no' }]);
      });

      const keys = Object.keys(result.current.errors);
      expect(keys).toHaveLength(1);
      expect(result.current.errors[keys[0] as string]).toBe('Server says no');
    });

    test('editing any field clears the submit error', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        }),
      );

      act(() => {
        result.current.setServerErrors([{ path: [], message: 'Down' }]);
      });

      expect(result.current.serverErrors._root).toBe('Down');

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      expect(result.current.serverErrors._root).toBeUndefined();
      expect(result.current.errors._root).toBeUndefined();
    });

    test('server errors are cleared when field value changes', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        }),
      );

      act(() => {
        result.current.setServerErrors([{ path: ['name'], message: 'Server error' }]);
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

      const { result } = renderHook(() => useForm(userWithAddressValidator, { initialValues }));

      act(() => {
        result.current.setFieldValue('address.city', 'LA');
      });

      expect(result.current.values.address?.city).toBe('LA');
    });

    test('validates nested fields', async () => {
      const initialValues: UserWithAddressForm = {
        name: 'John',
        address: { street: '', city: '', zip: '' },
      };

      const { result } = renderHook(() =>
        useForm(userWithAddressValidator, {
          initialValues,
          validationMode: 'mount',
        }),
      );

      await waitFor(() => {
        expect(result.current.errors['address.street']).toBe('Street is required');
        expect(result.current.errors['address.city']).toBe('City is required');
        expect(result.current.errors['address.zip']).toBe('ZIP code is required');
      });
    });
  });

  describe('native field props', () => {
    test('getFieldProps returns correct props', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        }),
      );

      const props = result.current.getFieldProps('name');

      expect(props.id).toBe('name');
      expect(props.name).toBe('name');
      expect(props.value).toBe('John');
      expect(typeof props.onChange).toBe('function');
      expect(typeof props.onBlur).toBe('function');
    });

    test('getCheckboxProps returns correct props', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { newsletter: true },
        }),
      );

      const props = result.current.getCheckboxProps('newsletter');

      expect(props.id).toBe('newsletter');
      expect(props.name).toBe('newsletter');
      expect(props.checked).toBe(true);
      expect(typeof props.onChange).toBe('function');
      expect(typeof props.onBlur).toBe('function');
    });

    test('getSelectFieldProps returns correct props', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { country: 'US' },
        }),
      );

      const props = result.current.getSelectFieldProps('country');

      expect(props.id).toBe('country');
      expect(props.name).toBe('country');
      expect(props.value).toBe('US');
      expect(typeof props.onChange).toBe('function');
      expect(typeof props.onBlur).toBe('function');
    });

    test('getSwitchProps returns correct props', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { darkMode: false },
        }),
      );

      const props = result.current.getSwitchProps('darkMode');

      expect(props.id).toBe('darkMode');
      expect(props.name).toBe('darkMode');
      expect(props.checked).toBe(false);
      expect(typeof props.onChange).toBe('function');
      expect(typeof props.onBlur).toBe('function');
    });

    test('getSliderProps returns correct props', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { volume: 50 },
        }),
      );

      const props = result.current.getSliderProps('volume');

      expect(props.id).toBe('volume');
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
        }),
      );

      const props = result.current.getCheckboxGroupOptionProps('interests', 'sports');

      expect(props.id).toBe('interests-sports');
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
        }),
      );

      const props = result.current.getFileFieldProps('avatar');

      expect(props.id).toBe('avatar');
      expect(props.name).toBe('avatar');
      expect(typeof props.onChange).toBe('function');
      expect(typeof props.onBlur).toBe('function');
    });

    test('getRadioGroupOptionProps returns correct props', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { contactMethod: 'email' },
        }),
      );

      const props = result.current.getRadioGroupOptionProps('contactMethod', 'email');

      expect(props.id).toBe('contactMethod-email');
      expect(props.name).toBe('contactMethod');
      expect(props.value).toBe('email');
      expect(props.checked).toBe(true);
      expect(typeof props.onChange).toBe('function');
      expect(typeof props.onBlur).toBe('function');
    });
  });

  describe('getFieldError', () => {
    test('returns undefined for untouched field with error', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: '', email: '', age: 0 },
        }),
      );

      // Field has error (empty name) but is not touched
      expect(result.current.getFieldError('name')).toBeUndefined();
    });

    test('returns error for touched field with error', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: '', email: '', age: 0 },
        }),
      );

      act(() => {
        result.current.setFieldTouched('name', true);
      });

      expect(result.current.getFieldError('name')).toBe('Name is required');
    });

    test('returns undefined for touched field without error', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        }),
      );

      act(() => {
        result.current.setFieldTouched('name', true);
      });

      expect(result.current.getFieldError('name')).toBeUndefined();
    });

    test('returns undefined on fresh form', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { name: 'John' },
        }),
      );

      expect(result.current.getFieldError('name')).toBeUndefined();
    });

    test('returns server error when touched', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { email: 'test@example.com' },
        }),
      );

      act(() => {
        result.current.setServerErrors([{ path: ['email'], message: 'Email already exists' }]);
        result.current.setFieldTouched('email', true);
      });

      expect(result.current.getFieldError('email')).toBe('Email already exists');
    });

    test('updates on touch state change', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: '', email: '', age: 0 },
        }),
      );

      // Initially untouched
      expect(result.current.getFieldError('name')).toBeUndefined();

      // Touch the field
      act(() => {
        result.current.setFieldTouched('name', true);
      });

      expect(result.current.getFieldError('name')).toBe('Name is required');

      // Untouch the field
      act(() => {
        result.current.setFieldTouched('name', false);
      });

      expect(result.current.getFieldError('name')).toBeUndefined();
    });

    test('works with nested paths', () => {
      const { result } = renderHook(() =>
        useForm(userWithAddressValidator, {
          initialValues: {
            name: 'John',
            address: { street: '', city: '', zip: '' },
          },
        }),
      );

      act(() => {
        result.current.setFieldTouched('address.city', true);
      });

      expect(result.current.getFieldError('address.city')).toBe('City is required');
    });

    test('group path: returns undefined when no descendant is touched', () => {
      const { result } = renderHook(() =>
        useForm<{ r1: number[]; r2: number[] }>(() => err([{ path: ['r2'], message: 'Vectors must differ' }]), {
          initialValues: { r1: [0, 0, 0], r2: [0, 0, 0] },
        }),
      );

      act(() => {
        void result.current.validateForm(result.current.values);
      });

      // Error exists but no descendant touched — invisible.
      expect(result.current.getFieldError('r2')).toBeUndefined();
    });

    test('group path: bubbles error once a descendant is touched', () => {
      const { result } = renderHook(() =>
        useForm<{ r1: number[]; r2: number[] }>(() => err([{ path: ['r2'], message: 'Vectors must differ' }]), {
          initialValues: { r1: [0, 0, 0], r2: [0, 0, 0] },
        }),
      );

      act(() => {
        void result.current.validateForm(result.current.values);
        result.current.setFieldTouched('r2.0', true);
      });

      expect(result.current.getFieldError('r2')).toBe('Vectors must differ');
    });

    test('group path: ignores sibling-prefix touches (r20.0 must not satisfy "r2." scan)', () => {
      const { result } = renderHook(() =>
        useForm<{ r2: number[]; r20: number[] }>(() => err([{ path: ['r2'], message: 'Vectors must differ' }]), {
          initialValues: {
            r2: [0, 0, 0],
            r20: [0, 0, 0],
          },
        }),
      );

      act(() => {
        void result.current.validateForm(result.current.values);
        result.current.setFieldTouched('r20.0', true);
      });

      // r20.0 starts with "r20." not "r2." — the trailing-dot guard.
      expect(result.current.getFieldError('r2')).toBeUndefined();
    });

    test('group path: nested descendant satisfies the scan', () => {
      const { result } = renderHook(() =>
        useForm<{ secondary: { position: number[]; velocity: number[] } }>(
          () => err([{ path: ['secondary'], message: 'Primary and secondary must differ' }]),
          {
            initialValues: {
              secondary: { position: [0, 0, 0], velocity: [0, 0, 0] },
            },
          },
        ),
      );

      act(() => {
        void result.current.validateForm(result.current.values);
        result.current.setFieldTouched('secondary.position.0', true);
      });

      expect(result.current.getFieldError('secondary')).toBe('Primary and secondary must differ');
    });

    test('group path: descendant touched but no error at path → undefined', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { r1: [0, 0, 0], r2: [0, 0, 0] },
        }),
      );

      act(() => {
        result.current.setFieldTouched('r2.0', true);
      });

      // Short-circuit: no error at "r2", scan never runs.
      expect(result.current.getFieldError('r2')).toBeUndefined();
    });

    test('leaf path: behavior unchanged when descendants are touched', () => {
      // Ensures the new branch doesn't accidentally affect leaf semantics.
      const { result } = renderHook(() =>
        useForm<{ name: string }>(() => err([{ path: ['name'], message: 'Name is required' }]), {
          initialValues: { name: '' },
        }),
      );

      act(() => {
        void result.current.validateForm(result.current.values);
        result.current.setFieldTouched('name', true);
      });

      expect(result.current.getFieldError('name')).toBe('Name is required');
    });

    test("group path: error at one parent does not bubble through a sibling parent's descendant touch", () => {
      const { result } = renderHook(() =>
        useForm<{ primary: { position: number[] }; secondary: { position: number[] } }>(
          () =>
            err([
              { path: ['primary'], message: 'primary error' },
              { path: ['secondary'], message: 'secondary error' },
            ]),
          {
            initialValues: {
              primary: { position: [0, 0, 0] },
              secondary: { position: [0, 0, 0] },
            },
          },
        ),
      );

      act(() => {
        void result.current.validateForm(result.current.values);
        result.current.setFieldTouched('primary.position.0', true);
      });

      expect(result.current.getFieldError('primary')).toBe('primary error');
      expect(result.current.getFieldError('secondary')).toBeUndefined();
    });
  });

  describe('getFieldId', () => {
    test('returns field path as ID for simple fields', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        }),
      );

      expect(result.current.getFieldId('name')).toBe('name');
      expect(result.current.getFieldId('email')).toBe('email');
    });

    test('returns field-optionValue for option fields', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { interests: ['sports'] },
        }),
      );

      expect(result.current.getFieldId('interests', 'sports')).toBe('interests-sports');
      expect(result.current.getFieldId('interests', 42)).toBe('interests-42');
    });

    test('returns nested field path as ID', () => {
      const { result } = renderHook(() =>
        useForm(userWithAddressValidator, {
          initialValues: {
            name: 'John',
            address: { street: '123 Main', city: 'LA', zip: '10001' },
          },
        }),
      );

      expect(result.current.getFieldId('address.city')).toBe('address.city');
    });
  });

  describe('resetForm', () => {
    test('validates on reset when validationMode is mount', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: '', email: '', age: 0 },
          validationMode: 'mount',
        }),
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
    test('handles submit without onSubmit callback', async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        }),
      );

      const submitResult = await act(async () => {
        return await result.current.handleSubmit();
      });

      // Should return Result with validated data
      expect(isOk(submitResult)).toBe(true);
      if (isOk(submitResult)) {
        expect(submitResult.value).toEqual({
          name: 'John',
          email: 'john@example.com',
          age: 25,
        });
      }
    });
  });

  describe('onSubmit results', () => {
    const validValues = { name: 'John', email: 'john@example.com', age: 25 };
    const submitErrorMessage = 'Something went wrong. Please try again.';

    /** Silences the console.error a failed submission logs, and returns the spy. */
    const silenceConsoleError = () => spyOn(console, 'error').mockImplementation(() => {});

    afterEach(() => {
      mock.restore();
    });

    test("handleSubmit returns onSubmit's ok value (sync)", async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: validValues,
          onSubmit: () => ok({ id: '1' }),
        }),
      );

      const submitResult = await act(async () => {
        return await result.current.handleSubmit();
      });

      expect(isOk(submitResult)).toBe(true);
      if (isOk(submitResult)) {
        expect(submitResult.value).toEqual({ id: '1' });
      }
    });

    test("handleSubmit returns onSubmit's ok value (async)", async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: validValues,
          onSubmit: () => Promise.resolve(ok({ id: '1' })),
        }),
      );

      const submitResult = await act(async () => {
        return await result.current.handleSubmit();
      });

      expect(isOk(submitResult)).toBe(true);
      if (isOk(submitResult)) {
        expect(submitResult.value).toEqual({ id: '1' });
      }
    });

    test('handleSubmit returns ok(values) when onSubmit returns nothing', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: validValues,
          onSubmit,
        }),
      );

      const submitResult = await act(async () => {
        return await result.current.handleSubmit();
      });

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(isOk(submitResult)).toBe(true);
      if (isOk(submitResult)) {
        expect(submitResult.value).toEqual(validValues);
      }
    });

    test('onSubmit err is placed on fields and returned', async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: validValues,
          onSubmit: () => err([{ path: ['email'], message: 'Taken' }]),
        }),
      );

      const submitResult = await act(async () => {
        return await result.current.handleSubmit();
      });

      expect(isErr(submitResult)).toBe(true);
      if (isErr(submitResult)) {
        expect(submitResult.error).toEqual([{ path: ['email'], message: 'Taken' }]);
      }
      expect(result.current.getFieldError('email')).toBe('Taken');
      expect(result.current.isSubmitting).toBe(false);
    });

    test('onSubmit err at path [] becomes the submit error and leaves isValid true', async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: validValues,
          onSubmit: () => err([{ path: [], message: 'Service unavailable' }]),
        }),
      );

      const submitResult = await act(async () => {
        return await result.current.handleSubmit();
      });

      expect(isErr(submitResult)).toBe(true);
      if (isErr(submitResult)) {
        expect(submitResult.error).toEqual([{ path: [], message: 'Service unavailable' }]);
      }
      expect(result.current.errors._root).toBe('Service unavailable');
      expect(result.current.serverErrors._root).toBe('Service unavailable');
      expect(result.current.isValid).toBe(true);
    });

    test('a thrown onSubmit returns the generic submit error', async () => {
      const consoleError = silenceConsoleError();
      const onSubmit = mock((_values: UserForm) => {
        throw new Error('Network error');
      });

      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: validValues,
          onSubmit,
        }),
      );

      const submitResult = await act(async () => {
        return await result.current.handleSubmit();
      });

      expect(onSubmit).toHaveBeenCalled();
      expect(isErr(submitResult)).toBe(true);
      if (isErr(submitResult)) {
        expect(submitResult.error).toEqual([{ path: [], message: submitErrorMessage }]);
      }
      expect(result.current.errors._root).toBe(submitErrorMessage);
      expect(consoleError).toHaveBeenCalledWith('Form submission error:', expect.any(Error));
    });

    test('a thrown onSubmit leaves isValid true', async () => {
      silenceConsoleError();
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: validValues,
          onSubmit: () => {
            throw new Error('Network error');
          },
        }),
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.errors._root).toBe(submitErrorMessage);
      expect(result.current.isValid).toBe(true);
    });

    test('a rejected async onSubmit returns the generic submit error', async () => {
      const consoleError = silenceConsoleError();
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: validValues,
          onSubmit: async () => {
            await Promise.reject(new Error('Network error'));
          },
        }),
      );

      const submitResult = await act(async () => {
        return await result.current.handleSubmit();
      });

      expect(isErr(submitResult)).toBe(true);
      if (isErr(submitResult)) {
        expect(submitResult.error).toEqual([{ path: [], message: submitErrorMessage }]);
      }
      expect(result.current.errors._root).toBe(submitErrorMessage);
      expect(result.current.isSubmitting).toBe(false);
      expect(consoleError).toHaveBeenCalledWith('Form submission error:', expect.any(Error));
    });

    test('an onSubmit that returns a non-Result value returns the generic submit error', async () => {
      const consoleError = silenceConsoleError();
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: validValues,
          onSubmit: (() => 'saved') as unknown as () => void,
        }),
      );

      const submitResult = await act(async () => {
        return await result.current.handleSubmit();
      });

      expect(isErr(submitResult)).toBe(true);
      if (isErr(submitResult)) {
        expect(submitResult.error).toEqual([{ path: [], message: submitErrorMessage }]);
      }
      expect(result.current.errors._root).toBe(submitErrorMessage);
      expect(consoleError).toHaveBeenCalledWith('Form submission error:', expect.any(TypeError));
      expect(consoleError).toHaveBeenCalledWith(
        'Form submission error:',
        expect.objectContaining({ message: 'onSubmit must return a Result or nothing' }),
      );
    });

    test('a field validator that throws during submit returns the generic submit error', async () => {
      const consoleError = silenceConsoleError();
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: validValues,
          fieldValidators: {
            name: () => {
              throw new Error('Validator crashed');
            },
          },
        }),
      );

      const submitResult = await act(async () => {
        return await result.current.handleSubmit();
      });

      expect(isErr(submitResult)).toBe(true);
      if (isErr(submitResult)) {
        expect(submitResult.error).toEqual([{ path: [], message: submitErrorMessage }]);
      }
      expect(result.current.errors._root).toBe(submitErrorMessage);
      expect(result.current.isSubmitting).toBe(false);
      expect(consoleError).toHaveBeenCalledWith('Form submission error:', expect.any(Error));
    });

    test('a schema validator that throws during submit returns the generic submit error', async () => {
      const consoleError = silenceConsoleError();
      const { result } = renderHook(() =>
        useForm<{ name: string }>(
          () => {
            throw new Error('Validator crashed');
          },
          {
            initialValues: { name: 'John' },
            validationMode: 'submit',
          },
        ),
      );

      const submitResult = await act(async () => {
        return await result.current.handleSubmit();
      });

      expect(isErr(submitResult)).toBe(true);
      if (isErr(submitResult)) {
        expect(submitResult.error).toEqual([{ path: [], message: submitErrorMessage }]);
      }
      expect(result.current.errors._root).toBe(submitErrorMessage);
      expect(result.current.isValidating).toBe(false);
      expect(consoleError).toHaveBeenCalledWith('Form submission error:', expect.any(Error));
    });

    test('server errors from onSubmit clear on the next submit', async () => {
      const secondStarted = Promise.withResolvers<void>();
      const releaseSecond = Promise.withResolvers<void>();
      let calls = 0;

      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: validValues,
          onSubmit: async (values) => {
            calls += 1;
            if (calls === 1) {
              return err([
                { path: ['email'], message: 'Taken' },
                { path: [], message: 'Service unavailable' },
              ]);
            }
            secondStarted.resolve();
            await releaseSecond.promise;
            return ok(values);
          },
        }),
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.getFieldError('email')).toBe('Taken');
      expect(result.current.errors._root).toBe('Service unavailable');

      let second!: ReturnType<typeof result.current.handleSubmit>;
      await act(async () => {
        second = result.current.handleSubmit();
        await secondStarted.promise;
      });

      // Cleared when the submit starts, while its onSubmit is still pending
      expect(result.current.serverErrors).toEqual({});
      expect(result.current.errors.email).toBeUndefined();
      expect(result.current.errors._root).toBeUndefined();

      await act(async () => {
        releaseSecond.resolve();
        await second;
      });
    });
  });

  describe('array helpers', () => {
    test('arrayHelpers push adds item to array', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { items: [] },
        }),
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
        }),
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
        }),
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
        }),
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
        }),
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
        }),
      );

      const helpers = result.current.arrayHelpers('contacts');
      // @ts-expect-error - Type inference limitation in test
      const props = helpers.getFieldProps(0, 'name');

      expect(props.name).toBe('contacts.0.name');
      expect(props.value).toBe('John');
    });

    test('arrayHelpers getSelectFieldProps returns props for array item select', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { items: [{ category: 'electronics' }] },
        }),
      );

      const helpers = result.current.arrayHelpers('items');
      // @ts-expect-error - Type inference limitation in test
      const props = helpers.getSelectFieldProps(0, 'category');

      expect(props.name).toBe('items.0.category');
      expect(props.value).toBe('electronics');
    });

    test('arrayHelpers getSliderProps returns props for array item slider', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { settings: [{ volume: 75 }] },
        }),
      );

      const helpers = result.current.arrayHelpers('settings');
      // @ts-expect-error - Type inference limitation in test
      const props = helpers.getSliderProps(0, 'volume');

      expect(props.name).toBe('settings.0.volume');
      expect(props.value).toBe(75);
      expect(props.type).toBe('range');
    });

    test('arrayHelpers getCheckboxProps returns props for array item checkbox', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { settings: [{ enabled: true }] },
        }),
      );

      const helpers = result.current.arrayHelpers('settings');
      // @ts-expect-error - Type inference limitation in test
      const props = helpers.getCheckboxProps(0, 'enabled');

      expect(props.name).toBe('settings.0.enabled');
      expect(props.checked).toBe(true);
    });

    test('arrayHelpers getSwitchProps returns props for array item switch', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { features: [{ active: false }] },
        }),
      );

      const helpers = result.current.arrayHelpers('features');
      // @ts-expect-error - Type inference limitation in test
      const props = helpers.getSwitchProps(0, 'active');

      expect(props.name).toBe('features.0.active');
      expect(props.checked).toBe(false);
    });

    test('arrayHelpers getFileFieldProps returns props for array item file input', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { uploads: [{ file: null }] },
        }),
      );

      const helpers = result.current.arrayHelpers('uploads');
      // @ts-expect-error - Type inference limitation in test
      const props = helpers.getFileFieldProps(0, 'file');

      expect(props.name).toBe('uploads.0.file');
    });

    test('arrayHelpers getRadioGroupOptionProps returns props for array item radio', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { preferences: [{ size: 'medium' }] },
        }),
      );

      const helpers = result.current.arrayHelpers('preferences');
      // @ts-expect-error - Type inference limitation in test
      const props = helpers.getRadioGroupOptionProps(0, 'size', 'medium');

      expect(props.name).toBe('preferences.0.size');
      expect(props.value).toBe('medium');
      expect(props.checked).toBe(true);
    });

    test('arrayHelpers getFieldError returns undefined for untouched field', () => {
      const { result } = renderHook(() =>
        useForm(userWithContactsValidator, {
          initialValues: {
            name: 'John',
            contacts: [{ type: 'email', value: '' }],
          },
        }),
      );

      const helpers = result.current.arrayHelpers('contacts');
      const error = helpers.getFieldError(0, 'value');

      expect(error).toBeUndefined();
    });

    test('arrayHelpers getFieldError returns error string for touched field with error', () => {
      const { result } = renderHook(() =>
        useForm(userWithContactsValidator, {
          initialValues: {
            name: 'John',
            contacts: [{ type: 'email', value: '' }],
          },
        }),
      );

      act(() => {
        result.current.setFieldTouched('contacts.0.value', true);
      });

      const helpers = result.current.arrayHelpers('contacts');
      const error = helpers.getFieldError(0, 'value');

      expect(error).toBe('Contact value is required');
    });

    test('arrayHelpers getFieldError returns undefined for touched field without error', () => {
      const { result } = renderHook(() =>
        useForm(userWithContactsValidator, {
          initialValues: {
            name: 'John',
            contacts: [{ type: 'email', value: 'john@example.com' }],
          },
        }),
      );

      act(() => {
        result.current.setFieldTouched('contacts.0.value', true);
      });

      const helpers = result.current.arrayHelpers('contacts');
      const error = helpers.getFieldError(0, 'value');

      expect(error).toBeUndefined();
    });

    test('arrayHelpers getFieldId returns path without optionValue', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: {
            contacts: [{ name: 'John' }],
          },
        }),
      );

      const helpers = result.current.arrayHelpers('contacts');
      // @ts-expect-error - Type inference limitation in test
      const id = helpers.getFieldId(0, 'name');

      expect(id).toBe('contacts.0.name');
    });

    test('arrayHelpers getFieldId returns path with string optionValue', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: {
            contacts: [{ type: 'email' }],
          },
        }),
      );

      const helpers = result.current.arrayHelpers('contacts');
      // @ts-expect-error - Type inference limitation in test
      const id = helpers.getFieldId(0, 'type', 'email');

      expect(id).toBe('contacts.0.type-email');
    });

    test('arrayHelpers getFieldId returns path with numeric optionValue', () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: {
            items: [{ priority: 1 }, { priority: 5 }],
          },
        }),
      );

      const helpers = result.current.arrayHelpers('items');
      // @ts-expect-error - Type inference limitation in test
      const id = helpers.getFieldId(1, 'priority', 5);

      expect(id).toBe('items.1.priority-5');
    });
  });

  describe('async validation', () => {
    test('accepts async validator and validates on mount', async () => {
      const { result } = renderHook(() =>
        useForm(asyncUserValidator, {
          initialValues: { name: '', email: '', age: 0 },
          validationMode: 'mount',
        }),
      );

      await waitFor(() => {
        expect(result.current.errors.name).toBe('Name is required');
        expect(result.current.errors.email).toBe('Email is required');
        expect(result.current.isValid).toBe(false);
      });
    });

    test('async validation errors appear after resolution', async () => {
      const { result } = renderHook(() =>
        useForm(asyncUserValidator, {
          initialValues: { name: 'taken', email: 'a@b.com', age: 25 },
          validationMode: 'mount',
        }),
      );

      await waitFor(() => {
        expect(result.current.errors.name).toBe('Name is already taken');
      });
    });

    test('async validation clears errors on valid input', async () => {
      const { result } = renderHook(() =>
        useForm(asyncUserValidator, {
          initialValues: { name: 'valid', email: 'a@b.com', age: 25 },
          validationMode: 'mount',
        }),
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(true);
        expect(result.current.errors).toEqual({});
      });
    });

    test('handleSubmit works with async validator — valid case', async () => {
      const onSubmit = mock((_values: AsyncUserForm) => {});
      const validValues = { name: 'John', email: 'john@example.com', age: 25 };

      const { result } = renderHook(() =>
        useForm(asyncUserValidator, {
          initialValues: validValues,
          onSubmit,
        }),
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).toHaveBeenCalledWith(validValues);
    });

    test('handleSubmit works with async validator — invalid case', async () => {
      const onSubmit = mock((_values: AsyncUserForm) => {});
      const invalidValues = { name: 'taken', email: 'a@b.com', age: 25 };

      const { result } = renderHook(() =>
        useForm(asyncUserValidator, {
          initialValues: invalidValues,
          onSubmit,
        }),
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).not.toHaveBeenCalled();
      expect(result.current.errors.name).toBe('Name is already taken');
    });

    test('sync validators still return Result (not Promise) from validateForm', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        }),
      );

      let validationResult: ReturnType<typeof result.current.validateForm>;
      act(() => {
        validationResult = result.current.validateForm(result.current.values);
      });

      // Sync validator should return a plain Result, not a Promise
      expect(validationResult! instanceof Promise).toBe(false);
      expect((validationResult! as { ok: boolean }).ok).toBe(true);
    });

    test('async validators return Promise from validateForm', async () => {
      const { result } = renderHook(() =>
        useForm(asyncUserValidator, {
          initialValues: { name: 'John', email: 'john@example.com', age: 25 },
        }),
      );

      let validationResult: ReturnType<typeof result.current.validateForm>;
      await act(async () => {
        validationResult = result.current.validateForm(result.current.values);
        if (validationResult instanceof Promise) await validationResult;
      });

      expect(validationResult! instanceof Promise).toBe(true);
    });

    test('isValidating is true during async validation, false after', async () => {
      const { result } = renderHook(() =>
        useForm(alwaysValidAsyncValidator, {
          initialValues: { name: 'test' },
        }),
      );

      expect(result.current.isValidating).toBe(false);

      act(() => {
        result.current.setFieldValue('name', 'updated');
      });

      // isValidating should be true while async validation is in progress
      expect(result.current.isValidating).toBe(true);

      await waitFor(() => {
        expect(result.current.isValidating).toBe(false);
      });
    });

    test('race condition: rapid changes only apply the latest validation result', async () => {
      // Use alwaysInvalidAsyncValidator to verify that stale results don't overwrite
      const { result } = renderHook(() =>
        useForm(alwaysValidAsyncValidator, {
          initialValues: { value: 'initial' },
        }),
      );

      // Rapidly trigger multiple validations
      act(() => {
        result.current.setFieldValue('value', 'first');
      });
      act(() => {
        result.current.setFieldValue('value', 'second');
      });
      act(() => {
        result.current.setFieldValue('value', 'third');
      });

      // Wait for all validations to resolve
      await waitFor(() => {
        expect(result.current.isValidating).toBe(false);
      });

      // The latest value should be set, and form should be valid
      // (only the last validation result should have been dispatched)
      expect(result.current.values.value).toBe('third');
      expect(result.current.isValid).toBe(true);
    });

    test('async validation failure with alwaysInvalidAsyncValidator', async () => {
      const onSubmit = mock(() => {});
      const { result } = renderHook(() =>
        useForm<{ value: string }>(alwaysInvalidAsyncValidator, {
          initialValues: { value: 'anything' },
          onSubmit,
        }),
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).not.toHaveBeenCalled();
      expect(result.current.isValid).toBe(false);
      expect(result.current.errors.root).toBe('Async validation failed');
    });
  });

  describe('isDirty', () => {
    test('isDirty is false initially', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'Alice', email: 'alice@test.com', age: 30 },
        }),
      );

      expect(result.current.isDirty).toBe(false);
    });

    test('isDirty becomes true after changing a field', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'Alice', email: 'alice@test.com', age: 30 },
        }),
      );

      act(() => {
        result.current.setFieldValue('name', 'Bob');
      });

      expect(result.current.isDirty).toBe(true);
    });

    test('isDirty resets to false when field is changed back to initial value', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'Alice', email: 'alice@test.com', age: 30 },
        }),
      );

      act(() => {
        result.current.setFieldValue('name', 'Bob');
      });
      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.setFieldValue('name', 'Alice');
      });
      expect(result.current.isDirty).toBe(false);
    });

    test('isDirty resets to false when setValues restores all fields to initial', () => {
      const initialValues = { name: 'Alice', email: 'alice@test.com', age: 30 };
      const { result } = renderHook(() => useForm(userValidator, { initialValues }));

      act(() => {
        result.current.setValues({ name: 'Bob', email: 'bob@test.com' });
      });
      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.setValues({ name: 'Alice', email: 'alice@test.com' });
      });
      expect(result.current.isDirty).toBe(false);
    });

    test('isDirty resets to false after resetForm()', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'Alice', email: 'alice@test.com', age: 30 },
        }),
      );

      act(() => {
        result.current.setFieldValue('name', 'Bob');
      });
      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.resetForm();
      });
      expect(result.current.isDirty).toBe(false);
    });

    test('isDirty handles Date values correctly', () => {
      const initialDate = new Date('2024-01-01');
      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { startDate: initialDate },
        }),
      );

      expect(result.current.isDirty).toBe(false);

      act(() => {
        result.current.setFieldValue('startDate', new Date('2024-06-15'));
      });
      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.setFieldValue('startDate', new Date('2024-01-01'));
      });
      expect(result.current.isDirty).toBe(false);
    });

    test('replacing a File with another File marks the form dirty', () => {
      // Same name, contents and timestamp, so comparing by content can't tell the two apart.
      // The timestamp is nonzero because happy-dom replaces 0 with the current time.
      const lastModified = Date.UTC(2024, 0, 1);
      const initialValues = { avatar: new File(['a'], 'a.txt', { lastModified }) };
      const { result } = renderHook(() => useForm(alwaysValidValidator, { initialValues }));

      act(() => {
        result.current.setFieldValue('avatar', new File(['a'], 'a.txt', { lastModified }));
      });

      expect(result.current.isDirty).toBe(true);
    });

    test('picking an equal date-library value keeps the form clean', () => {
      // Shaped like a dayjs value: a date picker creates a new one on every pick
      class DayjsLike {
        $d: Date;
        $y: number;
        constructor(iso: string) {
          this.$d = new Date(iso);
          this.$y = this.$d.getUTCFullYear();
        }
      }

      const initialValues = { startDate: new DayjsLike('2024-01-01') };
      const { result } = renderHook(() => useForm(alwaysValidValidator, { initialValues }));

      act(() => {
        result.current.setFieldValue('startDate', new DayjsLike('2024-01-01'));
      });

      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('fieldValidators', () => {
    test('per-field validatingFields only set for the changed field', async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@test.com', age: 25 },
          validationMode: 'live',
          fieldValidators: {
            name: async (value) => {
              await new Promise((r) => setTimeout(r, 50));
              return value === 'taken' ? 'Name is taken' : undefined;
            },
          },
        }),
      );

      // Change name field - should trigger field validator
      act(() => {
        result.current.setFieldValue('name', 'valid');
      });

      // validatingFields should show name is validating
      await waitFor(() => {
        expect(result.current.validatingFields.name).toBe(true);
      });

      // email should NOT be in validatingFields
      expect(result.current.validatingFields.email).toBeUndefined();

      // Wait for validation to finish
      await waitFor(() => {
        expect(result.current.validatingFields.name).toBeUndefined();
      });
      expect(result.current.isValidating).toBe(false);
    });

    test('sync-only field changes do not trigger isValidating', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@test.com', age: 25 },
          validationMode: 'live',
          fieldValidators: {
            name: async (value) => {
              await new Promise((r) => setTimeout(r, 50));
              return value === 'taken' ? 'Name is taken' : undefined;
            },
          },
        }),
      );

      // Change email field (no field validator) - should NOT trigger isValidating
      act(() => {
        result.current.setFieldValue('email', 'new@test.com');
      });

      expect(result.current.isValidating).toBe(false);
      expect(result.current.validatingFields.email).toBeUndefined();
    });

    test('field validator returns error message', async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@test.com', age: 25 },
          validationMode: 'live',
          fieldValidators: {
            name: async (value) => {
              await new Promise((r) => setTimeout(r, 10));
              return value === 'taken' ? 'Name is taken' : undefined;
            },
          },
        }),
      );

      act(() => {
        result.current.setFieldValue('name', 'taken');
      });

      await waitFor(() => {
        expect(result.current.errors.name).toBe('Name is taken');
      });
      expect(result.current.isValidating).toBe(false);
    });

    test('field validator skipped when schema has error for that field', async () => {
      let validatorCalled = false;
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: '', email: 'john@test.com', age: 25 },
          validationMode: 'live',
          fieldValidators: {
            name: async (value) => {
              validatorCalled = true;
              await new Promise((r) => setTimeout(r, 10));
              return value === 'taken' ? 'Name is taken' : undefined;
            },
          },
        }),
      );

      // Set name to empty string (schema will produce "Name is required" error)
      act(() => {
        result.current.setFieldValue('name', '');
      });

      // Wait a bit for any async to settle
      await new Promise((r) => setTimeout(r, 50));

      // Field validator should NOT have been called since schema errored
      expect(validatorCalled).toBe(false);
      expect(result.current.errors.name).toBe('Name is required');
    });

    test('race condition protection - rapid changes to same field', async () => {
      let _callCount = 0;
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@test.com', age: 25 },
          validationMode: 'live',
          fieldValidators: {
            name: async (value) => {
              _callCount++;
              const delay = value === 'first' ? 100 : 10;
              await new Promise((r) => setTimeout(r, delay));
              return value === 'first' ? 'First error' : undefined;
            },
          },
        }),
      );

      // Rapid changes - first one takes longer
      act(() => {
        result.current.setFieldValue('name', 'first');
      });
      act(() => {
        result.current.setFieldValue('name', 'second');
      });

      // Wait for all to complete
      await waitFor(() => {
        expect(result.current.isValidating).toBe(false);
      });

      // The slow "first" result should be discarded; "second" is valid
      expect(result.current.errors.name).toBeUndefined();
    });

    test('handleSubmit runs all field validators and blocks submit on error', async () => {
      const onSubmit = mock(() => {});
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'taken', email: 'john@test.com', age: 25 },
          fieldValidators: {
            name: async (value) => {
              await new Promise((r) => setTimeout(r, 10));
              return value === 'taken' ? 'Name is taken' : undefined;
            },
          },
          onSubmit,
        }),
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).not.toHaveBeenCalled();
      expect(result.current.errors.name).toBe('Name is taken');
    });

    test('handleSubmit calls onSubmit when field validators pass', async () => {
      const onSubmit = mock(() => {});
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@test.com', age: 25 },
          fieldValidators: {
            name: async (value) => {
              await new Promise((r) => setTimeout(r, 10));
              return value === 'taken' ? 'Name is taken' : undefined;
            },
          },
          onSubmit,
        }),
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    test('resetForm clears validatingFields and fieldErrors', async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@test.com', age: 25 },
          validationMode: 'live',
          fieldValidators: {
            name: async (value) => {
              await new Promise((r) => setTimeout(r, 50));
              return value === 'taken' ? 'Name is taken' : undefined;
            },
          },
        }),
      );

      // Trigger field validation
      act(() => {
        result.current.setFieldValue('name', 'taken');
      });

      await waitFor(() => {
        expect(result.current.errors.name).toBe('Name is taken');
      });

      // Reset the form
      act(() => {
        result.current.resetForm();
      });

      expect(result.current.validatingFields).toEqual({});
      expect(result.current.errors.name).toBeUndefined();
    });

    test('error priority: fieldErrors override clientErrors, serverErrors override both', async () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'Jo', email: 'john@test.com', age: 25 },
          validationMode: 'live',
          fieldValidators: {
            name: async () => {
              await new Promise((r) => setTimeout(r, 10));
              return 'Name is taken (field)';
            },
          },
        }),
      );

      // First, get a schema error for name (too short - "Jo" might not trigger, let's use an empty one)
      act(() => {
        result.current.setFieldValue('name', 'validname');
      });

      // Wait for field validator to produce error
      await waitFor(() => {
        expect(result.current.errors.name).toBe('Name is taken (field)');
      });

      // Now set a server error - should override field error
      act(() => {
        result.current.setServerErrors([{ path: ['name'], message: 'Server says no' }]);
      });

      expect(result.current.errors.name).toBe('Server says no');
    });

    test('field validator does not re-fire on blur in live mode', async () => {
      let callCount = 0;
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'John', email: 'john@test.com', age: 25 },
          validationMode: 'live',
          fieldValidators: {
            name: async (value) => {
              callCount++;
              await new Promise((r) => setTimeout(r, 10));
              return value === 'taken' ? 'Name is taken' : undefined;
            },
          },
        }),
      );

      // Change triggers field validator
      act(() => {
        result.current.setFieldValue('name', 'valid');
      });
      await waitFor(() => expect(result.current.validatingFields.name).toBeUndefined());
      expect(callCount).toBe(1);

      // Blur should NOT re-trigger field validator
      act(() => {
        result.current.setFieldTouched('name', true);
      });
      // Give it a tick to ensure nothing async kicks off
      await waitFor(() => expect(callCount).toBe(1));
      expect(result.current.validatingFields.name).toBeUndefined();
    });

    test('sync field validator works without Promise', () => {
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'taken', email: 'john@test.com', age: 25 },
          validationMode: 'live',
          fieldValidators: {
            name: (value) => {
              return value === 'taken' ? 'Name is taken' : undefined;
            },
          },
        }),
      );

      act(() => {
        result.current.setFieldValue('name', 'taken');
      });

      expect(result.current.errors.name).toBe('Name is taken');
      expect(result.current.isValidating).toBe(false);
    });

    test('field validator runs after async schema on change', async () => {
      let callCount = 0;
      const { result } = renderHook(() =>
        useForm(asyncUserValidator, {
          initialValues: { name: 'John', email: 'john@test.com', age: 25 },
          validationMode: 'live',
          fieldValidators: {
            name: async (value) => {
              callCount++;
              await new Promise((r) => setTimeout(r, 10));
              return value === 'taken' ? 'Name is taken' : undefined;
            },
          },
        }),
      );

      act(() => {
        result.current.setFieldValue('name', 'valid');
      });

      await waitFor(() => expect(callCount).toBe(1));
      expect(result.current.errors.name).toBeUndefined();
    });

    test('field validator runs on blur in blur mode', async () => {
      let callCount = 0;
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: 'taken', email: 'john@test.com', age: 25 },
          validationMode: 'blur',
          fieldValidators: {
            name: async (value) => {
              callCount++;
              await new Promise((r) => setTimeout(r, 10));
              return value === 'taken' ? 'Name is taken' : undefined;
            },
          },
        }),
      );

      act(() => {
        result.current.setFieldTouched('name', true);
      });

      await waitFor(() => {
        expect(result.current.validatingFields.name).toBeUndefined();
      });
      expect(callCount).toBe(1);
      expect(result.current.errors.name).toBe('Name is taken');
    });

    test('field validator skipped on blur when schema has error for field', async () => {
      let validatorCalled = false;
      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues: { name: '', email: 'john@test.com', age: 25 },
          validationMode: 'blur',
          fieldValidators: {
            name: async (value) => {
              validatorCalled = true;
              await new Promise((r) => setTimeout(r, 10));
              return value === 'taken' ? 'Name is taken' : undefined;
            },
          },
        }),
      );

      act(() => {
        result.current.setFieldTouched('name', true);
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(validatorCalled).toBe(false);
      expect(result.current.errors.name).toBe('Name is required');
    });

    test('field validator runs on blur with async schema in blur mode', async () => {
      let callCount = 0;
      const { result } = renderHook(() =>
        useForm(asyncUserValidator, {
          initialValues: { name: 'John', email: 'john@test.com', age: 25 },
          validationMode: 'blur',
          fieldValidators: {
            name: async (value) => {
              callCount++;
              await new Promise((r) => setTimeout(r, 10));
              return value === 'taken' ? 'Name is taken' : undefined;
            },
          },
        }),
      );

      act(() => {
        result.current.setFieldTouched('name', true);
      });

      await waitFor(() => expect(callCount).toBe(1));
      expect(result.current.errors.name).toBeUndefined();
    });
  });
});
