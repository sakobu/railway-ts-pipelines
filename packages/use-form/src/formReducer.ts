import { deepMerge, getValueByPath, normalizePath, normalizePathKeys, pathsOverlap, setValueByPath } from './utils';

import type { FieldPath, FormAction, FormState } from './types';

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
 *
 * All state updates are performed immutably - the reducer always returns a new state object
 * rather than mutating the existing state. Server errors are automatically cleared when
 * related fields are modified to provide a smooth user experience.
 *
 * @template TValues - The type of form values being managed
 *
 * @param state - The current form state before the action is applied
 * @param action - The action to perform (e.g., SET_FIELD_VALUE, SET_CLIENT_ERRORS, RESET_FORM)
 * @param initialValues - Initial form values used when resetting the form
 * @returns A new form state object reflecting the changes from the action
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
        serverErrors: {},
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
