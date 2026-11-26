import { isErr, isOk, isResult, ok, err, type Result } from '@railway-ts/pipelines/result';
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
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type SyntheticEvent,
} from 'react';

import { createArrayHelpers } from './arrayHelpersFactory';
import { createAutoSave } from './autoSave';
import { createCheckEvents, type EventRecord } from './checkEvents';
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
import {
  fieldErrorsOf,
  fieldsToRecheck,
  isWaitingFieldCheck,
  validatingFieldsOf,
  validatorPeriod,
  waitingFieldChecksOf,
} from './formChecks';
import { createInitialFormState, formReducer, isValidState, isValidatingState } from './formReducer';
import { createFormStore, type FormStore } from './formStore';
import { createStabilityCheck } from './stabilityCheck';
import { isStandardSchema, fromStandardSchema, type FormValidator } from './standardSchema';
import { createSubmitScheduler, type SubmitScheduler } from './submitScheduler';
import { useDebounce } from './useDebounce';
import {
  changedPaths,
  deepEqual,
  getValueByPath,
  collectFieldPaths,
  isPathAffected,
  isPromiseLike,
  normalizePath,
  normalizePathKeys,
  own,
  pathsOverlap,
} from './utils';

import type {
  ArrayHelpers,
  CheckId,
  DeepPartial,
  ExtractFieldPaths,
  FieldCheckResult,
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

/** The default submit error for a submission that threw, or whose `onSubmit` returned neither a `Result` nor nothing. */
const SUBMIT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/** The default submit error for a save cancelled before `onSubmit`, because it would overwrite a newer version. */
const CHANGED_WHILE_SAVING_MESSAGE =
  'The record changed while saving, so nothing was saved. Review the latest version and save again.';

/** How long auto-save waits after the values last change, when `autoSave` sets no `delay`. */
const AUTO_SAVE_DELAY = 200;

/** Logged once per form when initialValues keeps changing along with the form's own state. */
const UNSTABLE_INITIAL_VALUES_MESSAGE =
  "useForm: initialValues or resetKey keeps changing along with the form's own state. " +
  "It's probably built from something that changes on its own, such as crypto.randomUUID(), new Date() or storage read during render, " +
  'or holds a Set, Map or Temporal value built anew on every render. ' +
  'Create generated values once, at module scope or with useState(() => …). ' +
  'A Set, Map or Temporal value compares by identity, so build it with useMemo, keyed on the data it comes from, ' +
  'or use an array or plain object.';

/** A schema check a field validator waits on: its result, or undefined once its validator threw or rejected. */
type SchemaCheck<TValues> =
  | Result<TValues, ValidationError[]>
  | Promise<Result<TValues, ValidationError[]> | undefined>
  | undefined;

/** How a schema check ended: the values it checked, and its result, or undefined once its validator threw or rejected. */
type SchemaOutcome<TValues> = { values: TValues; result: Result<TValues, ValidationError[]> | undefined };

/** A `fieldValidators` entry as the hook calls it, by a path the form only knows as a string. */
type FieldValidatorFn<TValues> = (value: unknown, values: TValues) => string | undefined | Promise<string | undefined>;

/**
 * A field validator as a check runs it: the paths it reads, and a call that answers with the error the field shows,
 * so an empty message has already become no error. {@link validatorsByPath} makes one from a `fieldValidators` entry.
 */
type FieldCheckFn<TValues> = {
  /** The validator's field, then each path it lists, normalized and without repeats. In this task, the field only. */
  inputs: readonly FieldPath[];
  /** Runs the validator on the values checked. Its answer is the error the field shows. */
  check: (values: TValues) => string | undefined | Promise<string | undefined>;
};

/**
 * The value at each of the validator's input paths in `values`, keyed by normalized path. Built with
 * `Object.fromEntries`, so a path named `__proto__` stays an own key.
 *
 * @param validator - The field validator
 * @param values - The values it checks
 * @returns What a check of `validator` on `values` records as its inputs
 */
const inputsOf = <TValues extends Record<string, unknown>>(
  validator: FieldCheckFn<TValues>,
  values: TValues,
): Record<FieldPath, unknown> =>
  Object.fromEntries(validator.inputs.map((path) => [path, getValueByPath(values, path)]));

/**
 * Logs a validator's throw or rejection that nothing could catch: in an event with no caller, such as the mount check,
 * or in an async check, which settles after the call that started it returned.
 *
 * @param error - What the validator threw or rejected with
 * @returns undefined, since the check has no result
 */
const logValidationError = (error: unknown): undefined => {
  console.error('Form validation error:', error);
  return undefined;
};

/**
 * The error a field validator's answer shows. An empty message is no error, as no message is.
 *
 * @param answer - What the validator returned, or resolved to
 * @returns The error, or undefined when the field passed
 */
const errorOf = (answer: string | undefined): string | undefined => answer || undefined;

/**
 * The error a validator's answer shows, read by {@link errorOf}. A throw still reaches the caller, and a rejection
 * still rejects. An answer that settles later becomes a native promise, whatever thenable it was.
 *
 * @param answer - What the validator returned: its answer, or a thenable of it
 * @returns The error, or a native promise of it
 */
const shownError = (
  answer: string | undefined | PromiseLike<string | undefined>,
): string | undefined | Promise<string | undefined> =>
  isPromiseLike(answer) ? Promise.resolve(answer).then(errorOf) : errorOf(answer);

/**
 * The field validators that are on, by normalized path. An entry set to undefined is off, as a missing key is.
 * Each answers with the error it shows, so a field's checks and a submit's read an answer the same way.
 *
 * @param fieldValidators - The `fieldValidators` option
 * @returns Each validator, keyed by its field's normalized path
 */
const validatorsByPath = <TValues extends Record<string, unknown>>(
  fieldValidators: Record<string, unknown> | undefined,
): ReadonlyMap<FieldPath, FieldCheckFn<TValues>> =>
  new Map(
    Object.entries(fieldValidators ?? {})
      .filter((entry): entry is [string, FieldValidatorFn<TValues>] => typeof entry[1] === 'function')
      .map(([field, fn]) => {
        const key = normalizePath(field);
        return [key, { inputs: [key], check: (values) => shownError(fn(getValueByPath(values, key), values)) }];
      }),
  );

/**
 * The errors a schema result places on the form: none for a pass.
 *
 * @param result - What the schema validator returned, or resolved to
 * @returns Each error's message, by its path as `formatErrors` writes it
 */
const schemaErrorsOf = <TValues>(result: Result<TValues, ValidationError[]>): Record<FieldPath, string> =>
  isErr(result) ? formatErrors(result.error) : {};

/**
 * Runs a step that answers at once or later, and tells how it settled: `onAnswer` gets its answer, and `onFail` hears
 * of a throw or rejection. Either way the caller still gets what the step gave, sync or async: its answer, its throw
 * or its rejection. An answer that settles later, whatever thenable it is, reaches the caller as a native promise.
 * An answer `onAnswer` throws on, as on a validator's malformed result, fails the step: `onFail` hears of it, and the
 * throw reaches the caller.
 *
 * @param run - The step
 * @param onAnswer - Called with the answer, before the caller gets it
 * @param onFail - Called on a throw or rejection, before it reaches the caller
 * @returns The answer, or a promise of it
 */
const settling = <T>(run: () => T | Promise<T>, onAnswer: (answer: T) => void, onFail: () => void): T | Promise<T> => {
  const fail = (error: unknown): never => {
    onFail();
    throw error;
  };
  const answered = (settled: T): T => {
    try {
      onAnswer(settled);
    } catch (error) {
      fail(error);
    }
    return settled;
  };
  let answer: T | Promise<T>;
  try {
    answer = run();
  } catch (error) {
    return fail(error);
  }
  return isPromiseLike(answer) ? Promise.resolve(answer).then(answered, fail) : answered(answer);
};

/**
 * A submit's field step. It runs the given field validators in parallel, each in the period its validator is in now,
 * and ends each check as its result arrives. Once every result is in, only a check whose validator stayed on, in the
 * same period, counts. Decided then, not as each result arrives, so the outcome agrees with the form: a validator
 * switched off meanwhile no longer shows its error. Once a resetKey switch retired the submission's record, every
 * check counts, as a remount's would: the form no longer shows that record.
 *
 * @param store - The form's store, which holds each validator's period
 * @param validators - The field validators to run, by normalized path
 * @param values - The submitted values
 * @param id - The submission's check id
 * @param generation - The generation the submission belongs to
 * @param send - Dispatches the submission's writes
 * @param register - Whether the checks show while they run. Not once a follow or reset replaced the submitted values:
 *   they still run and count then, but describe values the form no longer shows.
 * @returns The errors of the checks that count, in the validators' order
 * @throws What the first check that counts threw or rejected with: it fails the submission, as a throw anywhere does.
 *   Every one that doesn't count is logged instead, before the throw.
 */
const checkFieldsForSubmit = async <TValues extends Record<string, unknown>>(
  store: FormStore<TValues>,
  validators: ReadonlyMap<FieldPath, FieldCheckFn<TValues>>,
  values: TValues,
  id: CheckId,
  generation: number,
  send: (action: FormAction<TValues>) => void,
  register: boolean,
): Promise<ValidationError[]> => {
  const atStart = store.getState().checks;
  const runs = Array.from(validators, ([key, validator]) => ({
    key,
    validator,
    period: validatorPeriod(atStart, key),
  }));
  if (register) {
    runs.forEach(({ key, validator }) =>
      send({ type: 'START_FIELD_CHECK', field: key, id, status: 'running', inputs: inputsOf(validator, values) }),
    );
  }

  // Each runs in a promise, so a throw becomes a rejection: every check ends and is waited for, whatever the others do
  const settled = await Promise.allSettled(
    runs.map(({ key, validator }) => {
      const end = (result: FieldCheckResult) => send({ type: 'END_FIELD_CHECK', field: key, id, result });
      return Promise.resolve().then(() =>
        settling(
          () => validator.check(values),
          (error) => end({ error }),
          () => end('none'),
        ),
      );
    }),
  );

  // Which checks count, decided once, against the validators as they are now that every result is in. Once a resetKey
  // switch retired the submission's record, the validators belong to the new record: every check counts then, as a
  // remount's would.
  const { checks, generation: now } = store.getState();
  const errors: ValidationError[] = [];
  let failed: PromiseRejectedResult | undefined;
  for (const [index, { key, period }] of runs.entries()) {
    const outcome = settled[index]!;
    if (now === generation && validatorPeriod(checks, key) !== period) {
      // It counts as never run, so nothing else sees its throw or rejection: logged, as a live check's is
      if (outcome.status === 'rejected') logValidationError(outcome.reason);
    } else if (outcome.status === 'rejected') {
      failed ??= outcome;
    } else if (outcome.value !== undefined) {
      errors.push({ path: [key], message: outcome.value });
    }
  }
  // Thrown once the pass is over, so every check that doesn't count has been logged
  if (failed) throw failed.reason;
  return errors;
};

/**
 * Places server errors on the form: an error at path `[]` becomes the submit error, and every other
 * error goes on its path, marked touched so it shows.
 *
 * @param send - Dispatches each write, or drops it when the errors no longer belong to the form's state
 * @param errors - Server validation errors, each with a `path` and a `message`
 * @param lands - Whether the error at a path still describes the value shown there. Without it, every error lands.
 */
const placeErrorsWith = <TValues extends Record<string, unknown>>(
  send: (action: FormAction<TValues>) => void,
  errors: ValidationError[],
  lands: (path: FieldPath) => boolean = () => true,
): void => {
  const { [ROOT_ERROR_KEY]: submitError, ...all } = formatErrors(errors);
  const perPath = Object.fromEntries(Object.entries(all).filter(([path]) => lands(path)));
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
  const {
    initialValues,
    resetKey,
    onSubmit,
    savedValues,
    validationMode,
    fieldValidators,
    onValuesChange,
    onFieldChange,
    messages,
    autoSave,
  } = options;

  // The submit errors useForm writes itself. Read out as strings, so an inline `messages` object keeps the methods
  // the same.
  const submitFailedMessage = messages?.submitFailed ?? SUBMIT_ERROR_MESSAGE;
  const changedWhileSavingMessage = messages?.changedWhileSaving ?? CHANGED_WHILE_SAVING_MESSAGE;

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

  // Read out as primitives, so an inline `autoSave` object reruns no effect (Auto-save, below). A `null` from untyped
  // code is off.
  const autoSaveOn = Boolean(autoSave);
  const autoSaveDelay = (autoSaveOn && typeof autoSave === 'object' ? autoSave.delay : undefined) ?? AUTO_SAVE_DELAY;

  // The field validators that are on in this render, by normalized path, and their fields
  const byPath = useMemo(() => validatorsByPath<TValues>(fieldValidators), [fieldValidators]);
  const onFields = useMemo(() => new Set(byPath.keys()), [byPath]);

  // ===========================================================================
  // State Store
  // ===========================================================================

  // The state lives in a store, so every method reads the state left by the calls before it,
  // not the state of the last render. React renders from the store. It starts synced with the first render's field
  // validators, so the mount commit's sync changes nothing, and a form with fieldValidators renders once on mount.
  const [store] = useState(() =>
    createFormStore<TValues>(
      formReducer(
        createInitialFormState(initialValues, resetKey),
        { type: 'SYNC_FIELD_VALIDATORS', fields: onFields },
        initialValues,
      ),
      initialValues,
    ),
  );

  // resetForm() resets to the initialValues of the latest commit. An insertion effect hands them to the store
  // before any layout effect, passive effect or event handler of that commit can dispatch, including a child's.
  useInsertionEffect(() => {
    store.setInitialValues(initialValues);
  });

  // The latest commit's field validators. A field check reads its validator from here when it runs, so no method
  // depends on fieldValidators, and an inline object keeps the methods the same. The insertion effect that syncs the
  // store with the props (Following initialValues, below) writes it.
  const fieldValidatorsRef = useRef(byPath);
  const validatorFor = useCallback((field: FieldPath) => fieldValidatorsRef.current.get(normalizePath(field)), []);

  // One public call is one event, and the calls made while it runs, such as from onFieldChange, join it. Its checks
  // run in one pass once the outermost call returns (checkRecorded, below).
  const [events] = useState(createCheckEvents);

  // Notifies of a change the quiet syncs of this commit made (Following initialValues, below), before any other
  // layout effect of the form runs. On every commit, since one that only switches a validator off changes no prop the
  // form otherwise watches.
  useLayoutEffect(() => {
    store.flush();
  });

  const storedState = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const { dispatch } = store;

  // The render shows the state synced with this render's props, so this commit's effects never see a switched-off
  // validator's error or the old values. Pure, with no store write: an insertion effect (Following initialValues,
  // below) dispatches the same syncs in the same order, so the store catches up with what was rendered. That effect
  // says why the order matters.
  //
  // The field validators first: a validator switched off ends its check, which drops its error and validating flag.
  // An inline fieldValidators is new on every render, but when it switches nothing this returns the stored state
  // itself, so the initialValues sync below doesn't rerun.
  const validatorsSynced = useMemo(
    () => formReducer(storedState, { type: 'SYNC_FIELD_VALIDATORS', fields: onFields }, initialValues),
    [storedState, onFields, initialValues],
  );

  // Then initialValues and resetKey, on the state that already holds this render's switch-offs
  const formState = useMemo(
    () => formReducer(validatorsSynced, { type: 'SYNC_INITIAL_VALUES', initialValues, resetKey }, initialValues),
    [validatorsSynced, initialValues, resetKey],
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

  // Auto-save's view of the submissions (Auto-save, below), set up before the first submit scheduler. Every
  // scheduler, the one a resetKey reset makes included, reports each settle here, so auto-save decides again once no
  // submission runs.

  // Auto-save's version, and whether it is on and mounted, which effect A switches
  const [autoSaver] = useState(createAutoSave<TValues>);
  // The settles auto-save decides again after. Effect B depends on it.
  const [settleCount, countSettle] = useReducer((count: number) => count + 1, 0);
  // Counts a settle only while auto-save is on, so a form without it renders nothing extra
  const noteSettle = useCallback(() => {
    if (autoSaver.isOn()) countSettle();
  }, [autoSaver]);

  // Decides what an overlapping handleSubmit does: share the running submission, or follow it.
  // A resetKey reset replaces it, so the new record's submits don't join or wait behind the old record's.
  const [firstSubmitScheduler] = useState(() =>
    createSubmitScheduler<TValues, Result<TResult, ValidationError[]>>(noteSettle),
  );
  const submitSchedulerRef = useRef(firstSubmitScheduler);
  // The scheduler the latest resetKey reset retired: the previous record's. Its submissions, auto-save's and Save
  // clicks alike, hold the new record's auto-save until its onIdle reports them settled.
  const retiredSchedulerRef = useRef<SubmitScheduler<TValues, Result<TResult, ValidationError[]>> | undefined>(
    undefined,
  );

  // ===========================================================================
  // Computed State
  // ===========================================================================

  // What the field checks show: the error each holds, and the fields whose validator runs
  const fieldErrors = useMemo(() => fieldErrorsOf(formState.checks.fields), [formState.checks.fields]);
  const validatingFields = useMemo(() => validatingFieldsOf(formState.checks.fields), [formState.checks.fields]);

  // Combined errors: client, then field validators, then per-path server errors, then the submit error.
  // Each later source wins.
  const errors = useMemo(() => {
    const combined: Record<FieldPath, string> = {};

    // Schema errors (base)
    Object.entries(formState.clientErrors).forEach(([path, msg]) => {
      combined[path] = msg;
    });

    // Field validator errors (override schema for same field)
    Object.entries(fieldErrors).forEach(([path, msg]) => {
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
  }, [formState.clientErrors, fieldErrors, formState.serverErrors, formState.submitError]);

  // Public view of server errors: per-path errors plus the submit error at the root key
  const serverErrors = useMemo(
    () =>
      formState.submitError === undefined
        ? formState.serverErrors
        : { ...formState.serverErrors, [ROOT_ERROR_KEY]: formState.submitError },
    [formState.serverErrors, formState.submitError],
  );

  // Valid when no client, field-validator, or per-path server errors exist. The submit error never counts.
  const isValid = isValidState(formState);

  // Derived, not stored, so it also follows new initialValues, such as a saved record passed back in
  const isDirty = useMemo(() => !deepEqual(formState.values, initialValues), [formState.values, initialValues]);

  // Derived: true while a schema check runs, a submission validates, or a field check is pending
  const isValidating = isValidatingState(formState);

  // ===========================================================================
  // Validation Functions
  // ===========================================================================

  /**
   * Runs the schema check under `id`: starts it, then ends it with the errors of a result, or with none on a throw or
   * rejection, which leaves the errors as they were. The throw or rejection still reaches the caller.
   *
   * When its end lands, `onLanded` gets its id, its outcome and the values the form held when it started. It lands
   * when the check was still current as its end was written, and `write` applied that end: not once a newer schema
   * check, a follow or a reset replaced it, nor once `write` dropped the end after a `resetKey` switch.
   */
  const checkSchema = useCallback(
    (
      write: (action: FormAction<TValues>) => void,
      id: CheckId,
      values: TValues,
      onLanded: (id: CheckId, outcome: SchemaOutcome<TValues>, held: TValues) => void,
    ): Result<TValues, ValidationError[]> | Promise<Result<TValues, ValidationError[]>> => {
      const held = store.getState().values;
      const end = (result: Result<TValues, ValidationError[]> | undefined): void => {
        const action: FormAction<TValues> = {
          type: 'END_SCHEMA_CHECK',
          id,
          ...(result !== undefined && { answer: { values, passed: isOk(result), errors: schemaErrorsOf(result) } }),
        };
        const current = store.getState().checks.schema === id;
        write(action);
        if (current && store.getState().checks.schema === undefined) onLanded(id, { values, result }, held);
      };
      write({ type: 'START_SCHEMA_CHECK', id });
      return settling(
        () => validate(values, validator),
        end,
        () => end(undefined),
      );
    },
    [store, validator],
  );

  /**
   * Moves the field's check `id` on with a schema check's outcome, while the check still waits. The outcome is the
   * schema check's of the check's own values, or that of a newer schema check of the form's values, as they were when
   * it started, when that one lands first ({@link moveOnWaitingChecks}). Whichever comes first moves the check on, and
   * a later one finds it no longer waiting.
   *
   * - No result, since the schema validator threw or rejected: the check ends with no error.
   * - A schema error at the field: it ends with no error, so the schema's error shows.
   * - Otherwise it runs the field's validator from the latest commit, on the checked values, and ends with its
   *   answer.
   *
   * A validator that throws ends the check, keeping the error shown, and the throw reaches the caller. One that rejects
   * does too, and the rejection is logged, since nothing awaits it.
   *
   * @param key - The field's normalized path
   * @param id - The check's id
   * @param outcome - The schema check's outcome
   */
  const moveOnWithSchema = useCallback(
    (key: FieldPath, id: CheckId, outcome: SchemaOutcome<TValues>): void => {
      if (!isWaitingFieldCheck(store.getState().checks, key, id)) return;
      const end = (result: FieldCheckResult) => dispatch({ type: 'END_FIELD_CHECK', field: key, id, result });

      if (!outcome.result || own(normalizePathKeys(schemaErrorsOf(outcome.result)), key) !== undefined) {
        end({ error: undefined });
        return;
      }

      dispatch({ type: 'RUN_FIELD_CHECK', field: key, id });
      const answer = settling(
        () => validatorFor(key)?.check(outcome.values),
        (error) => end({ error }),
        () => end('none'),
      );
      // Nothing awaits an async answer, so a rejection is logged
      if (isPromiseLike(answer)) void answer.catch(logValidationError);
    },
    [store, dispatch, validatorFor],
  );

  /**
   * Moves the field checks still waiting that started before the schema check `id` on with its outcome, now that it
   * landed, as if each had waited on it ({@link moveOnWithSchema}). It's the newest schema check, so none of them is
   * left waiting on a result that may never come, such as that of a call a debouncer replaced and never resolves. A
   * check that started after it waits on it as its own schema check, whose continuation moves the check on.
   *
   * Only when it checked the values the form held when it started: a check of other values, such as a `validateForm`
   * of a render's stale copy, says nothing about them, and the checks keep waiting on their own results. An edit made
   * since, as in `blur` mode with no check, doesn't stop it: it still checked the form's values, and is the newest.
   *
   * A throw from a validator is logged: the check belongs to a call that has returned.
   *
   * @param id - The landed schema check's id
   * @param outcome - Its outcome
   * @param held - The values the form held when it started
   */
  const moveOnWaitingChecks = useCallback(
    (id: CheckId, outcome: SchemaOutcome<TValues>, held: TValues): void => {
      const waiting = Object.entries(waitingFieldChecksOf(store.getState().checks.fields, id));
      if (waiting.length === 0) return;
      if (held !== outcome.values && !deepEqual(held, outcome.values)) return;
      for (const [key, check] of waiting) {
        try {
          moveOnWithSchema(key, check.id, outcome);
        } catch (error) {
          logValidationError(error);
        }
      }
    },
    [store, moveOnWithSchema],
  );

  /**
   * Validates the current form values using the Railway-oriented validator and updates error state.
   * Accepts both sync and async validators (MaybeAsyncValidator).
   *
   * - When the validator is sync, returns `Result<TValues, ValidationError[]>` immediately.
   * - When the validator is async, returns `Promise<Result<TValues, ValidationError[]>>`.
   *
   * Each call starts a schema check in the form state, which replaces the schema checks before it, even when it
   * finishes at once. Its errors land only while it is still the current check: a newer schema check, a follow of new
   * `initialValues` or a reset ends it first, and drops its result. When they land and it checked the values the form
   * held when it started, every field check that started before it and still waits on a schema result moves on with
   * this one's.
   *
   * A validator that throws or rejects leaves the errors as they were, ends the check as a result would, and the
   * throw or rejection reaches the caller.
   *
   * Its caller waits for a result, so it isn't an event ({@link checkRecorded}): it checks at once, even when called
   * inside one, such as from `onFieldChange`. That event's pass comes later, with a newer schema check.
   *
   * @param values - The form values to validate (usually form.values)
   * @returns Railway Result or Promise<Result> depending on the validator
   */
  const validateForm = useCallback(
    (values: TValues): Result<TValues, ValidationError[]> | Promise<Result<TValues, ValidationError[]>> =>
      checkSchema(dispatch, store.takeCheckId(), values, moveOnWaitingChecks),
    [store, dispatch, checkSchema, moveOnWaitingChecks],
  );

  /**
   * Starts a schema check that nothing awaits, for an event's pass ({@link checkRecorded}). A rejection is logged,
   * since nothing could catch it, and leaves the check with no result. A sync throw reaches the caller.
   *
   * @param values - The form values to validate
   * @param id - The check's id: one the caller took before starting its field checks
   * @returns The check, for a field validator to wait on
   */
  const startValidation = useCallback(
    (values: TValues, id: CheckId): SchemaCheck<TValues> => {
      const result = checkSchema(dispatch, id, values, moveOnWaitingChecks);
      return isPromiseLike(result) ? result.catch(logValidationError) : result;
    },
    [dispatch, checkSchema, moveOnWaitingChecks],
  );

  /**
   * Starts a check of a field on `values`, waiting on a schema result, and returns its continuation, which takes the
   * schema's check of `values`. The caller starts it after taking that schema check's id and before running it, so the
   * check has the greater id and the schema check's landing leaves it to the continuation. A newer schema check of the
   * form's values, as they were when it started, that lands first moves it on instead ({@link moveOnWaitingChecks}).
   * Whichever comes first moves it on ({@link moveOnWithSchema}): a schema error for the field, or no result, ends it
   * with no error, and otherwise it runs the field's validator from the latest commit and ends with its answer.
   *
   * The check replaces the field's checks before it as soon as it starts. A newer check of the field, a follow, a
   * reset or switching the validator off ends it in the form state, and its result no longer lands. While it runs,
   * the field keeps the error it showed only if the check's inputs are unchanged.
   *
   * After a sync schema result, a validator that throws ends the check, keeping the error shown, and the throw reaches
   * the continuation's caller. After an async one, the validator runs once the caller has returned, so a throw from it
   * is logged. A rejection is logged too, since nothing awaits it.
   *
   * @param key - The field's normalized path
   * @param validator - The field's validator, whose inputs the check records
   * @param values - The values the schema checks
   * @returns The continuation: it takes the schema's check of `values`, from `startValidation`
   */
  const startWaitingCheck = useCallback(
    (
      key: FieldPath,
      validator: FieldCheckFn<TValues>,
      values: TValues,
    ): ((schemaResult: SchemaCheck<TValues>) => void) => {
      const id = store.takeCheckId();
      dispatch({ type: 'START_FIELD_CHECK', field: key, id, status: 'waiting', inputs: inputsOf(validator, values) });

      const afterSchema = (result: Result<TValues, ValidationError[]> | undefined): void =>
        moveOnWithSchema(key, id, { values, result });

      return (schemaResult) => {
        if (isPromiseLike(schemaResult)) {
          // The field validator then runs after the caller returned: a throw from it is logged
          void schemaResult.then(afterSchema).catch(logValidationError);
        } else {
          afterSchema(schemaResult);
        }
      };
    },
    [store, dispatch, moveOnWithSchema],
  );

  /**
   * The check pass: once an event's outermost call returns, it checks what the event recorded, on the values the form
   * holds then. It's the only place that starts a check nothing awaits.
   *
   * 1. The validators it checks are every one a recorded path reaches, through an input path overlapping it, and the
   *    fields a follow recorded whose validator is still on. Each is checked once.
   * 2. It clears the client errors at the recorded paths. A sync schema check sets them again at once, so the cleared
   *    state is never rendered, and while an async one runs, the old errors don't show.
   * 3. It takes the schema check's id, starts a waiting check per validator, runs the schema once, then continues each
   *    one. So each start replaces its field's older waiting check before the landing could move that one on, and the
   *    landing, even at once, leaves the new checks to their continuations.
   *
   * A follow's record also clears every client error while an async schema check runs, or once it threw: the old
   * values' errors don't show on the new ones.
   *
   * @param record - What the event recorded
   * @throws A sync throw from the schema validator, once the field checks ended with no result. Otherwise the first
   *   sync throw from a field validator, once every other one ran. Each later throw is logged.
   */
  const checkRecorded = useCallback(
    (record: EventRecord): void => {
      const { values, clientErrors } = store.getState();
      const paths = [...record.paths];
      const validators = Array.from(fieldValidatorsRef.current).filter(
        ([key, validator]) =>
          record.fields.has(key) || validator.inputs.some((input) => paths.some((path) => pathsOverlap(input, path))),
      );

      const isCleared = (errorPath: FieldPath): boolean => paths.some((path) => isPathAffected(errorPath, path));
      if (Object.keys(clientErrors).some(isCleared)) {
        dispatch({
          type: 'SET_CLIENT_ERRORS',
          errors: Object.fromEntries(Object.entries(clientErrors).filter(([errorPath]) => !isCleared(errorPath))),
        });
      }

      const schemaId = store.takeCheckId();
      const moveOns = validators.map(([key, validator]) => startWaitingCheck(key, validator, values));

      const clearForFollow = (): void => {
        if (record.clearAll && Object.keys(store.getState().clientErrors).length > 0) {
          dispatch({ type: 'SET_CLIENT_ERRORS', errors: {} });
        }
      };

      let schemaResult: SchemaCheck<TValues>;
      try {
        schemaResult = startValidation(values, schemaId);
      } catch (error) {
        // The schema validator threw: the field checks end with no result, and the throw reaches the caller
        clearForFollow();
        moveOns.forEach((moveOn) => moveOn(undefined));
        throw error;
      }
      if (isPromiseLike(schemaResult)) clearForFollow();

      // Every field check moves on, whatever the others throw. The first throw then reaches the caller, and each later
      // one is logged, since only one can.
      let failed: { error: unknown } | undefined;
      for (const moveOn of moveOns) {
        try {
          moveOn(schemaResult);
        } catch (error) {
          if (failed) logValidationError(error);
          else failed = { error };
        }
      }
      if (failed) throw failed.error;
    },
    [store, dispatch, startValidation, startWaitingCheck],
  );

  /**
   * Runs `body` as an event with no caller to throw to, as an effect, a timer or a save's settle does: the mount check,
   * the layout effect's check after a `resetKey` reset and its follow of new `initialValues`, the follow after a save,
   * and auto-save's check. A sync throw is logged, since nothing could catch it.
   *
   * @param body - What the event records
   */
  const runUncalled = useCallback(
    (body: (record: EventRecord) => void): void => {
      try {
        events.run(body, checkRecorded);
      } catch (error) {
        logValidationError(error);
      }
    },
    [events, checkRecorded],
  );

  /**
   * What `mount` mode does on mount and on a reset: asks its event for a schema check, and marks every field touched at
   * once, nested and array items included, so the errors show.
   *
   * @param record - The event's record
   */
  const recordMountCheck = useCallback(
    (record: EventRecord): void => {
      record.schema = true;
      dispatch({ type: 'MARK_ALL_TOUCHED', fields: collectFieldPaths(store.getState().values) });
    },
    [store, dispatch],
  );

  // Validate on mount if enabled. It checks and touches the values the store holds, which equal initialValues unless a
  // child's layout effect already edited them.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (validateOnMount && !didMountRef.current) {
      didMountRef.current = true;
      runUncalled(recordMountCheck);
    }
  }, [validateOnMount, runUncalled, recordMountCheck]);

  // ===========================================================================
  // Following initialValues
  // ===========================================================================

  /**
   * Records the checks of a follow, so the errors describe the values shown. It asks for a check when the mode calls
   * for it, when the form has validated before (a blurred field in `blur` mode, a submit attempt in any mode), or when
   * errors are shown or still being checked. That check re-checks every field whose check was pending or showed an
   * error before the follow, and clears the old values' schema errors while an async schema check runs, as when typing.
   * A field keeps its error while it's re-checked only if the follow left the values it checked unchanged. A mode that
   * wouldn't have validated yet still doesn't. In `mount` mode it marks the new version's fields touched at once.
   *
   * @param record - The event's record
   * @param prev - The state before the follow
   * @param next - The state after it
   */
  const recordFollow = useCallback(
    (record: EventRecord, prev: FormState<TValues>, next: FormState<TValues>): void => {
      const fields = fieldsToRecheck(prev.checks.fields);
      const blurred = validateOnBlur && Object.values(prev.touched).some(Boolean);

      if (
        validateOnChange ||
        validateOnMount ||
        blurred ||
        prev.submitCount > 0 ||
        Object.keys(prev.clientErrors).length > 0 ||
        prev.checks.schema !== undefined ||
        fields.length > 0
      ) {
        record.schema = true;
        record.clearAll = true;
        fields.forEach((key) => record.fields.add(key));
      }

      if (validateOnMount) {
        dispatch({ type: 'MARK_ALL_TOUCHED', fields: collectFieldPaths(next.values) });
      }
    },
    [dispatch, validateOnChange, validateOnBlur, validateOnMount],
  );

  // Tells whether initialValues changes on its own, from how its versions line up with the form's own updates
  const [stabilityCheck] = useState(createStabilityCheck<FormState<TValues>>);

  // The state before this commit's sync, when the sync changed it. The layout effect below runs its side effects.
  const syncedFromRef = useRef<FormState<TValues> | undefined>(undefined);

  // The store catches up with the synced state this render showed before any layout effect of the commit runs, a
  // child's included, so a child's write or submit acts on that state. Only the parts that run no app code are
  // here: the syncs, and on a resetKey reset, the switch to a fresh submit scheduler. In the render's order, field
  // validators first, so the state a follow starts from already holds this commit's switch-offs: the follow doesn't
  // re-check a field whose validator just went off. Quietly, since an insertion effect mustn't schedule a render: the
  // layout effect that flushes the store (State Store, above) notifies.
  useInsertionEffect(() => {
    fieldValidatorsRef.current = byPath;
    store.dispatchQuietly({ type: 'SYNC_FIELD_VALIDATORS', fields: onFields });
    const prev = store.getState();
    store.dispatchQuietly({ type: 'SYNC_INITIAL_VALUES', initialValues, resetKey });
    const next = store.getState();
    if (next === prev) return;
    syncedFromRef.current = prev;
    if (next.generation !== prev.generation) {
      // Started over. The old record's running submission and waiting follow-up still run as the old record's,
      // and the follow-up submits the values the form held. The new record's submits start on a fresh scheduler.
      submitSchedulerRef.current.retire(prev.values);
      retiredSchedulerRef.current = submitSchedulerRef.current;
      submitSchedulerRef.current = createSubmitScheduler(noteSettle);
    }
  });

  // Runs the side effects of a follow or a `resetKey` reset on the values the form now holds, once the store has
  // notified of the state it caught up to. Each is an event with no caller, so a throw from its check is logged.
  // storedState is a dependency, so this runs at every change of the form's state as well as of the props:
  // that's how the stability check tells an outside render, a catch-up and a form update apart. initialValues and
  // resetKey are, so a commit whose sync changed the state always runs it.
  useLayoutEffect(() => {
    const prev = syncedFromRef.current;
    syncedFromRef.current = undefined;
    if (prev) {
      const now = store.getState();
      if (now.generation !== prev.generation) {
        if (validateOnMount) runUncalled(recordMountCheck);
      } else if (now.baselineEpoch !== prev.baselineEpoch) {
        runUncalled((record) => recordFollow(record, prev, now));
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
    runUncalled,
    recordMountCheck,
    recordFollow,
    validateOnMount,
  ]);

  // ===========================================================================
  // Field Management Functions
  // ===========================================================================

  /**
   * Applies an edit. One that undoes the last unsaved edit makes the form follow the latest version: it then records a
   * follow's checks in the event, which replace the edit's own validation.
   *
   * @param action - The edit
   * @param record - The event's record
   * @returns Whether the edit made the form follow the latest version
   */
  const applyEdit = useCallback(
    (action: FormAction<TValues>, record: EventRecord): boolean => {
      const prev = store.getState();
      dispatch(action);
      const next = store.getState();
      if (next.baselineEpoch === prev.baselineEpoch) return false;
      recordFollow(record, prev, next);
      return true;
    },
    [store, dispatch, recordFollow],
  );

  /**
   * Updates a single field value and optionally triggers validation.
   * Automatically marks the field as touched (in "live" mode) and clears related server errors.
   *
   * Validation runs once, after the outermost call returns: a call made inside `onFieldChange` joins this one. The
   * schema then runs once, and so does each field validator on this field, on a field inside it or on one containing
   * it, on the values as they are then. A sync throw from either reaches the outermost call.
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
    <TValue>(field: FieldPath, value: TValue, shouldValidate = validateOnChange): void =>
      events.run((record) => {
        // Store the value first, so onFieldChange and any setFieldValue calls it makes build on it
        const followed = applyEdit({ type: 'SET_FIELD_VALUE', field, value }, record);

        onFieldChangeRef.current?.(field, value, store.getState().values);

        // Mark touched on first change for immediate error visibility
        if (touchOnChange && !own(store.getState().touched, normalizePath(field))) {
          dispatch({ type: 'SET_FIELD_TOUCHED', field, isTouched: true });
        }

        // The pass validates the values as they are after any onFieldChange cascade. A follow recorded its own checks.
        if (shouldValidate && !followed) {
          record.schema = true;
          record.paths.add(normalizePath(field));
        }
      }, checkRecorded),
    [store, dispatch, events, applyEdit, validateOnChange, touchOnChange, checkRecorded],
  );

  /**
   * Updates multiple field values simultaneously and optionally triggers validation.
   * More efficient than calling setFieldValue multiple times when updating several fields.
   * Automatically clears server errors for affected fields.
   *
   * Validation runs once, after the outermost call returns, as for `setFieldValue`: the schema, and each field
   * validator that a value it changed reaches. A value equal to the one before isn't a change, so a whole-record
   * `setValues` re-runs only the validators of what changed. The schema errors at the changed paths clear while an
   * async schema check runs.
   *
   * A record to load goes in `initialValues` instead, which the form follows while it has no unsaved edits.
   *
   * @param newValues - Partial object containing the fields to update. A plain nested object merges
   *   into the object there, as `setFieldValue` on each of its keys would. Every other value, such as
   *   an array, `File`, `Map` or class instance, replaces the value before it and is stored as given.
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
    (newValues: DeepPartial<TValues>, shouldValidate = validateOnChange): void =>
      events.run((record) => {
        const before = store.getState().values;
        const followed = applyEdit({ type: 'SET_VALUES', values: newValues }, record);

        // A follow recorded its own checks
        if (shouldValidate && !followed) {
          record.schema = true;
          changedPaths(before, newValues).forEach((path) => record.paths.add(path));
        }
      }, checkRecorded),
    [store, events, applyEdit, validateOnChange, checkRecorded],
  );

  /**
   * Marks a field as touched or untouched and optionally triggers validation.
   * Touched fields typically display their validation errors to the user.
   *
   * Validation runs once, after the outermost call returns, as for `setFieldValue`. Outside `live` mode it checks the
   * schema and the field validators the field reaches. In `live` mode, typing has checked the field already, so only
   * its first touch checks, and only the schema.
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
    (field: FieldPath, isTouched = true, shouldValidate = validateOnBlur): void =>
      events.run((record) => {
        const key = normalizePath(field);
        const wasTouched = own(store.getState().touched, key);
        dispatch({
          type: 'SET_FIELD_TOUCHED',
          field,
          isTouched,
        });

        if (shouldValidate) {
          if (!validateOnChange) {
            // In non-live modes, run field validators on blur
            record.schema = true;
            record.paths.add(key);
          } else if (!wasTouched) {
            // Live mode: only validate on first touch (focus→blur without typing).
            // After onChange has run (which sets touched), blur is redundant.
            record.schema = true;
          }
        }
      }, checkRecorded),
    [store, dispatch, events, validateOnBlur, validateOnChange, checkRecorded],
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
   * It runs the field validators that are on when it reaches them. A check whose validator is switched off before
   * they all end is still waited for, then counts as never run, as the form shows it.
   *
   * The submission belongs to the form state of `generation`. After a `resetKey` reset it still runs
   * and resolves, but none of its writes land. It then runs the field validators its record had when `handleSubmit`
   * was called, not the new record's, and every check counts, as a remount's would.
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
   * @param validatorsAtCall - The field validators when `handleSubmit` was called, for a record a `resetKey` reset
   *   retired
   * @returns Promise<Result<TResult, ValidationError[]>> - `onSubmit`'s Result, the validated data, or errors
   */
  const runSubmission = useCallback(
    async (
      values: TValues,
      generation: number,
      staleShown: boolean,
      validatorsAtCall: ReadonlyMap<FieldPath, FieldCheckFn<TValues>>,
    ): Promise<Result<TResult, ValidationError[]>> => {
      const send = dispatchIn(generation);

      // Every statement is inside this try and every step is awaited, so its catch sees every throw and rejection
      try {
        const { clientErrors, serverErrors, baselineEpoch, lastVersion, otherVersions } = store.getState();

        // Whether the submitted values are still the baseline: a follow of new initialValues or a resetForm()
        // replaces them
        const isBaseline = (): boolean => store.getState().baselineEpoch === baselineEpoch;

        // Whether the save would overwrite a newer version of the record. After a resetKey switch, the previous
        // record's save still goes out, as a remount's would.
        const isOvertaken = (): boolean => {
          const now = store.getState();
          if (now.generation !== generation) return false;
          // A staleness the caller couldn't see, because isStale reads false while isSubmitting
          if (now.isStale && !staleShown) return true;
          // None arrived since, other than the previous save's answer: the save doesn't overwrite that save's own
          if (now.otherVersions === otherVersions) return false;
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

        // The submission's checks all hold this id. Its schema check replaces the schema checks running before it,
        // and its field checks replace those of their fields. A check that starts after it, as typing starts one,
        // checks newer values, and replaces it in turn. After a resetKey reset, send drops the start: a follow-up of
        // the previous record can start during the new record's, whose checks stay.
        const checkId = store.takeCheckId();

        // Show validating state during submit validation. Its own flag: a check that typing starts meanwhile, and
        // ends, doesn't end this one.
        send({ type: 'SET_SUBMIT_VALIDATING', isSubmitValidating: true });

        let validationResult: Result<TValues, ValidationError[]>;
        try {
          // Starts and ends the schema check (await handles both sync and async validators). When it lands, the field
          // checks still waiting move on with it if the submission stops here: its schema failed, threw or rejected.
          // Otherwise its field step's checks replace them, so no validator runs twice.
          validationResult = await checkSchema(send, checkId, values, (id, outcome, held) => {
            if (!outcome.result || isErr(outcome.result)) moveOnWaitingChecks(id, outcome, held);
          });
        } finally {
          send({ type: 'SET_SUBMIT_VALIDATING', isSubmitValidating: false });
        }

        if (isErr(validationResult)) {
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
          // Run the field validators that are on now, before calling onSubmit, or after a resetKey switch, those the
          // record had. Their checks show while they run, unless a follow or reset replaced the submitted values.
          const checkErrors = await checkFieldsForSubmit(
            store,
            store.getState().generation === generation ? fieldValidatorsRef.current : validatorsAtCall,
            values,
            checkId,
            generation,
            send,
            isBaseline(),
          );
          if (checkErrors.length > 0) return err(checkErrors);

          // A successful save settles the baseline. With savedValues, the save's answer is the version equal to what
          // it stored. Without, a version that arrived while it ran is the answer: the form follows it, or bases the
          // edits on it. A latest version equal to the base isn't: it's the previous save's answer or the old base
          // coming back. Inside the try, so isSubmitting stays true until the finally. A dropped write leaves the
          // epoch as it was, so nothing follows.
          const settleSuccess = (result: TResult) => {
            let saved: TValues | undefined;
            try {
              saved = savedValues?.(result);
            } catch (error) {
              // The save succeeded all the same: without what it stored, the form finds its answer as it does without
              // savedValues
              console.error('Form submission error:', error);
            }
            const before = store.getState();
            send({
              type: 'SUBMIT_SUCCEEDED',
              values,
              baselineEpoch,
              lastVersion,
              ...(saved !== undefined && { saved }),
            });
            const after = store.getState();
            if (after.baselineEpoch !== before.baselineEpoch) {
              runUncalled((record) => recordFollow(record, before, after));
            }
          };

          // The last check before the save goes out
          if (isOvertaken()) {
            send({ type: 'SET_SUBMIT_ERROR', submitError: changedWhileSavingMessage });
            return err([{ path: [], message: changedWhileSavingMessage }]);
          }

          // The save goes out: onSubmit is called, or with none set, the submission ends here. Whatever it answers,
          // auto-save doesn't send these values again.
          send({ type: 'SUBMISSION_WENT_OUT', values });

          if (!onSubmit) {
            // Nothing was saved, so the values stay edits: a newer version arriving later doesn't replace them.
            // Cast: without an onSubmit TResult defaults to TValues, so the validated values are the success value.
            // The one hole is an explicit useForm<T, U> with no onSubmit at all.
            return ok(validData) as Result<TResult, ValidationError[]>;
          }

          const outcome = await onSubmit(validData);

          if (outcome === undefined) {
            // Cast: OnSubmit's member that returns nothing requires TResult ≡ TValues
            const result = validData as unknown as TResult;
            settleSuccess(result);
            return ok(result);
          }

          if (!isResult(outcome)) throw new TypeError('onSubmit must return a Result or nothing');

          if (isErr(outcome)) {
            if (isBaseline()) {
              // An error describes the submitted value, so it doesn't land on a field edited during the save, just
              // as an edit after the save clears it
              const shown = store.getState().values;
              placeErrorsWith(send, outcome.error, (path) =>
                deepEqual(getValueByPath(shown, path), getValueByPath(values, path)),
              );
            } else {
              // A follow or resetForm() replaced the submitted values, so the field errors would describe values no
              // longer shown. The submit error is about the attempt, and still shows.
              const submitError = formatErrors(outcome.error)[ROOT_ERROR_KEY];
              if (submitError !== undefined) send({ type: 'SET_SUBMIT_ERROR', submitError });
            }
          } else {
            settleSuccess(outcome.value);
          }

          return outcome;
        } finally {
          send({
            type: 'SET_SUBMITTING',
            isSubmitting: false,
          });
        }
      } catch (error) {
        // A throw went out too, with no verdict on the values, so auto-save doesn't resubmit them in a loop. When
        // onSubmit threw, this reports the values a second time, which changes nothing.
        send({ type: 'SUBMISSION_WENT_OUT', values });
        console.error('Form submission error:', error);

        // Sets only the submit error: field errors placed during the submission stay
        send({ type: 'SET_SUBMIT_ERROR', submitError: submitFailedMessage });
        return err([{ path: [], message: submitFailedMessage }]);
      }
    },
    [
      store,
      checkSchema,
      moveOnWaitingChecks,
      onSubmit,
      savedValues,
      runUncalled,
      recordFollow,
      dispatchIn,
      submitFailedMessage,
      changedWhileSavingMessage,
    ],
  );

  /**
   * Handles form submission using the Railway-oriented programming pattern.
   * Validates all fields, marks them as touched, and calls onSubmit if validation passes.
   * Returns a Promise that resolves to a Result and never rejects:
   * - `ok` with `onSubmit`'s `ok` value, or with the validated data when `onSubmit` returns nothing or is absent.
   *   Without `onSubmit`, nothing is saved, so the values stay edits.
   * - `err` with the validation errors, or with `onSubmit`'s `err`, whose errors are placed on their fields, except
   *   on fields changed during the save
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
      // The record's field validators, for a submission that runs once a resetKey switch retired the record
      const validatorsAtCall = fieldValidatorsRef.current;
      return submitSchedulerRef.current.submit(
        () => store.getState().values,
        (values) => runSubmission(values, generation, staleShown, validatorsAtCall),
      );
    },
    [store, runSubmission],
  );

  /**
   * Resets the form to its initial state.
   * Clears all values (back to initialValues), errors, and touched state.
   * If validationMode is "mount", validates and marks every field touched, as on mount, so the errors show. Its check
   * runs once the outermost call returns, as for `setFieldValue`, and a sync throw from the schema reaches the caller.
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
  const resetForm = useCallback(
    (): void =>
      events.run((record) => {
        dispatch({
          type: 'RESET_FORM',
        });

        // As on mount: validate, and mark every field touched so the errors show
        if (validateOnMount) recordMountCheck(record);
      }, checkRecorded),
    [dispatch, events, recordMountCheck, validateOnMount, checkRecorded],
  );

  // ===========================================================================
  // Auto-save
  // ===========================================================================

  // Auto-save decides only in effect B and in its timer's callback, never inside a dispatch or a method's cascade, and
  // reads the store, never a render's state. A submission's settle doesn't decide: it counts (noteSettle, above), and
  // the commit that follows decides. The auto-saver sits above too, since noteSettle reads whether it is on.

  // The latest commit's runAutoSave, so a delay an earlier render started saves through the latest onSubmit. Set
  // before any effect runs (below).
  const runAutoSaveRef = useRef<() => void>(() => {});

  // Restarts the tracked version's delay with the latest commit's length: a delay already running keeps its own.
  // Unmounting cancels it, and one that ends after auto-save is switched off finds no version to save.
  const restartDelay = useDebounce(() => {
    autoSaver.delayEnded();
    runAutoSaveRef.current();
  }, autoSaveDelay);

  /**
   * Decides auto-save's next step for the values the store holds now, and takes it. Values that changed start a new
   * version and its delay. Values the form hasn't checked get one schema check per version, and another once a follow
   * or reset ends that check, or a check of other values lands in its place. A throw or rejection from the schema
   * validator is logged. Otherwise, once nothing holds them, they're submitted through `handleSubmit`. Does nothing
   * while auto-save is off or unmounted.
   */
  const runAutoSave = (): void => {
    if (!autoSaver.isOn()) return;
    const state = store.getState();

    if (autoSaver.track(state.values)) restartDelay();

    const step = autoSaver.decide(() => ({
      isDirty: !deepEqual(state.values, store.getInitialValues()),
      verdict: state.verdict,
      isChecking: state.checks.schema !== undefined,
      isValidating: isValidatingState(state),
      isValid: isValidState(state),
      isStale: state.isStale,
      isSubmitting: submitSchedulerRef.current.isBusy() || retiredSchedulerRef.current?.isBusy() === true,
      wentOut: state.wentOut,
      baselineEpoch: state.baselineEpoch,
    }));

    if (step === 'check') {
      runUncalled((record) => {
        record.schema = true;
      });
    } else if (step === 'submit') {
      // handleSubmit never rejects, and the scheduler's onIdle reports the settle
      void handleSubmit();
    }
  };

  // Before any effect of the commit runs, a child's included. No ref is written during render.
  useInsertionEffect(() => {
    runAutoSaveRef.current = runAutoSave;
  });

  // Effect A. Switching auto-save off drops a version waiting out its delay, and switching it on starts a fresh delay.
  // A save already running finishes.
  useEffect(() => {
    if (autoSaveOn) autoSaver.start();
    return autoSaver.stop;
  }, [autoSaveOn, autoSaver]);

  // Effect B. Decides after each commit that may have changed what auto-save reads: the form's state, the initial
  // values, the switch, or a settle. After effect A, so A's setup has run when both run in one commit.
  useEffect(() => {
    runAutoSaveRef.current();
  }, [storedState, initialValues, autoSaveOn, settleCount]);

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
      const err = own(errors, key);
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
        return own(formState.touched, key) ? own(errors, key) : undefined;
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
    fieldErrors,
    isSubmitting: formState.isSubmitting,
    isValidating,
    validatingFields,
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
