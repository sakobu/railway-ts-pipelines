import { describe, test, expect, mock } from 'bun:test';

import { createAutoSave, type AutoSaveView } from '../../src/autoSave';

type V = { name: string };

const A: V = { name: 'a' };
const B: V = { name: 'b' };
const B2: V = { name: 'b2' };

/** A view that allows a submit of `A`; each test overrides what it needs. */
const view = (over: Partial<AutoSaveView<V>> = {}): AutoSaveView<V> => ({
  values: A,
  isDirty: true,
  checkedValues: A,
  isChecking: false,
  isValidating: false,
  isValid: true,
  isStale: false,
  isSubmitting: false,
  wentOut: undefined,
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
    expect(auto.decide(() => view({ checkedValues: B }))).toBe('check');
    expect(auto.decide(() => view({ checkedValues: B }))).toBe('wait');

    auto.track(B2);
    auto.delayEnded();
    expect(auto.decide(() => view({ values: B2, checkedValues: B }))).toBe('check');
  });

  test('waits for a running schema check instead of starting one', () => {
    const auto = due();
    expect(auto.decide(() => view({ checkedValues: B, isChecking: true }))).toBe('wait');
  });

  test('submits once while its own save runs, even for a new version', () => {
    const auto = due();
    expect(auto.decide(() => view())).toBe('submit');

    auto.track(B);
    auto.delayEnded();
    expect(auto.decide(() => view({ values: B, checkedValues: B }))).toBe('wait');

    auto.saveSettled();
    expect(auto.decide(() => view({ values: B, checkedValues: B }))).toBe('submit');
  });

  test('checks a new version while its own save runs', () => {
    const auto = due();
    expect(auto.decide(() => view())).toBe('submit');

    auto.track(B);
    auto.delayEnded();
    expect(auto.decide(() => view({ values: B, checkedValues: A }))).toBe('check');
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

  test('stop keeps its own running save', () => {
    const auto = due();
    expect(auto.decide(() => view())).toBe('submit');

    auto.stop();
    auto.start();
    auto.track(A);
    auto.delayEnded();
    expect(auto.decide(() => view())).toBe('wait');

    auto.saveSettled();
    expect(auto.decide(() => view())).toBe('submit');
  });
});
