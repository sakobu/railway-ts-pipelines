import { formReducer } from './formReducer';

import type { CheckId, FormAction, FormState } from './types';

/**
 * Holds a form's state outside React, so every method reads the state left by the calls before it.
 * React renders from it through `useSyncExternalStore`.
 *
 * @template TValues - The shape of the form values
 */
export type FormStore<TValues extends Record<string, unknown>> = {
  /** Returns the current state. A new object after every change, the same object otherwise. */
  getState: () => FormState<TValues>;
  /**
   * Applies an action with `formReducer` right away, then notifies subscribers if the state changed.
   * `RESET_FORM` resets to the initial values set most recently.
   */
  dispatch: (action: FormAction<TValues>) => void;
  /**
   * Applies an action like `dispatch`, without notifying subscribers, so an insertion effect can use it: one
   * mustn't schedule a render. The next `dispatch` or `flush` notifies them.
   */
  dispatchQuietly: (action: FormAction<TValues>) => void;
  /** Notifies subscribers of a change `dispatchQuietly` made, unless a `dispatch` since has notified them. */
  flush: () => void;
  /**
   * Sets the initial values `RESET_FORM` resets to, from the next dispatch on. The state doesn't change,
   * and no subscriber is notified.
   *
   * @param initialValues - The values a reset starts over from
   */
  setInitialValues: (initialValues: TValues) => void;
  /**
   * Hands out the id of the next check: 1, 2, 3 and so on. The count never restarts, not even on `RESET_FORM`,
   * so an id is never taken twice and a later check always has the larger one.
   */
  takeCheckId: () => CheckId;
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
 * @param initialValues - The initial values `RESET_FORM` resets to, until `setInitialValues` replaces them
 * @returns A store whose methods stay the same for its lifetime
 *
 * @example
 * const store = createFormStore(initialState, initialValues);
 * store.dispatch({ type: 'SET_FIELD_VALUE', field: 'name', value: 'Ada' });
 * store.getState().values.name; // 'Ada', before React re-renders
 *
 * store.setInitialValues(savedRecord);
 * store.dispatch({ type: 'RESET_FORM' }); // the values are savedRecord
 */
export const createFormStore = <TValues extends Record<string, unknown>>(
  initialState: FormState<TValues>,
  initialValues: TValues,
): FormStore<TValues> => {
  let state = initialState;
  let latestInitialValues = initialValues;
  // A change dispatchQuietly made that no subscriber has heard of yet
  let unheard = false;
  let lastCheckId: CheckId = 0;
  const listeners = new Set<() => void>();

  /** Applies `action`, and tells whether the state changed. */
  const apply = (action: FormAction<TValues>): boolean => {
    const next = formReducer(state, action, latestInitialValues);
    if (next === state) return false;
    state = next;
    return true;
  };

  const notify = () => {
    unheard = false;
    listeners.forEach((listener) => listener());
  };

  return {
    getState: () => state,
    dispatch: (action) => {
      if (apply(action)) notify();
    },
    dispatchQuietly: (action) => {
      if (apply(action)) unheard = true;
    },
    flush: () => {
      if (unheard) notify();
    },
    setInitialValues: (values) => {
      latestInitialValues = values;
    },
    takeCheckId: () => ++lastCheckId,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
