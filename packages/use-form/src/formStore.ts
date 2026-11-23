import { formReducer } from './formReducer';

import type { FormAction, FormState } from './types';

/**
 * Holds a form's state outside React, so every method reads the state left by the calls before it.
 * React renders from it through `useSyncExternalStore`.
 *
 * @template TValues - The shape of the form values
 */
export type FormStore<TValues extends Record<string, unknown>> = {
  /** Returns the current state. A new object after every change, the same object otherwise. */
  getState: () => FormState<TValues>;
  /** Applies an action with `formReducer` right away, then notifies subscribers if the state changed. */
  dispatch: (action: FormAction<TValues>) => void;
  /**
   * Calls `listener` after every change.
   *
   * @returns A function that removes the listener
   */
  subscribe: (listener: () => void) => () => void;
};

/**
 * Creates a {@link FormStore}.
 *
 * @template TValues - The shape of the form values
 * @param initialState - The state before any action
 * @param getInitialValues - Reads the initial values the reducer uses (for `RESET_FORM` and `isDirty`) at each dispatch
 * @returns A store whose methods stay the same for its lifetime
 *
 * @example
 * const store = createFormStore(initialState, () => initialValuesRef.current);
 * store.dispatch({ type: 'SET_FIELD_VALUE', field: 'name', value: 'Ada' });
 * store.getState().values.name; // 'Ada', before React re-renders
 */
export const createFormStore = <TValues extends Record<string, unknown>>(
  initialState: FormState<TValues>,
  getInitialValues: () => TValues,
): FormStore<TValues> => {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    dispatch: (action) => {
      const next = formReducer(state, action, getInitialValues());
      if (next === state) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
