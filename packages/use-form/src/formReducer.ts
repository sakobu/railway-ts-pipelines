import {
  NO_CHECKS,
  endFieldCheck,
  endPendingChecks,
  endSchemaCheck,
  markFieldCheckRunning,
  startFieldCheck,
  startOver,
  startSchemaCheck,
  syncValidators,
} from './formChecks';
import {
  deepEqual,
  deepMerge,
  getValueByPath,
  normalizePath,
  normalizePathKeys,
  pathsOverlap,
  setValueByPath,
} from './utils';

import type { ChecksState, FieldPath, FormAction, FormState, ResetKey } from './types';

/**
 * The one empty map shared by a fresh state's maps, a follow's server errors, cleared server errors and a valid
 * result's client errors. A render that derives a state and the store that computes the same state then hold the
 * same map, and clearing errors that were already empty keeps their identity, so values derived from them do too.
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
  checks: NO_CHECKS,
  isSubmitting: false,
  isSubmitValidating: false,
  submitCount: 0,
  lastVersion: initialValues,
  cleanValues: initialValues,
  baseVersion: initialValues,
  isStale: false,
  otherVersions: 0,
  resetKey,
  generation: 0,
  baselineEpoch: 0,
});

/**
 * Whether values equal to the latest version may count as clean. Not while a submission runs: the latest version
 * may be an optimistic write that a failed save rolls back, and counting it clean would let the rollback replace
 * the values. Nor while a save's answer is pending: the latest version is then the one from before the save.
 */
const latestIsSettled = <TValues extends Record<string, unknown>>(state: FormState<TValues>): boolean =>
  !state.isSubmitting && state.baseVersion !== undefined;

/** Treats the values shown, equal to the latest version, as clean and as based on it, without changing them. */
const settleOnLatest = <TValues extends Record<string, unknown>>(state: FormState<TValues>): FormState<TValues> => {
  const { saved: _saved, ...rest } = state;
  return { ...rest, cleanValues: state.lastVersion, baseVersion: state.lastVersion, isStale: false };
};

/** Shows `version`, and treats it as clean and as the base of any later edits. */
const followVersion = <TValues extends Record<string, unknown>>(
  state: FormState<TValues>,
  version: TValues,
): FormState<TValues> => {
  const { submitError: _submitError, saved: _saved, ...rest } = state;
  return {
    ...rest,
    values: version,
    serverErrors: EMPTY,
    lastVersion: version,
    cleanValues: version,
    baseVersion: version,
    isStale: false,
    checks: endPendingChecks(state.checks),
    baselineEpoch: state.baselineEpoch + 1,
  };
};

/**
 * The state after a successful save whose answer is the latest version: the form follows it when nothing was typed
 * since the save started, or bases the edits on it.
 *
 * @param state - The state when the save settles
 * @param submitted - The values the save submitted
 */
const answeredBy = <TValues extends Record<string, unknown>>(
  state: FormState<TValues>,
  submitted: TValues,
): FormState<TValues> => {
  if (deepEqual(state.values, submitted)) return followVersion(state, state.lastVersion);
  if (deepEqual(state.values, state.lastVersion)) return settleOnLatest(state);
  const { saved: _saved, ...rest } = state;
  return { ...rest, cleanValues: submitted, baseVersion: state.lastVersion, isStale: false };
};

/**
 * The state after an edit set `values` and kept `serverErrors`. The edit clears the submit error. Values that
 * come to equal the latest version end `isStale`, and count as clean when {@link latestIsSettled} allows. Values
 * that come back to the clean values leave no unsaved edits, so the form follows the latest version then, as a form
 * with no edits does. The comparisons only run once a version arrived under edits, so most forms pay nothing for them.
 */
