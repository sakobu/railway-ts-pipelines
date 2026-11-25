import { expect, test } from 'bun:test';

import {
  NO_CHECKS,
  endFieldCheck,
  endPendingChecks,
  endSchemaCheck,
  fieldErrorsOf,
  fieldsToRecheck,
  isCurrentFieldCheck,
  isCurrentSchemaCheck,
  markFieldCheckRunning,
  startFieldCheck,
  startOver,
  startSchemaCheck,
  syncValidators,
  validatingFieldsOf,
  validatorPeriod,
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
test('isCurrentFieldCheck holds while pending, not once done or replaced', () => {
  const waiting = startFieldCheck(withName, 'name', 1, 'waiting', 'x');
  expect(isCurrentFieldCheck(waiting, 'name', 1)).toBe(true);
  expect(isCurrentFieldCheck(failed, 'name', 1)).toBe(false);
  expect(isCurrentFieldCheck(startFieldCheck(waiting, 'name', 2, 'waiting', 'y'), 'name', 1)).toBe(false);
});
test('the newest schema check wins, and ending it clears it', () => {
  const second = startSchemaCheck(startSchemaCheck(NO_CHECKS, 1), 2);
  expect(isCurrentSchemaCheck(second, 1)).toBe(false);
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
  const three = syncValidators(NO_CHECKS, on('a', 'b', 'c'));
  const checks = endFieldCheck(
    startFieldCheck(
      startFieldCheck(startFieldCheck(three, 'a', 1, 'waiting', 1), 'b', 2, 'running', 1),
      'c',
      3,
      'running',
      1,
    ),
    'c',
    3,
    { error: undefined },
  );
  expect(fieldsToRecheck(checks.fields).sort()).toEqual(['a', 'b']);
  expect(fieldsToRecheck(failed.fields)).toEqual(['name']);
});
test('selectors share one empty object when there is nothing to show', () => {
  expect(fieldErrorsOf({})).toBe(fieldErrorsOf(withName.fields));
  expect(validatingFieldsOf({})).toBe(validatingFieldsOf(failed.fields));
});
