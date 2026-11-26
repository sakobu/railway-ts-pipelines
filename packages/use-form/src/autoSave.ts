import { deepEqual } from './utils';

import type { SchemaVerdict } from './types';

// The rule: the tracked version of the values is saved once its delay has ended, it has unsaved edits, it hasn't gone
// out already, the form's latest schema check passed it and the form shows it valid, the form isn't stale, and no
// submission is running.
// Values the form hasn't checked get one schema check per version first, and another once a follow or reset ends that
// check. This module only decides, and holds whether auto-save is on; the caller acts.

/**
 * What auto-save reads from the form when it decides.
 *
 * @template TValues - The shape of the form values
 */
export type AutoSaveView<TValues> = {
  /** The current values, which `decide` compares with the other fields' values */
  values: TValues;
  /** The values differ from the store's initial values, by content */
  isDirty: boolean;
  /** FormState.verdict */
  verdict: SchemaVerdict<TValues> | undefined;
  /** A schema check is running: FormState.checks.schema !== undefined */
  isChecking: boolean;
  /** As the form computes isValidating */
  isValidating: boolean;
  /** As the form computes isValid */
  isValid: boolean;
  /** FormState.isStale: the store's, which a running submission doesn't hide */
  isStale: boolean;
  /** A submission runs on the current submit scheduler, or on the one auto-save last submitted on */
  isSubmitting: boolean;
  /** FormState.wentOut */
  wentOut: TValues | undefined;
  /** FormState.baselineEpoch: a follow or reset increments it, and ends the running checks */
  baselineEpoch: number;
};

/** What auto-save asks the caller to do: nothing yet, run a schema check, or submit. */
export type AutoSaveStep = 'wait' | 'check' | 'submit';

/**
 * Holds whether auto-save is on, tracks the current version of the values, and decides its next step.
 *
 * @template TValues - The shape of the form values
 */
export type AutoSave<TValues> = {
  /** Switches auto-save on. */
  start: () => void;

  /** Switches auto-save off, and forgets the tracked version, so the next `track` starts a new one. */
  stop: () => void;

  /** Whether auto-save is on: started, and not stopped since. */
  isOn: () => boolean;

  /**
   * Starts a new version when the values differ by content from the tracked version, or after `stop`.
   *
   * @param values - The current values
   * @returns Whether it started a version: the caller then starts the delay
   */
  track: (values: TValues) => boolean;

  /** The tracked version's delay has passed. */
  delayEnded: () => void;

  /**
   * Decides for the tracked version. It returns `'check'` at most once per version in each baseline epoch, and records
   * it: a follow or reset ends the check.
   *
   * @param readView - Reads what the form shows now. `decide` calls it once, only after the delay has ended, so a
   *   caller pays for the view only then.
   * @returns What the caller does next
   */
  decide: (readView: () => AutoSaveView<TValues>) => AutoSaveStep;
};

/**
 * Creates an {@link AutoSave} that is off and tracks no version yet.
 *
 * @template TValues - The shape of the form values
 * @returns An auto-save, off, with nothing tracked
 */
export const createAutoSave = <TValues>(): AutoSave<TValues> => {
  // Boxed because TValues is unconstrained: `undefined` alone can't mean "nothing tracked".
  let tracked: { values: TValues } | undefined;
  let delayPassed = false;
  // The baseline epoch the tracked version's check started in
  let checkedIn: number | undefined;
  let on = false;

  const start = (): void => {
    on = true;
  };

  const stop = (): void => {
    on = false;
    tracked = undefined;
    delayPassed = false;
    checkedIn = undefined;
  };

  const isOn = (): boolean => on;

  const track = (values: TValues): boolean => {
    if (tracked && deepEqual(tracked.values, values)) return false;
    tracked = { values };
    delayPassed = false;
    checkedIn = undefined;
    return true;
  };

  const delayEnded = (): void => {
    delayPassed = true;
  };

  const decide = (readView: () => AutoSaveView<TValues>): AutoSaveStep => {
    if (!delayPassed) return 'wait';
    const view = readView();
    if (!view.isDirty) return 'wait';
    if (view.wentOut !== undefined && deepEqual(view.values, view.wentOut)) return 'wait';
    const { verdict } = view;
    if (verdict === undefined || !deepEqual(view.values, verdict.values)) {
      if (view.isChecking || checkedIn === view.baselineEpoch) return 'wait';
      checkedIn = view.baselineEpoch;
      return 'check';
    }
    if (!verdict.passed || view.isValidating || !view.isValid || view.isStale || view.isSubmitting) return 'wait';
    return 'submit';
  };

  return { start, stop, isOn, track, delayEnded, decide };
};
