import { describe, test, expect, mock, spyOn, afterEach } from 'bun:test';

import { ok, err, type Result } from '@railway-ts/pipelines/result';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useForm } from '../../src/useForm';
import { useFormAutoSubmission } from '../../src/useFormAutoSubmission';
import { createGatedOnSubmit, nextTask } from '../fixtures/gates';
import {
  userValidator,
  alwaysValidValidator,
  alwaysInvalidValidator,
  alwaysValidAsyncValidator,
  type UserForm,
} from '../fixtures/validators';

import type { ValidationError } from '@railway-ts/pipelines/schema';

const initial: UserForm = { name: 'John', email: 'john@example.com', age: 25 };

/** A form fed by `initialValues` props, auto-submitting after `delay`. */
const renderAutoSubmitForm = (
  onSubmit: ((values: UserForm) => void) | ((values: UserForm) => Promise<Result<UserForm, ValidationError[]>>),
  delay: number,
) =>
  renderHook(
    ({ values }: { values: UserForm }) => {
      const form = useForm(userValidator, {
        initialValues: values,
        onSubmit,
      });
      useFormAutoSubmission(form, delay);
      return form;
    },
    { initialProps: { values: initial } },
  );

const sleep = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

describe('useFormAutoSubmission', () => {
  describe('basic auto-submission', () => {
    test('auto-submits valid dirty form after debounce delay', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form);
        return form;
      });

      // Make form dirty by changing a value
      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      // Wait for debounce + submission
      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalledTimes(1);
        },
        { timeout: 500 },
      );

      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Jane',
        email: 'john@example.com',
        age: 25,
      });
    });

    test('does not submit invalid form', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form);
        return form;
      });

      // Make form invalid
      act(() => {
        result.current.setFieldValue('name', '');
      });

      // Wait for potential submission attempt
      await waitFor(
        () => {
          expect(onSubmit).not.toHaveBeenCalled();
          expect(result.current.errors.name).toBe('Name is required');
        },
        { timeout: 300 },
      );
    });

    test('does not submit clean (not dirty) form', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form);
        return form;
      });

      // Wait for potential submission attempt
      await waitFor(
        () => {
          expect(onSubmit).not.toHaveBeenCalled();
          expect(result.current.isDirty).toBe(false);
        },
        { timeout: 300 },
      );
    });
  });

  describe('debounce behavior', () => {
    test('debounces rapid value changes', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form, 200);
        return form;
      });

      // Make multiple rapid changes
      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      act(() => {
        result.current.setFieldValue('name', 'Jenny');
      });

      // Wait for debounce + submission
      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalledTimes(1);
        },
        { timeout: 500 },
      );

      // Should only submit once with final value
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Jenny',
        email: 'john@example.com',
        age: 25,
      });
    });

    test('respects custom delay parameter', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form, 500); // Custom 500ms delay
        return form;
      });

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      // Check it hasn't submitted too early (wait exactly 250ms)
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(onSubmit).not.toHaveBeenCalled();

      // Wait for submission after full delay
      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalledTimes(1);
        },
        { timeout: 400 }, // 250ms already passed, need up to 250ms more for 500ms total
      );
    });
  });

  describe('validation integration', () => {
    test('validates form before attempting submission', async () => {
      const onSubmit = mock((_values: Record<string, unknown>) => {});

      const { result } = renderHook(() => {
        const form = useForm(alwaysValidValidator, {
          initialValues: { name: 'John' },
          onSubmit,
          validationMode: 'live', // Enable live validation to track validation calls
        });

        useFormAutoSubmission(form);
        return form;
      });

      // Initially should be valid and not dirty
      expect(result.current.isValid).toBe(true);
      expect(result.current.isDirty).toBe(false);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      // Form should become dirty
      expect(result.current.isDirty).toBe(true);

      // Wait for submission
      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalled();
        },
        { timeout: 500 },
      );

      // Verify it submitted with the correct values
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Jane' });
    });

    test('auto-submits with async validator after validation resolves', async () => {
      const onSubmit = mock((_values: Record<string, unknown>) => {});

      const { result } = renderHook(() => {
        const form = useForm(alwaysValidAsyncValidator, {
          initialValues: { name: 'John' },
          onSubmit,
        });
        useFormAutoSubmission(form);
        return form;
      });

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalledTimes(1);
        },
        { timeout: 500 },
      );

      expect(onSubmit).toHaveBeenCalledWith({ name: 'Jane' });
    });

    test('does not submit if validation fails', async () => {
      const onSubmit = mock(() => {});

      const { result } = renderHook(() => {
        const form = useForm<{ name: string }>(alwaysInvalidValidator, {
          initialValues: { name: 'John' },
          onSubmit,
        });
        useFormAutoSubmission(form);
        return form;
      });

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      // Wait for potential submission
      await waitFor(
        () => {
          expect(onSubmit).not.toHaveBeenCalled();
          expect(result.current.isValid).toBe(false);
        },
        { timeout: 300 },
      );
    });
  });

  describe('unchanged values optimization', () => {
    test('does not re-validate unchanged values', async () => {
      const onSubmit = mock((_values: Record<string, unknown>) => {});
      let validateCount = 0;

      const { result } = renderHook(() => {
        const form = useForm(alwaysValidValidator, {
          initialValues: { name: 'John' },
          onSubmit,
        });

        // Track validation calls
        const originalValidate = form.validateForm;
        form.validateForm = (values) => {
          validateCount++;
          return originalValidate(values);
        };

        useFormAutoSubmission(form);
        return form;
      });

      // First change
      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      await waitFor(
        () => {
          expect(validateCount).toBeGreaterThan(0);
        },
        { timeout: 500 },
      );

      const firstValidateCount = validateCount;

      // Wait a bit
      await waitFor(
        () => {
          // Validate count should not increase if values haven't changed
          expect(validateCount).toBe(firstValidateCount);
        },
        { timeout: 300 },
      );
    });
  });

  describe('form reset behavior', () => {
    test('stops auto-submit when form is reset immediately', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form, 500); // Longer delay to allow reset
        return form;
      });

      // Make form dirty and immediately reset
      act(() => {
        result.current.setFieldValue('name', 'Jane');
        result.current.resetForm();
      });

      // Wait for potential submission
      await waitFor(
        () => {
          // Should not have submitted because form was reset before debounce completed
          expect(onSubmit).not.toHaveBeenCalled();
          expect(result.current.isDirty).toBe(false);
        },
        { timeout: 600 },
      );
    });

    test('form becomes clean after reset and does not auto-submit on subsequent renders', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result, rerender } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form);
        return form;
      });

      // Make form dirty and wait for submission
      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalledTimes(1);
        },
        { timeout: 500 },
      );

      // Reset form
      act(() => {
        result.current.resetForm();
      });

      expect(result.current.isDirty).toBe(false);

      // Rerender and wait - should not trigger another submission
      rerender();
      await waitFor(
        () => {
          // Should still only have been called once (not called again after reset)
          expect(onSubmit).toHaveBeenCalledTimes(1);
        },
        { timeout: 300 },
      );
    });
  });

  describe('multiple field changes', () => {
    test('auto-submits after multiple field changes', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form);
        return form;
      });

      // Change multiple fields
      act(() => {
        result.current.setFieldValue('name', 'Jane');
        result.current.setFieldValue('email', 'jane@example.com');
        result.current.setFieldValue('age', 30);
      });

      // Wait for submission
      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalledTimes(1);
        },
        { timeout: 500 },
      );

      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Jane',
        email: 'jane@example.com',
        age: 30,
      });
    });
  });

  describe('stale isValid bug', () => {
    test('submits after transitioning from invalid to valid values', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result } = renderHook(() => {
        const form = useForm(userValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form);
        return form;
      });

      // Make form invalid first
      act(() => {
        result.current.setFieldValue('name', '');
      });

      // Wait for validation to mark form as invalid
      await waitFor(
        () => {
          expect(result.current.isValid).toBe(false);
        },
        { timeout: 300 },
      );

      // Now fix the invalid field back to valid
      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      // The fix: validateForm return value is used directly,
      // so submission should fire even though isValid was false on the previous render
      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalledTimes(1);
        },
        { timeout: 500 },
      );

      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Jane',
        email: 'john@example.com',
        age: 25,
      });
    });
  });

  describe('overlapping saves', () => {
    test('an edit made during an in-flight auto-save is saved after it', async () => {
      const onSubmit = mock(async (_values: Record<string, unknown>) => {
        await new Promise((resolve) => setTimeout(resolve, 300));
      });
      const initialValues = { name: '' };

      const { result } = renderHook(() => {
        const form = useForm(alwaysValidValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form, 50);
        return form;
      });

      act(() => {
        result.current.setFieldValue('name', 'a');
      });

      // The first save is in flight
      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalledTimes(1);
        },
        { timeout: 500 },
      );

      act(() => {
        result.current.setFieldValue('name', 'ab');
      });

      // Both saves have finished
      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalledTimes(2);
          expect(result.current.isSubmitting).toBe(false);
        },
        { timeout: 1500 },
      );

      expect(onSubmit.mock.calls).toEqual([[{ name: 'a' }], [{ name: 'ab' }]]);
    });

    test('an edit made during a save goes out as soon as that save settles, without another delay', async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const { result } = renderAutoSubmitForm(onSubmit, 200);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 500 });

      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });
      // The edit comes due during the save
      await sleep(300);
      expect(onSubmit).toHaveBeenCalledTimes(1);

      await act(async () => {
        saves[0]!.resolve(ok({ ...initial, name: 'Jane' }));
        await nextTask();
      });

      // Half the delay: waiting a full delay after the save would miss this
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2), { timeout: 100 });
      expect(onSubmit.mock.calls[1]).toEqual([{ ...initial, name: 'Janet' }]);
    });

    test("an edit that comes back to the values being saved isn't saved again", async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const { result } = renderAutoSubmitForm(onSubmit, 200);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 500 });

      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });
      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      // The edit comes due during the save
      await sleep(300);

      await act(async () => {
        saves[0]!.resolve(ok({ ...initial, name: 'Jane' }));
        await nextTask();
      });
      await sleep(300);

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    test("a held save isn't sent when the edits were undone during the save", async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const { result } = renderAutoSubmitForm(onSubmit, 50);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });

      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });
      // The edit comes due during the save: it's held
      await sleep(150);
      act(() => {
        result.current.setFieldValue('name', 'John');
      });
      expect(result.current.isDirty).toBe(false);

      await act(async () => {
        saves[0]!.resolve(ok({ ...initial, name: 'Jane' }));
        await nextTask();
      });
      await sleep(150);

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    test("after a resetKey switch, the new record's save waits for the previous record's running save", async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const other: UserForm = { name: 'Bob', email: 'bob@example.com', age: 30 };
      const { result, rerender } = renderHook(
        ({ values, id }: { values: UserForm; id: string }) => {
          const form = useForm(userValidator, { initialValues: values, resetKey: id, onSubmit });
          useFormAutoSubmission(form, 50);
          return form;
        },
        { initialProps: { values: initial, id: 'a' } },
      );

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });

      rerender({ values: other, id: 'b' });
      act(() => {
        result.current.setFieldValue('name', 'Bobby');
      });
      await sleep(300);
      expect(onSubmit).toHaveBeenCalledTimes(1);

      await act(async () => {
        saves[0]!.resolve(ok({ ...initial, name: 'Jane' }));
        await nextTask();
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2), { timeout: 1000 });
      expect(onSubmit.mock.calls[1]).toEqual([{ ...other, name: 'Bobby' }]);
    });

    test("keeps saving when the previous save's answer arrives during the held save", async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const { result, rerender } = renderAutoSubmitForm(onSubmit, 50);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });
      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });
      // The edit comes due during the save: it's held, and goes out once the save succeeds
      await sleep(150);
      await act(async () => {
        saves[0]!.resolve(undefined);
        await nextTask();
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2), { timeout: 1000 });

      // The first save's answer arrives while the held save runs, and the user keeps typing
      rerender({ values: { ...initial, name: 'Jane' } });
      act(() => {
        result.current.setFieldValue('name', 'Janette');
      });
      await act(async () => {
        saves[1]!.resolve(undefined);
        await nextTask();
      });
      // The held save's answer arrives
      rerender({ values: { ...initial, name: 'Janet' } });
      expect(result.current.isStale).toBe(false);

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(3), { timeout: 1000 });
      expect(onSubmit.mock.calls[2]).toEqual([{ ...initial, name: 'Janette' }]);
    });
  });

  describe('failed saves', () => {
    afterEach(() => {
      mock.restore();
    });

    test('keeps auto-submitting after a thrown onSubmit', async () => {
      const consoleError = spyOn(console, 'error').mockImplementation(() => {});
      let calls = 0;
      const onSubmit = mock((_values: Record<string, unknown>) => {
        calls += 1;
        if (calls === 1) throw new Error('Network error');
        return Promise.resolve();
      });
      const initialValues = { name: '' };

      const { result } = renderHook(() => {
        const form = useForm(alwaysValidValidator, {
          initialValues,
          onSubmit,
        });
        useFormAutoSubmission(form, 50);
        return form;
      });

      act(() => {
        result.current.setFieldValue('name', 'a');
      });

      // The first save failed: the submit error shows, and the form stays valid
      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalledTimes(1);
          expect(result.current.errors._root).toBe('Something went wrong. Please try again.');
        },
        { timeout: 500 },
      );
      expect(result.current.isValid).toBe(true);

      act(() => {
        result.current.setFieldValue('name', 'ab');
      });

      await waitFor(
        () => {
          expect(onSubmit).toHaveBeenCalledTimes(2);
          expect(result.current.isSubmitting).toBe(false);
        },
        { timeout: 500 },
      );

      expect(onSubmit.mock.calls).toEqual([[{ name: 'a' }], [{ name: 'ab' }]]);
      expect(consoleError).toHaveBeenCalledWith('Form submission error:', expect.any(Error));
    });
  });

  describe('stale forms', () => {
    // Another user's change to the record
    const changed: UserForm = { ...initial, email: 'new@example.com' };
    const wait = () => sleep(150);

    test('does not submit while the form is stale, including a save already waiting out its delay', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const { result, rerender } = renderAutoSubmitForm(onSubmit, 50);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      rerender({ values: changed });
      expect(result.current.isStale).toBe(true);

      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });
      await wait();

      expect(onSubmit).not.toHaveBeenCalled();
    });

    test('submits the edits made while stale once the form is no longer stale', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const { result, rerender } = renderAutoSubmitForm(onSubmit, 50);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      rerender({ values: changed });
      await wait();
      expect(onSubmit).not.toHaveBeenCalled();

      // The other user undid the change
      rerender({ values: { ...initial } });
      expect(result.current.isStale).toBe(false);

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });
      expect(onSubmit.mock.calls[0]).toEqual([{ ...initial, name: 'Jane' }]);
    });

    test("a save that comes due during a save waits for it, and doesn't go out if that save ends stale", async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const { result, rerender } = renderAutoSubmitForm(onSubmit, 50);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });

      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });
      rerender({ values: changed });
      // The save is running, so the form doesn't read as stale
      expect(result.current.isStale).toBe(false);
      await wait();
      expect(onSubmit).toHaveBeenCalledTimes(1);

      await act(async () => {
        saves[0]!.resolve(err([{ path: [], message: 'Conflict' }]));
        await nextTask();
      });
      expect(result.current.isStale).toBe(true);

      await wait();
      expect(onSubmit).toHaveBeenCalledTimes(1);

      // The other user undid the change: the dropped save goes out
      rerender({ values: { ...initial } });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2), { timeout: 1000 });
      expect(onSubmit.mock.calls[1]).toEqual([{ ...initial, name: 'Janet' }]);
    });

    test("a save dropped as stale doesn't come back as an invalid edit once the form is no longer stale", async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const { result, rerender } = renderAutoSubmitForm(onSubmit, 50);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });

      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });
      rerender({ values: changed });
      await wait();
      await act(async () => {
        saves[0]!.resolve(err([{ path: [], message: 'Conflict' }]));
        await nextTask();
      });
      expect(result.current.isStale).toBe(true);

      act(() => {
        result.current.setFieldValue('email', 'not-an-email');
      });
      rerender({ values: { ...initial } });
      await wait();

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(result.current.submitCount).toBe(1);
    });

    test("a form that's stale isn't validated, and is validated once it isn't", async () => {
      const validateForm = mock((_values: { name: string }) => ({ ok: true }));
      const handleSubmit = mock(() => {});
      const { rerender } = renderHook(
        ({ name, isStale }: { name: string; isStale: boolean }) =>
          useFormAutoSubmission(
            { values: { name }, isDirty: true, isValid: true, isStale, validateForm, handleSubmit },
            20,
          ),
        { initialProps: { name: 'a', isStale: true } },
      );

      rerender({ name: 'ab', isStale: true });
      await sleep(80);
      expect(validateForm).not.toHaveBeenCalled();
      expect(handleSubmit).not.toHaveBeenCalled();

      rerender({ name: 'ab', isStale: false });
      await sleep(80);
      expect(validateForm).toHaveBeenCalledTimes(1);
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('a handleSubmit that throws', () => {
    afterEach(() => {
      mock.restore();
    });

    test("is logged, and doesn't stop later edits from being submitted", async () => {
      const consoleError = spyOn(console, 'error').mockImplementation(() => {});
      const boom = new Error('boom');
      let calls = 0;
      const handleSubmit = () => {
        calls += 1;
        if (calls === 1) throw boom;
      };
      const validateForm = () => ({ ok: true });
      const { rerender } = renderHook(
        ({ values }: { values: { name: string } }) =>
          useFormAutoSubmission({ values, isDirty: true, isValid: true, validateForm, handleSubmit }, 20),
        { initialProps: { values: { name: 'a' } } },
      );

      await sleep(80);
      rerender({ values: { name: 'ab' } });
      await sleep(80);

      expect(calls).toBe(2);
      expect(consoleError).toHaveBeenCalledWith('Auto-submission error:', boom);
    });
  });

  describe('hook return value', () => {
    test('returns null', () => {
      const { result } = renderHook(() => {
        const form = useForm(alwaysValidValidator, {
          initialValues: { name: 'John' },
        });
        return useFormAutoSubmission(form);
      });

      expect(result.current).toBe(null);
    });
  });
});
