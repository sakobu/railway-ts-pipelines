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
  /** Its result, when a promise, marks when the save settles. */
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
 * An edit made during a save goes out as soon as that save settles, unless the form is then stale.
 * After a `resetKey` switch, the new record's auto-save waits for the previous record's running save,
 * and goes out as soon as it settles.
 *
 * @template T - The type of form values
 *
 * @param form - A form object containing values, validation state, and submission methods
 * @param delay - The debounce delay in milliseconds before auto-submitting (default: 200ms)
 * @returns null (this hook only produces side effects)
 *
 * @example
 * // Auto-submit a preferences form
 * const form = useForm(preferencesSchema, {
 *   initialValues: { theme: 'light', notifications: true },
 *   onSubmit: async (values) => {
 *     await updateUserPreferences(values);
 *   }
 * });
 *
 * useFormAutoSubmission(form, 500);
 *
 * @example
 * // Auto-save a draft
 * const form = useForm(draftSchema, {
 *   initialValues: draft,
 *   onSubmit: saveDraft,
 *   validationMode: "live"
 * });
 *
 * useFormAutoSubmission(form);
 */
export const useFormAutoSubmission = <T>(form: FormWithAutoSubmit<T>, delay = 200) => {
  const { values, isDirty, isValid, isStale = false, validateForm, handleSubmit } = form;
  const lastValidatedRef = useRef<T | null>(null);
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
    if (!isValid) return;
    // The effect already forgot the validated values, so it submits them once the form is no longer stale
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
    if (heldRef.current && !savingRef.current) {
      // The save that held this one has settled, and the form isn't stale: send it now, as a queued save would go
      heldRef.current = false;
      if (isDirty && !deepEqual(values, savedRef.current)) submit(values);
      return;
    }
    if (!isDirty) return;
    if (deepEqual(values, lastValidatedRef.current)) return;

    lastValidatedRef.current = values;
    const result = validateForm(values);

    if (result instanceof Promise) {
      void result.then((r) => {
        if (r.ok) debouncedSubmit();
      });
    } else if (result.ok) {
      debouncedSubmit();
    }
    // `settled` re-runs the effect once a save settles, so a held save goes out
  }, [values, isDirty, isStale, settled, submit, debouncedSubmit, validateForm]);

  return null;
};
