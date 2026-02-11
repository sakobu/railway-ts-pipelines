import {
  useReducer,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type FormEvent,
} from 'react';
import { isErr, ok, err, match, type Result } from '@railway-ts/pipelines/result';
import {
  validate,
  formatErrors,
  type MaybeAsyncValidator,
  type ValidationError,
} from '@railway-ts/pipelines/schema';
import { formReducer } from './formReducer';
import { deepMerge, getValueByPath, setValueByPath, collectFieldPaths } from './utils';
import {
  isStandardSchema,
  fromStandardSchema,
  type FormValidator,
} from './standardSchema';
import type {
  ArrayHelpers,
  DeepPartial,
  ExtractFieldPaths,
  FieldPath,
  FormAction,
  NativeCheckboxProps,
  FormOptions,
  NativeSelectProps,
  NativeSliderProps,
  FormState,
  NativeSwitchProps,
  NativeFieldProps,
  GetArrayItemType,
  NativeFileFieldProps,
  NativeRadioGroupOptionProps,
} from './types';
import { createArrayHelpers } from './arrayHelpersFactory';
import {
  createNativeCheckboxProps,
  createNativeSelectFieldProps,
  createNativeSliderProps,
  createNativeSwitchProps,
  createNativeFieldProps,
  createCheckboxGroupOptionProps,
  createNativeFileFieldProps,
  createRadioGroupOptionProps,
} from './fieldPropsFactory';

// =============================================================================
// Main Hook
// =============================================================================

/**
 * A powerful React form hook that combines Railway-oriented validation with native HTML support.
 * Provides type-safe form state management, automatic validation, error handling, and direct
 * integration with native HTML form elements.
 *
 * This hook integrates with @railway-ts/pipelines for functional validation, supports multiple
 * validation modes (live, blur, mount, submit), manages both client and server errors, and
 * provides helpers for working with nested objects and dynamic arrays.
 *
 * @template TValues - The shape of form values as a record with string keys
 *
 * @param validator - Railway-oriented validator (sync or async) from @railway-ts/pipelines that validates form values
 * @param options - Configuration options for form behavior
 * @param options.initialValues - Initial values for form fields (used on mount and reset)
 * @param options.onSubmit - Callback invoked when form is submitted with valid data
 * @param options.validationMode - Controls when validation occurs: "live" | "blur" | "mount" | "submit"
 *
 * @returns An object containing:
 * **Form State:**
 * - `values` - Current form field values (TValues)
 * - `touched` - Record of which fields have been interacted with
 * - `errors` - Combined client and server errors (server takes precedence)
 * - `clientErrors` - Validation errors from the validator function
 * - `serverErrors` - Manually set errors from server responses
 * - `isValid` - Whether the form has no validation errors
 * - `isDirty` - Whether any values have changed from initial state
 * - `isSubmitting` - Whether the form is currently being submitted
 * - `isValidating` - Whether async validation is currently in progress
 *
 * **Field Management:**
 * - `setFieldValue(field, value, shouldValidate?)` - Update a single field
 * - `setFieldTouched(field, isTouched?, shouldValidate?)` - Mark field as touched
 * - `setValues(values, shouldValidate?)` - Update multiple fields at once
 *
 * **Server Error Management:**
 * - `setServerErrors(errors)` - Set server-side validation errors
 * - `clearServerErrors()` - Clear all server-side errors
 *
 * **Form Actions:**
 * - `handleSubmit(e?)` - Validate and submit the form
 * - `resetForm()` - Reset form to initial values and clear errors
 * - `validateForm(values)` - Manually trigger validation
 *
 * **Native HTML Integration:**
 * - `getFieldProps(field)` - Props for text inputs, email, textarea, etc.
 * - `getSelectFieldProps(field)` - Props for select elements
 * - `getCheckboxProps(field)` - Props for boolean checkboxes
 * - `getSwitchProps(field)` - Props for toggle switches
 * - `getSliderProps(field)` - Props for range inputs
 * - `getCheckboxGroupOptionProps(field, value)` - Props for checkbox groups (arrays)
 * - `getFileFieldProps(field)` - Props for file inputs
 * - `getRadioGroupOptionProps(field, value)` - Props for radio groups
 *
 * **Array Field Helpers:**
 * - `arrayHelpers(field)` - Get helpers for managing array fields (push, remove, swap, etc.)
 *
 * @example
 * // Basic usage with validation
 * const form = useForm(userValidator, {
 *   initialValues: { name: "", email: "", age: 0 },
 *   onSubmit: async (values) => {
 *     await api.createUser(values);
 *   },
 *   validationMode: "live"
 * });
 *
 * @example
 * // Render with native HTML elements
 * <form onSubmit={form.handleSubmit}>
 *   <input type="text" {...form.getFieldProps("name")} />
 *   {form.touched.name && form.errors.name && <span>{form.errors.name}</span>}
 *
 *   <input type="email" {...form.getFieldProps("email")} />
 *   {form.touched.email && form.errors.email && <span>{form.errors.email}</span>}
 *
 *   <button type="submit" disabled={!form.isValid || form.isSubmitting}>
 *     {form.isSubmitting ? "Submitting..." : "Submit"}
 *   </button>
 * </form>
 *
 * @example
 * // Handle server errors
 * const form = useForm(userValidator, {
 *   onSubmit: async (values) => {
 *     const response = await api.createUser(values);
 *     if (!response.ok) {
 *       const errors = await response.json();
 *       form.setServerErrors(errors);
 *     }
 *   }
 * });
 *
 * @example
 * // Working with arrays
 * const form = useForm(contactsValidator, {
 *   initialValues: { contacts: [] }
 * });
 *
 * const contactsHelpers = form.arrayHelpers("contacts");
 * return (
 *   <div>
 *     {contactsHelpers.values.map((_, index) => (
 *       <div key={index}>
 *         <input {...contactsHelpers.getFieldProps(index, "name")} />
 *         <input {...contactsHelpers.getFieldProps(index, "email")} />
 *         <button onClick={() => contactsHelpers.remove(index)}>Remove</button>
 *       </div>
 *     ))}
 *     <button onClick={() => contactsHelpers.push({ name: "", email: "" })}>
 *       Add Contact
 *     </button>
 *   </div>
 * );
 */
