import {
  deepEqual,
  deepMerge,
  getValueByPath,
  normalizePath,
  normalizePathKeys,
  pathsOverlap,
  setValueByPath,
} from './utils';

import type { FieldPath, FormAction, FormState, ResetKey } from './types';

/**
 * The one empty map shared by a fresh state's maps, a follow's server errors and cleared server errors.
 * A render that derives a state and the store that computes the same state then hold the same map, and
 * clearing server errors that were already empty keeps their identity, so values derived from them do too.
 * Frozen, since the reducer copies before every write: a mutation in place would throw.
 */
const EMPTY: Readonly<Record<string, never>> = Object.freeze({});

/** Creates the state of a form that has just mounted on `initialValues`. */
export const createInitialFormState = <TValues extends Record<string, unknown>>(
  initialValues: TValues,
  resetKey: ResetKey,
): FormState<TValues> => ({
  values: initialValues,
  touched: EMPTY,
  clientErrors: EMPTY,
  serverErrors: EMPTY,
  fieldErrors: EMPTY,
  validatingFields: EMPTY,
  isSubmitting: false,
  isFormValidating: false,
  submitCount: 0,
  lastVersion: initialValues,
  cleanValues: initialValues,
  baseVersion: initialValues,
  isStale: false,
  resetKey,
  generation: 0,
  baselineEpoch: 0,
});

/** Shows `version`, and treats it as clean and as the base of any later edits. */
const followVersion = <TValues extends Record<string, unknown>>(
  state: FormState<TValues>,
  version: TValues,
): FormState<TValues> => {
  const { submitError: _submitError, ...rest } = state;
  return {
    ...rest,
    values: version,
    serverErrors: EMPTY,
    lastVersion: version,
    cleanValues: version,
    baseVersion: version,
    isStale: false,
    baselineEpoch: state.baselineEpoch + 1,
  };
};

/**
 * Reducer function for form state management using the Redux-style reducer pattern.
 * Handles all form state transitions in an immutable, predictable way.
 *
 * This reducer processes various actions that modify form state including:
 * - Field value updates (single or batch)
 * - Touch state tracking (marking fields as interacted with)
 * - Client-side validation errors
 * - Server-side validation errors
 * - Form submission state
 * - Form reset to initial values
 * - Syncing new initialValues: follow them, keep the edits and track isStale, or start over on a resetKey change
 * - Settling a successful submit
 *
 * All state updates are performed immutably, never mutating the existing state. Some actions
 * return the same state object when they change nothing, so the store can skip notifying:
 * SET_FIELD_VALUE with the field's current value, SYNC_INITIAL_VALUES with the version already
 * synced, and a SUBMIT_SUCCEEDED from before a follow or reset. Server errors are automatically cleared when
 * related fields are modified to provide a smooth user experience.
 *
 * @template TValues - The type of form values being managed
 *
 * @param state - The current form state before the action is applied
 * @param action - The action to perform (e.g., SET_FIELD_VALUE, SET_CLIENT_ERRORS, RESET_FORM)
 * @param initialValues - Initial form values used when resetting the form
 * @returns A new state object, or the same one for the no-op cases above
 *
 * @example
 * // Used internally by useForm's store, which applies each action as soon as it is dispatched
 * const next = formReducer(state, action, initialValues);
 *
 * @example
 * // Dispatching a field value change
 * dispatch({
 *   type: "SET_FIELD_VALUE",
 *   field: "email",
 *   value: "user@example.com"
 * });
 *
 * @example
 * // Dispatching validation errors
 * dispatch({
 *   type: "SET_CLIENT_ERRORS",
 *   errors: { email: "Invalid email format", password: "Too short" }
 * });
 *
 * @example
 * // Marking all fields as touched on submit
 * dispatch({
 *   type: "MARK_ALL_TOUCHED",
 *   fields: ["name", "email", "password"]
 * });
 */
