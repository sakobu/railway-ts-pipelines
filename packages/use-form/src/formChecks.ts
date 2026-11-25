import { deepEqual, own } from './utils';

import type {
  CheckId,
  ChecksState,
  FieldCheck,
  FieldCheckResult,
  FieldPath,
  PendingStatus,
  ValidatorState,
} from './types';

const EMPTY_FIELDS: Readonly<Record<FieldPath, FieldCheck>> = Object.freeze({});
const EMPTY_VALIDATORS: ChecksState['validators'] = Object.freeze({});
const NO_ERRORS: Readonly<Record<FieldPath, string>> = Object.freeze({});
const NOT_VALIDATING: Readonly<Record<FieldPath, boolean>> = Object.freeze({});

/** The checks of a form that has run none, with no field validators. */
export const NO_CHECKS: ChecksState = Object.freeze({
  schema: undefined,
  fields: EMPTY_FIELDS,
  validators: EMPTY_VALIDATORS,
});

/** Drops the schema check and every field check, and keeps the validators. */
export const startOver = (checks: ChecksState): ChecksState =>
  checks.schema === undefined && Object.keys(checks.fields).length === 0
    ? checks
    : { schema: undefined, fields: EMPTY_FIELDS, validators: checks.validators };

/**
 * Brings the validators in line with the fields that have one on now. A validator that goes off
 * ends its check with no error, and its period goes up. One that comes back keeps its period.
 */
export const syncValidators = (checks: ChecksState, on: ReadonlySet<FieldPath>): ChecksState => {
  let validators: Record<FieldPath, ValidatorState> | undefined;
  let fields: Record<FieldPath, FieldCheck> | undefined;

  for (const [key, validator] of Object.entries(checks.validators)) {
    if (validator.on && !on.has(key)) {
      validators ??= { ...checks.validators };
      validators[key] = { on: false, period: validator.period + 1 };
      const check = own(checks.fields, key);
      if (check) {
        fields ??= { ...checks.fields };
        fields[key] = { id: check.id, status: 'done', value: check.value };
      }
    } else if (!validator.on && on.has(key)) {
      validators ??= { ...checks.validators };
      validators[key] = { on: true, period: validator.period };
    }
  }
  for (const key of on) {
    if (!Object.hasOwn(checks.validators, key)) {
      validators ??= { ...checks.validators };
      validators[key] = { on: true, period: 0 };
    }
  }

  if (!validators) return checks;
  return { ...checks, validators, fields: fields ?? checks.fields };
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
 * current check. The replaced check's error stays shown only while the value is unchanged.
 */
export const startFieldCheck = (
  checks: ChecksState,
  key: FieldPath,
  id: CheckId,
  status: PendingStatus,
  value: unknown,
): ChecksState => {
  if (!own(checks.validators, key)?.on) return checks;
  const replaced = own(checks.fields, key);
  if (replaced && replaced.id >= id) return checks;
  const next: FieldCheck = { id, status, value };
  if (replaced?.error !== undefined && deepEqual(replaced.value, value)) next.error = replaced.error;
  return { ...checks, fields: { ...checks.fields, [key]: next } };
};

/** The field's check `id`, while it is the field's latest check and has not ended. */
const currentFieldCheck = (checks: ChecksState, key: FieldPath, id: CheckId): FieldCheck | undefined => {
  const check = own(checks.fields, key);
  return check?.id === id && check.status !== 'done' ? check : undefined;
};

/** Whether `id` is the field's latest check and it has not ended. */
export const isCurrentFieldCheck = (checks: ChecksState, key: FieldPath, id: CheckId): boolean =>
  currentFieldCheck(checks, key, id) !== undefined;

/** Moves the field's current check from waiting to running. */
export const markFieldCheckRunning = (checks: ChecksState, key: FieldPath, id: CheckId): ChecksState => {
  const check = own(checks.fields, key);
  if (check?.status !== 'waiting' || check.id !== id) return checks;
  return { ...checks, fields: { ...checks.fields, [key]: { ...check, status: 'running' } } };
};

/**
 * Ends the field's current check. A result with an error shows it, and one without clears it.
 * `'none'` keeps the error shown.
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
  const error = result === 'none' ? kept : result.error;
  const ended: FieldCheck = { ...rest, status: 'done' };
  if (error !== undefined) ended.error = error;
  return { ...checks, fields: { ...checks.fields, [key]: ended } };
};

/** Ends every check that is still pending, keeping the errors shown, and clears the schema check. */
export const endPendingChecks = (checks: ChecksState): ChecksState => {
  let fields: Record<FieldPath, FieldCheck> | undefined;
  for (const [key, check] of Object.entries(checks.fields)) {
    if (check.status !== 'done') {
      fields ??= { ...checks.fields };
      fields[key] = { ...check, status: 'done' };
    }
  }
  if (!fields && checks.schema === undefined) return checks;
  return { ...checks, schema: undefined, fields: fields ?? checks.fields };
};

/** The errors to show, by field. */
export const fieldErrorsOf = (fields: Readonly<Record<FieldPath, FieldCheck>>): Readonly<Record<FieldPath, string>> => {
  let errors: Record<FieldPath, string> | undefined;
  for (const [key, check] of Object.entries(fields)) {
    if (check.error !== undefined) (errors ??= {})[key] = check.error;
  }
  return errors ?? NO_ERRORS;
};

/** The fields whose validator is running now. */
export const validatingFieldsOf = (
  fields: Readonly<Record<FieldPath, FieldCheck>>,
): Readonly<Record<FieldPath, boolean>> => {
  let validating: Record<FieldPath, boolean> | undefined;
  for (const [key, check] of Object.entries(fields)) {
    if (check.status === 'running') (validating ??= {})[key] = true;
  }
  return validating ?? NOT_VALIDATING;
};

/** The fields with a pending check or an error shown. */
export const fieldsToRecheck = (fields: Readonly<Record<FieldPath, FieldCheck>>): FieldPath[] =>
  Object.entries(fields)
    .filter(([, check]) => check.status !== 'done' || check.error !== undefined)
    .map(([key]) => key);
