import { describe, test, expect, mock } from 'bun:test';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useForm } from '../../src/useForm';
import { isStandardSchema, fromStandardSchema } from '../../src/standardSchema';
import { isOk, isErr } from '@railway-ts/pipelines/result';
import {
  standardSchemaUserValidator,
  asyncStandardSchemaUserValidator,
  standardSchemaNestedPathValidator,
  type UserForm,
  type UserWithAddressForm,
} from '../fixtures/validators';

// =============================================================================
// Type Guard: isStandardSchema
// =============================================================================

describe('isStandardSchema', () => {
  test('returns true for a Standard Schema v1 object', () => {
    expect(isStandardSchema(standardSchemaUserValidator)).toBe(true);
  });

  test('returns true for async Standard Schema v1 object', () => {
    expect(isStandardSchema(asyncStandardSchemaUserValidator)).toBe(true);
  });

  test('returns false for a plain function (MaybeAsyncValidator)', () => {
    const validator = () => ({ ok: true, value: {} });
    expect(isStandardSchema(validator)).toBe(false);
  });

  test('returns false for null', () => {
    expect(isStandardSchema(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(isStandardSchema(undefined)).toBe(false);
  });

  test('returns false for an object without ~standard', () => {
    expect(isStandardSchema({ version: 1 })).toBe(false);
  });

  test('returns false for ~standard with wrong version', () => {
    expect(
      isStandardSchema({
        '~standard': { version: 2, vendor: 'test', validate: () => ({}) },
      })
    ).toBe(false);
  });
});

// =============================================================================
// Adapter: fromStandardSchema
// =============================================================================

describe('fromStandardSchema', () => {
  describe('sync', () => {
    test('converts successful validation to ok Result', () => {
      const validator = fromStandardSchema(standardSchemaUserValidator);
      const result = validator({
        name: 'John',
        email: 'john@test.com',
        age: 25,
      });
      expect(result).not.toBeInstanceOf(Promise);
      expect(isOk(result as any)).toBe(true);
    });

    test('converts failed validation to err Result with ValidationErrors', () => {
      const validator = fromStandardSchema(standardSchemaUserValidator);
      const result = validator({ name: '', email: 'bad', age: 10 });
      expect(result).not.toBeInstanceOf(Promise);
      expect(isErr(result as any)).toBe(true);
      const errors = (result as any).error;
      expect(errors).toBeInstanceOf(Array);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toHaveProperty('path');
      expect(errors[0]).toHaveProperty('message');
    });

    test('converts paths with { key } segments to string[]', () => {
      const validator = fromStandardSchema(standardSchemaNestedPathValidator);
      const result = validator({ name: '', address: {} });
      expect(isErr(result as any)).toBe(true);
      const errors = (result as any).error;
      const streetError = errors.find(
        (e: any) => e.message === 'Street is required'
      );
      expect(streetError).toBeDefined();
      // { key: 'address' }, { key: 'street' } → ['address', 'street']
      expect(streetError.path).toEqual(['address', 'street']);
    });
  });

  describe('async', () => {
    test('converts successful async validation to ok Result', async () => {
      const validator = fromStandardSchema(asyncStandardSchemaUserValidator);
      const result = await validator({
        name: 'John',
        email: 'john@test.com',
        age: 25,
      });
      expect(isOk(result)).toBe(true);
    });

    test('converts failed async validation to err Result', async () => {
      const validator = fromStandardSchema(asyncStandardSchemaUserValidator);
      const result = await validator({ name: '', email: 'bad', age: 10 });
      expect(isErr(result)).toBe(true);
      const errors = (result as any).error;
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Integration: useForm with Standard Schema validators
// =============================================================================

describe('useForm with Standard Schema', () => {
  describe('sync Standard Schema', () => {
    test('initializes with default values', () => {
      const { result } = renderHook(() =>
        useForm<UserForm>(standardSchemaUserValidator, {
          initialValues: { name: '', email: '', age: 0 },
        })
      );

      expect(result.current.values).toEqual({ name: '', email: '', age: 0 });
      expect(result.current.touched).toEqual({});
      expect(result.current.isSubmitting).toBe(false);
    });

    test('validates on mount when validationMode is mount', () => {
      const { result } = renderHook(() =>
        useForm<UserForm>(standardSchemaUserValidator, {
          initialValues: { name: '', email: '', age: 0 },
          validationMode: 'mount',
        })
      );

      expect(result.current.errors.name).toBe('Name is required');
      expect(result.current.errors.email).toBe('Email must be valid');
      expect(result.current.isValid).toBe(false);
    });

    test('validates on change in live mode', async () => {
      const { result } = renderHook(() =>
        useForm<UserForm>(standardSchemaUserValidator, {
          initialValues: { name: '', email: '', age: 0 },
          validationMode: 'live',
        })
      );

      act(() => {
        result.current.setFieldValue('name', 'John');
      });

      await waitFor(() => {
        // name error should be cleared now
        expect(result.current.errors.name).toBeUndefined();
      });
    });

    test('validates on blur in blur mode', async () => {
      const { result } = renderHook(() =>
        useForm<UserForm>(standardSchemaUserValidator, {
          initialValues: { name: '', email: '', age: 0 },
          validationMode: 'blur',
        })
      );

      act(() => {
        result.current.setFieldTouched('name', true);
      });

      await waitFor(() => {
        expect(result.current.errors.name).toBe('Name is required');
      });
    });

    test('calls onSubmit with valid data', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const validValues: UserForm = {
        name: 'John',
        email: 'john@test.com',
        age: 25,
      };

      const { result } = renderHook(() =>
        useForm<UserForm>(standardSchemaUserValidator, {
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
      const onSubmit = mock((_values: UserForm) => {});

      const { result } = renderHook(() =>
        useForm<UserForm>(standardSchemaUserValidator, {
          initialValues: { name: '', email: '', age: 0 },
          onSubmit,
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).not.toHaveBeenCalled();
      expect(result.current.errors.name).toBe('Name is required');
    });

    test('resets form clears errors and values', async () => {
      const initialValues: UserForm = { name: '', email: '', age: 0 };

      const { result } = renderHook(() =>
        useForm<UserForm>(standardSchemaUserValidator, {
          initialValues,
          validationMode: 'live',
        })
      );

      // Make changes to trigger dirty and errors
      act(() => {
        result.current.setFieldValue('name', 'John');
      });

      await waitFor(() => {
        expect(result.current.isDirty).toBe(true);
      });

      // Reset
      act(() => {
        result.current.resetForm();
      });

      expect(result.current.values).toEqual(initialValues);
      expect(result.current.isDirty).toBe(false);
      expect(result.current.touched).toEqual({});
    });
  });

  describe('async Standard Schema', () => {
    test('sets isValidating during async validation', async () => {
      const { result } = renderHook(() =>
        useForm<UserForm>(asyncStandardSchemaUserValidator, {
          initialValues: { name: '', email: '', age: 0 },
          validationMode: 'live',
        })
      );

      act(() => {
        result.current.setFieldValue('name', 'John');
      });

      // isValidating should be true while awaiting
      expect(result.current.isValidating).toBe(true);

      await waitFor(() => {
        expect(result.current.isValidating).toBe(false);
      });
    });

    test('calls onSubmit with valid data (async)', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const validValues: UserForm = {
        name: 'John',
        email: 'john@test.com',
        age: 25,
      };

      const { result } = renderHook(() =>
        useForm<UserForm>(asyncStandardSchemaUserValidator, {
          initialValues: validValues,
          onSubmit,
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).toHaveBeenCalledWith(validValues);
    });

    test('does not call onSubmit with invalid async data', async () => {
      const onSubmit = mock((_values: UserForm) => {});

      const { result } = renderHook(() =>
        useForm<UserForm>(asyncStandardSchemaUserValidator, {
          initialValues: { name: 'taken', email: 'test@test.com', age: 25 },
          onSubmit,
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).not.toHaveBeenCalled();
      expect(result.current.errors.name).toBe('Name is already taken');
    });
  });

  describe('nested path errors', () => {
    test('maps Standard Schema nested paths to dot-notation errors', () => {
      const { result } = renderHook(() =>
        useForm<UserWithAddressForm>(standardSchemaNestedPathValidator, {
          initialValues: {
            name: '',
            address: { street: '', city: '', zip: '' },
          },
          validationMode: 'mount',
        })
      );

      expect(result.current.errors.name).toBe('Name is required');
      expect(result.current.errors['address.street']).toBe(
        'Street is required'
      );
      expect(result.current.errors['address.city']).toBe('City is required');
    });
  });
});
