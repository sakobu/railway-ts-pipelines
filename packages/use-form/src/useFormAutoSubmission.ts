import { useRef, useEffect } from 'react';

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
  validateForm: (values: T) => { ok: boolean } | Promise<{ ok: boolean }>;
  handleSubmit: () => void;
};

/**
 * A React hook that automatically submits a form when it becomes valid and dirty.
 * Useful for creating auto-save or live-update form experiences.
 *
 * The hook monitors form values and automatically triggers submission when:
 * 1. The form is dirty (has been modified)
 * 2. The form is valid (passes all validation rules)
 * 3. The values have changed since the last validation
 *
 * Submission is debounced to avoid excessive API calls during rapid user input.
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
export const useFormAutoSubmission = <T>(
  form: FormWithAutoSubmit<T>,
  delay = 200
) => {
  const { values, isDirty, isValid, validateForm, handleSubmit } = form;
  const lastValidatedRef = useRef<T | null>(null);

  const debouncedSubmit = useDebounce(() => {
    if (isValid) handleSubmit();
  }, delay);

  useEffect(() => {
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
  }, [values, isDirty, debouncedSubmit, validateForm]);

  return null;
};