const withEdit = <TValues extends Record<string, unknown>>(
  state: FormState<TValues>,
  values: TValues,
  serverErrors: Record<FieldPath, string>,
): FormState<TValues> => {
  const { submitError: _submitError, ...rest } = state;
  const next = { ...rest, values, serverErrors };
  if (state.cleanValues === state.lastVersion) return next;
  if (deepEqual(values, state.lastVersion)) {
    return latestIsSettled(next) ? settleOnLatest(next) : { ...next, isStale: false };
  }
  if (latestIsSettled(next) && deepEqual(values, state.cleanValues)) return followVersion(next, state.lastVersion);
  return next;
};

/** Sets the client errors, as `SET_CLIENT_ERRORS` and a current schema check's end do. */
const withClientErrors = <TValues extends Record<string, unknown>>(
  state: FormState<TValues>,
  errors: Record<FieldPath, string>,
): FormState<TValues> => {
  const clientErrors = normalizePathKeys(errors);
  // A valid result keeps the shared empty map, so values derived from it, like `errors`, keep their identity
  return { ...state, clientErrors: Object.keys(clientErrors).length === 0 ? EMPTY : clientErrors };
};

/** Sets the checks. Checks a rule left unchanged keep the state itself, so the store skips notifying. */
const withChecks = <TValues extends Record<string, unknown>>(
  state: FormState<TValues>,
  checks: ChecksState,
): FormState<TValues> => (checks === state.checks ? state : { ...state, checks });

