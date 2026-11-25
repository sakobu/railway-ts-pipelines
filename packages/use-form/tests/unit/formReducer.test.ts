import { describe, test, expect } from 'bun:test';

import { createInitialFormState, formReducer } from '../../src/formReducer';

import type { FormState, ResetKey } from '../../src/types';

const v1 = { name: 'John', email: 'john@example.com' };
const v2 = { name: 'John', email: 'new@example.com' };
const edited = { name: 'Jane', email: 'john@example.com' };
const sync = <T extends Record<string, unknown>>(initialValues: T, resetKey: ResetKey = 'a') =>
  ({ type: 'SYNC_INITIAL_VALUES', initialValues, resetKey }) as const;

describe('formReducer', () => {
  const initialValues = { name: 'John', email: 'john@example.com' };

  const initialState: FormState<typeof initialValues> = createInitialFormState(initialValues, undefined);

  describe('SET_FIELD_VALUE', () => {
    test('SET_FIELD_VALUE clears a server error on a group containing the edited field', () => {
      const nested = { name: 'John', address: { city: 'NYC' } };
      const state: FormState<typeof nested> = {
        ...createInitialFormState(nested, undefined),
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
      const nestedState: FormState<typeof nestedValues> = createInitialFormState(nestedValues, undefined);

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
        ...createInitialFormState(nestedValues, undefined),
        serverErrors: {
          'user.address.city': 'City error',
          'user.name': 'Name error',
        },
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
      const nestedState: FormState<typeof nestedValues> = createInitialFormState(nestedValues, undefined);

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

    test('no errors keep the shared empty map, so a valid result changes nothing derived from it', () => {
      const result = formReducer(initialState, { type: 'SET_CLIENT_ERRORS', errors: {} }, initialValues);

      expect(result.clientErrors).toBe(initialState.clientErrors);
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
    test('an initialValues equal to the latest version by content keeps it: no new version arrived', () => {
      const state: FormState<typeof initialValues> = { ...initialState, values: { name: 'Jane', email: '' } };

      const result = formReducer(state, { type: 'RESET_FORM' }, { ...initialValues });

      expect(result.lastVersion).toBe(initialState.lastVersion);
      expect(result.values).toBe(initialState.lastVersion);
    });

    test('RESET_FORM clears the submit error', () => {
      const state: FormState<typeof initialValues> = { ...initialState, submitError: 'Down' };

      const result = formReducer(state, { type: 'RESET_FORM' }, initialValues);

      expect(result.submitError).toBeUndefined();
    });

    test('resets form to initial state', () => {
      const dirtyState: FormState<typeof initialValues> = {
        ...createInitialFormState(initialValues, undefined),
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

    test('RESET_FORM resets the sync state and keeps resetKey and generation', () => {
      const s = createInitialFormState(v1, 'a');
      const start: FormState<typeof v1> = {
        ...s,
        values: edited,
        cleanValues: edited,
        baseVersion: undefined,
        lastVersion: v2,
        isStale: true,
        generation: 2,
        baselineEpoch: 4,
      };

      const result = formReducer(start, { type: 'RESET_FORM' }, v2);

      expect(result.values).toBe(v2);
      expect(result.lastVersion).toBe(v2);
      expect(result.cleanValues).toBe(v2);
      expect(result.baseVersion).toBe(v2);
      expect(result.isStale).toBe(false);
      expect(result.resetKey).toBe('a');
      expect(result.generation).toBe(2);
      expect(result.baselineEpoch).toBe(5);
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

describe('createInitialFormState', () => {
  test('starts clean, with every version equal to initialValues', () => {
    const s = createInitialFormState(v1, 'a');

    expect(s.values).toBe(v1);
    expect(s.lastVersion).toBe(v1);
    expect(s.cleanValues).toBe(v1);
    expect(s.baseVersion).toBe(v1);
    expect(s).toMatchObject({
      isStale: false,
      resetKey: 'a',
      generation: 0,
      baselineEpoch: 0,
      submitCount: 0,
      isSubmitting: false,
    });
  });
});

describe('SYNC_INITIAL_VALUES', () => {
  const s = createInitialFormState(v1, 'a');
  const stale = formReducer({ ...s, values: edited }, sync(v2), v2);

  test('returns the same state for a version with the same content', () => {
    expect(formReducer(s, sync({ ...v1 }), v1)).toBe(s);
  });

  describe('otherVersions', () => {
    test('counts a version that arrives, followed or not', () => {
      expect(formReducer(s, sync(v2), v2).otherVersions).toBe(1);
      expect(stale.otherVersions).toBe(1);
    });

    test("doesn't count the version that arrives while a save's answer is pending: it's that answer", () => {
      const pending = { ...s, values: edited, cleanValues: edited, baseVersion: undefined };

      expect(formReducer(pending, sync(v2), v2).otherVersions).toBe(0);
      expect(formReducer({ ...pending, values: v1 }, sync(v2), v2).otherVersions).toBe(0);
    });

    test('resetForm() keeps the count', () => {
      expect(formReducer(stale, { type: 'RESET_FORM' }, v2).otherVersions).toBe(1);
    });
  });

  test('follows a new version when the values equal cleanValues', () => {
    const result = formReducer(s, sync(v2), v2);

    expect(result.values).toBe(v2);
    expect(result.lastVersion).toBe(v2);
    expect(result.cleanValues).toBe(v2);
    expect(result.baseVersion).toBe(v2);
    expect(result.baselineEpoch).toBe(1);
    expect(result.isStale).toBe(false);
  });

  test('a follow replaces values, dropping keys the new version lacks', () => {
    const state = createInitialFormState<Record<string, unknown>>({ name: 'a', nickname: 'b' }, 'a');

    const result = formReducer<Record<string, unknown>>(state, sync({ name: 'a' }), { name: 'a' });

    expect(result.values).toEqual({ name: 'a' });
  });

  test('a follow clears server errors and the submit error, and keeps touched, submitCount and isSubmitting', () => {
    const start = {
      ...s,
      serverErrors: { email: 'Taken' },
      submitError: 'Down',
      touched: { name: true },
      submitCount: 2,
      isSubmitting: true,
    };

    const result = formReducer(start, sync(v2), v2);

    expect(result.serverErrors).toEqual({});
    expect(result.submitError).toBeUndefined();
    expect(result.touched).toEqual({ name: true });
    expect(result.submitCount).toBe(2);
    expect(result.isSubmitting).toBe(true);
  });

  test('keeps edits and marks the form stale when someone else changed the record', () => {
    expect(stale.values).toBe(edited);
    expect(stale.lastVersion).toBe(v2);
    expect(stale.baseVersion).toBe(v1);
    expect(stale.cleanValues).toBe(v1);
    expect(stale.isStale).toBe(true);
  });

  test('a new version equal to the edited values makes them clean, keeping the values shown', () => {
    const values = { ...v2 };

    const result = formReducer({ ...s, values }, sync(v2), v2);

    expect(result.values).toBe(values);
    expect(result.lastVersion).toBe(v2);
    expect(result.cleanValues).toBe(v2);
    expect(result.baseVersion).toBe(v2);
    expect(result.isStale).toBe(false);
    expect(result.baselineEpoch).toBe(0);
  });

  test('after values came to equal a version, the next version is followed', () => {
    const v3 = { ...v2, name: 'Jim' };
    const caughtUp = formReducer({ ...s, values: { ...v2 } }, sync(v2), v2);

    const result = formReducer(caughtUp, sync(v3), v3);

    expect(result.values).toBe(v3);
    expect(result.isStale).toBe(false);
  });

  test('a version equal to the values during a submission stays an edit: it may be an optimistic write', () => {
    const result = formReducer({ ...s, values: { ...v2 }, isSubmitting: true }, sync(v2), v2);

    expect(result.isStale).toBe(false);
    expect(result.cleanValues).toBe(v1);
    expect(result.baseVersion).toBe(v1);
  });

  test('clears isStale when the new version equals the base again', () => {
    expect(formReducer(stale, sync({ ...v1 }), v1).isStale).toBe(false);
  });

  test('after a successful submit, the next version becomes the base without marking stale', () => {
    const start = { ...s, values: edited, cleanValues: { ...v1, name: 'Submitted' }, baseVersion: undefined };

    const result = formReducer(start, sync(v2), v2);

    expect(result.baseVersion).toBe(v2);
    expect(result.isStale).toBe(false);
    expect(result.values).toBe(edited);
  });

  test('after a successful submit, follows a saved record that differs from the submitted values', () => {
    const submitted = { name: ' Jane ', email: 'john@example.com' };
    const start = { ...s, values: submitted, cleanValues: submitted, baseVersion: undefined };
    const saved = { ...submitted, name: 'Jane' };

    const result = formReducer(start, sync(saved), saved);

    expect(result.values).toBe(saved);
  });

  test('keeps the edits through an optimistic write and its rollback', () => {
    // The optimistic write arrives while onSubmit runs, and the rollback once the failed save has settled
    const s1 = formReducer({ ...s, values: edited, isSubmitting: true }, sync({ ...edited }), v1);
    expect(s1.isStale).toBe(false);

    const s2 = formReducer({ ...s1, isSubmitting: false }, sync({ ...v1 }), v1);
    expect(s2.values).toBe(edited);
    expect(s2.isStale).toBe(false);
  });

  test('a resetKey change starts over from the new initialValues', () => {
    const dirty: FormState<typeof v1> = {
      ...s,
      values: edited,
      touched: { name: true },
      clientErrors: { name: 'Client' },
      serverErrors: { email: 'Server' },
      fieldErrors: { name: 'Field' },
      submitError: 'Down',
      validatingFields: { name: true },
      isSubmitting: true,
      isFormValidating: true,
      submitCount: 3,
      isStale: true,
      generation: 2,
      baselineEpoch: 5,
    };

    const result = formReducer(dirty, sync(v2, 'b'), v2);

    expect(result).toEqual({ ...createInitialFormState(v2, 'b'), generation: 3, baselineEpoch: 6 });
  });

  test('a change from undefined to a key counts as a resetKey change', () => {
    const result = formReducer(createInitialFormState(v1, undefined), sync(v1, 'x'), v1);

    expect(result.generation).toBe(1);
    expect(result.resetKey).toBe('x');
  });
});

describe('SUBMIT_SUCCEEDED', () => {
  const s = createInitialFormState(v1, 'a');
  const saved = { ...edited, email: 'saved@example.com' };
  const succeeded = { type: 'SUBMIT_SUCCEEDED', values: edited, baselineEpoch: 0, lastVersion: v1 } as const;

  test('with no version since the submission started, takes the submitted values as clean and unsets the base', () => {
    const result = formReducer({ ...s, values: edited, isStale: true }, succeeded, v1);

    expect(result.cleanValues).toBe(edited);
    expect(result.baseVersion).toBeUndefined();
    expect(result.isStale).toBe(false);
  });

  describe('with saved, what savedValues says the save stored', () => {
    test('follows the latest version when it equals saved, even one from before the save', () => {
      // The server trimmed the edit away: the saved record equals the version before the save
      const result = formReducer({ ...s, values: edited }, { ...succeeded, saved: { ...v1 } }, v1);

      expect(result.values).toBe(v1);
      expect(result.baseVersion).toBe(v1);
      expect(result.baselineEpoch).toBe(1);
    });

    test("waits for the version equal to saved: the save's copy of its values doesn't count, nor become the base", () => {
      const pending = formReducer({ ...s, values: edited }, { ...succeeded, saved }, v1);
      expect(pending.baseVersion).toBeUndefined();
      expect(pending.saved).toBe(saved);

      const copied = formReducer(pending, sync({ ...edited }), v1);
      expect(copied.values).toBe(edited);
      expect(copied.baseVersion).toBeUndefined();
      expect(copied.otherVersions).toBe(0);

      const answered = formReducer({ ...copied, values: { ...edited, name: 'Janet' } }, sync(saved), v1);
      expect(answered.baseVersion).toBe(saved);
      expect(answered.saved).toBeUndefined();
      expect(answered.isStale).toBe(false);
    });
  });

  test('a save of values equal to the latest version keeps that version as the base', () => {
    // Its answer has the same content, so it never arrives as a new version: waiting for it would leave the base
    // unset, and the next version, someone else's change, would be taken for the answer
    const unchanged = { ...v1 };

    const result = formReducer({ ...s, values: unchanged }, { ...succeeded, values: unchanged }, v1);

    expect(result.cleanValues).toBe(unchanged);
    expect(result.baseVersion).toBe(v1);
    expect(result.isStale).toBe(false);
  });

  test('follows a version that arrived during the submission when nothing was typed since', () => {
    const result = formReducer({ ...s, values: edited, lastVersion: saved, isStale: true }, succeeded, v1);

    expect(result.values).toBe(saved);
    expect(result.lastVersion).toBe(saved);
    expect(result.cleanValues).toBe(saved);
    expect(result.baseVersion).toBe(saved);
    expect(result.isStale).toBe(false);
    expect(result.baselineEpoch).toBe(1);
  });

  test('bases typing done during the submission on a version that arrived during it', () => {
    const typed = { ...edited, name: 'Janet' };

    const result = formReducer({ ...s, values: typed, lastVersion: saved, isStale: true }, succeeded, v1);

    expect(result.values).toBe(typed);
    expect(result.cleanValues).toBe(edited);
    expect(result.baseVersion).toBe(saved);
    expect(result.isStale).toBe(false);
    expect(result.baselineEpoch).toBe(0);
  });

  test('typing done during the submission that equals the version that arrived counts as clean', () => {
    const result = formReducer({ ...s, values: { ...saved }, lastVersion: saved, isSubmitting: true }, succeeded, v1);

    expect(result.cleanValues).toBe(saved);
    expect(result.baseVersion).toBe(saved);
    expect(result.isStale).toBe(false);
    expect(result.baselineEpoch).toBe(0);
  });

  test('is ignored when a follow or reset happened since the submission started', () => {
    const state = { ...s, baselineEpoch: 1 };

    expect(formReducer(state, succeeded, v1)).toBe(state);
  });

  test("the base coming back during the submission isn't its answer: keeps the saved values, doesn't follow it", () => {
    // Someone else's change made the form stale, and the base the edits started from came back while the save ran
    const stale = formReducer({ ...s, values: edited }, sync(v2), v1);
    const state = formReducer(stale, sync(v1), v1);

    const result = formReducer(state, { ...succeeded, lastVersion: v2 }, v1);

    expect(result.values).toBe(edited);
    expect(result.lastVersion).toBe(v1);
    expect(result.cleanValues).toBe(edited);
    expect(result.baseVersion).toBeUndefined();
    expect(result.isStale).toBe(false);
    expect(result.baselineEpoch).toBe(0);
  });

  test('the base is compared by content: one that comes back as a new object keeps the saved values too', () => {
    const stale = formReducer({ ...s, values: edited }, sync(v2), v1);
    const back = { ...v1 };
    const state = formReducer(stale, sync(back), v1);

    const result = formReducer(state, { ...succeeded, lastVersion: v2 }, v1);

    expect(result.values).toBe(edited);
    expect(result.lastVersion).toBe(back);
    expect(result.cleanValues).toBe(edited);
    expect(result.baseVersion).toBeUndefined();
    expect(result.baselineEpoch).toBe(0);
  });

  describe("while the previous save's answer was pending", () => {
    // The previous save submitted `earlier` and succeeded before its answer arrived, so this save started
    // with the base unset
    const earlier = { ...v1, name: 'Jan' };
    const answer = { ...earlier, email: 'jan@example.com' };
    const typed = { ...edited, name: 'Janet' };
    const start: FormState<typeof v1> = { ...s, values: edited, cleanValues: earlier, baseVersion: undefined };

    test('the version that arrived answered the previous save: the submitted values are clean, the base unset', () => {
      const state = formReducer(start, sync(answer), v1);

      const result = formReducer(state, succeeded, v1);

      expect(result.values).toBe(edited);
      expect(result.lastVersion).toBe(answer);
      expect(result.cleanValues).toBe(edited);
      expect(result.baseVersion).toBeUndefined();
      expect(result.isStale).toBe(false);
      expect(result.baselineEpoch).toBe(0);
    });

    test('keeps typing done during the submission, with the base unset', () => {
      const state = formReducer({ ...start, values: typed }, sync(answer), v1);

      const result = formReducer(state, succeeded, v1);

      expect(result.values).toBe(typed);
      expect(result.cleanValues).toBe(edited);
      expect(result.baseVersion).toBeUndefined();
      expect(result.isStale).toBe(false);
    });

    test("a second version that arrived is this save's answer: follows it when nothing was typed since", () => {
      const state = formReducer(formReducer(start, sync(answer), v1), sync(saved), v1);

      const result = formReducer(state, succeeded, v1);

      expect(result.values).toBe(saved);
      expect(result.cleanValues).toBe(saved);
      expect(result.baseVersion).toBe(saved);
      expect(result.baselineEpoch).toBe(1);
    });

    test('bases typing done during the submission on a second version that arrived', () => {
      const state = formReducer(formReducer({ ...start, values: typed }, sync(answer), v1), sync(saved), v1);

      const result = formReducer(state, succeeded, v1);

      expect(result.values).toBe(typed);
      expect(result.cleanValues).toBe(edited);
      expect(result.baseVersion).toBe(saved);
      expect(result.isStale).toBe(false);
      expect(result.baselineEpoch).toBe(0);
    });
  });
});

describe('isStale and edits', () => {
  const s = createInitialFormState(v1, 'a');
  const stale: FormState<typeof v1> = { ...s, values: edited, lastVersion: v2, isStale: true };

  test('SET_FIELD_VALUE makes the values clean when they come to equal the latest version', () => {
    const a = formReducer(stale, { type: 'SET_FIELD_VALUE', field: 'name', value: 'John' }, v1);
    const b = formReducer(a, { type: 'SET_FIELD_VALUE', field: 'email', value: 'new@example.com' }, v1);

    expect(b.isStale).toBe(false);
    expect(b.cleanValues).toBe(v2);
    expect(b.baseVersion).toBe(v2);
  });

  test('SET_VALUES makes them clean the same way', () => {
    const result = formReducer(stale, { type: 'SET_VALUES', values: { name: 'John', email: 'new@example.com' } }, v1);

    expect(result.isStale).toBe(false);
    expect(result.cleanValues).toBe(v2);
    expect(result.baseVersion).toBe(v2);
  });

  test('an edit back to the latest version stays an edit during a submission', () => {
    const result = formReducer(
      { ...stale, isSubmitting: true },
      { type: 'SET_VALUES', values: { name: 'John', email: 'new@example.com' } },
      v1,
    );

    expect(result.isStale).toBe(false);
    expect(result.cleanValues).toBe(v1);
  });

  test("an edit back to the latest version stays an edit while a save's answer is pending", () => {
    // The save of `edited` succeeded before its answer arrived, so the latest version is the one before it
    const pending: FormState<typeof v1> = { ...s, values: edited, cleanValues: edited, baseVersion: undefined };

    const result = formReducer(pending, { type: 'SET_FIELD_VALUE', field: 'name', value: 'John' }, v1);

    expect(result.cleanValues).toBe(edited);
    expect(result.baseVersion).toBeUndefined();
  });

  test('SET_FIELD_VALUE keeps isStale while the values differ from the latest version', () => {
    const result = formReducer(stale, { type: 'SET_FIELD_VALUE', field: 'name', value: 'Janet' }, v1);

    expect(result.isStale).toBe(true);
  });

  test('an edit back to the clean values follows the latest version, as a form with no edits does', () => {
    const result = formReducer(stale, { type: 'SET_FIELD_VALUE', field: 'name', value: 'John' }, v1);

    expect(result.values).toBe(v2);
    expect(result.cleanValues).toBe(v2);
    expect(result.baseVersion).toBe(v2);
    expect(result.isStale).toBe(false);
    expect(result.baselineEpoch).toBe(1);
  });

  test('an edit back to the clean values stays an edit during a submission', () => {
    const result = formReducer({ ...stale, isSubmitting: true }, { type: 'SET_VALUES', values: { name: 'John' } }, v1);

    expect(result.values).toEqual(v1);
    expect(result.isStale).toBe(true);
    expect(result.baselineEpoch).toBe(0);
  });

  test("an edit back to the clean values stays an edit while a save's answer is pending", () => {
    // The save of `edited` succeeded before its answer arrived, so the latest version is the one before it
    const pending: FormState<typeof v1> = {
      ...s,
      values: { ...edited, name: 'Janet' },
      cleanValues: edited,
      baseVersion: undefined,
    };

    const result = formReducer(pending, { type: 'SET_FIELD_VALUE', field: 'name', value: 'Jane' }, v1);

    expect(result.values).toEqual(edited);
    expect(result.lastVersion).toBe(v1);
    expect(result.baselineEpoch).toBe(0);
  });
});

describe('checks', () => {
  const start = createInitialFormState(v1, 'a');
  const on = (...fields: string[]) => ({ type: 'SYNC_FIELD_VALIDATORS', fields: new Set(fields) }) as const;
  const apply = (state: FormState<typeof v1>, ...actions: Parameters<typeof formReducer<typeof v1>>[1][]) =>
    actions.reduce((current, action) => formReducer(current, action, v1), state);

  test('SYNC_FIELD_VALIDATORS returns the same state when nothing changes', () => {
    const once = apply(start, on('name'));

    expect(once).not.toBe(start);
    expect(apply(once, on('name'))).toBe(once);
  });

  test('END_SCHEMA_CHECK sets clientErrors only for the current check', () => {
    const started = apply(start, { type: 'START_SCHEMA_CHECK', id: 1 }, { type: 'START_SCHEMA_CHECK', id: 2 });

    expect(apply(started, { type: 'END_SCHEMA_CHECK', id: 1, errors: { name: 'Bad' } })).toBe(started);

    const ended = apply(started, { type: 'END_SCHEMA_CHECK', id: 2, errors: { name: 'Bad' } });
    expect(ended.clientErrors).toEqual({ name: 'Bad' });
    expect(ended.checks.schema).toBeUndefined();
  });

  test('END_SCHEMA_CHECK normalizes bracket keys', () => {
    const ended = apply(
      start,
      { type: 'START_SCHEMA_CHECK', id: 1 },
      { type: 'END_SCHEMA_CHECK', id: 1, errors: { 'r1[0]': 'Bad' } },
    );

    expect(ended.clientErrors).toEqual({ 'r1.0': 'Bad' });
  });

  test('END_SCHEMA_CHECK without errors ends the check and keeps clientErrors', () => {
    const withErrors: FormState<typeof v1> = { ...start, clientErrors: { name: 'Bad' } };

    const ended = apply(withErrors, { type: 'START_SCHEMA_CHECK', id: 1 }, { type: 'END_SCHEMA_CHECK', id: 1 });

    expect(ended.checks.schema).toBeUndefined();
    expect(ended.clientErrors).toBe(withErrors.clientErrors);
  });

  test('field check actions normalize a bracket path', () => {
    const waiting = apply(start, on('r1.0'), {
      type: 'START_FIELD_CHECK',
      field: 'r1[0]',
      id: 1,
      status: 'waiting',
      value: 'x',
    });
    expect(waiting.checks.fields['r1.0']?.status).toBe('waiting');

    const running = apply(waiting, { type: 'RUN_FIELD_CHECK', field: 'r1[0]', id: 1 });
    expect(running.checks.fields['r1.0']?.status).toBe('running');

    const done = apply(running, { type: 'END_FIELD_CHECK', field: 'r1[0]', id: 1, result: { error: 'Bad' } });
    expect(done.checks.fields['r1.0']).toEqual({ id: 1, status: 'done', value: 'x', error: 'Bad' });
  });

  test('a follow ends pending field checks and keeps their errors', () => {
    const running = apply(
      start,
      on('name'),
      { type: 'START_FIELD_CHECK', field: 'name', id: 1, status: 'running', value: 'John' },
      { type: 'END_FIELD_CHECK', field: 'name', id: 1, result: { error: 'Bad' } },
      { type: 'START_FIELD_CHECK', field: 'name', id: 2, status: 'running', value: 'John' },
    );
    expect(running.checks.fields.name?.status).toBe('running');

    const followed = formReducer(running, sync(v2), v1);

    expect(followed.checks.fields.name).toEqual({ id: 2, status: 'done', value: 'John', error: 'Bad' });
  });

  const busy = apply(
    start,
    on('name'),
    { type: 'START_SCHEMA_CHECK', id: 1 },
    { type: 'START_FIELD_CHECK', field: 'name', id: 2, status: 'running', value: 'John' },
  );

  test('RESET_FORM starts checks over and keeps validators', () => {
    const result = formReducer(busy, { type: 'RESET_FORM' }, v1);

    expect(result.checks.schema).toBeUndefined();
    expect(result.checks.fields).toEqual({});
    expect(result.checks.validators).toEqual({ name: { on: true, period: 0 } });
  });

  test('a resetKey change starts checks over and keeps validators', () => {
    const result = formReducer(busy, sync(v1, 'b'), v1);

    expect(result.checks.schema).toBeUndefined();
    expect(result.checks.fields).toEqual({});
    expect(result.checks.validators).toEqual({ name: { on: true, period: 0 } });
  });
});
