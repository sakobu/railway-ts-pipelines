import { deepEqual, getValueByPath, own } from './utils';

import type {
  CheckId,
  CheckInputs,
  ChecksState,
  FieldCheck,
  FieldCheckResult,
  FieldPath,
  FollowChecks,
  PendingStatus,
  ValidatorState,
} from './types';

// One frozen empty record, shared by every selector and default that has nothing to show.
const EMPTY: Readonly<Record<string, never>> = Object.freeze({});

/**
 * The record with the entries set, or the record itself when there are none. Each becomes an own entry, even one keyed
 * `__proto__`, which an assignment would take for the prototype.
 */
const withEntries = <T>(
  record: Readonly<Record<FieldPath, T>>,
  entries: readonly [FieldPath, T][],
): Readonly<Record<FieldPath, T>> => (entries.length === 0 ? record : { ...record, ...Object.fromEntries(entries) });

/** Whether a check is pending: waiting on a schema result, or running. */
const isPending = (check: FieldCheck): boolean => check.status !== 'done';

/**
 * Whether a check's verdict on its inputs is still open or shows: it's pending, shows an error, or waits held back by
 * the schema gate. An edit of its inputs outdates such a check.
 */
const isOpen = (check: FieldCheck): boolean => isPending(check) || check.error !== undefined || check.gated === true;

/** The check ended with no error, keeping its id and inputs, and no longer held back. */
const endedWithoutError = (check: FieldCheck): FieldCheck => ({ id: check.id, status: 'done', inputs: check.inputs });

/** The checks of a form that has run none, with no field validators. */
export const NO_CHECKS: ChecksState = Object.freeze({
  schema: undefined,
  fields: EMPTY,
  validators: EMPTY,
});

/** Drops the schema check and every field check, and keeps the validators. */
export const startOver = (checks: ChecksState): ChecksState =>
  checks.schema === undefined && Object.keys(checks.fields).length === 0
    ? checks
    : { schema: undefined, fields: EMPTY, validators: checks.validators };

/**
 * Brings the validators in line with the fields that have one on now. A validator that goes off
 * ends its check with no error, and its period goes up. One that comes back keeps its period.
 */
export const syncValidators = (checks: ChecksState, on: ReadonlySet<FieldPath>): ChecksState => {
  const validators: [FieldPath, ValidatorState][] = [];
  const fields: [FieldPath, FieldCheck][] = [];

  for (const [key, validator] of Object.entries(checks.validators)) {
    if (validator.on && !on.has(key)) {
      validators.push([key, { on: false, period: validator.period + 1 }]);
      const check = own(checks.fields, key);
      if (check) fields.push([key, endedWithoutError(check)]);
    } else if (!validator.on && on.has(key)) {
      validators.push([key, { on: true, period: validator.period }]);
    }
  }
  for (const key of on) {
    if (!Object.hasOwn(checks.validators, key)) validators.push([key, { on: true, period: 0 }]);
  }

  // A field check changes only along with its validator
  if (validators.length === 0) return checks;
  return {
    ...checks,
    validators: withEntries(checks.validators, validators),
    fields: withEntries(checks.fields, fields),
  };
};

/** The period of a field's validator, or `undefined` while it is off. */
export const validatorPeriod = (checks: ChecksState, key: FieldPath): number | undefined => {
  const validator = own(checks.validators, key);
  return validator?.on ? validator.period : undefined;
};

/** Registers a schema check, unless a newer one is already registered. */
export const startSchemaCheck = (checks: ChecksState, id: CheckId): ChecksState =>
  checks.schema !== undefined && checks.schema >= id ? checks : { ...checks, schema: id };

/** Clears the schema check when it is `id`, and returns its input otherwise. */
export const endSchemaCheck = (checks: ChecksState, id: CheckId): ChecksState =>
  checks.schema === id ? { ...checks, schema: undefined } : checks;

/**
 * Registers a field check, only while the field's validator is on and `id` is newer than its
 * current check. The replaced check's error stays shown only while every input is unchanged.
 */
export const startFieldCheck = (
  checks: ChecksState,
  key: FieldPath,
  id: CheckId,
  status: PendingStatus,
  inputs: CheckInputs,
): ChecksState => {
  if (!own(checks.validators, key)?.on) return checks;
  const replaced = own(checks.fields, key);
  if (replaced && replaced.id >= id) return checks;
  const next: FieldCheck = { id, status, inputs };
  if (replaced?.error !== undefined && deepEqual(replaced.inputs, inputs)) next.error = replaced.error;
  return { ...checks, fields: { ...checks.fields, [key]: next } };
};

/** Whether `values` hold every input a check recorded: each path's value deep-equals the recorded one. */
export const inputsHeld = (inputs: CheckInputs, values: Record<string, unknown>): boolean =>
  Object.entries(inputs).every(([path, value]) => deepEqual(getValueByPath(values, path), value));

/**
 * Ends every check that is pending, shows an error or is held back by the schema gate, and whose inputs `values` no
 * longer hold. It ends with no error, no longer held back, and keeps its id and inputs.
 */
export const endOutdatedChecks = (checks: ChecksState, values: Record<string, unknown>): ChecksState => {
  const ended: [FieldPath, FieldCheck][] = [];
  for (const [key, check] of Object.entries(checks.fields)) {
    if (isOpen(check) && !inputsHeld(check.inputs, values)) ended.push([key, endedWithoutError(check)]);
  }
  return ended.length === 0 ? checks : { ...checks, fields: withEntries(checks.fields, ended) };
};

