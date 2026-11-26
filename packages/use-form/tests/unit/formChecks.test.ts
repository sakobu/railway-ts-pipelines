import { expect, test } from 'bun:test';

import {
  NO_CHECKS,
  endFieldCheck,
  endPendingChecks,
  endSchemaCheck,
  fieldErrorsOf,
  fieldsToRecheck,
  hasFieldError,
  hasPendingFieldCheck,
  isWaitingFieldCheck,
  markFieldCheckRunning,
  startFieldCheck,
  startOver,
  startSchemaCheck,
  syncValidators,
  validatingFieldsOf,
  validatorPeriod,
  waitingFieldChecksOf,
} from '../../src/formChecks';

const on = (...keys: string[]) => new Set(keys);
const withName = syncValidators(NO_CHECKS, on('name'));
const failed = endFieldCheck(startFieldCheck(withName, 'name', 1, 'running', 'x'), 'name', 1, { error: 'Taken' });

test('a validator coming on starts at period 0', () => {
  expect(validatorPeriod(withName, 'name')).toBe(0);
  expect(validatorPeriod(withName, 'email')).toBeUndefined();
});
test('syncValidators returns the same object when the on set is unchanged', () => {
  expect(syncValidators(withName, on('name'))).toBe(withName);
});
test('switching a validator off ends its check with no error and bumps its period', () => {
  const off = syncValidators(failed, on());
  expect(fieldErrorsOf(off.fields)).toEqual({});
  expect(off.fields.name).toMatchObject({ id: 1, status: 'done' });
  expect(validatorPeriod(off, 'name')).toBeUndefined();
  const back = syncValidators(off, on('name'));
  expect(validatorPeriod(back, 'name')).toBe(1);
  expect(fieldErrorsOf(back.fields)).toEqual({});
});
test('switching off a validator with no check bumps its period and leaves the field checks', () => {
  const off = syncValidators(withName, on());
  expect(off.validators).toEqual({ name: { on: false, period: 1 } });
  expect(off.fields).toBe(withName.fields);
});
test('a validator already off, or never on, stays as it is', () => {
  const off = syncValidators(withName, on());
  expect(syncValidators(off, on())).toBe(off);
  expect(syncValidators(NO_CHECKS, on())).toBe(NO_CHECKS);
});
test('startFieldCheck registers only a newer check', () => {
  const started = startFieldCheck(withName, 'name', 2, 'running', 'x');
  expect(startFieldCheck(started, 'name', 1, 'running', 'x')).toBe(started);
});
test('startFieldCheck registers no check for a field whose validator is off', () => {
  expect(startFieldCheck(NO_CHECKS, 'name', 1, 'running', 'x')).toBe(NO_CHECKS);
});
test('a check of the same value keeps the last error, and one of a new value shows none', () => {
  const same = startFieldCheck(failed, 'name', 2, 'running', 'x');
  expect(fieldErrorsOf(same.fields)).toEqual({ name: 'Taken' });
  expect(validatingFieldsOf(same.fields)).toEqual({ name: true });
  expect(fieldErrorsOf(startFieldCheck(failed, 'name', 2, 'waiting', 'y').fields)).toEqual({});
});
test('a check waiting on the schema shows the last error while the value is unchanged', () => {
  const waiting = startFieldCheck(failed, 'name', 2, 'waiting', 'x');
  expect(fieldErrorsOf(waiting.fields)).toEqual({ name: 'Taken' });
  expect(validatingFieldsOf(waiting.fields)).toEqual({});
});
test('the same value compares by content', () => {
  const tagged = endFieldCheck(startFieldCheck(withName, 'name', 1, 'running', ['a']), 'name', 1, { error: 'Bad' });
  expect(fieldErrorsOf(startFieldCheck(tagged, 'name', 2, 'running', ['a']).fields)).toEqual({ name: 'Bad' });
});
test('markFieldCheckRunning moves the current waiting check to running, and ignores a replaced one', () => {
  const waiting = startFieldCheck(withName, 'name', 1, 'waiting', 'x');
  expect(markFieldCheckRunning(waiting, 'name', 1).fields.name?.status).toBe('running');
  const replaced = startFieldCheck(waiting, 'name', 2, 'waiting', 'y');
  expect(markFieldCheckRunning(replaced, 'name', 1)).toBe(replaced);
});
test('markFieldCheckRunning returns its input for a check already running or done', () => {
  const running = startFieldCheck(withName, 'name', 1, 'running', 'x');
  expect(markFieldCheckRunning(running, 'name', 1)).toBe(running);
  expect(markFieldCheckRunning(failed, 'name', 1)).toBe(failed);
});
test('endFieldCheck lands only the current check', () => {
  const replaced = startFieldCheck(startFieldCheck(withName, 'name', 1, 'running', 'x'), 'name', 2, 'running', 'y');
  expect(endFieldCheck(replaced, 'name', 1, { error: 'Old' })).toBe(replaced);
  expect(endFieldCheck(failed, 'name', 1, { error: 'Again' })).toBe(failed);
});
test("'none' keeps the error shown, and an answer of no error clears it", () => {
  const rechecking = startFieldCheck(failed, 'name', 2, 'running', 'x');
  expect(fieldErrorsOf(endFieldCheck(rechecking, 'name', 2, 'none').fields)).toEqual({ name: 'Taken' });
  expect(fieldErrorsOf(endFieldCheck(rechecking, 'name', 2, { error: undefined }).fields)).toEqual({});
});
test('isWaitingFieldCheck holds while the check waits, not once it runs, ends or is replaced', () => {
  const waiting = startFieldCheck(withName, 'name', 1, 'waiting', 'x');
  expect(isWaitingFieldCheck(waiting, 'name', 1)).toBe(true);
  expect(isWaitingFieldCheck(waiting, 'name', 2)).toBe(false);
  expect(isWaitingFieldCheck(markFieldCheckRunning(waiting, 'name', 1), 'name', 1)).toBe(false);
  expect(isWaitingFieldCheck(endFieldCheck(waiting, 'name', 1, 'none'), 'name', 1)).toBe(false);
  expect(isWaitingFieldCheck(startFieldCheck(waiting, 'name', 2, 'waiting', 'y'), 'name', 1)).toBe(false);
  expect(isWaitingFieldCheck(NO_CHECKS, 'name', 1)).toBe(false);
});
test('waitingFieldChecksOf takes the checks that wait, not those running or done', () => {
  let checks = syncValidators(NO_CHECKS, on('a', 'b', 'c'));
  checks = startFieldCheck(checks, 'a', 1, 'waiting', 'x');
  checks = startFieldCheck(checks, 'b', 2, 'running', 'x');
  checks = endFieldCheck(startFieldCheck(checks, 'c', 3, 'waiting', 'x'), 'c', 3, 'none');
  expect(waitingFieldChecksOf(checks.fields, 4)).toEqual({ a: { id: 1, status: 'waiting', value: 'x' } });
});
test('waitingFieldChecksOf takes only the checks that started before the given schema check', () => {
  let checks = syncValidators(NO_CHECKS, on('a', 'b'));
  checks = startFieldCheck(checks, 'a', 1, 'waiting', 'x');
  checks = startFieldCheck(checks, 'b', 3, 'waiting', 'x');
  expect(Object.keys(waitingFieldChecksOf(checks.fields, 2))).toEqual(['a']);
  expect(Object.keys(waitingFieldChecksOf(checks.fields, 3))).toEqual(['a']);
  expect(waitingFieldChecksOf(checks.fields, 1)).toBe(waitingFieldChecksOf({}, 1));
});
test('the newest schema check wins, and ending it clears it', () => {
  const second = startSchemaCheck(startSchemaCheck(NO_CHECKS, 1), 2);
  expect(endSchemaCheck(second, 1)).toBe(second);
  expect(endSchemaCheck(second, 2).schema).toBeUndefined();
  expect(startSchemaCheck(second, 1)).toBe(second);
});
test('endPendingChecks ends pending checks, keeps their errors, and clears the schema check', () => {
  const pending = startSchemaCheck(startFieldCheck(failed, 'name', 2, 'running', 'x'), 3);
  const ended = endPendingChecks(pending);
  expect(ended.schema).toBeUndefined();
  expect(ended.fields.name).toMatchObject({ id: 2, status: 'done', error: 'Taken' });
  expect(endPendingChecks(ended)).toBe(ended);
});
test('startOver clears every check and keeps the validators', () => {
  const over = startOver(startSchemaCheck(failed, 2));
  expect(over.schema).toBeUndefined();
  expect(over.fields).toEqual({});
  expect(over.validators).toBe(failed.validators);
});
test('fieldsToRecheck takes pending checks and errors, not a check done without one', () => {
  let checks = syncValidators(NO_CHECKS, on('a', 'b', 'c'));
  // a waits on the schema
  checks = startFieldCheck(checks, 'a', 1, 'waiting', 1);
  // b runs
  checks = startFieldCheck(checks, 'b', 2, 'running', 1);
  // c is done, with no error
  checks = startFieldCheck(checks, 'c', 3, 'running', 1);
  checks = endFieldCheck(checks, 'c', 3, { error: undefined });
  expect(fieldsToRecheck(checks.fields).sort()).toEqual(['a', 'b']);
  expect(fieldsToRecheck(failed.fields)).toEqual(['name']);
});
test('selectors share one empty object when there is nothing to show', () => {
  expect(fieldErrorsOf({})).toBe(fieldErrorsOf(withName.fields));
  expect(validatingFieldsOf({})).toBe(validatingFieldsOf(failed.fields));
  expect(waitingFieldChecksOf({}, 2)).toBe(waitingFieldChecksOf(failed.fields, 2));
});
test('a field named after an Object.prototype member syncs on, starts, ends and shows its error', () => {
  const synced = syncValidators(NO_CHECKS, on('constructor'));
  expect(validatorPeriod(synced, 'constructor')).toBe(0);
  const started = startFieldCheck(synced, 'constructor', 1, 'waiting', 'x');
  expect(isWaitingFieldCheck(started, 'constructor', 1)).toBe(true);
  const ended = endFieldCheck(markFieldCheckRunning(started, 'constructor', 1), 'constructor', 1, { error: 'Bad' });
  expect(fieldErrorsOf(ended.fields)).toEqual({ constructor: 'Bad' });
});
test('hasPendingFieldCheck takes a check waiting or running, not one done', () => {
  const waiting = startFieldCheck(withName, 'name', 1, 'waiting', 'x');
  expect(hasPendingFieldCheck(waiting.fields)).toBe(true);
  expect(hasPendingFieldCheck(markFieldCheckRunning(waiting, 'name', 1).fields)).toBe(true);
  expect(hasPendingFieldCheck(failed.fields)).toBe(false);
  expect(hasPendingFieldCheck({})).toBe(false);
});
test('hasFieldError takes a check holding an error, not one without', () => {
  expect(hasFieldError(failed.fields)).toBe(true);
  expect(hasFieldError(withName.fields)).toBe(false);
  expect(hasFieldError({})).toBe(false);
});
test('a __proto__ key syncs on as its own entry, so syncing the same set again returns its input', () => {
  const synced = syncValidators(NO_CHECKS, on('__proto__'));
  expect(validatorPeriod(synced, '__proto__')).toBe(0);
  expect(syncValidators(synced, on('__proto__'))).toBe(synced);
});
test('a __proto__ field keeps its own entry in every record its checks write', () => {
  const synced = syncValidators(NO_CHECKS, on('__proto__'));
  const waiting = startFieldCheck(synced, '__proto__', 1, 'waiting', 'x');
  expect(Object.entries(waitingFieldChecksOf(waiting.fields, 2))).toEqual([
    ['__proto__', { id: 1, status: 'waiting', value: 'x' }],
  ]);
  const running = markFieldCheckRunning(waiting, '__proto__', 1);
  expect(Object.entries(validatingFieldsOf(running.fields))).toEqual([['__proto__', true]]);
  expect(Object.entries(endPendingChecks(running).fields)).toEqual([
    ['__proto__', { id: 1, status: 'done', value: 'x' }],
  ]);
  const shown = endFieldCheck(running, '__proto__', 1, { error: 'Bad' });
  expect(Object.entries(fieldErrorsOf(shown.fields))).toEqual([['__proto__', 'Bad']]);
  const off = syncValidators(shown, on());
  expect(Object.entries(off.validators)).toEqual([['__proto__', { on: false, period: 1 }]]);
  expect(Object.entries(off.fields)).toEqual([['__proto__', { id: 1, status: 'done', value: 'x' }]]);
});
