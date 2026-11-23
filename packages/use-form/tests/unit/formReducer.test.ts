import { describe, test, expect } from 'bun:test';

import { formReducer } from '../../src/formReducer';

import type { FormState } from '../../src/types';

describe('formReducer', () => {
  const initialValues = { name: 'John', email: 'john@example.com' };

  const initialState: FormState<typeof initialValues> = {
    values: initialValues,
    touched: {},
    clientErrors: {},
    serverErrors: {},
    fieldErrors: {},
    validatingFields: {},
    isSubmitting: false,
    isFormValidating: false,
    submitCount: 0,
  };

  describe('SET_FIELD_VALUE', () => {
    test('SET_FIELD_VALUE clears a server error on a group containing the edited field', () => {
      const nested = { name: 'John', address: { city: 'NYC' } };
      const state: FormState<typeof nested> = {
        ...initialState,
        values: nested,
        serverErrors: { address: 'Bad address' },
      };

      const result = formReducer(state, { type: 'SET_FIELD_VALUE', field: 'address.city', value: 'LA' }, nested);

      expect(result.serverErrors).toEqual({});
    });

    test('SET_FIELD_VALUE keeps unrelated server errors', () => {
      const state: FormState<typeof initialValues> = { ...initialState, serverErrors: { email: 'Taken' } };

      const result = formReducer(state, { type: 'SET_FIELD_VALUE', field: 'name', value: 'Jane' }, initialValues);

      expect(result.serverErrors).toEqual({ email: 'Taken' });
    });

    test('SET_FIELD_VALUE clears the submit error', () => {
      const state: FormState<typeof initialValues> = { ...initialState, submitError: 'Down' };

      const result = formReducer(state, { type: 'SET_FIELD_VALUE', field: 'name', value: 'Jane' }, initialValues);

      expect(result.submitError).toBeUndefined();
    });

    test('updates field value', () => {
      const result = formReducer(
        initialState,
        {
          type: 'SET_FIELD_VALUE',
          field: 'name',
          value: 'Jane',
        },
        initialValues,
      );

      expect(result.values.name).toBe('Jane');
      expect(result.values.email).toBe('john@example.com');
    });

    test('clears server errors for affected field', () => {
      const stateWithErrors: FormState<typeof initialValues> = {
        ...initialState,
        serverErrors: {
          name: 'Server error for name',
          email: 'Server error for email',
        },
      };

      const result = formReducer(
        stateWithErrors,
        {
          type: 'SET_FIELD_VALUE',
          field: 'name',
          value: 'Jane',
        },
        initialValues,
      );

      expect(result.serverErrors.name).toBeUndefined();
      expect(result.serverErrors.email).toBe('Server error for email');
    });

    test('returns same state reference when value unchanged', () => {
      const result = formReducer(
        initialState,
        {
          type: 'SET_FIELD_VALUE',
          field: 'name',
          value: 'John', // same as initialValues.name
        },
        initialValues,
      );

      expect(result).toBe(initialState);
    });

    test('returns same state reference for same nested value', () => {
      const nestedValues = {
        user: { name: 'John', address: { city: 'NYC' } },
      };
      const nestedState: FormState<typeof nestedValues> = {
        values: nestedValues,
        touched: {},
        clientErrors: {},
        serverErrors: {},
        fieldErrors: {},
        validatingFields: {},
        isSubmitting: false,
        isFormValidating: false,
        submitCount: 0,
      };

      const cityRef = nestedValues.user.address;
      const result = formReducer(
        nestedState,
        {
          type: 'SET_FIELD_VALUE',
          field: 'user.address',
          value: cityRef, // exact same reference
        },
        nestedValues,
      );

      expect(result).toBe(nestedState);
    });

    test('clears server errors for nested paths', () => {
      const nestedValues = {
        user: { name: 'John', address: { city: 'NYC' } },
      };
      const nestedState: FormState<typeof nestedValues> = {
        values: nestedValues,
        touched: {},
        clientErrors: {},
        serverErrors: {
          'user.address.city': 'City error',
          'user.name': 'Name error',
        },
        fieldErrors: {},
        validatingFields: {},
        isSubmitting: false,
        isFormValidating: false,
        submitCount: 0,
      };

      const result = formReducer(
        nestedState,
        {
          type: 'SET_FIELD_VALUE',
          field: 'user.address',
          value: { city: 'LA' },
        },
        nestedValues,
      );

      // Parent change should clear child error
      expect(result.serverErrors['user.address.city']).toBeUndefined();
      // Unrelated error should remain
      expect(result.serverErrors['user.name']).toBe('Name error');
    });
  });

  describe('SET_VALUES', () => {
    test('SET_VALUES clears overlapping server errors and the submit error', () => {
      const state: FormState<typeof initialValues> = {
        ...initialState,
        serverErrors: { name: 'Taken', email: 'Bad' },
        submitError: 'Down',
      };

      const result = formReducer(state, { type: 'SET_VALUES', values: { name: 'Jane' } }, initialValues);

      expect(result.serverErrors).toEqual({ email: 'Bad' });
      expect(result.submitError).toBeUndefined();
    });

    test('updates multiple values', () => {
      const result = formReducer(
        initialState,
        {
          type: 'SET_VALUES',
          values: { name: 'Jane', email: 'jane@example.com' },
        },
        initialValues,
      );

      expect(result.values.name).toBe('Jane');
      expect(result.values.email).toBe('jane@example.com');
    });

    test('deep merges nested objects preserving sibling properties', () => {
      const nestedValues = {
        name: 'John',
        address: { street: '123 Main', city: 'LA', zip: '10001' },
      };
      const nestedState: FormState<typeof nestedValues> = {
        values: nestedValues,
        touched: {},
        clientErrors: {},
        serverErrors: {},
        fieldErrors: {},
        validatingFields: {},
        isSubmitting: false,
        isFormValidating: false,
        submitCount: 0,
      };

      const result = formReducer(
        nestedState,
        {
          type: 'SET_VALUES',
          values: { address: { city: 'NYC' } },
        },
        nestedValues,
      );

      expect(result.values.address.city).toBe('NYC');
      expect(result.values.address.street).toBe('123 Main');
      expect(result.values.address.zip).toBe('10001');
      expect(result.values.name).toBe('John');
    });

    test('clears server errors for changed fields', () => {
      const stateWithErrors: FormState<typeof initialValues> = {
        ...initialState,
        serverErrors: {
          name: 'Name error',
          email: 'Email error',
        },
      };

      const result = formReducer(
        stateWithErrors,
        {
          type: 'SET_VALUES',
          values: { name: 'Jane' },
        },
        initialValues,
      );

      expect(result.serverErrors.name).toBeUndefined();
      expect(result.serverErrors.email).toBe('Email error');
    });
  });

  describe('SET_FIELD_TOUCHED', () => {
    test('marks field as touched', () => {
      const result = formReducer(
        initialState,
        {
          type: 'SET_FIELD_TOUCHED',
          field: 'name',
          isTouched: true,
        },
        initialValues,
      );

      expect(result.touched.name).toBe(true);
    });

    test('marks field as untouched', () => {
      const touchedState: FormState<typeof initialValues> = {
        ...initialState,
        touched: { name: true },
      };

      const result = formReducer(
        touchedState,
        {
          type: 'SET_FIELD_TOUCHED',
          field: 'name',
          isTouched: false,
        },
        initialValues,
      );

      expect(result.touched.name).toBe(false);
    });
  });

  describe('SET_CLIENT_ERRORS', () => {
    test('sets client errors', () => {
      const errors = {
        name: 'Name is required',
        email: 'Email is invalid',
      };

      const result = formReducer(
        initialState,
        {
          type: 'SET_CLIENT_ERRORS',
          errors,
        },
        initialValues,
      );

      expect(result.clientErrors).toEqual(errors);
    });

    test('replaces existing client errors', () => {
      const stateWithErrors: FormState<typeof initialValues> = {
        ...initialState,
        clientErrors: { name: 'Old error' },
      };

      const newErrors = { email: 'Email is required' };

      const result = formReducer(
        stateWithErrors,
        {
          type: 'SET_CLIENT_ERRORS',
          errors: newErrors,
        },
        initialValues,
      );

      expect(result.clientErrors).toEqual(newErrors);
    });
  });

  describe('SET_SERVER_ERRORS', () => {
    test('SET_SERVER_ERRORS stores the submit error apart from per-path errors', () => {
      const result = formReducer(
        initialState,
        { type: 'SET_SERVER_ERRORS', errors: { name: 'Taken' }, submitError: 'Down' },
        initialValues,
      );

      expect(result.serverErrors).toEqual({ name: 'Taken' });
      expect(result.submitError).toBe('Down');

      const replaced = formReducer(result, { type: 'SET_SERVER_ERRORS', errors: {} }, initialValues);

      expect(replaced.submitError).toBeUndefined();
    });

    test('sets server errors', () => {
      const errors = {
        name: 'Name already exists',
        email: 'Email already exists',
      };

      const result = formReducer(
        initialState,
        {
          type: 'SET_SERVER_ERRORS',
          errors,
        },
        initialValues,
      );

      expect(result.serverErrors).toEqual(errors);
    });

    test('replaces existing server errors', () => {
      const stateWithErrors: FormState<typeof initialValues> = {
        ...initialState,
        serverErrors: { name: 'Old error' },
      };

      const newErrors = { email: 'Email error' };

      const result = formReducer(
        stateWithErrors,
        {
          type: 'SET_SERVER_ERRORS',
          errors: newErrors,
        },
        initialValues,
      );

      expect(result.serverErrors).toEqual(newErrors);
    });
  });

  describe('SET_SUBMIT_ERROR', () => {
    test('SET_SUBMIT_ERROR sets the submit error and keeps per-path server errors', () => {
      const state: FormState<typeof initialValues> = { ...initialState, serverErrors: { email: 'Taken' } };

      const result = formReducer(state, { type: 'SET_SUBMIT_ERROR', submitError: 'Down' }, initialValues);

      expect(result.submitError).toBe('Down');
      expect(result.serverErrors).toEqual({ email: 'Taken' });
    });
  });

  describe('CLEAR_SERVER_ERRORS', () => {
    test('CLEAR_SERVER_ERRORS clears the submit error', () => {
      const state: FormState<typeof initialValues> = { ...initialState, submitError: 'Down' };

      const result = formReducer(state, { type: 'CLEAR_SERVER_ERRORS' }, initialValues);

      expect(result.submitError).toBeUndefined();
    });

    test('clears all server errors', () => {
      const stateWithErrors: FormState<typeof initialValues> = {
        ...initialState,
        serverErrors: {
          name: 'Name error',
          email: 'Email error',
        },
      };

      const result = formReducer(
        stateWithErrors,
        {
          type: 'CLEAR_SERVER_ERRORS',
        },
        initialValues,
      );

      expect(result.serverErrors).toEqual({});
    });
  });

  describe('SET_SUBMITTING', () => {
    test('sets isSubmitting to true without changing submitCount', () => {
      const result = formReducer(
        initialState,
        {
          type: 'SET_SUBMITTING',
          isSubmitting: true,
        },
        initialValues,
      );

      expect(result.isSubmitting).toBe(true);
      expect(result.submitCount).toBe(0);
    });

    test('sets isSubmitting to false without changing submitCount', () => {
      const submittingState: FormState<typeof initialValues> = {
        ...initialState,
        isSubmitting: true,
        submitCount: 1,
      };

      const result = formReducer(
        submittingState,
        {
          type: 'SET_SUBMITTING',
          isSubmitting: false,
        },
        initialValues,
      );

      expect(result.isSubmitting).toBe(false);
      expect(result.submitCount).toBe(1);
    });
  });

  describe('INCREMENT_SUBMIT_COUNT', () => {
    test('increments submitCount by 1', () => {
      const result = formReducer(initialState, { type: 'INCREMENT_SUBMIT_COUNT' }, initialValues);

      expect(result.submitCount).toBe(1);
    });

    test('increments submitCount on each dispatch', () => {
      let state = initialState;

      state = formReducer(state, { type: 'INCREMENT_SUBMIT_COUNT' }, initialValues);
      expect(state.submitCount).toBe(1);

      state = formReducer(state, { type: 'INCREMENT_SUBMIT_COUNT' }, initialValues);
      expect(state.submitCount).toBe(2);
    });

    test('does not change isSubmitting', () => {
      const result = formReducer(initialState, { type: 'INCREMENT_SUBMIT_COUNT' }, initialValues);

      expect(result.isSubmitting).toBe(false);
    });
  });

  describe('RESET_FORM', () => {
    test('RESET_FORM clears the submit error', () => {
      const state: FormState<typeof initialValues> = { ...initialState, submitError: 'Down' };

      const result = formReducer(state, { type: 'RESET_FORM' }, initialValues);

      expect(result.submitError).toBeUndefined();
    });

    test('resets form to initial state', () => {
      const dirtyState: FormState<typeof initialValues> = {
        values: { name: 'Jane', email: 'jane@example.com' },
        touched: { name: true, email: true },
        clientErrors: { name: 'Name error' },
        serverErrors: { email: 'Email error' },
        fieldErrors: { name: 'Field error' },
        validatingFields: { name: true },
        isSubmitting: true,
        isFormValidating: true,
        submitCount: 3,
      };

      const result = formReducer(
        dirtyState,
        {
          type: 'RESET_FORM',
        },
        initialValues,
      );

      expect(result.values).toEqual(initialValues);
      expect(result.touched).toEqual({});
      expect(result.clientErrors).toEqual({});
      expect(result.serverErrors).toEqual({});
      expect(result.fieldErrors).toEqual({});
      expect(result.validatingFields).toEqual({});
      expect(result.isSubmitting).toBe(false);
      expect(result.isFormValidating).toBe(false);
      expect(result.submitCount).toBe(0);
    });
  });

  describe('MARK_ALL_TOUCHED', () => {
    test('marks all specified fields as touched', () => {
      const result = formReducer(
        initialState,
        {
          type: 'MARK_ALL_TOUCHED',
          fields: ['name', 'email', 'address.city'],
        },
        initialValues,
      );

      expect(result.touched.name).toBe(true);
      expect(result.touched.email).toBe(true);
      expect(result.touched['address.city']).toBe(true);
    });

    test('preserves existing touched fields', () => {
      const touchedState: FormState<typeof initialValues> = {
        ...initialState,
        touched: { name: true },
      };

      const result = formReducer(
        touchedState,
        {
          type: 'MARK_ALL_TOUCHED',
          fields: ['email'],
        },
        initialValues,
      );

      expect(result.touched.name).toBe(true);
      expect(result.touched.email).toBe(true);
    });
  });

  describe('SET_FIELD_VALIDATING', () => {
    test('sets per-field validating state to true', () => {
      const result = formReducer(
        initialState,
        {
          type: 'SET_FIELD_VALIDATING',
          field: 'name',
          isValidating: true,
        },
        initialValues,
      );

      expect(result.validatingFields.name).toBe(true);
    });

    test('sets per-field validating state to false and removes key', () => {
      const validatingState: FormState<typeof initialValues> = {
        ...initialState,
        validatingFields: { name: true },
      };

      const result = formReducer(
        validatingState,
        {
          type: 'SET_FIELD_VALIDATING',
          field: 'name',
          isValidating: false,
        },
        initialValues,
      );

      expect(result.validatingFields.name).toBeUndefined();
    });

    test('preserves other validating fields when one completes', () => {
      const validatingState: FormState<typeof initialValues> = {
        ...initialState,
        validatingFields: { name: true, email: true },
      };

      const result = formReducer(
        validatingState,
        {
          type: 'SET_FIELD_VALIDATING',
          field: 'name',
          isValidating: false,
        },
        initialValues,
      );

      expect(result.validatingFields.name).toBeUndefined();
      expect(result.validatingFields.email).toBe(true);
    });
  });

  describe('SET_FORM_VALIDATING', () => {
    test('sets form-level validating state to true', () => {
      const result = formReducer(
        initialState,
        {
          type: 'SET_FORM_VALIDATING',
          isFormValidating: true,
        },
        initialValues,
      );

      expect(result.isFormValidating).toBe(true);
    });

    test('sets form-level validating state to false', () => {
      const validatingState: FormState<typeof initialValues> = {
        ...initialState,
        isFormValidating: true,
      };

      const result = formReducer(
        validatingState,
        {
          type: 'SET_FORM_VALIDATING',
          isFormValidating: false,
        },
        initialValues,
      );

      expect(result.isFormValidating).toBe(false);
    });
  });

  describe('SET_FIELD_ERROR', () => {
    test('sets a per-field error', () => {
      const result = formReducer(
        initialState,
        {
          type: 'SET_FIELD_ERROR',
          field: 'name',
          error: 'Name is taken',
        },
        initialValues,
      );

      expect(result.fieldErrors.name).toBe('Name is taken');
    });

    test('clears a per-field error when undefined', () => {
      const stateWithFieldError: FormState<typeof initialValues> = {
        ...initialState,
        fieldErrors: { name: 'Name is taken' },
      };

      const result = formReducer(
        stateWithFieldError,
        {
          type: 'SET_FIELD_ERROR',
          field: 'name',
          error: undefined,
        },
        initialValues,
      );

      expect(result.fieldErrors.name).toBeUndefined();
    });

    test('preserves other field errors', () => {
      const stateWithFieldErrors: FormState<typeof initialValues> = {
        ...initialState,
        fieldErrors: { name: 'Name is taken', email: 'Email is taken' },
      };

      const result = formReducer(
        stateWithFieldErrors,
        {
          type: 'SET_FIELD_ERROR',
          field: 'name',
          error: undefined,
        },
        initialValues,
      );

      expect(result.fieldErrors.name).toBeUndefined();
      expect(result.fieldErrors.email).toBe('Email is taken');
    });
  });

  describe('default case', () => {
    test('returns current state for unknown action', () => {
      const next = formReducer(
        initialState,
        // @ts-expect-error testing unknown action branch
        { type: 'UNKNOWN_ACTION' },
        initialValues,
      );

      expect(next).toBe(initialState);
    });
  });
});