/** The field's check `id`, while it is the field's latest check and has not ended. */
const currentFieldCheck = (checks: ChecksState, key: FieldPath, id: CheckId): FieldCheck | undefined => {
  const check = own(checks.fields, key);
  return check?.id === id && isPending(check) ? check : undefined;
};

/**
 * The field's check `id`, while it is the field's latest check and still waits on a schema result. Only a waiting
 * check moves on with one: once the first result moved it on, a later one finds it running or done.
 */
export const waitingFieldCheck = (checks: ChecksState, key: FieldPath, id: CheckId): FieldCheck | undefined => {
  const check = own(checks.fields, key);
  return check?.id === id && check.status === 'waiting' ? check : undefined;
};

/** Moves the field's current check from waiting to running. */
export const markFieldCheckRunning = (checks: ChecksState, key: FieldPath, id: CheckId): ChecksState => {
  const check = waitingFieldCheck(checks, key, id);
  if (!check) return checks;
  return { ...checks, fields: { ...checks.fields, [key]: { ...check, status: 'running' } } };
};

/**
 * Ends the field's current check. A result with an error shows it, and one without clears it.
 * `'none'` keeps the error shown. `'gated'` clears it, and holds the check back until the schema accepts its inputs.
 */
export const endFieldCheck = (
  checks: ChecksState,
  key: FieldPath,
  id: CheckId,
  result: FieldCheckResult,
): ChecksState => {
  const check = currentFieldCheck(checks, key, id);
  if (!check) return checks;
  const { error: kept, ...rest } = check;
  const ended: FieldCheck = { ...rest, status: 'done' };
  if (result === 'gated') {
    ended.gated = true;
  } else {
    const error = result === 'none' ? kept : result.error;
    if (error !== undefined) ended.error = error;
  }
  return { ...checks, fields: { ...checks.fields, [key]: ended } };
};

/** The errors to show, by field. */
export const fieldErrorsOf = (fields: Readonly<Record<FieldPath, FieldCheck>>): Readonly<Record<FieldPath, string>> => {
  const errors: [FieldPath, string][] = [];
  for (const [key, check] of Object.entries(fields)) {
    if (check.error !== undefined) errors.push([key, check.error]);
  }
  return withEntries(EMPTY, errors);
};

/**
 * The fields each check that shows an error read, by field: the keys of its `inputs`. A field whose check shows no
 * error has no entry, so a form that shows none gets the shared empty record, and keeps its identity.
 */
export const fieldErrorReadsOf = (
  fields: Readonly<Record<FieldPath, FieldCheck>>,
): Readonly<Record<FieldPath, readonly FieldPath[]>> => {
  const reads: [FieldPath, readonly FieldPath[]][] = [];
  for (const [key, check] of Object.entries(fields)) {
    if (check.error !== undefined) reads.push([key, Object.keys(check.inputs)]);
  }
  return withEntries(EMPTY, reads);
};

/** The fields whose validator is running now. */
export const validatingFieldsOf = (
  fields: Readonly<Record<FieldPath, FieldCheck>>,
): Readonly<Record<FieldPath, boolean>> => {
  const validating: [FieldPath, boolean][] = [];
  for (const [key, check] of Object.entries(fields)) {
    if (check.status === 'running') validating.push([key, true]);
  }
  return withEntries(EMPTY, validating);
};

/**
 * The checks still waiting on a schema result that started before the schema check `before`, by field: those it moves
 * on when it lands. A check that started after it waits on it as its own schema check, and moves on with its result.
 */
export const waitingFieldChecksOf = (
  fields: Readonly<Record<FieldPath, FieldCheck>>,
  before: CheckId,
): Readonly<Record<FieldPath, FieldCheck>> =>
  withEntries(
    EMPTY,
    Object.entries(fields).filter(([, check]) => check.status === 'waiting' && check.id < before),
  );

/** The fields whose check the schema gate holds back: those a landed schema check that accepts their inputs runs. */
export const gatedFieldsOf = (fields: Readonly<Record<FieldPath, FieldCheck>>): FieldPath[] =>
  Object.entries(fields).flatMap(([key, check]) => (check.gated === true ? [key] : []));

/** Whether a field check is pending: waiting on a schema result, or running. */
export const hasPendingFieldCheck = (fields: Readonly<Record<FieldPath, FieldCheck>>): boolean =>
  Object.values(fields).some(isPending);

/** Whether any field check holds an error. */
export const hasFieldError = (fields: Readonly<Record<FieldPath, FieldCheck>>): boolean =>
  Object.values(fields).some((check) => check.error !== undefined);

/** A follow that asks for no check. */
export const NO_FOLLOW_CHECKS: FollowChecks = Object.freeze({ check: false, paths: new Set<FieldPath>() });

/**
 * The checks of two follows as one: a check when either asks for one, reaching every path either changed. So a value
 * one changed and the other put back is checked again, as it is after two edits.
 */
export const mergeFollowChecks = (earlier: FollowChecks, later: FollowChecks): FollowChecks => ({
  check: earlier.check || later.check,
  paths: new Set([...earlier.paths, ...later.paths]),
});
