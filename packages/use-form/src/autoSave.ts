import { deepEqual } from './utils';

// The rule: the tracked version of the values is saved once its delay has ended, it has unsaved edits, it hasn't gone
// out already, the form has checked it and shows it valid, the form isn't stale, and no submission is running.
// Values the form hasn't checked get one schema check per version first. This module only decides; the caller acts.

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
 * Tracks the current version of the values and decides its next step.
 *
 * @template TValues - The shape of the form values
 */
export type AutoSave<TValues> = {
  /**
   * Starts a new version when the values differ by content from the tracked version, or after `restart`.
   *
   * @param values - The current values
   * @returns Whether it started a version: the caller then starts the delay
   */
  track: (values: TValues) => boolean;

  /** The tracked version's delay has passed. */
  delayEnded: () => void;

  /** Forgets the tracked version, so the next `track` starts a new one. */
  restart: () => void;

  /**
   * Decides for the tracked version. It returns `'check'` at most once per version and records it. It returns
   * `'submit'` only while its own save isn't running, and records that save as running.
   *
   * @param view - What the form shows now
   * @returns What the caller does next
   */
  decide: (view: AutoSaveView<TValues>) => AutoSaveStep;

  /** Its own save settled. */
  saveSettled: () => void;
};

/**
 * Creates an {@link AutoSave} that tracks no version yet. A `restart` doesn't clear its own running save: a save
 * started before it still holds the next version until `saveSettled`.
 *
 * @template TValues - The shape of the form values
 * @returns An auto-save with nothing tracked
 */
export const createAutoSave = <TValues>(): AutoSave<TValues> => {
  let tracked: { values: TValues } | undefined;
  let delayPassed = false;
  let checkStarted = false;
  let ownSaveRunning = false;

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

  const restart = (): void => {
    tracked = undefined;
  };

  const decide = (view: AutoSaveView<TValues>): AutoSaveStep => {
    if (!delayPassed || !view.isDirty) return 'wait';
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

  return { track, delayEnded, restart, decide, saveSettled };
};
