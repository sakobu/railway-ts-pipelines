import { isErr, isResult, ok, err, type Result } from '@railway-ts/pipelines/result';
import {
  validate,
  formatErrors,
  ROOT_ERROR_KEY,
  type MaybeAsyncValidator,
  type ValidationError,
} from '@railway-ts/pipelines/schema';
import {
  useCallback,
  useMemo,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type SyntheticEvent,
} from 'react';

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
import { createInitialFormState, formReducer } from './formReducer';
import { createFormStore } from './formStore';
import { createStabilityCheck } from './stabilityCheck';
import { isStandardSchema, fromStandardSchema, type FormValidator } from './standardSchema';
import { createSubmitScheduler } from './submitScheduler';
import {
  deepEqual,
  getValueByPath,
  collectFieldPaths,
  isPathAffected,
  normalizePath,
  normalizePathKeys,
} from './utils';

import type {
  ArrayHelpers,
  DeepPartial,
  ExtractFieldPaths,
  FieldPath,
  NativeCheckboxProps,
  NativeCheckboxGroupOptionProps,
  FormAction,
  FormOptions,
  FormState,
  NativeSelectProps,
  NativeSliderProps,
  NativeSwitchProps,
  NativeFieldProps,
  NativeFileFieldProps,
  NativeRadioGroupOptionProps,
  UseFormReturn,
} from './types';

/** The submit error for a submission that threw, or whose `onSubmit` returned neither a `Result` nor nothing. */
const SUBMIT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/** The submit error for a save cancelled before `onSubmit`, because it would overwrite a newer version. */
const CHANGED_WHILE_SAVING_MESSAGE =
  'The record changed while saving, so nothing was saved. Review the latest version and save again.';

/** Logged once per form when initialValues keeps changing along with the form's own state. */
const UNSTABLE_INITIAL_VALUES_MESSAGE =
  "useForm: initialValues or resetKey keeps changing along with the form's own state. " +
  "It's probably built from something that changes on its own, such as crypto.randomUUID(), new Date() or storage read during render, " +
  'or holds a Set, Map or Temporal value built anew on every render. ' +
  'Create generated values once, at module scope or with useState(() => …). ' +
  'A Set, Map or Temporal value compares by identity, so build it with useMemo, keyed on the data it comes from, ' +
  'or use an array or plain object.';

/**
 * Takes the next validation number for a field. A check whose number is no longer the field's latest doesn't land.
 *
 * @param seqs - The latest number of each field, by normalized path
 * @param key - The field's normalized path
 * @returns The number the new check holds
 */
const takeNextFieldSeq = (seqs: Record<FieldPath, number>, key: FieldPath): number => {
  const seq = (seqs[key] ?? 0) + 1;
  seqs[key] = seq;
  return seq;
};

/**
 * Places server errors on the form: an error at path `[]` becomes the submit error, and every other
 * error goes on its path, marked touched so it shows.
 *
 * @param send - Dispatches each write, or drops it when the errors no longer belong to the form's state
 * @param errors - Server validation errors, each with a `path` and a `message`
 */