/** Applies one action; `formReducer` then applies the clean rule to its result. */
const reduce = <TValues extends Record<string, unknown>>(
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

      return withEdit(state, newValues, newServerErrors);
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

      return withEdit(state, newValues, newServerErrors);
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
      return withClientErrors(state, action.errors);

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

    case 'SET_SUBMIT_VALIDATING':
      return { ...state, isSubmitValidating: action.isSubmitValidating };

    case 'SYNC_FIELD_VALIDATORS':
      return withChecks(state, syncValidators(state.checks, action.fields));

    case 'START_SCHEMA_CHECK':
      return withChecks(state, startSchemaCheck(state.checks, action.id));

    case 'END_SCHEMA_CHECK': {
      // endSchemaCheck changes the checks only when the check is current, so a new state means its errors land
      const ended = withChecks(state, endSchemaCheck(state.checks, action.id));
      if (ended === state || action.errors === undefined) return ended;
      return { ...withClientErrors(ended, action.errors), checkedValues: action.values };
    }

    case 'SUBMISSION_WENT_OUT':
      return state.wentOut === action.values ? state : { ...state, wentOut: action.values };

    case 'START_FIELD_CHECK':
      return withChecks(
        state,
        startFieldCheck(state.checks, normalizePath(action.field), action.id, action.status, action.value),
      );

    case 'RUN_FIELD_CHECK':
      return withChecks(state, markFieldCheckRunning(state.checks, normalizePath(action.field), action.id));

    case 'END_FIELD_CHECK':
      return withChecks(state, endFieldCheck(state.checks, normalizePath(action.field), action.id, action.result));

    case 'RESET_FORM': {
      // initialValues built inline is a new object on every render. One equal to the latest version by content is
      // that version, so it keeps its identity: a submission tells by it whether a new version arrived.
      const version = deepEqual(initialValues, state.lastVersion) ? state.lastVersion : initialValues;
      return {
        ...createInitialFormState(version, state.resetKey),
        checks: startOver(state.checks),
        otherVersions: state.otherVersions,
        generation: state.generation,
        baselineEpoch: state.baselineEpoch + 1,
      };
    }

    case 'SYNC_INITIAL_VALUES': {
      const { initialValues: version, resetKey } = action;
      if (!Object.is(resetKey, state.resetKey)) {
        return {
          ...createInitialFormState(version, resetKey),
          checks: startOver(state.checks),
          generation: state.generation + 1,
          baselineEpoch: state.baselineEpoch + 1,
        };
      }
      if (deepEqual(version, state.lastVersion)) return state;
      const pending = state.baseVersion === undefined;
      // While a save's answer is pending, the save's own copy of the submitted values isn't a new version
      if (pending && state.saved !== undefined && deepEqual(version, state.cleanValues)) {
        return { ...state, lastVersion: version };
      }
      // The version arriving while a save's answer is pending is that answer, and becomes the base: the one equal to
      // what the save stored, when savedValues gave it, or else the first. Any other counts.
      const isAnswer = pending && (state.saved === undefined || deepEqual(version, state.saved));
      const counted = isAnswer ? state : { ...state, otherVersions: state.otherVersions + 1 };
      if (deepEqual(state.values, state.cleanValues)) return followVersion(counted, version);
      const { saved: _saved, ...answered } = counted;
      const arrived = isAnswer
        ? { ...answered, lastVersion: version, baseVersion: version }
        : { ...counted, lastVersion: version };
      if (deepEqual(state.values, version)) {
        return latestIsSettled(arrived) ? settleOnLatest(arrived) : { ...arrived, isStale: false };
      }
      return { ...arrived, isStale: !deepEqual(arrived.baseVersion, version) };
    }

    case 'SUBMIT_SUCCEEDED': {
      if (action.baselineEpoch !== state.baselineEpoch) return state;
      const { values: submitted, saved } = action;
      // Within one epoch only a version arriving while the form has edits moves lastVersion
      const arrivedDuring = state.lastVersion !== action.lastVersion;

      if (saved !== undefined) {
        // savedValues gave what the save stored: the version equal to it is the answer, whenever it arrives
        if (deepEqual(state.lastVersion, saved)) return answeredBy(state, submitted);
        // Not here yet. A version that arrived during the save, other than its copy of the submitted values, is
        // someone else's change: the form follows it, or reports it until the answer arrives after it.
        const theirs = arrivedDuring && !deepEqual(state.lastVersion, submitted);
        if (theirs && deepEqual(state.values, submitted)) return followVersion(state, state.lastVersion);
        return { ...state, cleanValues: submitted, baseVersion: undefined, saved, isStale: theirs };
      }

      // A latest version equal to the base, by content, isn't this save's answer either: it's the previous save's
      // answer, pending when this save started and made the base when it arrived, or the old base coming back
      if (!arrivedDuring || deepEqual(state.baseVersion, state.lastVersion)) {
        // None arrived for this submission: the next one to arrive is the server's answer. Unless the submitted
        // values equal the latest version: the answer then has the same content, so it never arrives as a new
        // version, and the latest version stays the base.
        const answered = deepEqual(submitted, state.lastVersion);
        return {
          ...state,
          cleanValues: submitted,
          baseVersion: answered ? state.lastVersion : undefined,
          isStale: false,
        };
      }
      // One arrived: the server's answer, delivered before onSubmit returned. The save succeeded, so it's settled.
      return answeredBy(state, submitted);
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
 * - Tracking checks: the schema check, each field's validator and its checks
 *
 * Values equal to the initial values leave nothing that went out to remember, so `wentOut` is dropped from the
 * result of every action, the ones that change nothing included.
 *
 * All state updates are performed immutably, never mutating the existing state. Some actions
 * return the same state object when they change nothing, so the store can skip notifying:
 * SET_FIELD_VALUE with the field's current value, SYNC_INITIAL_VALUES with the version already
 * synced, a SUBMIT_SUCCEEDED from before a follow or reset, and a check action that changes no checks,
 * such as one for a check that is no longer current. Server errors are automatically cleared when
 * related fields are modified to provide a smooth user experience.
 *
 * @template TValues - The type of form values being managed
 *
 * @param state - The current form state before the action is applied
 * @param action - The action to perform (e.g., SET_FIELD_VALUE, SET_CLIENT_ERRORS, RESET_FORM)
 * @param initialValues - Initial form values used when resetting the form
 * @returns A new state object, or the same one for the no-op cases above, unless the clean rule drops `wentOut`
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
  const next = reduce(state, action, initialValues);
  if (next.wentOut === undefined || !deepEqual(next.values, initialValues)) return next;
  const { wentOut: _wentOut, ...rest } = next;
  return rest;
};
