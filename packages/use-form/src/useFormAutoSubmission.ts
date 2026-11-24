import { useCallback, useEffect, useRef, useState } from 'react';

import { useDebounce } from './useDebounce';
import { deepEqual } from './utils';

/**
 * Represents the subset of form methods needed for auto-submission
 * @template T - The type of form values
 */
type FormWithAutoSubmit<T> = {
  values: T;
  isDirty: boolean;
  isValid: boolean;
  /** When true, auto-submission waits: a save would overwrite a newer version of the record. Optional, so any form-like object still fits. */
  isStale?: boolean;
  validateForm: (values: T) => { ok: boolean } | Promise<{ ok: boolean }>;
  /** Its result, when a promise, marks when the save settles. A throw or rejection is logged with `console.error`, and auto-save carries on. */
  handleSubmit: () => unknown;
};

/**
 * A React hook that automatically submits a form when it becomes valid and dirty.
 * Useful for creating auto-save or live-update form experiences.
 *
 * The hook monitors form values and automatically triggers submission when:
 * 1. The form is dirty (has been modified)
 * 2. The form is valid (passes all validation rules)
 * 3. The values have changed since the last validation
 * 4. The form isn't stale (`isStale`): a save would overwrite a newer version of the record.
 *
 * Submission is debounced to avoid excessive API calls during rapid user input.
 * Pass what was saved back in as `initialValues`, so `isDirty` compares against what the server holds. With
 * `initialValues` that never change, an edit back to them after an earlier save counts as clean and isn't saved.
 * An edit made during a save goes out as soon as that save settles, unless the form is then stale or invalid.
 * It only submits values whose latest validation passed: values still being validated wait for their result.
 * After a `resetKey` switch, the new record's auto-save waits for the previous record's running auto-save,
 * and goes out as soon as it settles.
 * A throw or rejection from `handleSubmit` is logged with `console.error`, and auto-save carries on.
 *
 * @template T - The type of form values
 *
 * @param form - A form object containing values, validation state, and submission methods
 * @param delay - The debounce delay in milliseconds before auto-submitting (default: 200ms)
 * @returns null (this hook only produces side effects)
 *
 * @example
 * // Auto-submit a preferences form. The saved preferences come back as initialValues, so switching
 * // back to an earlier value saves too.
 * const [saved, setSaved] = useState(loadedPreferences);
 * const form = useForm(preferencesSchema, {
 *   initialValues: saved,
 *   onSubmit: async (values) => {
 *     setSaved(await updateUserPreferences(values));
 *   }
 * });
 *
 * useFormAutoSubmission(form, 500);
 *
 * @example
 * // Auto-save a draft, passing the saved draft back
 * const [draft, setDraft] = useState(loadedDraft);
 * const form = useForm(draftSchema, {
 *   initialValues: draft,
 *   onSubmit: async (values) => {
 *     setDraft(await saveDraft(values));
 *   },
 *   validationMode: "live"
 * });
 *
 * useFormAutoSubmission(form);
 */
export const useFormAutoSubmission = <T>(form: FormWithAutoSubmit<T>, delay = 200) => {
  const { values, isDirty, isValid, isStale = false, validateForm, handleSubmit } = form;
  const lastValidatedRef = useRef<T | null>(null);
  // The values whose validation, the latest this hook started, passed. `isValid` describes the last validation
  // that finished, which may be of older values, so a save goes out only for these.
  const passedRef = useRef<T | null>(null);
  // This hook's last save: its values, and whether it's still running
  const savedRef = useRef<T | null>(null);
  const savingRef = useRef(false);
  // A save came due while this hook's own save ran: it goes out once that save settles
  const heldRef = useRef(false);
  // Bumped when a save settles, so the effect decides with its outcome
  const [settled, setSettled] = useState(0);

  const submit = useCallback(
    (submitted: T) => {
      savingRef.current = true;
      savedRef.current = submitted;
      // A throw from handleSubmit, sync or async, still settles the save, so later saves aren't held forever
      void new Promise<unknown>((resolve) => {
        resolve(handleSubmit());
      })
        .catch((error: unknown) => {
          console.error('Auto-submission error:', error);
        })
        .finally(() => {
          savingRef.current = false;
          setSettled((n) => n + 1);
        });
    },
    [handleSubmit],
  );

  const debouncedSubmit = useDebounce(() => {
    // The delay can end after the form went clean, as after a follow or resetForm(): there's nothing to save then.
    // It can also end while newer values are still being validated: their validation submits them if they pass.
    if (!isDirty || !isValid || !deepEqual(values, passedRef.current)) return;
    // While the form is stale, the effect forgets the validated values, so it submits them once it no longer is
    if (isStale) return;
    if (savingRef.current) {
      heldRef.current = true;
      return;
    }
    submit(values);
  }, delay);

  useEffect(() => {
    if (isStale) {
      lastValidatedRef.current = null;
      heldRef.current = false;
      return;
    }
    // A clean form has nothing to save. Forgetting the validated and saved values lets an edit back to them, after
    // a follow or a resetKey switch, be validated and saved: after a switch they're the previous record's.
    if (!isDirty) {
      lastValidatedRef.current = null;
      savedRef.current = null;
    }
    if (heldRef.current && !savingRef.current) {
      // The save that held this one has settled, and the form isn't stale: send it now, as a queued save would go.
      heldRef.current = false;
      if (isDirty && isValid && deepEqual(values, passedRef.current) && !deepEqual(values, savedRef.current)) {
        submit(values);
        return;
      }
      // Otherwise values not validated yet, such as an edit that came in the same render, go the usual way below
    }
    if (!isDirty || deepEqual(values, lastValidatedRef.current)) return;

    lastValidatedRef.current = values;
    const result = validateForm(values);
    const passed = () => {
      // Only the latest validation this hook started counts
      if (lastValidatedRef.current !== values) return;
      passedRef.current = values;
      debouncedSubmit();
    };

    if (result instanceof Promise) {
      void result.then((r) => {
        if (r.ok) passed();
      });
    } else if (result.ok) {
      passed();
    }
    // `settled` re-runs the effect once a save settles, so a held save goes out
  }, [values, isDirty, isValid, isStale, settled, submit, debouncedSubmit, validateForm]);

  return null;
};