const placeErrorsWith = <TValues extends Record<string, unknown>>(
  send: (action: FormAction<TValues>) => void,
  errors: ValidationError[],
): void => {
  const { [ROOT_ERROR_KEY]: submitError, ...perPath } = formatErrors(errors);
  send({
    type: 'SET_SERVER_ERRORS',
    errors: perPath,
    ...(submitError !== undefined && { submitError }),
  });
  send({
    type: 'MARK_ALL_TOUCHED',
    fields: Object.keys(perPath),
  });
};

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
 * @template TResult - The value `handleSubmit` resolves to on success: `onSubmit`'s `ok` value, or the form values
 *
 * @param validator - Railway-oriented validator (sync or async) from @railway-ts/pipelines that validates form values
 * @param options - Configuration options for form behavior
 * @param options.initialValues - Initial values. The form follows new ones while it has no unsaved edits.
 * @param options.resetKey - Identifies the record the form edits. A change starts the form over, as if remounted.
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
 * - `isDirty` - Whether the values differ from the current `initialValues`
 * - `isStale` - Whether a newer `initialValues` arrived that the form didn't follow, because it has unsaved edits
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
 * // Handle server errors: return err to place them on the form, ok to succeed
 * const form = useForm(userValidator, {
 *   initialValues: { name: "", email: "", age: 0 },
 *   onSubmit: async (values) => {
 *     const response = await api.createUser(values);
 *     if (!response.ok) return err((await response.json()) as ValidationError[]);
 *     return ok((await response.json()) as User);
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
export const useForm = <TValues extends Record<string, unknown>, TResult = TValues>(
  validatorOrSchema: FormValidator<TValues>,
  options: FormOptions<TValues, TResult>,
): UseFormReturn<TValues, TResult> => {
  const { initialValues, resetKey, onSubmit, validationMode, fieldValidators, onValuesChange, onFieldChange } = options;

  // Normalize: if a Standard Schema v1 object was passed, adapt it into a MaybeAsyncValidator.
  // useMemo ensures referential stability since fromStandardSchema creates a new function.
  const validator: MaybeAsyncValidator<unknown, TValues> = useMemo(
    () => (isStandardSchema(validatorOrSchema) ? fromStandardSchema(validatorOrSchema) : validatorOrSchema),
    [validatorOrSchema],
  );

  // Derive behavior flags from validationMode
  const mode = validationMode ?? 'live';
  const validateOnChange = mode === 'live';
  const validateOnBlur = mode === 'live' || mode === 'blur';
  const validateOnMount = mode === 'mount';
  const touchOnChange = mode === 'live';

  // ===========================================================================
  // State Store
  // ===========================================================================

  // The state lives in a store, so every method reads the state left by the calls before it,
  // not the state of the last render. React renders from the store.
  const [store] = useState(() =>
    createFormStore<TValues>(createInitialFormState(initialValues, resetKey), initialValues),
  );

  // resetForm() resets to the initialValues of the latest commit. An insertion effect hands them to the store
  // before any layout effect, passive effect or event handler of that commit can dispatch, including a child's.
  useInsertionEffect(() => {
    store.setInitialValues(initialValues);
  });

  const storedState = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const { dispatch } = store;

  // The render shows the state synced with this render's initialValues and resetKey, so this commit's
  // effects never see the old values. Pure, with no store write: a layout effect (Following initialValues,
  // below) dispatches the same sync, and the store catches up with what was rendered.
  const formState = useMemo(
    () => formReducer(storedState, { type: 'SYNC_INITIAL_VALUES', initialValues, resetKey }, initialValues),
    [storedState, initialValues, resetKey],
  );

  // =========================================================================
  // Value change callbacks
  // =========================================================================

  // --- onValuesChange ---
  // Ref avoids dependency-array issues with inline functions. Only the passive effect below calls it, and that
  // effect is declared after this one, so a passive effect updates the ref in time.
  const onValuesChangeRef = useRef(onValuesChange);
  useEffect(() => {
    onValuesChangeRef.current = onValuesChange;
  });

  // Track previous values for the second argument.
  const prevValuesRef = useRef(formState.values);

  useEffect(() => {
    onValuesChangeRef.current?.(formState.values, prevValuesRef.current);
    prevValuesRef.current = formState.values;
  }, [formState.values]);

  // --- onFieldChange ---
  // Fired imperatively from setFieldValue. Updated in an insertion effect, like the store's initial values,
  // so a setFieldValue from any effect of the same commit, a child's included, gets this render's callback.
  const onFieldChangeRef = useRef(onFieldChange);
  useInsertionEffect(() => {
    onFieldChangeRef.current = onFieldChange;
  });

  // Sequence counter for race condition protection on async validation
  const validationSeqRef = useRef(0);

  // Per-field sequence counters for race condition protection on field-level async validation
  const fieldValidationSeqRef = useRef<Record<string, number>>({});

  // Decides what an overlapping handleSubmit does: share the running submission, or follow it.
  // A resetKey reset replaces it, so the new record's submits don't join or wait behind the old record's.
  const [firstSubmitScheduler] = useState(createSubmitScheduler<TValues, Result<TResult, ValidationError[]>>);
  const submitSchedulerRef = useRef(firstSubmitScheduler);

  // ===========================================================================
  // Computed State
  // ===========================================================================

  // Combined errors: client, then field validators, then per-path server errors, then the submit error.
  // Each later source wins.
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

    // Submit error (describes the attempt, not a field)
    if (formState.submitError !== undefined) {
      combined[ROOT_ERROR_KEY] = formState.submitError;
    }

    return combined;
  }, [formState.clientErrors, formState.fieldErrors, formState.serverErrors, formState.submitError]);

  // Public view of server errors: per-path errors plus the submit error at the root key
  const serverErrors = useMemo(
    () =>
      formState.submitError === undefined
        ? formState.serverErrors
        : { ...formState.serverErrors, [ROOT_ERROR_KEY]: formState.submitError },
    [formState.serverErrors, formState.submitError],
  );

  // Valid when no client, field-validator, or per-path server errors exist. The submit error never counts.
  const isValid = useMemo(
    () =>
      Object.keys(formState.clientErrors).length === 0 &&
      Object.keys(formState.fieldErrors).length === 0 &&
      Object.keys(formState.serverErrors).length === 0,
    [formState.clientErrors, formState.fieldErrors, formState.serverErrors],
  );

  // Derived, not stored, so it also follows new initialValues, such as a saved record passed back in
  const isDirty = useMemo(() => !deepEqual(formState.values, initialValues), [formState.values, initialValues]);

  // Derived: true when any async validation (form-level or field-level) is running
  const isValidating = useMemo(
    () => formState.isFormValidating || Object.keys(formState.validatingFields).length > 0,
    [formState.isFormValidating, formState.validatingFields],
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
    [dispatch],
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
   * Every call replaces the validations before it, even one that finishes at once, and a sync result
   * ends the validating state of an async one it replaced. An async result also lands only while the
   * values it checked are still the baseline: a follow of new `initialValues` or a reset drops it.
   *
   * @param values - The form values to validate (usually form.values)
   * @returns Railway Result or Promise<Result> depending on the validator
   */
  const validateForm = useCallback(
    (values: TValues): Result<TValues, ValidationError[]> | Promise<Result<TValues, ValidationError[]>> => {
      const seq = ++validationSeqRef.current;
      const { baselineEpoch } = store.getState();
      const validationResult = validate(values, validator);

      if (validationResult instanceof Promise) {
        dispatch({ type: 'SET_FORM_VALIDATING', isFormValidating: true });

        return validationResult.then((result) => {
          // Only dispatch if this is still the latest validation, and no follow or reset came since
          if (seq === validationSeqRef.current && store.getState().baselineEpoch === baselineEpoch) {
            dispatchValidationResult(result);
            dispatch({ type: 'SET_FORM_VALIDATING', isFormValidating: false });
          }
          return result;
        });
      }

      // Sync path: it lands at once, and ends an async validation it replaced
      dispatchValidationResult(validationResult);
      if (store.getState().isFormValidating) {
        dispatch({ type: 'SET_FORM_VALIDATING', isFormValidating: false });
      }
      return validationResult;
    },
    [store, dispatch, validator, dispatchValidationResult],
  );

  /**
   * Clears a field's validator error and validating flag, each only if present, so a field with
   * nothing to clear doesn't add a store update.
   *
   * @param field - The field whose check is cleared
   */
  const clearFieldCheck = useCallback(
    (field: FieldPath): void => {
      const key = normalizePath(field);
      const { fieldErrors, validatingFields } = store.getState();
      if (fieldErrors[key] !== undefined) dispatch({ type: 'SET_FIELD_ERROR', field, error: undefined });
      if (validatingFields[key]) dispatch({ type: 'SET_FIELD_VALIDATING', field, isValidating: false });
    },
    [store, dispatch],
  );

  /**
   * Runs a single field's validator with per-field race condition protection.
   * Only runs when the field has a registered fieldValidator. A field whose validator was removed
   * clears the error and validating flag its earlier check left, since nothing else would.
   *
   * Every call replaces the field's checks before it, even one that finishes at once, and a sync result
   * clears the validating flag of an async one it replaced. An async result also lands only while the
   * values it checked are still the baseline.
   */
  const runFieldValidator = useCallback(
    (field: FieldPath, values: TValues): void => {
      const validatorFn = fieldValidators?.[field as ExtractFieldPaths<TValues>];
      if (!validatorFn) {
        clearFieldCheck(field);
        return;
      }

      const seqKey = normalizePath(field);
      const seq = takeNextFieldSeq(fieldValidationSeqRef.current, seqKey);
      const { baselineEpoch } = store.getState();

      dispatch({ type: 'SET_FIELD_ERROR', field, error: undefined });

      const fieldValue = getValueByPath(values, field);
      const result = (
        validatorFn as (value: unknown, values: TValues) => string | undefined | Promise<string | undefined>
      )(fieldValue, values);

      if (result instanceof Promise) {
        dispatch({ type: 'SET_FIELD_VALIDATING', field, isValidating: true });

        void result.then((error) => {
          if (seq === fieldValidationSeqRef.current[seqKey] && store.getState().baselineEpoch === baselineEpoch) {
            dispatch({ type: 'SET_FIELD_ERROR', field, error });
            dispatch({
              type: 'SET_FIELD_VALIDATING',
              field,
              isValidating: false,
            });
          }
        });
      } else {
        dispatch({ type: 'SET_FIELD_ERROR', field, error: result });
        if (store.getState().validatingFields[seqKey]) {
          dispatch({ type: 'SET_FIELD_VALIDATING', field, isValidating: false });
        }
      }
    },
    [store, dispatch, fieldValidators, clearFieldCheck],
  );

  /**
   * Once the schema result is in, runs the field's validator, or clears the field's error and
   * validating flag when the schema has an error for the field, so the schema's error shows.
   *
   * It replaces the field's checks before it as soon as it's called, so a field validator still
   * running, or one still waiting for its own schema result, can't land over it. Its schema result
   * is dropped once a newer check of the field starts, or a follow or a reset comes: it checked
   * values the form no longer holds.
   *
   * @param field - The field whose validator runs
   * @param values - The values the schema checked
   * @param schemaResult - The schema's result for `values`, from `validateForm`
   */
  const runFieldAfterSchema = useCallback(
    (
      field: FieldPath,
      values: TValues,
      schemaResult: Result<TValues, ValidationError[]> | Promise<Result<TValues, ValidationError[]>>,
    ): void => {
      const key = normalizePath(field);
      const seq = takeNextFieldSeq(fieldValidationSeqRef.current, key);
      const { baselineEpoch } = store.getState();

      const afterSchema = (result: Result<TValues, ValidationError[]>) => {
        if (seq !== fieldValidationSeqRef.current[key] || store.getState().baselineEpoch !== baselineEpoch) return;

        const schemaErrors = isErr(result) ? normalizePathKeys(formatErrors(result.error)) : {};
        if (!schemaErrors[key]) {
          runFieldValidator(field, values);
          return;
        }

        clearFieldCheck(field);
      };

      if (schemaResult instanceof Promise) {
        void schemaResult.then(afterSchema);
      } else {
        afterSchema(schemaResult);
      }
    },
    [store, runFieldValidator, clearFieldCheck],
  );

  /**
   * Runs schema validation followed by field-level validation for a single field.
   * If the schema produces an error for the field, the field validator is skipped.
   */
  const runValidationPipeline = useCallback(
    (field: FieldPath, values: TValues): void => {
      // Clear stale client errors for this field before (potentially async) validation.
      // For sync validators, SET_CLIENT_ERRORS immediately follows so the cleared state is never rendered.
      // For async validators, this prevents the old error from flashing during the gap.
      const currentErrors = store.getState().clientErrors;
      const hasStale = Object.keys(currentErrors).some((p) => isPathAffected(p, field));
      if (hasStale) {
        const cleaned = { ...currentErrors };
        Object.keys(cleaned).forEach((p) => {
          if (isPathAffected(p, field)) delete cleaned[p];
        });
        dispatch({ type: 'SET_CLIENT_ERRORS', errors: cleaned });
      }

      const schemaResult = validateForm(values);

      if (fieldValidators?.[field as ExtractFieldPaths<TValues>]) {
        runFieldAfterSchema(field, values, schemaResult);
      }
    },
    [store, dispatch, validateForm, fieldValidators, runFieldAfterSchema],
  );

  /**
   * What `mount` mode does on mount and on a `resetKey` reset: validates the values and marks every field
   * touched, nested and array items included, so the errors show at once.
   *
   * @param values - The values the form starts with
   */
  const validateAsOnMount = useCallback(
    (values: TValues): void => {
      void validateForm(values);
      dispatch({ type: 'MARK_ALL_TOUCHED', fields: collectFieldPaths(values) });
    },
    [dispatch, validateForm],
  );

  // Validate on mount if enabled
  const didMountRef = useRef(false);
  useEffect(() => {
    if (validateOnMount && !didMountRef.current) {
      didMountRef.current = true;
      validateAsOnMount(initialValues);
    }
  }, [initialValues, validateAsOnMount, validateOnMount]);

  // ===========================================================================
  // Following initialValues
  // ===========================================================================

  /**
   * Runs the side effects of a follow, so the errors describe the values shown. It re-validates when the
   * mode or the errors already shown call for it, re-runs the field validators that have an error or are
   * still running, and in `mount` mode marks the new version's fields touched. A mode that wouldn't have
   * validated yet still doesn't.
   *
   * @param prev - The state before the follow
   * @param next - The state after it
   */
  const runFollowEffects = useCallback(
    (prev: FormState<TValues>, next: FormState<TValues>): void => {
      const fields = Array.from(new Set([...Object.keys(prev.fieldErrors), ...Object.keys(prev.validatingFields)]));

      if (
        validateOnChange ||
        validateOnMount ||
        Object.keys(prev.clientErrors).length > 0 ||
        prev.isFormValidating ||
        fields.length > 0
      ) {
        const schemaResult = validateForm(next.values);
        fields.forEach((field) => runFieldAfterSchema(field, next.values, schemaResult));
      }

      if (validateOnMount) {
        dispatch({ type: 'MARK_ALL_TOUCHED', fields: collectFieldPaths(next.values) });
      }
    },
    [dispatch, validateOnChange, validateOnMount, validateForm, runFieldAfterSchema],
  );

  // Tells whether initialValues changes on its own, from how its versions line up with the form's own updates
  const [stabilityCheck] = useState(createStabilityCheck<FormState<TValues>>);

  // The state before this commit's sync, when the sync changed it. The layout effect below runs its side effects.
  const syncedFromRef = useRef<FormState<TValues> | undefined>(undefined);

  // The store catches up with the synced state this render showed before any layout effect of the commit runs, a
  // child's included, so a child's write or submit acts on that state. Only the parts that run no app code are
  // here: the sync, and on a resetKey reset, the switch to a fresh submit scheduler. Quietly, since an insertion
  // effect mustn't schedule a render: the layout effect below notifies.
  useInsertionEffect(() => {
    const prev = store.getState();
    store.dispatchQuietly({ type: 'SYNC_INITIAL_VALUES', initialValues, resetKey });
    const next = store.getState();
    if (next === prev) return;
    syncedFromRef.current = prev;
    if (next.generation !== prev.generation) {
      // Started over. The old record's running submission and waiting follow-up still run as the old record's,
      // and the follow-up submits the values the form held. The new record's submits start on a fresh scheduler.
      submitSchedulerRef.current.retire(prev.values);
      submitSchedulerRef.current = createSubmitScheduler();
    }
  });

  // Renders the state the store caught up to, then runs the side effects of a follow or a `resetKey` reset on the
  // values the form now holds.
  // storedState is a dependency, so this runs at every change of the form's state as well as of the props:
  // that's how the stability check tells an outside render, a catch-up and a form update apart. initialValues and
  // resetKey are, so a commit whose sync changed the state always runs it.
  useLayoutEffect(() => {
    store.flush();
    const prev = syncedFromRef.current;
    syncedFromRef.current = undefined;
    if (prev) {
      const now = store.getState();
      if (now.generation !== prev.generation) {
        if (validateOnMount) validateAsOnMount(now.values);
      } else if (now.baselineEpoch !== prev.baselineEpoch) {
        runFollowEffects(prev, now);
      }
    }
    // Reports, never throws: the check is a guess. React's own update-depth error still ends a true loop.
    // A version equal to the values the render used came from the form's own state.
    const changed = prev !== undefined;
    const echo = changed && deepEqual(initialValues, storedState.values);
    if (stabilityCheck.record(storedState, changed, store.getState(), echo)) {
      console.error(UNSTABLE_INITIAL_VALUES_MESSAGE);
    }
  }, [
    store,
    storedState,
    initialValues,
    resetKey,
    stabilityCheck,
    runFollowEffects,
    validateAsOnMount,
    validateOnMount,
  ]);

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
    <TValue>(field: FieldPath, value: TValue, shouldValidate = validateOnChange): void => {
      // Store the value first, so onFieldChange and any setFieldValue calls it makes build on it
      dispatch({
        type: 'SET_FIELD_VALUE',
        field,
        value,
      });

      onFieldChangeRef.current?.(field, value, store.getState().values);

      // Mark touched on first change for immediate error visibility
      if (touchOnChange && !store.getState().touched[normalizePath(field)]) {
        dispatch({ type: 'SET_FIELD_TOUCHED', field, isTouched: true });
      }

      // Validate the values as they are after any onFieldChange cascade
      if (shouldValidate) {
        runValidationPipeline(field, store.getState().values);
      }
    },
    [store, dispatch, validateOnChange, touchOnChange, runValidationPipeline],
  );

  /**
   * Updates multiple field values simultaneously and optionally triggers validation.
   * More efficient than calling setFieldValue multiple times when updating several fields.
   * Automatically clears server errors for affected fields.
   *
   * A record to load goes in `initialValues` instead, which the form follows while it has no unsaved edits.
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
   * // Fill in an address picked from suggestions
   * const handlePick = ({ street, city, zip }: Suggestion) => {
   *   form.setValues({ address: { street, city, zip } });
   * };
   */
  const setValues = useCallback(
    (newValues: DeepPartial<TValues>, shouldValidate = validateOnChange): void => {
      dispatch({
        type: 'SET_VALUES',
        values: newValues,
      });

      if (shouldValidate) {
        void validateForm(store.getState().values);
      }
    },
    [store, dispatch, validateOnChange, validateForm],
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
    (field: FieldPath, isTouched = true, shouldValidate = validateOnBlur): void => {
      const wasTouched = store.getState().touched[normalizePath(field)];
      dispatch({
        type: 'SET_FIELD_TOUCHED',
        field,
        isTouched,
      });

      if (shouldValidate) {
        if (!validateOnChange) {
          // In non-live modes, run field validators on blur
          runValidationPipeline(field, store.getState().values);
        } else if (!wasTouched) {
          // Live mode: only validate on first touch (focus→blur without typing).
          // After onChange has run (which sets touched), blur is redundant.
          void validateForm(store.getState().values);
        }
      }
    },
    [store, dispatch, validateOnBlur, validateOnChange, validateForm, runValidationPipeline],
  );

  // ===========================================================================
  // Server Error Management
  // ===========================================================================

  /**
   * Sets server-side validation errors received from API responses.
   * These errors take precedence over client-side errors in the merged `errors` object.
   * Server errors are automatically cleared when the related field value changes.
   * An error at path `[]` becomes the submit error. Every other error's path is marked touched,
   * so the errors show through `getFieldError` straight away.
   *
   * @param errors - Server validation errors, each with a `path` and a `message`
   *
   * @example
   * // Errors that arrive outside onSubmit, such as in a React Query mutation's onError
   * // (inside onSubmit, return err(errors) instead)
   * const mutation = useMutation({
   *   mutationFn: api.createUser,
   *   onError: (error) => {
   *     if (error instanceof ApiValidationError) form.setServerErrors(error.fieldErrors);
   *   },
   * });
   *
   * @example
   * // Set a single server error
   * form.setServerErrors([{ path: ["email"], message: "This email is already registered" }]);
   *
   * @example
   * // A path [] error is the submit error, shown at errors._root
   * form.setServerErrors([{ path: [], message: "Service unavailable" }]);
   */
  const placeServerErrors = useCallback(
    (errors: ValidationError[]): void => placeErrorsWith(dispatch, errors),
    [dispatch],
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
  }, [dispatch]);

  // ===========================================================================
  // Form Action Functions
  // ===========================================================================

  /**
   * Returns a dispatch for the writes of one generation: they land only while the form is still in it,
   * so after a `resetKey` reset, the previous record's writes are dropped.
   *
   * @param generation - The generation the writes belong to
   * @returns A dispatch that drops each write once `generation` is no longer current
   */
  const dispatchIn = useCallback(
    (generation: number) =>
      (action: FormAction<TValues>): void => {
        if (store.getState().generation === generation) dispatch(action);
      },
    [store, dispatch],
  );

  /**
   * Runs one submission of the given values: marks every field touched, counts the attempt,
   * clears server errors, validates, runs the field validators, then calls `onSubmit`.
   * `handleSubmit` decides when it runs, through the submit scheduler.
   *
   * The submission belongs to the form state of `generation`. After a `resetKey` reset it still runs
   * and resolves, but none of its writes land.
   *
   * It doesn't call `onSubmit` when the save would overwrite a newer version of the record: one that arrived
   * while it validated and made the form stale or was followed, or a staleness that a running submission hid
   * from the caller. It resolves to a submit error instead.
   *
   * Never rejects. A throw anywhere, or an `onSubmit` value that is neither a `Result` nor nothing,
   * is logged and resolves to the generic submit error.
   *
   * @param values - The form values to submit
   * @param generation - The generation current when `handleSubmit` was called
   * @param staleShown - Whether `isStale` read true when `handleSubmit` was called: the app chose to overwrite
   * @returns Promise<Result<TResult, ValidationError[]>> - `onSubmit`'s Result, the validated data, or errors
   */
  const runSubmission = useCallback(
    async (values: TValues, generation: number, staleShown: boolean): Promise<Result<TResult, ValidationError[]>> => {
      const send = dispatchIn(generation);

      // Every statement is inside this try and every step is awaited, so its catch sees every throw and rejection
      try {
        const { clientErrors, serverErrors, baselineEpoch, lastVersion } = store.getState();

        // The validation's results describe the submitted values, so they land only while those values are
        // still the baseline: a follow of new initialValues or a resetForm() drops them
        const isBaseline = (): boolean => store.getState().baselineEpoch === baselineEpoch;
        const whileBaseline = (action: FormAction<TValues>): void => {
          if (isBaseline()) send(action);
        };

        // Whether the save would overwrite a newer version of the record. After a resetKey switch, the previous
        // record's save still goes out, as a remount's would.
        const isOvertaken = (): boolean => {
          const now = store.getState();
          if (now.generation !== generation) return false;
          // A staleness the caller couldn't see, because isStale reads false while a submission runs
          if (now.isStale && !staleShown) return true;
          if (now.lastVersion === lastVersion) return false;
          // A version that arrived since: the form went stale, or followed it and no longer shows these values
          return now.isStale || (!isBaseline() && !deepEqual(now.values, values));
        };

        // Mark all fields and error paths as touched (deep)
        const valuePaths = collectFieldPaths(values);
        const allPaths = Array.from(
          new Set([...valuePaths, ...Object.keys(clientErrors), ...Object.keys(serverErrors)]),
        );

        send({
          type: 'MARK_ALL_TOUCHED',
          fields: allPaths,
        });

        // Increment submit count on every attempt (regardless of validation outcome)
        send({ type: 'INCREMENT_SUBMIT_COUNT' });

        // Clear any existing server errors
        send({
          type: 'CLEAR_SERVER_ERRORS',
        });

        // Invalidate any pending live async validations, unless a resetKey reset replaced this submission's
        // state: a follow-up of the previous record can start during the new record's, whose validations stay
        if (store.getState().generation === generation) ++validationSeqRef.current;

        // Show validating state during submit validation
        send({ type: 'SET_FORM_VALIDATING', isFormValidating: true });

        let validationResult: Result<TValues, ValidationError[]>;
        try {
          // Validate the form (await handles both sync and async validators)
          validationResult = await validate(values, validator);
        } finally {
          whileBaseline({ type: 'SET_FORM_VALIDATING', isFormValidating: false });
        }

        if (isErr(validationResult)) {
          whileBaseline({
            type: 'SET_CLIENT_ERRORS',
            errors: formatErrors(validationResult.error),
          });

          // No SET_SUBMITTING dispatch — isSubmitting was never set to true
          return validationResult;
        }

        const validData = validationResult.value;

        // Only set isSubmitting after validation passes
        send({
          type: 'SET_SUBMITTING',
          isSubmitting: true,
        });

        try {
          // Run all field validators in parallel before calling onSubmit
          if (fieldValidators) {
            const fieldEntries = Object.entries(fieldValidators) as Array<
              [string, (value: unknown, values: TValues) => string | undefined | Promise<string | undefined>]
            >;

            const fieldResults = await Promise.all(
              fieldEntries.map(async ([field, validatorFn]) => {
                const fieldValue = getValueByPath(values, field);
                const error = await validatorFn(fieldValue, values);
                whileBaseline({ type: 'SET_FIELD_ERROR', field, error });
                return { field, error };
              }),
            );

            const hasFieldErrors = fieldResults.some((r) => r.error);
            if (hasFieldErrors) {
              return err(fieldResults.filter((r) => r.error).map((r) => ({ path: [r.field], message: r.error! })));
            }
          }

          // A successful save settles the baseline. A version that arrived while it ran is the save's own
          // answer: the form follows it, or bases the edits on it. A latest version equal to the base isn't: it's
          // the previous save's answer or the old base coming back. Inside the try, so isSubmitting stays true
          // until the finally. A dropped write leaves the epoch as it was, so nothing follows.
          const settleSuccess = () => {
            const before = store.getState();
            send({ type: 'SUBMIT_SUCCEEDED', values, baselineEpoch, lastVersion });
            const after = store.getState();
            if (after.baselineEpoch !== before.baselineEpoch) runFollowEffects(before, after);
          };

          // The last check before the save goes out
          if (isOvertaken()) {
            send({ type: 'SET_SUBMIT_ERROR', submitError: CHANGED_WHILE_SAVING_MESSAGE });
            return err([{ path: [], message: CHANGED_WHILE_SAVING_MESSAGE }]);
          }

          const outcome = onSubmit ? await onSubmit(validData) : undefined;

          if (outcome === undefined) {
            settleSuccess();
            // Cast: OnSubmit's member that returns nothing requires TResult ≡ TValues, and without an
            // onSubmit TResult defaults to TValues, so the validated values are the success value. The one
            // hole is an explicit useForm<T, U> with no onSubmit at all.
            return ok(validData) as Result<TResult, ValidationError[]>;
          }

          if (!isResult(outcome)) throw new TypeError('onSubmit must return a Result or nothing');

          if (isErr(outcome)) {
            if (isBaseline()) {
              placeErrorsWith(send, outcome.error);
            } else {
              // A follow or resetForm() replaced the submitted values, so the field errors would describe values no
              // longer shown. The submit error is about the attempt, and still shows.
              const submitError = formatErrors(outcome.error)[ROOT_ERROR_KEY];
              if (submitError !== undefined) send({ type: 'SET_SUBMIT_ERROR', submitError });
            }
          } else {
            settleSuccess();
          }

          return outcome;
        } finally {
          send({
            type: 'SET_SUBMITTING',
            isSubmitting: false,
          });
        }
      } catch (error) {
        console.error('Form submission error:', error);

        // Sets only the submit error: field errors placed during the submission stay
        send({ type: 'SET_SUBMIT_ERROR', submitError: SUBMIT_ERROR_MESSAGE });
        return err([{ path: [], message: SUBMIT_ERROR_MESSAGE }]);
      }
    },
    [store, validator, onSubmit, fieldValidators, runFollowEffects, dispatchIn],
  );

  /**
   * Handles form submission using the Railway-oriented programming pattern.
   * Validates all fields, marks them as touched, and calls onSubmit if validation passes.
   * Returns a Promise that resolves to a Result and never rejects:
   * - `ok` with `onSubmit`'s `ok` value, or with the validated data when `onSubmit` returns nothing or is absent
   * - `err` with the validation errors, or with `onSubmit`'s `err`, whose errors are placed on their fields
   * - `err([{ path: [], message: "Something went wrong. Please try again." }])` when the submission throws,
   *   or `onSubmit` returns neither a `Result` nor nothing. This becomes the submit error, and the original
   *   error is logged with `console.error`.
   * - `err` with a submit error, without calling `onSubmit`, when the save would overwrite a newer version of
   *   the record that the caller hadn't seen (see `runSubmission`)
   *
   * While a submission is running, a call with the same values shares its Promise, and a call
   * with changed values submits them once it finishes. Every call with an event calls `preventDefault()`.
   *
   * A submission belongs to the record the form held when it was called. After a `resetKey` change it
   * still runs and its Promise still resolves, but none of its results land on the new record's form,
   * and the new record's submit doesn't wait for it.
   *
   * @param e - Optional form event (will preventDefault if provided)
   * @returns Promise<Result<TResult, ValidationError[]>> - Railway Result with `onSubmit`'s value, the validated data, or errors
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
   * // onSubmit returns the server's Result, and handleSubmit passes it on
   * import { match } from "@railway-ts/pipelines/result";
   *
   * const form = useForm(userValidator, {
   *   initialValues: { name: "", email: "" },
   *   onSubmit: (values) => api.createUser(values), // Promise<Result<User, ValidationError[]>>
   * });
   *
   * const handleSave = async () => {
   *   const result = await form.handleSubmit();
   *   match(result, {
   *     ok: (user) => {
   *       navigate(`/users/${user.id}`);
   *     },
   *     err: (errors) => {
   *       // Already on the form: field errors under their paths, a path [] error at errors._root
   *       console.warn("Not saved:", errors);
   *     },
   *   });
   * };
   */
  const handleSubmit = useCallback(
    (e?: SyntheticEvent): Promise<Result<TResult, ValidationError[]>> => {
      e?.preventDefault();
      const { generation, isStale, isSubmitting } = store.getState();
      // What isStale read: a submission running hides it
      const staleShown = isStale && !isSubmitting;
      return submitSchedulerRef.current.submit(
        () => store.getState().values,
        (values) => runSubmission(values, generation, staleShown),
      );
    },
    [store, runSubmission],
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
      void validateForm(store.getState().values);
    }
  }, [store, dispatch, validateForm, validateOnMount]);

  // ===========================================================================
  // Error Helper
  // ===========================================================================

  /**
   * Returns the error message for a field path, gated on user interaction.
   *
   * - Leaf paths: returns the error iff the field itself has been touched.
   * - Group / parent paths: returns the error iff *any* descendant field has
   *   been touched. This makes cross-field validation errors that schemas
   *   attach to a non-leaf path (e.g. `S.refineAt("confirm", v => v.password
   *   === v.confirm, …)` or `S.refineAt("r2", …)` over a tuple) surface
   *   naturally on the group container, without callers having to read
   *   `form.errors` and `form.touched` directly.
   *
   * Eliminates the common `touched[field] ? errors[field] : undefined`
   * boilerplate and removes the leaf-only constraint that previously hid
   * group-level errors.
   *
   * @template TField - The field path type (auto-inferred with autocomplete)
   * @param field - The field path (with type-safe autocomplete)
   * @returns The error message string if visible per the rules above, otherwise `undefined`
   *
   * @example
   * // Leaf:
   * {form.getFieldError("email") && <span>{form.getFieldError("email")}</span>}
   *
   * @example
   * // Group — schema has `refineAt("r2", v => !equal(v.r1, v.r2), "must differ")`:
   * {form.getFieldError("r2") && <Banner msg={form.getFieldError("r2")} />}
   */
  const getFieldError = useCallback(
    <TField extends ExtractFieldPaths<TValues>>(field: TField): string | undefined => {
      const key = normalizePath(field);
      const err = errors[key];
      if (!err) return undefined;
      // Visible iff the queried path itself or any descendant has been touched.
      // `isPathAffected(touchedKey, key)` already encodes "same path or
      // descendant," reusing the same semantics used for cascading error
      // clears (see utils.ts).
      for (const touchedKey in formState.touched) {
        if (formState.touched[touchedKey] && isPathAffected(touchedKey, key)) return err;
      }
      return undefined;
    },
    [formState.touched, errors],
  );

  // ===========================================================================
  // ID Helper
  // ===========================================================================

  /**
   * Returns a stable HTML element ID for a field, without creating onChange/onBlur handlers.
   * Useful for linking `<label htmlFor>` to an input without calling a full props factory.
   *
   * @template TField - The field path type (auto-inferred with autocomplete)
   * @param field - The field path (with type-safe autocomplete)
   * @param optionValue - Optional value for checkbox group / radio group options
   * @returns The element ID string (field path, or `field-optionValue` for options)
   *
   * @example
   * <label htmlFor={form.getFieldId('username')}>Username</label>
   * <input {...form.getFieldProps('username')} />
   *
   * @example
   * <label htmlFor={form.getFieldId('contacts', 'email')}>Email</label>
   * <input type="checkbox" {...form.getCheckboxGroupOptionProps('contacts', 'email')} />
   */
  const getFieldId = useCallback(
    <TField extends ExtractFieldPaths<TValues>>(field: TField, optionValue?: string | number): string => {
      return optionValue !== undefined ? `${field}-${String(optionValue)}` : field;
    },
    [],
  );

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
    <TField extends ExtractFieldPaths<TValues>>(field: TField): NativeFieldProps => {
      return createNativeFieldProps(field, formState.values, setFieldValue, setFieldTouched);
    },
    [formState.values, setFieldValue, setFieldTouched],
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
    <TField extends ExtractFieldPaths<TValues>>(field: TField): NativeSelectProps => {
      return createNativeSelectFieldProps(field, formState.values, setFieldValue, setFieldTouched);
    },
    [formState.values, setFieldValue, setFieldTouched],
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
    <TField extends ExtractFieldPaths<TValues>>(field: TField): NativeCheckboxProps => {
      return createNativeCheckboxProps(field, formState.values, setFieldValue, setFieldTouched);
    },
    [formState.values, setFieldValue, setFieldTouched],
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
    <TField extends ExtractFieldPaths<TValues>>(field: TField): NativeSwitchProps => {
      return createNativeSwitchProps(field, formState.values, setFieldValue, setFieldTouched);
    },
    [formState.values, setFieldValue, setFieldTouched],
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
    <TField extends ExtractFieldPaths<TValues>>(field: TField): NativeSliderProps => {
      return createNativeSliderProps(field, formState.values, setFieldValue, setFieldTouched);
    },
    [formState.values, setFieldValue, setFieldTouched],
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
      optionValue: string | number,
    ): NativeCheckboxGroupOptionProps => {
      return createCheckboxGroupOptionProps(field, optionValue, formState.values, setFieldValue, setFieldTouched);
    },
    [formState.values, setFieldValue, setFieldTouched],
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
    <TField extends ExtractFieldPaths<TValues>>(field: TField): NativeFileFieldProps => {
      return createNativeFileFieldProps(field, formState.values, setFieldValue, setFieldTouched);
    },
    [formState.values, setFieldValue, setFieldTouched],
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
      optionValue: string | number,
    ): NativeRadioGroupOptionProps => {
      return createRadioGroupOptionProps(field, optionValue, formState.values, setFieldValue, setFieldTouched);
    },
    [formState.values, setFieldValue, setFieldTouched],
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
  const arrayHelpers = useCallback(
    <TItem = unknown>(field: string): ArrayHelpers<TItem, ExtractFieldPaths<TItem>> => {
      // Local path-based wrappers to avoid generic casts
      const getFieldPropsAtPath = (path: string) =>
        createNativeFieldProps(path, formState.values, setFieldValue, setFieldTouched);

      const getSelectFieldPropsAtPath = (path: string) =>
        createNativeSelectFieldProps(path, formState.values, setFieldValue, setFieldTouched);

      const getSliderPropsAtPath = (path: string) =>
        createNativeSliderProps(path, formState.values, setFieldValue, setFieldTouched);

      const getCheckboxPropsAtPath = (path: string) =>
        createNativeCheckboxProps(path, formState.values, setFieldValue, setFieldTouched);

      const getSwitchPropsAtPath = (path: string) =>
        createNativeSwitchProps(path, formState.values, setFieldValue, setFieldTouched);

      const getFileFieldPropsAtPath = (path: string) =>
        createNativeFileFieldProps(path, formState.values, setFieldValue, setFieldTouched);

      const getRadioGroupOptionPropsAtPath = (path: string, opt: string | number) =>
        createRadioGroupOptionProps(path, opt, formState.values, setFieldValue, setFieldTouched);

      const getFieldErrorAtPath = (path: string) => {
        const key = normalizePath(path);
        return formState.touched[key] ? errors[key] : undefined;
      };

      const getFieldIdAtPath = (path: string, optionValue?: string | number) =>
        optionValue !== undefined ? `${path}-${String(optionValue)}` : path;

      return createArrayHelpers<TItem, ExtractFieldPaths<TItem>>(
        field,
        getValueByPath<TValues, TItem[]>(formState.values, field) || [],
        () => getValueByPath<TValues, TItem[]>(store.getState().values, field) || [],
        setFieldValue,
        getFieldPropsAtPath,
        getSelectFieldPropsAtPath,
        getSliderPropsAtPath,
        getCheckboxPropsAtPath,
        getSwitchPropsAtPath,
        getFileFieldPropsAtPath,
        getRadioGroupOptionPropsAtPath,
        getFieldErrorAtPath,
        getFieldIdAtPath,
      );
    },
    [store, formState.values, formState.touched, errors, setFieldValue, setFieldTouched],
  );

  // ===========================================================================
  // Return
  // ===========================================================================

  return {
    // Form state
    values: formState.values,
    touched: formState.touched,
    errors,
    clientErrors: formState.clientErrors,
    serverErrors,
    fieldErrors: formState.fieldErrors,
    isSubmitting: formState.isSubmitting,
    isValidating,
    validatingFields: formState.validatingFields,
    isValid,
    isDirty,
    // A version that arrives during a save may be the save's own answer, and SUBMIT_SUCCEEDED settles it
    isStale: formState.isStale && !formState.isSubmitting,
    submitCount: formState.submitCount,

    // Error helper
    getFieldError,

    // ID helper
    getFieldId,

    // Field management
    setFieldValue,
    setFieldTouched,
    setValues,

    // Server error management
    setServerErrors: placeServerErrors,
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
