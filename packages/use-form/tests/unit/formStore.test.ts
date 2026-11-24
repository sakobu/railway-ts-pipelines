import { describe, test, expect, mock } from 'bun:test';

import { createInitialFormState } from '../../src/formReducer';
import { createFormStore } from '../../src/formStore';

import type { FormState } from '../../src/types';

type Values = { name: string };

const initialState: FormState<Values> = createInitialFormState({ name: '' }, undefined);

describe('createFormStore', () => {
  test('dispatch applies the reducer immediately', () => {
    const store = createFormStore(initialState, initialState.values);

    store.dispatch({ type: 'SET_FIELD_VALUE', field: 'name', value: 'Ada' });

    expect(store.getState().values).toEqual({ name: 'Ada' });
  });

  test('notifies each listener once per state change', () => {
    const store = createFormStore(initialState, initialState.values);
    const first = mock(() => {});
    const second = mock(() => {});
    store.subscribe(first);
    store.subscribe(second);

    store.dispatch({ type: 'SET_FIELD_VALUE', field: 'name', value: 'Ada' });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('does not notify when the reducer returns the same state', () => {
    const store = createFormStore(initialState, initialState.values);
    const listener = mock(() => {});
    store.subscribe(listener);
    const before = store.getState();

    store.dispatch({ type: 'SET_FIELD_VALUE', field: 'name', value: '' });

    expect(listener).not.toHaveBeenCalled();
    expect(store.getState()).toBe(before);
  });

  test('an unsubscribed listener is not notified', () => {
    const store = createFormStore(initialState, initialState.values);
    const listener = mock(() => {});
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.dispatch({ type: 'SET_FIELD_VALUE', field: 'name', value: 'Ada' });

    expect(listener).not.toHaveBeenCalled();
  });

  test('setInitialValues neither changes the state nor notifies', () => {
    const store = createFormStore(initialState, initialState.values);
    const listener = mock(() => {});
    store.subscribe(listener);
    const before = store.getState();

    store.setInitialValues({ name: 'B' });

    expect(listener).not.toHaveBeenCalled();
    expect(store.getState()).toBe(before);
  });

  test('the reducer gets the initial values set most recently, at dispatch time', () => {
    const store = createFormStore<Values>(initialState, { name: '' });

    store.setInitialValues({ name: 'B' });
    store.dispatch({ type: 'RESET_FORM' });

    expect(store.getState().values).toEqual({ name: 'B' });
  });
});
