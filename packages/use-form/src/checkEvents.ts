import type { FieldPath } from './types';

// One public call is one event. The calls made while it runs, such as from `onFieldChange`, join it, and each asks
// what it wants checked. Once the outermost call returns, one pass checks what the event recorded, on the values as
// they stand then. So within one event a validator runs at most once, and the schema runs once.

/** What a check reaches: the field validators it re-checks, beside the schema check every request asks for. */
export type CheckReach = {
  /** Paths an edit changed, or blurred fields: each reaches every validator with an input path overlapping it. */
  readonly paths?: Iterable<FieldPath>;
  /** Fields an edit named: each reaches every validator whose input path is it or contains it, changed or not. */
  readonly named?: Iterable<FieldPath>;
  /** Validator keys to re-check, as a follow asks for. */
  readonly validators?: Iterable<FieldPath>;
};

/** What a call can ask its event to check. Every request includes a schema check, so none can lose its check. */
export type EventRequests = {
  /**
   * Asks for a schema check, and for every field validator the reach covers.
   *
   * @param reach - The paths, named fields and validator keys it reaches, normalized. None asks for the schema check
   *   only.
   */
  check: (reach?: CheckReach) => void;
};

/**
 * What one event asked to have checked, as its pass reads it once the outermost call returns: every reach its checks
 * recorded, joined. Every request asks for a schema check, so a pass always runs one.
 */
export type EventRecord = {
  /** Changed or blurred paths, normalized: each reaches every validator with an input path overlapping it */
  readonly paths: ReadonlySet<FieldPath>;
  /** Fields an edit named, normalized: each reaches every validator whose input path is it or contains it */
  readonly named: ReadonlySet<FieldPath>;
  /** Validator keys to re-check, as a follow asks for */
  readonly validators: ReadonlySet<FieldPath>;
};

/** The events of one form. */
export type CheckEvents = {
  /**
   * Runs `body` as an event, or as part of the event already running, with that event's requests. When the outermost
   * body returns, `pass` runs once with what the event recorded, if any request was made. A body that throws drops
   * the record and runs no pass. A throw from `pass` reaches the caller. A nested call's `pass` is ignored. The pass
   * runs once the event has ended, so a call made from inside it is an event of its own.
   */
  run: (body: (requests: EventRequests) => void, pass: (record: EventRecord) => void) => void;
};

/**
 * Creates the events of one form, none running.
 *
 * @returns The form's events
 */
export const createCheckEvents = (): CheckEvents => {
  // The requests of the event running, if one is
  let running: EventRequests | undefined;

  return {
    run: (body, pass) => {
      if (running) {
        body(running);
        return;
      }
      const record = { paths: new Set<FieldPath>(), named: new Set<FieldPath>(), validators: new Set<FieldPath>() };
      // Whether any request was made, so the pass runs
      let requested = false;
      const requests: EventRequests = {
        check: ({ paths = [], named = [], validators = [] } = {}) => {
          requested = true;
          for (const path of paths) record.paths.add(path);
          for (const field of named) record.named.add(field);
          for (const key of validators) record.validators.add(key);
        },
      };
      running = requests;
      try {
        body(requests);
      } finally {
        // A throw ends the event too, so the next call starts its own
        running = undefined;
      }
      if (requested) pass(record);
    },
  };
};
