import type { FieldPath } from './types';

// One public call is one event. The calls made while it runs, such as from `onFieldChange`, join it, and each records
// what it asks to have checked. Once the outermost call returns, one pass checks what the event recorded, on the values
// as they stand then. So within one event a validator runs at most once, and the schema runs once.

/** What one event asks to have checked once its outermost call returns. */
export type EventRecord = {
  /** A schema check. Set with every path or field below. */
  schema: boolean;
  /** Edited or blurred paths, normalized. Each reaches every validator with an input path overlapping it. */
  paths: Set<FieldPath>;
  /** Validator keys a follow re-checks */
  fields: Set<FieldPath>;
  /** A follow's: clear the old values' client errors while an async or throwing schema check runs */
  clearAll: boolean;
};

/** The events of one form. */
export type CheckEvents = {
  /**
   * Runs `body` as an event, or as part of the event already running, with that event's record. When the outermost
   * body returns, `pass` runs once with the record if `record.schema` is set. A body that throws drops the record and
   * runs no pass. A throw from `pass` reaches the caller. A nested call's `pass` is ignored. The pass runs once the
   * event has ended, so a call made from inside it is an event of its own.
   */
  run: (body: (record: EventRecord) => void, pass: (record: EventRecord) => void) => void;
};

/**
 * Creates the events of one form, none running.
 *
 * @returns The form's events
 */
export const createCheckEvents = (): CheckEvents => {
  // The record of the event running, if one is
  let running: EventRecord | undefined;

  return {
    run: (body, pass) => {
      if (running) {
        body(running);
        return;
      }
      const record: EventRecord = { schema: false, paths: new Set(), fields: new Set(), clearAll: false };
      running = record;
      try {
        body(record);
      } finally {
        // A throw ends the event too, so the next call starts its own
        running = undefined;
      }
      if (record.schema) pass(record);
    },
  };
};