export const useForm = <TValues extends Record<string, unknown>>(
  validatorOrSchema: FormValidator<TValues>,
  options: FormOptions<TValues>
) => {
  const { initialValues, onSubmit, validationMode, fieldValidators } = options;

  // Normalize: if a Standard Schema v1 object was passed, adapt it into a MaybeAsyncValidator.
  // useMemo ensures referential stability since fromStandardSchema creates a new function.
  const validator: MaybeAsyncValidator<unknown, TValues> = useMemo(
    () =>
      isStandardSchema(validatorOrSchema)
        ? fromStandardSchema(validatorOrSchema)
        : validatorOrSchema,
    [validatorOrSchema],
  );

  // Derive behavior flags from validationMode
  const mode = validationMode ?? 'live';
  const validateOnChange = mode === 'live';
  const validateOnBlur = mode === 'live' || mode === 'blur';
  const validateOnMount = mode === 'mount';
  const touchOnChange = mode === 'live';

  // ===========================================================================
  // Reducer Setup
  // ===========================================================================

  // Create a memoized reducer that captures initialValues
  const reducerFn = useCallback(
    (state: FormState<TValues>, action: FormAction<TValues>) =>
      formReducer(state, action, initialValues),
    [initialValues]
  );

  // Initial state
  const initialState: FormState<TValues> = {
    values: initialValues,
    touched: {},
    clientErrors: {},
    serverErrors: {},
    fieldErrors: {},
    validatingFields: {},
    isSubmitting: false,
    isFormValidating: false,
    submitCount: 0,
    isDirty: false,
  };

  // Initialize the reducer
  const [formState, dispatch] = useReducer(reducerFn, initialState);

  // Ref to access latest formState inside stable callbacks without re-creating them
  const formStateRef = useRef(formState);
  useEffect(() => {
    formStateRef.current = formState;
  });

  // Sequence counter for race condition protection on async validation
  const validationSeqRef = useRef(0);

  // Per-field sequence counters for race condition protection on field-level async validation
  const fieldValidationSeqRef = useRef<Record<string, number>>({});

  // ===========================================================================
  // Computed State
  // ===========================================================================

  // Combined errors from client, field validators, and server (server > field > client)
  const errors = useMemo(() => {
    const combined: Record<FieldPath, string> = {};

    // Schema errors (base)
    Object.entries(formState.clientErrors).forEach(([path, msg]) => {
      combined[path] = msg;
    });

    // Field validator errors (override schema for same field)
    Object.entries(formState.fieldErrors).forEach(([path, msg]) => {
      combined[path] = msg;
    });

    // Server errors (highest priority)
    Object.entries(formState.serverErrors).forEach(([path, msg]) => {
      combined[path] = msg;
    });

    return combined;
  }, [formState.clientErrors, formState.fieldErrors, formState.serverErrors]);

  // Form is valid when there are no errors of any kind
  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);

  // Derived: true when any async validation (form-level or field-level) is running
  const isValidating = useMemo(
    () => formState.isFormValidating || Object.keys(formState.validatingFields).length > 0,
    [formState.isFormValidating, formState.validatingFields]
  );

  // ===========================================================================
  // Validation Functions
  // ===========================================================================

  /**
   * Dispatches the validation result to update client errors.
   * Shared by both sync and async validation paths.
   */
  const dispatchValidationResult = useCallback(
    (result: Result<TValues, ValidationError[]>) => {
      if (isErr(result)) {
        dispatch({
          type: 'SET_CLIENT_ERRORS',
          errors: formatErrors(result.error),
        });
      } else {
        dispatch({
          type: 'SET_CLIENT_ERRORS',
          errors: {},
        });
      }
    },
    []
  );

  /**
   * Validates the current form values using the Railway-oriented validator and updates error state.
   * Accepts both sync and async validators (MaybeAsyncValidator).
   *
   * - When the validator is sync, returns `Result<TValues, ValidationError[]>` immediately.
   * - When the validator is async, returns `Promise<Result<TValues, ValidationError[]>>`.
   *   A sequence counter protects against race conditions: only the latest async validation
   *   result dispatches state updates.
   *
   * @param values - The form values to validate (usually form.values)
   * @returns Railway Result or Promise<Result> depending on the validator
   */
  const validateForm = useCallback(
    (
      values: TValues,
    ): Result<TValues, ValidationError[]> | Promise<Result<TValues, ValidationError[]>> => {
      const validationResult = validate(values, validator);

      if (validationResult instanceof Promise) {
        const seq = ++validationSeqRef.current;
        dispatch({ type: 'SET_FORM_VALIDATING', isFormValidating: true });

        return validationResult.then((result) => {
          // Only dispatch if this is still the latest validation
          if (seq === validationSeqRef.current) {
            dispatchValidationResult(result);
            dispatch({ type: 'SET_FORM_VALIDATING', isFormValidating: false });
          }
          return result;
        });
      }

      // Sync path — no race conditions possible
      dispatchValidationResult(validationResult);
      return validationResult;
    },
    [validator, dispatchValidationResult],
  );

  /**
   * Runs a single field's validator with per-field race condition protection.
   * Only runs when the field has a registered fieldValidator.
   */
  const runFieldValidator = useCallback(
    (field: FieldPath, values: TValues): void => {
      const validatorFn = fieldValidators?.[field as ExtractFieldPaths<TValues>];
      if (!validatorFn) return;

      dispatch({ type: 'SET_FIELD_ERROR', field, error: undefined });

      const fieldValue = getValueByPath(values, field);
      const result = validatorFn(fieldValue, values);

      if (result instanceof Promise) {
        if (!fieldValidationSeqRef.current[field]) {
          fieldValidationSeqRef.current[field] = 0;
        }
        const seq = ++fieldValidationSeqRef.current[field];
        dispatch({ type: 'SET_FIELD_VALIDATING', field, isValidating: true });

        void result.then((error) => {
          if (seq === fieldValidationSeqRef.current[field]) {
            dispatch({ type: 'SET_FIELD_ERROR', field, error });
            dispatch({ type: 'SET_FIELD_VALIDATING', field, isValidating: false });
          }
        });
      } else {
        dispatch({ type: 'SET_FIELD_ERROR', field, error: result });
      }
    },
    [fieldValidators],
  );

  /**
   * Runs schema validation followed by field-level validation for a single field.
   * If the schema produces an error for the field, the field validator is skipped.
   */
  const runValidationPipeline = useCallback(
    (field: FieldPath, values: TValues): void => {
      const schemaResult = validateForm(values);

      if (fieldValidators?.[field as ExtractFieldPaths<TValues>]) {
        const afterSchema = (result: Result<TValues, ValidationError[]>) => {
          const schemaErrors = isErr(result) ? formatErrors(result.error) : {};
          if (!schemaErrors[field]) {
            runFieldValidator(field, values);
          } else {
            dispatch({ type: 'SET_FIELD_ERROR', field, error: undefined });
            dispatch({ type: 'SET_FIELD_VALIDATING', field, isValidating: false });
          }
        };

        if (schemaResult instanceof Promise) {
          void schemaResult.then(afterSchema);
        } else {
          afterSchema(schemaResult);
        }
      }
    },
    [validateForm, fieldValidators, runFieldValidator],
  );

  // Validate on mount if enabled
  const didMountRef = useRef(false);
  useEffect(() => {
    if (validateOnMount && !didMountRef.current) {
      didMountRef.current = true;
      void validateForm(initialValues);

      // Also mark all fields as touched (including nested and array items)
      const allFields = collectFieldPaths(
        initialValues as Record<string, unknown>
      );
      dispatch({
        type: 'MARK_ALL_TOUCHED',
        fields: allFields,
      });
    }
  }, [initialValues, validateForm, validateOnMount]);

  // ===========================================================================
  // Field Management Functions
  // ===========================================================================

  /**
   * Updates a single field value and optionally triggers validation.
   * Automatically marks the field as touched (in "live" mode) and clears related server errors.
   *
   * @template TValue - The type of the value being set
   * @param field - The field path (supports dot notation and bracket notation)
   * @param value - The new value for the field
   * @param shouldValidate - Whether to trigger validation after update (default: depends on validationMode)
   *
   * @example
   * // Update a field programmatically
   * form.setFieldValue("email", "user@example.com");
   *
   * @example
   * // Update without triggering validation
   * form.setFieldValue("username", "newuser", false);
   *
   * @example
   * // Update nested field
   * form.setFieldValue("address.city", "San Francisco");
   *
   * @example
   * // Use in a custom input handler
   * const handleCustomChange = (value: string) => {
   *   const formatted = value.toUpperCase();
   *   form.setFieldValue("code", formatted);
   * };
   */
  const setFieldValue = useCallback(
    <TValue>(
      field: FieldPath,
      value: TValue,
      shouldValidate = validateOnChange
    ): void => {
      // Calculate updated values first
      const updatedValues = setValueByPath<TValues, TValue>(
        formState.values,
        field,
        value
      );

      // Dispatch state update
      dispatch({
        type: 'SET_FIELD_VALUE',
        field,
        value,
      });

      // Mark touched on first change for immediate error visibility
      if (touchOnChange && !formState.touched[field]) {
        dispatch({ type: 'SET_FIELD_TOUCHED', field, isTouched: true });
      }

      // Validate with calculated values if needed
      if (shouldValidate) {
        runValidationPipeline(field, updatedValues);
      }
    },
    [
      formState.values,
      formState.touched,
      validateOnChange,
      touchOnChange,
      runValidationPipeline,
    ]
  );

  /**
   * Updates multiple field values simultaneously and optionally triggers validation.
   * More efficient than calling setFieldValue multiple times when updating several fields.
   * Automatically clears server errors for affected fields.
   *
   * @param newValues - Partial object containing the fields to update
   * @param shouldValidate - Whether to trigger validation after update (default: depends on validationMode)
   *
   * @example
   * // Update multiple fields at once
   * form.setValues({
   *   firstName: "John",
   *   lastName: "Doe",
   *   email: "john@example.com"
   * });
   *
   * @example
   * // Update without validation
   * form.setValues({ theme: "dark", language: "en" }, false);
   *
   * @example
   * // Populate form from API response
   * const loadUser = async (id: string) => {
   *   const user = await api.getUser(id);
   *   form.setValues(user);
   * };
   */
  const setValues = useCallback(
    (newValues: DeepPartial<TValues>, shouldValidate = validateOnChange): void => {
      dispatch({
        type: 'SET_VALUES',
        values: newValues,
      });

      if (shouldValidate) {
        // Need to get latest state for validation
        const updatedValues = deepMerge(formState.values, newValues);
        void validateForm(updatedValues);
      }
    },
    [formState.values, validateOnChange, validateForm]
  );

  /**
   * Marks a field as touched or untouched and optionally triggers validation.
   * Touched fields typically display their validation errors to the user.
   *
   * @param field - The field path to mark
   * @param isTouched - Whether the field should be marked as touched (default: true)
   * @param shouldValidate - Whether to trigger validation after update (default: depends on validationMode)
   *
   * @example
   * // Mark a field as touched (will show validation errors)
   * form.setFieldTouched("email");
   *
   * @example
   * // Mark as untouched (hide validation errors)
   * form.setFieldTouched("password", false);
   *
   * @example
   * // Use in custom blur handler
   * const handleCustomBlur = () => {
   *   form.setFieldTouched("username", true);
   *   // Additional custom logic
   * };
   */
  const setFieldTouched = useCallback(
    (
      field: FieldPath,
      isTouched = true,
      shouldValidate = validateOnBlur
    ): void => {
      dispatch({
        type: 'SET_FIELD_TOUCHED',
        field,
        isTouched,
      });

      if (shouldValidate) {
        if (!validateOnChange) {
          // In non-live modes, run field validators on blur
          runValidationPipeline(field, formState.values);
        } else {
          // In live mode, field validators already ran on change — only re-run schema
          void validateForm(formState.values);
        }
      }
    },
    [formState.values, validateOnBlur, validateOnChange, validateForm, runValidationPipeline]
  );

  // ===========================================================================
  // Server Error Management
  // ===========================================================================

  /**
   * Sets server-side validation errors received from API responses.
   * These errors take precedence over client-side errors in the merged `errors` object.
   * Server errors are automatically cleared when the related field value changes.
   *
   * @param serverErrors - Map of field paths to error messages from server
   *
   * @example
   * // Handle server validation errors
   * const form = useForm(userValidator, {
   *   onSubmit: async (values) => {
   *     const response = await fetch("/api/users", {
   *       method: "POST",
   *       body: JSON.stringify(values)
   *     });
   *
   *     if (!response.ok) {
   *       const errors = await response.json();
   *       form.setServerErrors({
   *         "email": "Email already taken",
   *         "username": "Username not available"
   *       });
   *       return;
   *     }
   *   }
   * });
   *
   * @example
   * // Set a single server error
   * form.setServerErrors({ "email": "This email is already registered" });
   */
  const setServerErrors = useCallback(
    (serverErrors: Record<FieldPath, string>): void => {
      dispatch({
        type: 'SET_SERVER_ERRORS',
        errors: serverErrors,
      });
    },
    []
  );

  /**
   * Clears all server-side validation errors.
   * Client-side validation errors are not affected.
   * Server errors are also automatically cleared when field values change.
   *
   * @example
   * // Clear server errors when user starts editing
   * const handleRetry = () => {
   *   form.clearServerErrors();
   *   // User can now resubmit
   * };
   *
   * @example
   * // Clear before resubmitting
   * const handleResubmit = () => {
   *   form.clearServerErrors();
   *   form.handleSubmit();
   * };
   */
  const clearServerErrors = useCallback((): void => {
    dispatch({
      type: 'CLEAR_SERVER_ERRORS',
    });
  }, []);

  // ===========================================================================
  // Form Action Functions
  // ===========================================================================

  /**
   * Handles form submission using the Railway-oriented programming pattern.
   * Validates all fields, marks them as touched, and calls onSubmit if validation passes.
   * Returns a Promise that resolves to either the validated data or validation errors.
   *
   * @param e - Optional form event (will preventDefault if provided)
   * @returns Promise<Result<TValues, ValidationError[]>> - Railway Result with validated data or errors
   *
   * @example
   * // Use in form element
   * <form onSubmit={form.handleSubmit}>
   *   <input {...form.getFieldProps("email")} />
   *   <button type="submit">Submit</button>
   * </form>
   *
   * @example
   * // Use in button click handler
   * <button onClick={form.handleSubmit}>
   *   Save Changes
   * </button>
   *
   * @example
   * // Handle result programmatically with Railway pattern
   * import { match } from "@railway-ts/pipelines/result";
   *
   * const handleSave = async () => {
   *   const result = await form.handleSubmit();
   *   match(result, {
   *     ok: (values) => {
   *       console.log("Form submitted:", values);
   *       navigate("/success");
   *     },
   *     err: (errors) => {
   *       console.error("Validation errors:", errors);
   *     },
   *   });
   * };
   */
  const handleSubmit = useCallback(
    async (e?: FormEvent): Promise<Result<TValues, ValidationError[]>> => {
      const { values, clientErrors, serverErrors } = formStateRef.current;

      if (e) {
        e.preventDefault();
      }

      // Mark all fields and error paths as touched (deep)
      const valuePaths = collectFieldPaths(
        values as Record<string, unknown>
      );
      const allPaths = Array.from(
        new Set([
          ...valuePaths,
          ...Object.keys(clientErrors),
          ...Object.keys(serverErrors),
        ])
      );

      dispatch({
        type: 'MARK_ALL_TOUCHED',
        fields: allPaths,
      });

      dispatch({
        type: 'SET_SUBMITTING',
        isSubmitting: true,
      });

      // Clear any existing server errors
      dispatch({
        type: 'CLEAR_SERVER_ERRORS',
      });

      // Validate the form (await handles both sync and async validators)
      const validationResult = await validate(values, validator);

      // Handle result using Railway pattern
      return match<
        TValues,
        ValidationError[],
        Promise<Result<TValues, ValidationError[]>>
      >(validationResult, {
        ok: async (validData) => {
          // Run all field validators in parallel before calling onSubmit
          if (fieldValidators) {
            const fieldEntries = Object.entries(fieldValidators) as Array<
              [string, (value: unknown, values: TValues) => string | undefined | Promise<string | undefined>]
            >;

            const fieldResults = await Promise.all(
              fieldEntries.map(async ([field, validatorFn]) => {
                const fieldValue = getValueByPath(values, field);
                const error = await validatorFn(fieldValue, values);
                if (error) {
                  dispatch({ type: 'SET_FIELD_ERROR', field, error });
                } else {
                  dispatch({ type: 'SET_FIELD_ERROR', field, error: undefined });
                }
                return { field, error };
              })
            );

            const hasFieldErrors = fieldResults.some((r) => r.error);
            if (hasFieldErrors) {
              dispatch({
                type: 'SET_SUBMITTING',
                isSubmitting: false,
              });
              return err(
                fieldResults
                  .filter((r) => r.error)
                  .map((r) => ({ path: [r.field], message: r.error! }))
              );
            }
          }

          if (onSubmit) {
            try {
              await onSubmit(validData);
            } catch (error) {
              console.error('Form submission error:', error);
            }
          }

          dispatch({
            type: 'SET_SUBMITTING',
            isSubmitting: false,
          });

          return ok(validData);
        },
        err: (errors) => {
          dispatch({
            type: 'SET_CLIENT_ERRORS',
            errors: formatErrors(errors),
          });

          dispatch({
            type: 'SET_SUBMITTING',
            isSubmitting: false,
          });

          return Promise.resolve(err(errors));
        },
      });
    },
    [validator, onSubmit, fieldValidators]
  );

  /**
   * Resets the form to its initial state.
   * Clears all values (back to initialValues), errors, and touched state.
   * If validationMode is "mount", triggers validation after reset.
   *
   * @example
   * // Reset after successful submission
   * const form = useForm(userValidator, {
   *   onSubmit: async (values) => {
   *     await api.createUser(values);
   *     form.resetForm(); // Clear form after success
   *   }
   * });
   *
   * @example
   * // Cancel button
   * <button type="button" onClick={form.resetForm}>
   *   Cancel
   * </button>
   *
   * @example
   * // Reset with confirmation
   * const handleReset = () => {
   *   if (form.isDirty && !confirm("Discard changes?")) {
   *     return;
   *   }
   *   form.resetForm();
   * };
   */
  const resetForm = useCallback((): void => {
    dispatch({
      type: 'RESET_FORM',
    });

    if (validateOnMount) {
      void validateForm(initialValues);
    }
  }, [initialValues, validateForm, validateOnMount]);

  // ===========================================================================
  // Native HTML Integration
  // ===========================================================================

  /**
   * Returns props to bind a native text input, email input, or textarea to a form field.
   * Provides type-safe autocomplete for valid field paths.
   * The returned object can be spread directly onto native HTML elements.
   *
   * @template TField - The field path type (auto-inferred with autocomplete)
   * @param field - The field path (with type-safe autocomplete)
   * @returns NativeFieldProps - Object with id, name, value, onChange, onBlur
   *
   * @example
   * // Text input
   * <input type="text" {...form.getFieldProps("username")} placeholder="Username" />
   *
   * @example
   * // Email input
   * <input type="email" {...form.getFieldProps("email")} required />
   *
   * @example
   * // Textarea
   * <textarea {...form.getFieldProps("bio")} rows={4} />
   *
   * @example
   * // Nested field
   * <input type="text" {...form.getFieldProps("address.city")} />
   */
  const getFieldProps = useCallback(
    <TField extends ExtractFieldPaths<TValues>>(
      field: TField
    ): NativeFieldProps => {
      return createNativeFieldProps(
        field as FieldPath,
        formState.values,
        setFieldValue,
        setFieldTouched
      );
    },
    [formState.values, setFieldValue, setFieldTouched]
  );

  /**
   * Returns props to bind a native select element to a form field.
   * Provides type-safe autocomplete for valid field paths.
   *
   * @template TField - The field path type (auto-inferred with autocomplete)
   * @param field - The field path (with type-safe autocomplete)
   * @returns NativeSelectProps - Object with id, name, value, onChange, onBlur
   *
   * @example
   * <select {...form.getSelectFieldProps("country")}>
   *   <option value="">Select a country</option>
   *   <option value="US">United States</option>
   *   <option value="CA">Canada</option>
   * </select>
   */
  const getSelectFieldProps = useCallback(
    <TField extends ExtractFieldPaths<TValues>>(
      field: TField
    ): NativeSelectProps => {
      return createNativeSelectFieldProps(
        field as FieldPath,
        formState.values,
        setFieldValue,
        setFieldTouched
      );
    },
    [formState.values, setFieldValue, setFieldTouched]
  );

  /**
   * Returns props to bind a native checkbox input to a boolean form field.
   * Provides type-safe autocomplete for valid field paths.
   *
   * @template TField - The field path type (auto-inferred with autocomplete)
   * @param field - The field path (with type-safe autocomplete)
   * @returns NativeCheckboxProps - Object with id, name, checked, onChange, onBlur
   *
   * @example
   * <label>
   *   <input type="checkbox" {...form.getCheckboxProps("acceptTerms")} />
   *   I accept the terms and conditions
   * </label>
   */
  const getCheckboxProps = useCallback(
    <TField extends ExtractFieldPaths<TValues>>(
      field: TField
    ): NativeCheckboxProps => {
      return createNativeCheckboxProps(
        field as FieldPath,
        formState.values,
        setFieldValue,
        setFieldTouched
      );
    },
    [formState.values, setFieldValue, setFieldTouched]
  );

  /**
   * Returns props to bind a native switch (checkbox styled as toggle) to a boolean form field.
   * Provides type-safe autocomplete for valid field paths.
   *
   * @template TField - The field path type (auto-inferred with autocomplete)
   * @param field - The field path (with type-safe autocomplete)
   * @returns NativeSwitchProps - Object with id, name, checked, onChange, onBlur
   *
   * @example
   * <label className="switch">
   *   <input type="checkbox" {...form.getSwitchProps("settings.darkMode")} />
   *   <span className="slider"></span>
   * </label>
   */
  const getSwitchProps = useCallback(
    <TField extends ExtractFieldPaths<TValues>>(
      field: TField
    ): NativeSwitchProps => {
      return createNativeSwitchProps(
        field as FieldPath,
        formState.values,
        setFieldValue,
        setFieldTouched
      );
    },
    [formState.values, setFieldValue, setFieldTouched]
  );

  /**
   * Returns props to bind a native range input to a numeric form field.
   * Provides type-safe autocomplete for valid field paths.
   * Note: Native range inputs only support single numeric values, not arrays.
   *
   * @template TField - The field path type (auto-inferred with autocomplete)
   * @param field - The field path (with type-safe autocomplete)
   * @returns NativeSliderProps - Object with id, name, type, value, onChange, onBlur
   *
   * @example
   * <div>
   *   <label>Volume: {form.values.volume}%</label>
   *   <input type="range" min={0} max={100} {...form.getSliderProps("volume")} />
   * </div>
   */
  const getSliderProps = useCallback(
    <TField extends ExtractFieldPaths<TValues>>(
      field: TField
    ): NativeSliderProps => {
      return createNativeSliderProps(
        field as FieldPath,
        formState.values,
        setFieldValue,
        setFieldTouched
      );
    },
    [formState.values, setFieldValue, setFieldTouched]
  );

  /**
   * Returns props for a single checkbox within a checkbox group bound to an array field.
   * Checking the box adds the value to the array; unchecking removes it.
   * Provides type-safe autocomplete for valid field paths.
   *
   * @template TField - The field path type (auto-inferred with autocomplete)
   * @param field - The field path (with type-safe autocomplete)
   * @param optionValue - The value this checkbox represents
   * @returns NativeCheckboxGroupOptionProps - Object with id, name, value, checked, onChange, onBlur
   *
   * @example
   * <label>
   *   <input type="checkbox" {...form.getCheckboxGroupOptionProps("interests", "sports")} />
   *   Sports
   * </label>
   * <label>
   *   <input type="checkbox" {...form.getCheckboxGroupOptionProps("interests", "music")} />
   *   Music
   * </label>
   */
  const getCheckboxGroupOptionProps = useCallback(
    <TField extends ExtractFieldPaths<TValues>>(
      field: TField,
      optionValue: string | number
    ) => {
      return createCheckboxGroupOptionProps(
        field as FieldPath,
        optionValue,
        formState.values,
        setFieldValue,
        setFieldTouched
      );
    },
    [formState.values, setFieldValue, setFieldTouched]
  );

  /**
   * Returns props to bind a native file input to a form field.
   * Provides type-safe autocomplete for valid field paths.
   * Supports both single and multiple file selection.
   *
   * @template TField - The field path type (auto-inferred with autocomplete)
   * @param field - The field path (with type-safe autocomplete)
   * @returns NativeFileFieldProps - Object with id, name, onChange, onBlur
   *
   * @example
   * // Single file
   * <input type="file" accept="image/*" {...form.getFileFieldProps("avatar")} />
   *
   * @example
   * // Multiple files
   * <input type="file" multiple {...form.getFileFieldProps("documents")} />
   */
  const getFileFieldProps = useCallback(
    <TField extends ExtractFieldPaths<TValues>>(
      field: TField
    ): NativeFileFieldProps => {
      return createNativeFileFieldProps(
        field as FieldPath,
        formState.values,
        setFieldValue,
        setFieldTouched
      );
    },
    [formState.values, setFieldValue, setFieldTouched]
  );

  /**
   * Returns props for a single radio button within a radio group bound to a scalar field.
   * Only one radio button in the group can be selected at a time.
   * Provides type-safe autocomplete for valid field paths.
   *
   * @template TField - The field path type (auto-inferred with autocomplete)
   * @param field - The field path (with type-safe autocomplete)
   * @param optionValue - The value this radio button represents
   * @returns NativeRadioGroupOptionProps - Object with id, name, value, checked, onChange, onBlur
   *
   * @example
   * <label>
   *   <input type="radio" {...form.getRadioGroupOptionProps("contactMethod", "email")} />
   *   Email
   * </label>
   * <label>
   *   <input type="radio" {...form.getRadioGroupOptionProps("contactMethod", "phone")} />
   *   Phone
   * </label>
   */
  const getRadioGroupOptionProps = useCallback(
    <TField extends ExtractFieldPaths<TValues>>(
      field: TField,
      optionValue: string | number
    ): NativeRadioGroupOptionProps => {
      return createRadioGroupOptionProps(
        field as FieldPath,
        optionValue,
        formState.values,
        setFieldValue,
        setFieldTouched
      );
    },
    [formState.values, setFieldValue, setFieldTouched]
  );

  // ===========================================================================
  // Array Field Helpers
  // ===========================================================================

  /**
   * Returns helper functions for managing array fields with type-safe operations.
   * Provides methods to add, remove, reorder, and bind HTML elements to array items.
   * Automatically infers item types and provides autocomplete for nested field paths.
   *
   * @template TItem - The type of items in the array (auto-inferred from field)
   * @param field - The path to the array field
   * @returns ArrayHelpers<TItem> - Object with array manipulation methods and field binding helpers
   *
   * @example
   * // Basic array operations
   * const form = useForm(contactsValidator, {
   *   initialValues: { contacts: [] }
   * });
   * const helpers = form.arrayHelpers("contacts");
   *
   * // Add new item
   * <button onClick={() => helpers.push({ name: "", email: "" })}>
   *   Add Contact
   * </button>
   *
   * @example
   * // Render array items with field binding
   * const helpers = form.arrayHelpers("addresses");
   * return (
   *   <div>
   *     {helpers.values.map((address, index) => (
   *       <div key={index}>
   *         <input {...helpers.getFieldProps(index, "street")} placeholder="Street" />
   *         <input {...helpers.getFieldProps(index, "city")} placeholder="City" />
   *         <button onClick={() => helpers.remove(index)}>Remove</button>
   *       </div>
   *     ))}
   *     <button onClick={() => helpers.push({ street: "", city: "" })}>
   *       Add Address
   *     </button>
   *   </div>
   * );
   *
   * @example
   * // Reorder items (drag and drop)
   * const handleMoveUp = (index: number) => {
   *   if (index > 0) {
   *     helpers.swap(index, index - 1);
   *   }
   * };
   *
   * @example
   * // Replace an entire item
   * const handleUpdate = (index: number) => {
   *   helpers.replace(index, { name: "Updated", email: "new@example.com" });
   * };
   */
  const arrayHelpersImpl = useCallback(
    <TItem = unknown>(
      field: string
    ): ArrayHelpers<TItem, ExtractFieldPaths<TItem>> => {
      // Local path-based wrappers to avoid generic casts
      const getFieldPropsAtPath = (path: string) =>
        createNativeFieldProps(
          path,
          formState.values,
          setFieldValue,
          setFieldTouched
        );

      const getSelectFieldPropsAtPath = (path: string) =>
        createNativeSelectFieldProps(
          path,
          formState.values,
          setFieldValue,
          setFieldTouched
        );

      const getSliderPropsAtPath = (path: string) =>
        createNativeSliderProps(
          path,
          formState.values,
          setFieldValue,
          setFieldTouched
        );

      const getCheckboxPropsAtPath = (path: string) =>
        createNativeCheckboxProps(
          path,
          formState.values,
          setFieldValue,
          setFieldTouched
        );

      const getSwitchPropsAtPath = (path: string) =>
        createNativeSwitchProps(
          path,
          formState.values,
          setFieldValue,
          setFieldTouched
        );

      const getFileFieldPropsAtPath = (path: string) =>
        createNativeFileFieldProps(
          path,
          formState.values,
          setFieldValue,
          setFieldTouched
        );

      const getRadioGroupOptionPropsAtPath = (
        path: string,
        opt: string | number
      ) =>
        createRadioGroupOptionProps(
          path,
          opt,
          formState.values,
          setFieldValue,
          setFieldTouched
        );

      const arrayValue =
        getValueByPath<TValues, TItem[]>(formState.values, field) ||
        [];

      return createArrayHelpers<TItem, ExtractFieldPaths<TItem>>(
        field,
        arrayValue,
        setFieldValue,
        getFieldPropsAtPath,
        getSelectFieldPropsAtPath,
        getSliderPropsAtPath,
        getCheckboxPropsAtPath,
        getSwitchPropsAtPath,
        getFileFieldPropsAtPath,
        getRadioGroupOptionPropsAtPath
      );
    },
    [formState.values, setFieldValue, setFieldTouched]
  );

  // Overloaded wrapper for better type inference
  const arrayHelpers = arrayHelpersImpl as {
    <TField extends keyof TValues & string>(
      field: TField
    ): ArrayHelpers<
      GetArrayItemType<TValues, TField>,
      ExtractFieldPaths<GetArrayItemType<TValues, TField>>
    >;
    <TField extends ExtractFieldPaths<TValues>, TItem = unknown>(
      field: TField
    ): ArrayHelpers<TItem, ExtractFieldPaths<TItem>>;
  };

  // ===========================================================================
  // Return
  // ===========================================================================

  return {
    // Form state
    values: formState.values,
    touched: formState.touched,
    errors,
    clientErrors: formState.clientErrors,
    serverErrors: formState.serverErrors,
    isSubmitting: formState.isSubmitting,
    isValidating,
    validatingFields: formState.validatingFields,
    isValid,
    isDirty: formState.isDirty,
    submitCount: formState.submitCount,

    // Field management
    setFieldValue,
    setFieldTouched,
    setValues,

    // Server error management
    setServerErrors,
    clearServerErrors,

    // Form actions
    handleSubmit,
    resetForm,
    validateForm,

    // Native HTML field integration
    getFieldProps,
    getSelectFieldProps,
    getCheckboxProps,
    getSwitchProps,
    getSliderProps,
    getCheckboxGroupOptionProps,
    getFileFieldProps,
    getRadioGroupOptionProps,

    // Array field helpers
    arrayHelpers,
  };
};
