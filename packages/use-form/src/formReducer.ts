import type { FieldPath, FormAction, FormState } from './types';
import { isPathAffected, setValueByPath } from './utils';

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
 * // Used internally by useForm hook with useReducer
 * const reducerFn = useCallback(
 *   (state: FormState<TValues>, action: FormAction<TValues>) =>
 *     formReducer(state, action, initialValues),
 *   [initialValues]
 * );
 * const [formState, dispatch] = useReducer(reducerFn, initialState);
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
  initialValues: TValues
): FormState<TValues> => {
  switch (action.type) {
    case 'SET_FIELD_VALUE': {
      const newValues = setValueByPath(
        state.values,
        action.field,
        action.value
      );

      const newServerErrors = { ...state.serverErrors };
      Object.keys(newServerErrors).forEach((errorPath) => {
        if (isPathAffected(errorPath, action.field)) {
          delete newServerErrors[errorPath];
        }
      });

      return {
        ...state,
        values: newValues,
        serverErrors: newServerErrors,
        isDirty: true,
      };
    }

    case 'SET_VALUES': {
      const newServerErrors = { ...state.serverErrors };
      Object.keys(action.values).forEach((field) => {
        Object.keys(newServerErrors).forEach((errorPath) => {
          if (isPathAffected(errorPath, field)) {
            delete newServerErrors[errorPath];
          }
        });
      });

      return {
        ...state,
        values: { ...state.values, ...action.values },
        serverErrors: newServerErrors,
        isDirty: true,
      };
    }

    case 'SET_FIELD_TOUCHED':
      return {
        ...state,
        touched: {
          ...state.touched,
          [action.field]: action.isTouched,
        },
      };

    case 'SET_CLIENT_ERRORS':
      return {
        ...state,
        clientErrors: action.errors,
      };

    case 'SET_SERVER_ERRORS':
      return {
        ...state,
        serverErrors: action.errors,
      };

    case 'CLEAR_SERVER_ERRORS':
      return {
        ...state,
        serverErrors: {},
      };

    case 'SET_SUBMITTING':
      return {
        ...state,
        isSubmitting: action.isSubmitting,
      };

    case 'SET_VALIDATING':
      return {
        ...state,
        isValidating: action.isValidating,
      };

    case 'SET_FIELD_VALIDATING': {
      const newValidatingFields = { ...state.validatingFields };
      if (action.isValidating) {
        newValidatingFields[action.field] = true;
      } else {
        delete newValidatingFields[action.field];
      }
      return {
        ...state,
        validatingFields: newValidatingFields,
        isValidating: Object.keys(newValidatingFields).length > 0,
      };
    }

    case 'SET_FIELD_ERROR': {
      const newFieldErrors = { ...state.fieldErrors };
      if (action.error) {
        newFieldErrors[action.field] = action.error;
      } else {
        delete newFieldErrors[action.field];
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
        isValidating: false,
        isDirty: false,
      };

    case 'MARK_ALL_TOUCHED': {
      const allTouched: Record<FieldPath, boolean> = {};
      action.fields.forEach((path) => {
        allTouched[path] = true;
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
