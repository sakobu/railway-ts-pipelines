import { expect, test } from 'bun:test';

import {
  NO_CHECKS,
  endFieldCheck,
  endOutdatedChecks,
  endPendingChecks,
  endSchemaCheck,
  fieldErrorsOf,
  fieldsCutShort,
  hasFieldError,
  hasPendingFieldCheck,
  inputsHeld,
  markFieldCheckRunning,
  startFieldCheck,
  startOver,
  startSchemaCheck,
  syncValidators,
  validatingFieldsOf,
  validatorPeriod,
  waitingFieldCheck,
  waitingFieldChecksOf,
} from '../../src/formChecks';

const on = (...keys: string[]) => new Set(keys);
const withName = syncValidators(NO_CHECKS, on('name'));
const failed = endFieldCheck(startFieldCheck(withName, 'name', 1, 'running', { name: 'x' }), 'name', 1, {
  error: 'Taken',
});

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
  const started = startFieldCheck(withName, 'name', 2, 'running', { name: 'x' });
  expect(startFieldCheck(started, 'name', 1, 'running', { name: 'x' })).toBe(started);
});
test('startFieldCheck registers no check for a field whose validator is off', () => {
  expect(startFieldCheck(NO_CHECKS, 'name', 1, 'running', { name: 'x' })).toBe(NO_CHECKS);
});
test('a check of the same value keeps the last error, and one of a new value shows none', () => {
  const same = startFieldCheck(failed, 'name', 2, 'running', { name: 'x' });
  expect(fieldErrorsOf(same.fields)).toEqual({ name: 'Taken' });
  expect(validatingFieldsOf(same.fields)).toEqual({ name: true });
  expect(fieldErrorsOf(startFieldCheck(failed, 'name', 2, 'waiting', { name: 'y' }).fields)).toEqual({});
});
test('a check waiting on the schema shows the last error while the value is unchanged', () => {
  const waiting = startFieldCheck(failed, 'name', 2, 'waiting', { name: 'x' });
  expect(fieldErrorsOf(waiting.fields)).toEqual({ name: 'Taken' });
  expect(validatingFieldsOf(waiting.fields)).toEqual({});
});
test('the same value compares by content', () => {
  const tagged = endFieldCheck(startFieldCheck(withName, 'name', 1, 'running', { name: ['a'] }), 'name', 1, {
    error: 'Bad',
  });
  expect(fieldErrorsOf(startFieldCheck(tagged, 'name', 2, 'running', { name: ['a'] }).fields)).toEqual({ name: 'Bad' });
});
test('markFieldCheckRunning moves the current waiting check to running, and ignores a replaced one', () => {
  const waiting = startFieldCheck(withName, 'name', 1, 'waiting', { name: 'x' });
  expect(markFieldCheckRunning(waiting, 'name', 1).fields.name?.status).toBe('running');
  const replaced = startFieldCheck(waiting, 'name', 2, 'waiting', { name: 'y' });
  expect(markFieldCheckRunning(replaced, 'name', 1)).toBe(replaced);
});
test('markFieldCheckRunning returns its input for a check already running or done', () => {
  const running = startFieldCheck(withName, 'name', 1, 'running', { name: 'x' });
  expect(markFieldCheckRunning(running, 'name', 1)).toBe(running);
  expect(markFieldCheckRunning(failed, 'name', 1)).toBe(failed);
});
test('endFieldCheck lands only the current check', () => {
  const replaced = startFieldCheck(
    startFieldCheck(withName, 'name', 1, 'running', { name: 'x' }),
    'name',
    2,
    'running',
    { name: 'y' },
  );
  expect(endFieldCheck(replaced, 'name', 1, { error: 'Old' })).toBe(replaced);
  expect(endFieldCheck(failed, 'name', 1, { error: 'Again' })).toBe(failed);
});
test("'none' keeps the error shown, and an answer of no error clears it", () => {
  const rechecking = startFieldCheck(failed, 'name', 2, 'running', { name: 'x' });
  expect(fieldErrorsOf(endFieldCheck(rechecking, 'name', 2, 'none').fields)).toEqual({ name: 'Taken' });
  expect(fieldErrorsOf(endFieldCheck(rechecking, 'name', 2, { error: undefined }).fields)).toEqual({});
});
test('waitingFieldCheck gives the check while it waits, not once it runs, ends or is replaced', () => {
  const waiting = startFieldCheck(withName, 'name', 1, 'waiting', { name: 'x' });
  expect(waitingFieldCheck(waiting, 'name', 1)).toEqual({ id: 1, status: 'waiting', inputs: { name: 'x' } });
  expect(waitingFieldCheck(waiting, 'name', 2)).toBeUndefined();
  expect(waitingFieldCheck(markFieldCheckRunning(waiting, 'name', 1), 'name', 1)).toBeUndefined();
  expect(waitingFieldCheck(endFieldCheck(waiting, 'name', 1, 'none'), 'name', 1)).toBeUndefined();
  expect(waitingFieldCheck(startFieldCheck(waiting, 'name', 2, 'waiting', { name: 'y' }), 'name', 1)).toBeUndefined();
  expect(waitingFieldCheck(NO_CHECKS, 'name', 1)).toBeUndefined();
});
test('waitingFieldChecksOf takes the checks that wait, not those running or done', () => {
  let checks = syncValidators(NO_CHECKS, on('a', 'b', 'c'));
  checks = startFieldCheck(checks, 'a', 1, 'waiting', { a: 'x' });
  checks = startFieldCheck(checks, 'b', 2, 'running', { b: 'x' });
  checks = endFieldCheck(startFieldCheck(checks, 'c', 3, 'waiting', { c: 'x' }), 'c', 3, 'none');
  expect(waitingFieldChecksOf(checks.fields, 4)).toEqual({ a: { id: 1, status: 'waiting', inputs: { a: 'x' } } });
});
test('waitingFieldChecksOf takes only the checks that started before the given schema check', () => {
  let checks = syncValidators(NO_CHECKS, on('a', 'b'));
  checks = startFieldCheck(checks, 'a', 1, 'waiting', { a: 'x' });
  checks = startFieldCheck(checks, 'b', 3, 'waiting', { b: 'x' });
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
  const pending = startSchemaCheck(startFieldCheck(failed, 'name', 2, 'running', { name: 'x' }), 3);
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
test('fieldsCutShort takes pending checks whose inputs the values hold, not done ones or outdated ones', () => {
  let checks = syncValidators(NO_CHECKS, on('a', 'b', 'c', 'd'));
  // a waits on the schema
  checks = startFieldCheck(checks, 'a', 1, 'waiting', { a: 1 });
  // b runs
  checks = startFieldCheck(checks, 'b', 2, 'running', { b: 1 });
  // c is done, with no error
  checks = startFieldCheck(checks, 'c', 3, 'running', { c: 1 });
  checks = endFieldCheck(checks, 'c', 3, { error: undefined });
  // d runs on a value the values no longer hold
  checks = startFieldCheck(checks, 'd', 4, 'running', { d: 1 });
  expect(fieldsCutShort(checks.fields, { a: 1, b: 1, c: 1, d: 2 }).sort()).toEqual(['a', 'b']);
  // An error shown, with no check pending, isn't cut short
  expect(fieldsCutShort(failed.fields, { name: 'x' })).toEqual([]);
});
test('selectors share one empty object when there is nothing to show', () => {
  expect(fieldErrorsOf({})).toBe(fieldErrorsOf(withName.fields));
  expect(validatingFieldsOf({})).toBe(validatingFieldsOf(failed.fields));
  expect(waitingFieldChecksOf({}, 2)).toBe(waitingFieldChecksOf(failed.fields, 2));
});
test('a field named after an Object.prototype member syncs on, starts, ends and shows its error', () => {
  const synced = syncValidators(NO_CHECKS, on('constructor'));
  expect(validatorPeriod(synced, 'constructor')).toBe(0);
  const started = startFieldCheck(synced, 'constructor', 1, 'waiting', { constructor: 'x' });
  expect(waitingFieldCheck(started, 'constructor', 1)).toBeDefined();
  const ended = endFieldCheck(markFieldCheckRunning(started, 'constructor', 1), 'constructor', 1, { error: 'Bad' });
  expect(fieldErrorsOf(ended.fields)).toEqual({ constructor: 'Bad' });
});
test('hasPendingFieldCheck takes a check waiting or running, not one done', () => {
  const waiting = startFieldCheck(withName, 'name', 1, 'waiting', { name: 'x' });
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
  const protoInputs = Object.fromEntries([['__proto__', 'x']]);
  const synced = syncValidators(NO_CHECKS, on('__proto__'));
  const waiting = startFieldCheck(synced, '__proto__', 1, 'waiting', protoInputs);
  expect(Object.entries(waitingFieldChecksOf(waiting.fields, 2))).toEqual([
    ['__proto__', { id: 1, status: 'waiting', inputs: protoInputs }],
  ]);
  const running = markFieldCheckRunning(waiting, '__proto__', 1);
  expect(Object.entries(validatingFieldsOf(running.fields))).toEqual([['__proto__', true]]);
  expect(Object.entries(endPendingChecks(running).fields)).toEqual([
    ['__proto__', { id: 1, status: 'done', inputs: protoInputs }],
  ]);
  const shown = endFieldCheck(running, '__proto__', 1, { error: 'Bad' });
  expect(Object.entries(fieldErrorsOf(shown.fields))).toEqual([['__proto__', 'Bad']]);
  const off = syncValidators(shown, on());
  expect(Object.entries(off.validators)).toEqual([['__proto__', { on: false, period: 1 }]]);
  expect(Object.entries(off.fields)).toEqual([['__proto__', { id: 1, status: 'done', inputs: protoInputs }]]);
  const outdated = endOutdatedChecks(shown, Object.fromEntries([['__proto__', 'y']]));
  expect(Object.entries(outdated.fields)).toEqual([['__proto__', { id: 1, status: 'done', inputs: protoInputs }]]);
});
test('inputsHeld compares each input path by value', () => {
  expect(inputsHeld({ name: 'x' }, { name: 'x', email: 'a' })).toBe(true);
  expect(inputsHeld({ name: 'x', email: 'a' }, { name: 'x', email: 'b' })).toBe(false);
  expect(inputsHeld({ 'address.city': 'Oslo' }, { address: { city: 'Oslo' } })).toBe(true);
  expect(inputsHeld({ tags: ['a'] }, { tags: ['a'] })).toBe(true);
});

test('endOutdatedChecks drops an error whose inputs the values no longer hold', () => {
  const ended = endOutdatedChecks(failed, { name: 'y' });
  expect(fieldErrorsOf(ended.fields)).toEqual({});
  expect(ended.fields.name).toEqual({ id: 1, status: 'done', inputs: { name: 'x' } });
});

test('endOutdatedChecks ends a pending check whose inputs changed', () => {
  const running = startFieldCheck(withName, 'name', 2, 'running', { name: 'x' });
  expect(hasPendingFieldCheck(endOutdatedChecks(running, { name: 'y' }).fields)).toBe(false);
});

test('endOutdatedChecks returns its input when every check still holds, or has nothing to drop', () => {
  expect(endOutdatedChecks(failed, { name: 'x', email: 'other' })).toBe(failed);
  const passed = endFieldCheck(startFieldCheck(withName, 'name', 1, 'running', { name: 'x' }), 'name', 1, {
    error: undefined,
  });
  expect(endOutdatedChecks(passed, { name: 'y' })).toBe(passed);
});

test('a new check keeps the replaced error only while every input is unchanged', () => {
  const twoInputs = endFieldCheck(
    startFieldCheck(withName, 'name', 1, 'running', { name: 'x', email: 'a' }),
    'name',
    1,
    { error: 'Taken' },
  );
  expect(startFieldCheck(twoInputs, 'name', 2, 'waiting', { name: 'x', email: 'a' }).fields.name?.error).toBe('Taken');
  expect(
    startFieldCheck(twoInputs, 'name', 2, 'waiting', { name: 'x', email: 'b' }).fields.name?.error,
  ).toBeUndefined();
});
