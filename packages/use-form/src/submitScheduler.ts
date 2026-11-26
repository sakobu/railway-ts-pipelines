import { deepEqual } from './utils';

/**
 * Decides what an overlapping submit does. At most one submission runs at a time,
 * and at most one follow-up waits behind it.
 *
 * @template TValues - The shape of the submitted values
 * @template TOutcome - What a submission resolves to
 */
export type SubmitScheduler<TValues, TOutcome> = {
  /**
   * Submits the current values, or joins a submission that already covers them.
   *
   * | When `submit` is called | It returns |
   * | --- | --- |
   * | nothing is running | a new submission: `run(getValues())` |
   * | a follow-up is waiting | that follow-up's promise |
   * | running, and `getValues()` deep-equals the running values | the running submission's promise |
   * | running, with different values | a new follow-up's promise |
   *
   * A follow-up starts once the running submission settles, fulfilled or rejected.
   * It uses the `getValues` and `run` of the latest call that joined it, and reads
   * `getValues()` only when it starts, so edits made while it waits are included.
   *
   * @param getValues - Reads the values to submit at the moment a submission starts
   * @param run - Performs one submission
   * @returns The promise of the submission this call started or joined
   */
  submit: (getValues: () => TValues, run: (values: TValues) => Promise<TOutcome>) => Promise<TOutcome>;

  /**
   * A waiting follow-up submits `values` instead of calling its `getValues`. Used when the form starts over:
   * the running submission and its follow-up still run, for the state they belong to.
   *
   * @param values - The values the waiting follow-up submits. With nothing waiting, nothing changes.
   */
  retire: (values: TValues) => void;

  /** Whether a submission runs. True also while a follow-up waits behind it. */
  isBusy: () => boolean;
};

type Running<TValues, TOutcome> = {
  values: TValues;
  promise: Promise<TOutcome>;
};

type FollowUp<TValues, TOutcome> = {
  promise: Promise<TOutcome>;
  resolve: (outcome: Promise<TOutcome>) => void;
  getValues: () => TValues;
  run: (values: TValues) => Promise<TOutcome>;
};

/**
 * Creates a {@link SubmitScheduler}. A double submit of the same values shares one
 * submission, and an edit made while a submission runs is submitted after it, not dropped.
 *
 * @template TValues - The shape of the submitted values
 * @template TOutcome - What a submission resolves to
 * @param onIdle - Called each time the scheduler goes idle: when a submission settles and no follow-up starts after
 *   it. Not when a follow-up starts.
 * @returns A scheduler with no submission running
 *
 * @example
 * const scheduler = createSubmitScheduler<FormValues, SubmitResult>();
 * const first = scheduler.submit(() => form.values, save);
 * const again = scheduler.submit(() => form.values, save); // same values: again === first
 */
export const createSubmitScheduler = <TValues, TOutcome>(onIdle?: () => void): SubmitScheduler<TValues, TOutcome> => {
  let running: Running<TValues, TOutcome> | undefined;
  let followUp: FollowUp<TValues, TOutcome> | undefined;

  const start = (values: TValues, run: (values: TValues) => Promise<TOutcome>): Promise<TOutcome> => {
    const promise = run(values);
    running = { values, promise };

    // Clearing the running state and starting the follow-up happen in one step,
    // so no call can slip in between and start a second submission alongside it.
    const settle = () => {
      running = undefined;
      const next = followUp;
      if (next) {
        followUp = undefined;
        next.resolve(start(next.getValues(), next.run));
      } else {
        onIdle?.();
      }
    };
    void promise.then(settle, settle);

    return promise;
  };

  const submit = (getValues: () => TValues, run: (values: TValues) => Promise<TOutcome>): Promise<TOutcome> => {
    if (followUp) {
      followUp.getValues = getValues;
      followUp.run = run;
      return followUp.promise;
    }

    if (!running) return start(getValues(), run);

    if (deepEqual(getValues(), running.values)) return running.promise;

    let resolve!: (outcome: Promise<TOutcome>) => void;
    const promise = new Promise<TOutcome>((resolvePromise) => {
      resolve = resolvePromise;
    });
    followUp = { promise, resolve, getValues, run };
    return promise;
  };

  const retire = (values: TValues): void => {
    if (followUp) followUp.getValues = () => values;
  };

  const isBusy = (): boolean => running !== undefined;

  return { submit, retire, isBusy };
};
