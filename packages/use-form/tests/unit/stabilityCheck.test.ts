import { describe, test, expect, beforeEach } from 'bun:test';

import { createStabilityCheck, type StabilityCheck } from '../../src/stabilityCheck';

describe('createStabilityCheck', () => {
  const fresh = () => ({});
  let check: StabilityCheck<object>;
  let last: object; // the state after the last sync settled: what the next outside render uses

  beforeEach(() => {
    check = createStabilityCheck<object>();
    last = fresh();
    check.record(last, false, last); // mount
  });

  // One sync, then the catch-up that settles. Returns what the check returned for the sync.
  const sync = (rendered: object, changed: boolean) => {
    const after = changed ? fresh() : rendered;
    const reported = check.record(rendered, changed, after);
    if (changed) check.record(after, false, after);
    last = after;
    return reported;
  };
  const formUpdate = (changed: boolean) => sync(fresh(), changed); // the form's own state moved first
  const outside = (changed: boolean) => sync(last, changed); // only props moved

  test('a version in every catch-up reports on the third', () => {
    // Written out, since its catch-ups never settle
    const [a1, a2, a3, a4] = [fresh(), fresh(), fresh(), fresh()];

    expect(check.record(last, true, a1)).toBe(false); // outside: 0
    expect(check.record(a1, true, a2)).toBe(false); // 1
    expect(check.record(a2, true, a3)).toBe(false); // 2
    expect(check.record(a3, true, a4)).toBe(true); // 3
  });

  test('a version with each form update reports on the third, and only once', () => {
    expect(formUpdate(true)).toBe(false);
    expect(formUpdate(true)).toBe(false);
    expect(formUpdate(true)).toBe(true);
    expect(formUpdate(true)).toBe(false);
  });

  test('a version from outside resets the count', () => {
    expect(formUpdate(true)).toBe(false);
    expect(formUpdate(true)).toBe(false);
    expect(outside(true)).toBe(false);
    expect(formUpdate(true)).toBe(false);
    expect(formUpdate(true)).toBe(false);

    expect(formUpdate(true)).toBe(true);
  });

  test("a version that echoes the form's values resets the count, as one that held still", () => {
    // A wrapper feeding the values back as initialValues: the version arrives with the form's own change
    const echo = () => {
      const after = fresh();
      const reported = check.record(fresh(), true, after, true);
      check.record(after, false, after);
      last = after;
      return reported;
    };

    expect(formUpdate(true)).toBe(false);
    expect(formUpdate(true)).toBe(false);
    expect(echo()).toBe(false);
    expect(echo()).toBe(false);
    expect(echo()).toBe(false);
    expect(formUpdate(true)).toBe(false);
    expect(formUpdate(true)).toBe(false);

    expect(formUpdate(true)).toBe(true);
  });

  test('a form update where initialValues held still resets the count', () => {
    expect(formUpdate(true)).toBe(false);
    expect(formUpdate(true)).toBe(false);
    expect(formUpdate(false)).toBe(false);
    expect(formUpdate(true)).toBe(false);
    expect(formUpdate(true)).toBe(false);

    expect(formUpdate(true)).toBe(true);
  });
});
