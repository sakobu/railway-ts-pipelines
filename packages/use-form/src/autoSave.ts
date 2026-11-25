import { deepEqual } from './utils';

// The rule: the tracked version of the values is saved once its delay has ended, it has unsaved edits, it hasn't gone
// out already, the form has checked it and shows it valid, the form isn't stale, and no submission is running.
// Values the form hasn't checked get one schema check per version first. This module only decides, and holds whether
// auto-save is on; the caller acts.

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
  /** FormState.checkedValues */
  checkedValues: TValues | undefined;
  /** A schema check is running: FormState.checks.schema !== undefined */
  isChecking: boolean;
  /** As the form computes isValidating */
  isValidating: boolean;
  /** As the form computes isValid */
  isValid: boolean;
  /** FormState.isStale: the store's, which a running submission doesn't hide */
  isStale: boolean;
  /** The current submit scheduler's isBusy() */
  isSubmitting: boolean;
  /** FormState.wentOut */
  wentOut: TValues | undefined;
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

  /**
   * Switches auto-save off, and forgets the tracked version, so the next `track` starts a new one. Its own running
   * save still holds the next version until `saveSettled`.
   */
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
   * Decides for the tracked version. It returns `'check'` at most once per version and records it. It returns
   * `'submit'` only while its own save isn't running, and records that save as running.
   *
   * @param readView - Reads what the form shows now. `decide` calls it once, only after the delay has ended, so a
   *   caller pays for the view only then.
   * @returns What the caller does next
   */
  decide: (readView: () => AutoSaveView<TValues>) => AutoSaveStep;

  /** Its own save settled. */
  saveSettled: () => void;
};

/**
 * Creates an {@link AutoSave} that is off and tracks no version yet. A `stop` doesn't clear its own running save: a
 * save started before it still holds the next version until `saveSettled`.
 *
 * @template TValues - The shape of the form values
 * @returns An auto-save, off, with nothing tracked
 */
export const createAutoSave = <TValues>(): AutoSave<TValues> => {
  // Boxed because TValues is unconstrained: `undefined` alone can't mean "nothing tracked".
  let tracked: { values: TValues } | undefined;
  let delayPassed = false;
  let checkStarted = false;
  let ownSaveRunning = false;
  let on = false;

  const start = (): void => {
    on = true;
  };

  const stop = (): void => {
    on = false;
    tracked = undefined;
    delayPassed = false;
    checkStarted = false;
  };

  const isOn = (): boolean => on;

  const track = (values: TValues): boolean => {
    if (tracked && deepEqual(tracked.values, values)) return false;
    tracked = { values };
    delayPassed = false;
    checkStarted = false;
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
    if (!deepEqual(view.values, view.checkedValues)) {
      if (view.isChecking || checkStarted) return 'wait';
      checkStarted = true;
      return 'check';
    }
    if (view.isValidating || !view.isValid || view.isStale || view.isSubmitting || ownSaveRunning) return 'wait';
    ownSaveRunning = true;
    return 'submit';
  };

  const saveSettled = (): void => {
    ownSaveRunning = false;
  };

  return { start, stop, isOn, track, delayEnded, decide, saveSettled };
};
