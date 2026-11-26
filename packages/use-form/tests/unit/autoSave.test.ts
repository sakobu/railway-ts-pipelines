import { describe, test, expect, mock } from 'bun:test';

import { createAutoSave, type AutoSaveView } from '../../src/autoSave';

import type { SchemaVerdict } from '../../src/types';

type V = { name: string };

const A: V = { name: 'a' };
const B: V = { name: 'b' };
const B2: V = { name: 'b2' };

/** The verdict of a check that passed `values`. */
const passed = (values: V): SchemaVerdict<V> => ({ values, passed: true });

/** A view that allows a submit of `A`, the values `due` tracks; each test overrides what it needs. */
const view = (over: Partial<AutoSaveView<V>> = {}): AutoSaveView<V> => ({
  isDirty: true,
  verdict: passed(A),
  isChecking: false,
  isValidating: false,
  isValid: true,
  isStale: false,
  isSubmitting: false,
  wentOut: undefined,
  baselineEpoch: 0,
  ...over,
});

/** An auto-save tracking `A` whose delay has ended. */
const due = () => {
  const auto = createAutoSave<V>();
  auto.track(A);
  auto.delayEnded();
  return auto;
};

describe('createAutoSave', () => {
  test('track starts a version on the first values and on a change by content, not on equal values', () => {
    const auto = createAutoSave<V>();
    expect(auto.track(A)).toBe(true);
    expect(auto.track({ ...A })).toBe(false);
    expect(auto.track(B)).toBe(true);
  });

  test('waits until the delay ends', () => {
    const auto = createAutoSave<V>();
    auto.track(A);
    expect(auto.decide(() => view())).toBe('wait');
    auto.delayEnded();
    expect(auto.decide(() => view())).toBe('submit');
  });

  test('reads the view once, and only after the delay ends', () => {
    const auto = createAutoSave<V>();
    auto.track(A);
    const readView = mock(() => view());
    expect(auto.decide(readView)).toBe('wait');
    expect(readView).toHaveBeenCalledTimes(0);
    auto.delayEnded();
    expect(auto.decide(readView)).toBe('submit');
    expect(readView).toHaveBeenCalledTimes(1);
  });

  const holds: Array<[string, Partial<AutoSaveView<V>>]> = [
    ['isDirty: false', { isDirty: false }],
    ['wentOut equal to the values', { wentOut: { ...A } }],
    ["a verdict that didn't pass the values", { verdict: { values: { ...A }, passed: false } }],
    ['isValidating', { isValidating: true }],
    ['not isValid', { isValid: false }],
    ['isStale', { isStale: true }],
    ['isSubmitting', { isSubmitting: true }],
  ];

  test.each(holds)('each condition alone holds the version, and it goes out once that clears: %s', (_name, over) => {
    const auto = due();
    expect(auto.decide(() => view(over))).toBe('wait');
    expect(auto.decide(() => view())).toBe('submit');
  });

  test('unchecked values get one check per version', () => {
    const auto = due();
    expect(auto.decide(() => view({ verdict: passed(B) }))).toBe('check');
    expect(auto.decide(() => view({ verdict: passed(B) }))).toBe('wait');

    auto.track(B2);
    auto.delayEnded();
    expect(auto.decide(() => view({ verdict: passed(B) }))).toBe('check');
  });

  test('a check started before a follow or reset holds no check after it', () => {
    const auto = due();
    expect(auto.decide(() => view({ verdict: passed(B) }))).toBe('check');
    expect(auto.decide(() => view({ verdict: passed(B), baselineEpoch: 1 }))).toBe('check');
  });

  test('a check started since the latest follow or reset still holds one', () => {
    const auto = due();
    expect(auto.decide(() => view({ verdict: passed(B), baselineEpoch: 1 }))).toBe('check');
    expect(auto.decide(() => view({ verdict: passed(B), baselineEpoch: 1 }))).toBe('wait');
  });

  test('waits for a running schema check instead of starting one', () => {
    const auto = due();
    expect(auto.decide(() => view({ verdict: passed(B), isChecking: true }))).toBe('wait');
  });

  test('checks a new version while a submission runs', () => {
    const auto = due();
    expect(auto.decide(() => view())).toBe('submit');

    auto.track(B);
    auto.delayEnded();
    expect(auto.decide(() => view({ verdict: passed(A), isSubmitting: true }))).toBe('check');
  });

  test('isOn is off at creation, on after start, and off after stop', () => {
    const auto = createAutoSave<V>();
    expect(auto.isOn()).toBe(false);
    auto.start();
    expect(auto.isOn()).toBe(true);
    auto.stop();
    expect(auto.isOn()).toBe(false);
  });

  test('stop, then start, starts a new version with its own delay', () => {
    const auto = due();
    auto.stop();
    auto.start();
    expect(auto.decide(() => view())).toBe('wait');
    expect(auto.track(A)).toBe(true);
    expect(auto.decide(() => view())).toBe('wait');
    auto.delayEnded();
    expect(auto.decide(() => view())).toBe('submit');
  });
});