export const formReducer = <TValues extends Record<string, unknown>>(
  state: FormState<TValues>,
  action: FormAction<TValues>,
  initialValues: TValues,
): FormState<TValues> => {
  switch (action.type) {
    case 'SET_FIELD_VALUE': {
      if (getValueByPath(state.values, action.field) === action.value) return state;

      const newValues = setValueByPath(state.values, action.field, action.value);

      const newServerErrors = { ...state.serverErrors };
      Object.keys(newServerErrors).forEach((errorPath) => {
        if (pathsOverlap(errorPath, action.field)) {
          delete newServerErrors[errorPath];
        }
      });

      // Any value change also clears the submit error
      const { submitError: _submitError, ...rest } = state;

      return {
        ...rest,
        values: newValues,
        serverErrors: newServerErrors,
        isStale: state.isStale && !deepEqual(newValues, state.lastVersion),
      };
    }

    case 'SET_VALUES': {
      const newValues = deepMerge(state.values, action.values);
      const newServerErrors = { ...state.serverErrors };
      Object.keys(action.values).forEach((field) => {
        Object.keys(newServerErrors).forEach((errorPath) => {
          if (pathsOverlap(errorPath, field)) {
            delete newServerErrors[errorPath];
          }
        });
      });

      // Any value change also clears the submit error
      const { submitError: _submitError, ...rest } = state;

      return {
        ...rest,
        values: newValues,
        serverErrors: newServerErrors,
        isStale: state.isStale && !deepEqual(newValues, state.lastVersion),
      };
    }

    case 'SET_FIELD_TOUCHED':
      return {
        ...state,
        touched: {
          ...state.touched,
          [normalizePath(action.field)]: action.isTouched,
        },
      };

    case 'SET_CLIENT_ERRORS':
      return {
        ...state,
        clientErrors: normalizePathKeys(action.errors),
      };

    case 'SET_SERVER_ERRORS': {
      const { submitError: _submitError, ...rest } = state;
      return {
        ...rest,
        serverErrors: normalizePathKeys(action.errors),
        ...(action.submitError !== undefined && { submitError: action.submitError }),
      };
    }

    case 'SET_SUBMIT_ERROR':
      return {
        ...state,
        submitError: action.submitError,
      };

    case 'CLEAR_SERVER_ERRORS': {
      const { submitError: _submitError, ...rest } = state;
      return {
        ...rest,
        serverErrors: EMPTY,
      };
    }

    case 'SET_SUBMITTING':
      return {
        ...state,
        isSubmitting: action.isSubmitting,
      };

    case 'INCREMENT_SUBMIT_COUNT':
      return { ...state, submitCount: state.submitCount + 1 };

    case 'SET_FORM_VALIDATING':
      return {
        ...state,
        isFormValidating: action.isFormValidating,
      };

    case 'SET_FIELD_VALIDATING': {
      const key = normalizePath(action.field);
      const newValidatingFields = { ...state.validatingFields };
      if (action.isValidating) {
        newValidatingFields[key] = true;
      } else {
        delete newValidatingFields[key];
      }
      return {
        ...state,
        validatingFields: newValidatingFields,
      };
    }

    case 'SET_FIELD_ERROR': {
      const key = normalizePath(action.field);
      const newFieldErrors = { ...state.fieldErrors };
      if (action.error) {
        newFieldErrors[key] = action.error;
      } else {
        delete newFieldErrors[key];
      }
      return {
        ...state,
        fieldErrors: newFieldErrors,
      };
    }

    case 'RESET_FORM':
      return {
        ...createInitialFormState(initialValues, state.resetKey),
        generation: state.generation,
        baselineEpoch: state.baselineEpoch + 1,
      };

    case 'SYNC_INITIAL_VALUES': {
      const { initialValues: version, resetKey } = action;
      if (!Object.is(resetKey, state.resetKey)) {
        return {
          ...createInitialFormState(version, resetKey),
          generation: state.generation + 1,
          baselineEpoch: state.baselineEpoch + 1,
        };
      }
      if (deepEqual(version, state.lastVersion)) return state;
      if (deepEqual(state.values, state.cleanValues)) return followVersion(state, version);
      const baseVersion = state.baseVersion ?? version;
      return {
        ...state,
        lastVersion: version,
        baseVersion,
        isStale: !deepEqual(state.values, version) && !deepEqual(baseVersion, version),
      };
    }

    case 'SUBMIT_SUCCEEDED': {
      if (action.baselineEpoch !== state.baselineEpoch) return state;
      // Within one epoch only a version arriving while the form has edits moves lastVersion. A latest version
      // equal to the base, by content, isn't this save's answer either: it's the previous save's answer, pending
      // when this save started and made the base when it arrived, or the old base coming back
      if (state.lastVersion === action.lastVersion || deepEqual(state.baseVersion, state.lastVersion)) {
        // None arrived for this submission: the next one to arrive is the server's answer
        return { ...state, cleanValues: action.values, baseVersion: undefined, isStale: false };
      }
      // One arrived: the server's answer, delivered before onSubmit returned
      if (deepEqual(state.values, action.values)) return followVersion(state, state.lastVersion);
      return { ...state, cleanValues: action.values, baseVersion: state.lastVersion, isStale: false };
    }

    case 'MARK_ALL_TOUCHED': {
      const allTouched: Record<FieldPath, boolean> = {};
      action.fields.forEach((path) => {
        allTouched[normalizePath(path)] = true;
      });

      return {
        ...state,
        touched: {
          ...state.touched,
          ...allTouched,
        },
      };
    }

    default:
      return state;
  }
};
