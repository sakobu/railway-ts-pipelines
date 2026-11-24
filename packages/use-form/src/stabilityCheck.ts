/** Suspect versions in a row before the check decides `initialValues` changes on its own. */
const MAX_SUSPECT_VERSIONS = 3;

/**
 * Tells whether `initialValues` keeps changing along with the form's own state, which means it
 * changes on its own (a generated id, `new Date()`, storage read during render).
 *
 * @template TState - The form state; renders are told apart by its identity
 */
export type StabilityCheck<TState> = {
  /**
   * Records one sync of `initialValues`.
   *
   * @param rendered - The state the render used
   * @param changed - Whether the sync changed the state
   * @param after - The state once the sync and its side effects are done
   * @param echo - Whether the new version equals the values the render used, as when a wrapper feeds the
   *   values back as `initialValues`. It came from the form's own state, so it doesn't change on its own.
   * @returns `true` once per check: the first time `initialValues` looks like it changes on its own
   */
  record: (rendered: TState, changed: boolean, after: TState, echo?: boolean) => boolean;
};

/**
 * Creates a {@link StabilityCheck}. Each sync falls into one of three kinds of render, and the kind
 * decides the count of suspect versions:
 *
 * | Render | The sync changed the state | It didn't, or the version echoes the values |
 * | --- | --- | --- |
 * | outside: the state is what the last sync saw | reset to 0 | keep |
 * | catch-up: the state is what the last changing sync left | +1 | keep |
 * | form update: the state changed some other way | +1 | reset to 0 |
 *
 * A catch-up always counts as a form change, because its state differs from the one the render before it used.
 *
 * @template TState - The form state; renders are told apart by its identity
 * @returns A check that has seen no sync
 *
 * @example
 * const check = createStabilityCheck<FormState<Values>>();
 * if (check.record(renderedState, next !== prev, store.getState())) console.error(message);
 */
export const createStabilityCheck = <TState>(): StabilityCheck<TState> => {
  let lastSeen: TState | undefined;
  let lastSynced: TState | undefined;
  let suspect = 0;
  let reported = false;

  const record = (rendered: TState, changed: boolean, after: TState, echo = false): boolean => {
    // Outside: the state is what the last sync saw. Catch-up: exactly what the last changing sync left.
    // Any other state came from a form update: a keystroke, a blur, a validation result, an app write.
    const formChanged = rendered !== lastSeen;
    const catchUp = rendered === lastSynced;
    lastSeen = rendered;
    lastSynced = changed ? after : undefined;

    if (!changed || echo) {
      // The form's state changed and initialValues held still, or followed the form's values, so it doesn't
      // change on its own
      if (formChanged && !catchUp) suspect = 0;
      return false;
    }
    // A version from outside resets the count. One that arrives with the form's own change is suspect.
    suspect = formChanged ? suspect + 1 : 0;
    if (suspect < MAX_SUSPECT_VERSIONS || reported) return false;
    reported = true;
    return true;
  };

  return { record };
};
