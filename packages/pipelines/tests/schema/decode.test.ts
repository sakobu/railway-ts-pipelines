import { describe, test, expect } from 'bun:test';

import { ok, err, isResult } from '@/result';
import { date, object, optional, parseISODate, required, string } from '@/schema';
import { decodeResult } from '@/schema/decode';

import type { AsyncValidator, ValidationError } from '@/schema/core';

const createdUser = object({ id: required(string()) });
const failed = (cause: ValidationError[], message = 'Unexpected response') => err([{ path: [], message, cause }]);
const notAnObject = [{ path: [], message: 'Expected an object' }];
const noOk = [{ path: ['ok'], message: 'Must be a boolean' }];

// A value after a trip over the wire. Not a clone: structuredClone would keep a Date as a Date.
// eslint-disable-next-line unicorn/prefer-structured-clone -- JSON serialization is the behavior under test
const overTheWire = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe('decodeResult', () => {
  test('decodes an ok envelope through the schema', () => {
    expect(decodeResult({ ok: true, value: { id: 'u1' } }, createdUser)).toEqual(ok({ id: 'u1' }));
  });

  test('round-trips ok and err through JSON', () => {
    const sent = ok({ id: 'u1' });
    expect(decodeResult(overTheWire(sent), createdUser)).toEqual(sent);
    const errors = [
      { path: ['email'], message: 'Email already registered' },
      { path: [], message: 'Too many attempts' },
    ];
    expect(decodeResult(overTheWire(err(errors)), createdUser)).toEqual(err(errors));
  });

  test('returns a branded Result on every branch', () => {
    expect(isResult(decodeResult({ ok: true, value: { id: 'u1' } }, createdUser))).toBe(true);
    expect(isResult(decodeResult({ ok: false, error: [{ path: [], message: 'x' }] }, createdUser))).toBe(true);
    expect(isResult(decodeResult(null, createdUser))).toBe(true);
  });

  test('keeps only path and message from each error, dropping a server-sent cause', () => {
    const entry = { path: ['email'], message: 'Taken', code: 'E1', cause: [{ path: [], message: 'db' }] };
    expect(decodeResult({ ok: false, error: [entry] }, createdUser)).toEqual(
      err([{ path: ['email'], message: 'Taken' }]),
    );
  });

  test('ignores extra envelope keys', () => {
    expect(decodeResult({ ok: true, value: { id: 'u1' }, meta: 1 }, createdUser)).toEqual(ok({ id: 'u1' }));
  });

  test('an ok(undefined) whose value key JSON dropped decodes with a schema that accepts undefined', () => {
    expect(decodeResult(overTheWire(ok(undefined)), optional(string()))).toEqual(ok(undefined));
  });

  test('a value the schema rejects becomes one root error whose cause points into the response', () => {
    expect(decodeResult({ ok: true, value: { id: 5 } }, createdUser)).toEqual(
      failed([{ path: ['value', 'id'], message: 'Must be a string' }]),
    );
    expect(decodeResult({ ok: true }, createdUser)).toEqual(
      failed([{ path: ['value'], message: 'Expected an object' }]),
    );
  });

  test('a Date sent as JSON: date() is rejected with a cause, parseISODate() decodes it', () => {
    const at = new Date('2026-11-23T10:00:00Z');
    const sent = overTheWire(ok({ createdAt: at }));
    expect(decodeResult(sent, object({ createdAt: required(date()) }))).toEqual(
      failed([{ path: ['value', 'createdAt'], message: 'Must be a Date object' }]),
    );
    expect(decodeResult(sent, object({ createdAt: required(parseISODate()) }))).toEqual(ok({ createdAt: at }));
  });

  test.each([
    ['null', null, notAnObject],
    ['undefined', undefined, notAnObject],
    ['a string', 'ok', notAnObject],
    ['a number', 42, notAnObject],
    ['an empty object', {}, noOk],
    ['a non-Result error body', { error: 'Internal Server Error' }, noOk],
    ['a bare ValidationError[] (no envelope)', [{ path: ['email'], message: 'Taken' }], noOk],
    ['a non-boolean ok', { ok: 'true', value: { id: 'u1' } }, noOk],
    ['ok false without error', { ok: false }, [{ path: ['error'], message: 'Expected an array' }]],
    [
      'an empty error list',
      { ok: false, error: [] },
      [{ path: ['error'], message: 'Array must have at least 1 items' }],
    ],
    ['a non-array error', { ok: false, error: 'boom' }, [{ path: ['error'], message: 'Expected an array' }]],
    [
      'a string path',
      { ok: false, error: [{ path: 'email', message: 'Taken' }] },
      [{ path: ['error', '0', 'path'], message: 'Expected an array' }],
    ],
    [
      'a numeric path segment',
      { ok: false, error: [{ path: ['items', 0], message: 'Bad' }] },
      [{ path: ['error', '0', 'path', '1'], message: 'Must be a string' }],
    ],
    [
      'an error without message',
      { ok: false, error: [{ path: [] }] },
      [{ path: ['error', '0', 'message'], message: 'Field is required' }],
    ],
  ])('%s becomes one root error with its cause', (_, body, cause) => {
    expect(decodeResult(body, createdUser)).toEqual(failed(cause));
  });

  test('uses a custom message', () => {
    expect(decodeResult(null, createdUser, 'Sign-up failed')).toEqual(failed(notAnObject, 'Sign-up failed'));
  });

  test('cause is typed, so reading it needs no cast', () => {
    const r = decodeResult(null, createdUser);
    const causePaths: string[][] = r.ok ? [] : r.error.flatMap((e) => e.cause ?? []).map((c) => c.path);
    expect(causePaths).toEqual([[]]);
  });

  test('accepts only sync schemas', () => {
    const asyncSchema: AsyncValidator<unknown, string> = async (v) => ok(String(v));
    // @ts-expect-error decodeResult takes a sync Validator, so the Result is never a Promise
    expect(decodeResult(null, asyncSchema)).toEqual(failed(notAnObject));
  });
});
