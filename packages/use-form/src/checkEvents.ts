import type { FieldPath } from './types';

// One public call is one event. The calls made while it runs, such as from `onFieldChange`, join it, and each asks
// what it wants checked. Once the outermost call returns, one pass checks what the event recorded, on the values as
// they stand then. So within one event a validator runs at most once, and the schema runs once. An event with no
// caller, such as an effect's, never joins one nor runs inside a pass: it runs as its own once the event running has
// ended, its pass included.

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
  /**
   * An event with no caller. It never joins a running event, nor runs inside a pass: one that starts while any event's
   * body or pass runs, that of a call made from inside a pass included, waits until the outermost event has ended, its
   * pass included (and even when its body or pass threw). Then it runs as its own, after those that started before it.
   * A throw from its body or pass goes to `report`, before the events that started inside it run.
   */
  runUncalled: (body: (requests: EventRequests) => void, pass: (record: EventRecord) => void) => void;
};

/**
 * Creates the events of one form, none running.
 *
 * @param report - Where a throw from an event with no caller goes, since nothing could catch it. One that throws in
 *   turn still lets every waiting event run, then reaches the outermost event's caller, unless that event threw its own.
 * @returns The form's events
 */
export const createCheckEvents = (report: (error: unknown) => void): CheckEvents => {
  // The requests of the event whose body runs, if one does
  let running: EventRequests | undefined;
  // How many events are active, body or pass: the outermost, each call made from inside a pass, and each waiting one
  // while it runs
  let active = 0;
  // The events with no caller that started while one was active, in order
  const waiting: (() => void)[] = [];

  // Runs `event` as an active one. Once the outermost has ended, its pass included, whatever it threw, the waiting
  // events run inside it, in order, whatever any of them or `report` throws. The outermost stays active meanwhile, so
  // one that starts inside them waits behind them. Then the outermost's own throw reaches its caller, or else the first
  // that escaped the waiting events, so none is lost. Nothing throws past its catch, so `active` is always restored.
  const activate = (event: () => void): void => {
    active += 1;
    let thrown: { error: unknown } | undefined;
    try {
      event();
    } catch (error) {
      thrown = { error };
    }
    if (active === 1) {
      for (let next = waiting.shift(); next; next = waiting.shift()) {
        try {
          next();
        } catch (error) {
          thrown ??= { error };
        }
      }
    }
    active -= 1;
    if (thrown) throw thrown.error;
  };

  // Runs `body` as an event of its own, then its pass
  const runAlone = (body: (requests: EventRequests) => void, pass: (record: EventRecord) => void): void => {
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
  };

  return {
    run: (body, pass) => {
      if (running) body(running);
      else activate(() => runAlone(body, pass));
    },
    runUncalled: (body, pass) => {
      // Its throw goes to `report` as it ends, before the events that started inside it run
      const runOwn = (): void =>
        activate(() => {
          try {
            runAlone(body, pass);
          } catch (error) {
            report(error);
          }
        });
      if (active > 0) waiting.push(runOwn);
      else runOwn();
    },
  };
};
