import { describe, test, expect, mock, spyOn, afterEach } from 'bun:test';

import { ok, err, type Result } from '@railway-ts/pipelines/result';
import { validate, type MaybeAsyncValidator, type ValidationError } from '@railway-ts/pipelines/schema';
import { renderHook, act, waitFor } from '@testing-library/react';
import { StrictMode, useState } from 'react';

import { useForm } from '../../src/useForm';
import { createGatedOnSubmit, createGatedValidator, nextTask, withoutAct } from '../fixtures/gates';
import {
  userValidator,
  alwaysValidValidator,
  alwaysInvalidValidator,
  alwaysValidAsyncValidator,
  type UserForm,
} from '../fixtures/validators';

import type { FormOptions } from '../../src/types';

const initial: UserForm = { name: 'John', email: 'john@example.com', age: 25 };

/** How long auto-save waits, unless a test sets its own. */
const delay = 100;

/** Waits without act, so each update commits as it does in the app. */
const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const sleep = (ms: number) => act(() => pause(ms));

/** An `onSubmit` that saves. */
const saving = () => mock((_values: UserForm) => {});

/** An `onSubmit` whose server rejects every save with `errors`. */
const rejecting = (errors: ValidationError[]) =>
  mock((_values: UserForm): Promise<Result<UserForm, ValidationError[]>> => Promise.resolve(err(errors)));

/** An async schema that passes every value, and counts its calls. */
const passingSchema = () =>
  mock((input: unknown): Promise<Result<UserForm, ValidationError[]>> => Promise.resolve(ok(input as UserForm)));

/** Options with a field validator that rejects the name 'Bad'. */
const noBadName: Partial<FormOptions<UserForm>> = {
  fieldValidators: { name: (name) => (name === 'Bad' ? 'No' : undefined) },
};

/**
 * A form fed by `values` and `options` props, auto-saving after `autoSaveDelay`. It builds a new `autoSave` object on
 * every render, as an inline option does. `options` overrides any option, `autoSave` and `onSubmit` included.
 */
const renderAutoSaveForm = (
  onSubmit: FormOptions<UserForm>['onSubmit'],
  autoSaveDelay: number,
  options?: Partial<FormOptions<UserForm>>,
) =>
  renderHook(
    (props: { values: UserForm; options: Partial<FormOptions<UserForm>> }) =>
      useForm(userValidator, {
        initialValues: props.values,
        onSubmit,
        autoSave: { delay: autoSaveDelay },
        ...props.options,
      }),
    { initialProps: { values: initial, options: options ?? {} } },
  );

describe('autoSave', () => {
  describe('a version an invalid form held', () => {
    test('#54: saves once a switched-off field validator drops the error that blocked it', async () => {
      const onSubmit = saving();
      const { result, rerender } = renderAutoSaveForm(onSubmit, delay, noBadName);

      act(() => {
        result.current.setFieldValue('name', 'Bad');
      });
      await sleep(3 * delay);
      expect(onSubmit).not.toHaveBeenCalled();

      rerender({ values: initial, options: {} });
      await sleep(3 * delay);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({ ...initial, name: 'Bad' });
    });

    test('#54: saves once clearServerErrors() clears an error on another field', async () => {
      const onSubmit = saving();
      const { result } = renderAutoSaveForm(onSubmit, delay);

      act(() => {
        result.current.setServerErrors([{ path: ['email'], message: 'Taken' }]);
      });
      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await sleep(3 * delay);
      expect(onSubmit).not.toHaveBeenCalled();

      act(() => {
        result.current.clearServerErrors();
      });
      await sleep(3 * delay);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({ ...initial, name: 'Jane' });
    });
  });

  describe('each version goes out once', () => {
    test("doesn't resend values the server rejected, after clearServerErrors()", async () => {
      const onSubmit = rejecting([{ path: ['email'], message: 'Taken' }]);
      const { result } = renderAutoSaveForm(onSubmit, delay);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(result.current.serverErrors).toEqual({ email: 'Taken' }));
      expect(onSubmit).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.clearServerErrors();
      });
      expect(result.current.isValid).toBe(true);
      await sleep(3 * delay);

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    test("doesn't auto-send values a Save click sent and the server rejected", async () => {
      const onSubmit = rejecting([{ path: ['email'], message: 'Taken' }]);
      const { result } = renderAutoSaveForm(onSubmit, delay);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      // The Save click, before the delay ends
      await act(() => result.current.handleSubmit());
      expect(result.current.serverErrors).toEqual({ email: 'Taken' });

      act(() => {
        result.current.clearServerErrors();
      });
      expect(result.current.isValid).toBe(true);
      await sleep(3 * delay);

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    test("an edit back to the values that went out, made within the delay, isn't sent", async () => {
      const onSubmit = rejecting([{ path: [], message: 'Down' }]);
      const { result } = renderAutoSaveForm(onSubmit, delay);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });
      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await sleep(3 * delay);

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    test("doesn't resend values an optimistic write and its rollback hid", async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const { result } = renderHook(() => {
        const [record, setRecord] = useState(initial);
        return useForm(userValidator, {
          initialValues: record,
          // Writes the values to the record before the server answers, and rolls back when the save fails
          onSubmit: async (values): Promise<Result<UserForm, ValidationError[]>> => {
            onSubmit(values);
            setRecord(values);
            await pause(10);
            setRecord(initial);
            await pause(10);
            return err([{ path: [], message: 'Network down' }]);
          },
          autoSave: { delay },
        });
      });

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      // Outside act, so the optimistic write commits before the rollback, as in the app
      await withoutAct(() => pause(5 * delay));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(result.current.values.name).toBe('Jane');
    });

    test('a form without onSubmit is submitted once per version', async () => {
      const { result } = renderAutoSaveForm(undefined, delay);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await sleep(5 * delay);

      expect(result.current.submitCount).toBe(1);
    });
  });

  describe('a Save click', () => {
    test("sends values a Save click's own validation stopped, once the form turns valid", async () => {
      const onSubmit = saving();
      const { result, rerender } = renderAutoSaveForm(onSubmit, delay, { ...noBadName, validationMode: 'live' });

      act(() => {
        result.current.setFieldValue('name', 'Bad');
      });
      await act(() => result.current.handleSubmit());
      await sleep(3 * delay);
      expect(result.current.submitCount).toBe(1);
      expect(onSubmit).not.toHaveBeenCalled();

      rerender({ values: initial, options: { validationMode: 'live' } });
      await sleep(3 * delay);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({ ...initial, name: 'Bad' });
    });

    test('an edit that comes due during a Save click goes out once that Save settles', async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const { result } = renderAutoSaveForm(onSubmit, delay);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
        void result.current.handleSubmit();
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });
      // Its delay ends while the Save runs
      await sleep(3 * delay);
      expect(onSubmit).toHaveBeenCalledTimes(1);

      // Outside act, the Save's last commit can come before the submit scheduler lets go of it
      await withoutAct(async () => {
        saves[0]!.resolve(undefined);
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
      });

      expect(onSubmit.mock.calls[1]).toEqual([{ ...initial, name: 'Janet' }]);
    });
  });

  describe('a stale form', () => {
    test('an auto-save cancelled as overtaken goes out once the other user undoes their change', async () => {
      const { pending, gated } = createGatedValidator<UserForm>();
      const onSubmit = saving();
      const { result, rerender } = renderHook(
        ({ values }: { values: UserForm }) => useForm(gated, { initialValues: values, onSubmit, autoSave: { delay } }),
        { initialProps: { values: initial } },
      );
      const edited: UserForm = { ...initial, name: 'Jane' };
      const passAll = () =>
        act(async () => {
          for (const check of pending) check.resolve(ok(edited));
          await nextTask();
        });

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      // The edit's own check
      await passAll();
      await sleep(2 * delay);
      // The save started, and its schema check waits
      expect(pending).toHaveLength(2);

      // Another user changes the record while the save validates
      rerender({ values: { ...initial, email: 'new@example.com' } });
      await passAll();
      expect(onSubmit).not.toHaveBeenCalled();
      expect(result.current.isStale).toBe(true);

      // They undo their change
      rerender({ values: initial });
      await sleep(2 * delay);
      // The new save's check waits too
      expect(pending).toHaveLength(3);
      await passAll();

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith(edited);
    });
  });

  describe('its own check', () => {
    test('an edit made without validation is checked, then saved', async () => {
      const onSubmit = saving();
      const { result } = renderAutoSaveForm(onSubmit, delay, { validationMode: 'live' });

      act(() => {
        result.current.setFieldValue('name', 'Jane', false);
      });
      await sleep(3 * delay);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({ ...initial, name: 'Jane' });
    });

    test("a check that a reset dropped doesn't hold the same values set again", async () => {
      const { pending, gated } = createGatedValidator<UserForm>();
      const onSubmit = saving();
      const { result } = renderHook(() =>
        useForm(gated, { initialValues: initial, onSubmit, validationMode: 'blur', autoSave: { delay: 10 } }),
      );
      const edited: UserForm = { ...initial, name: 'Jane' };
      const passAll = () =>
        act(async () => {
          for (const check of pending) check.resolve(ok(edited));
          await nextTask();
        });

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await sleep(100);
      // Auto-save's own check started, and waits
      expect(pending).toHaveLength(1);

      // The reset drops the check, and the same values come back in the same commit
      act(() => {
        result.current.resetForm();
        result.current.setFieldValue('name', 'Jane');
      });
      // The dropped check, then the new check and the save's
      await passAll();
      await passAll();
      await sleep(100);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith(edited);
    });

    test("a failed check in submit mode doesn't touch fields or count a submit", async () => {
      const onSubmit = saving();
      const { result } = renderAutoSaveForm(onSubmit, delay, { validationMode: 'submit' });

      act(() => {
        result.current.setFieldValue('name', '');
      });
      await sleep(3 * delay);
      expect(result.current.errors.name).toBe('Name is required');
      expect(result.current.touched).toEqual({});
      expect(result.current.submitCount).toBe(0);
      expect(onSubmit).not.toHaveBeenCalled();

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await sleep(3 * delay);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({ ...initial, name: 'Jane' });
    });

    test("a schema that throws during auto-save's own check is logged, not retried, and later edits are saved", async () => {
      const consoleError = spyOn(console, 'error').mockImplementation(() => {});
      try {
        const boom = new Error('boom');
        // Throws at once, not as a rejection, so the throw reaches the check auto-save started
        const schema = mock((input: unknown) => {
          if ((input as UserForm).name === 'Boom') throw boom;
          return validate(input, userValidator);
        });
        const onSubmit = saving();
        const { result } = renderHook(() =>
          useForm(schema, { initialValues: initial, onSubmit, validationMode: 'submit', autoSave: { delay } }),
        );
        const checksOfBoom = () => schema.mock.calls.filter(([input]) => (input as UserForm).name === 'Boom').length;

        act(() => {
          result.current.setFieldValue('name', 'Boom');
        });
        await sleep(5 * delay);
        expect(checksOfBoom()).toBe(1);
        expect(consoleError).toHaveBeenCalledWith('Form validation error:', boom);
        expect(onSubmit).not.toHaveBeenCalled();

        act(() => {
          result.current.setFieldValue('name', 'Fine');
        });
        await sleep(3 * delay);

        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit).toHaveBeenCalledWith({ ...initial, name: 'Fine' });
      } finally {
        consoleError.mockRestore();
      }
    });

    test("a validator that throws during the save doesn't make auto-save resubmit", async () => {
      const consoleError = spyOn(console, 'error').mockImplementation(() => {});
      try {
        const boom = new Error('boom');
        const onSubmit = saving();
        const { result } = renderAutoSaveForm(onSubmit, delay, {
          // Not live: there the edit's own field check would run the validator first, and its throw reach setFieldValue
          validationMode: 'submit',
          fieldValidators: {
            name: () => {
              throw boom;
            },
          },
        });

        act(() => {
          result.current.setFieldValue('name', 'Jane');
        });
        await sleep(5 * delay);

        expect(result.current.submitCount).toBe(1);
        expect(onSubmit).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalledWith('Form submission error:', boom);
      } finally {
        consoleError.mockRestore();
      }
    });

    test("a schema that rejects the values without an error doesn't make auto-save resubmit", async () => {
      // Rejects the name 'Jane' with no error. Its 20th rejection holds one, which ends a resubmit loop, so a
      // regression fails instead of hanging the runner.
      let rejections = 0;
      const schema = (input: unknown): Result<UserForm, ValidationError[]> => {
        if ((input as UserForm).name !== 'Jane') return validate(input, userValidator);
        rejections += 1;
        return err(rejections < 20 ? [] : [{ path: ['name'], message: 'Looped' }]);
      };
      const onSubmit = saving();
      const { result } = renderHook(() => useForm(schema, { initialValues: initial, onSubmit, autoSave: { delay } }));

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await sleep(5 * delay);

      // The edit's live check, then the save's
      expect(rejections).toBe(2);
      expect(result.current.submitCount).toBe(1);
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('validator calls', () => {
    test('the schema runs twice per edit in live mode', async () => {
      const schema = passingSchema();
      const onSubmit = saving();
      const { result } = renderHook(() => useForm(schema, { initialValues: initial, onSubmit, autoSave: { delay } }));
      await sleep(2 * delay);
      const atMount = schema.mock.calls.length;

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

      expect(schema.mock.calls.length - atMount).toBe(2);
    });

    test('field validators run once per edit and once in the save, in live mode', async () => {
      const checkName = mock((_name: string) => undefined);
      const onSubmit = saving();
      const { result } = renderAutoSaveForm(onSubmit, delay, { fieldValidators: { name: checkName } });

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

      expect(checkName).toHaveBeenCalledTimes(2);
    });

    test('submit mode checks the schema once per pause, and runs field validators only in the save', async () => {
      const schema = passingSchema();
      const checkName = mock((_name: string) => undefined);
      const onSubmit = saving();
      const { result } = renderHook(() =>
        useForm(schema, {
          initialValues: initial,
          onSubmit,
          validationMode: 'submit',
          fieldValidators: { name: checkName },
          autoSave: { delay },
        }),
      );

      act(() => {
        result.current.setFieldValue('name', 'J');
      });
      act(() => {
        result.current.setFieldValue('name', 'Ja');
      });
      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

      expect(onSubmit).toHaveBeenCalledWith({ ...initial, name: 'Jane' });
      expect(schema).toHaveBeenCalledTimes(2);
      expect(checkName).toHaveBeenCalledTimes(1);
    });
  });

  describe('the option', () => {
    test.each([[true], [{}]])('autoSave: %p waits 200 ms', async (autoSave) => {
      const onSubmit = saving();
      const { result } = renderAutoSaveForm(onSubmit, delay, { autoSave });

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await sleep(150);
      expect(onSubmit).not.toHaveBeenCalled();

      // Within 400 ms of the edit
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 250 });
    });

    test('autoSave: null, which untyped code can pass, is off', async () => {
      const onSubmit = saving();
      const { result } = renderAutoSaveForm(onSubmit, delay, { autoSave: null as unknown as false });

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await sleep(3 * delay);

      expect(onSubmit).not.toHaveBeenCalled();
    });

    test('switching autoSave on saves the edits already made, after the delay', async () => {
      const onSubmit = saving();
      const { result, rerender } = renderAutoSaveForm(onSubmit, delay, { autoSave: false });

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await sleep(3 * delay);
      expect(onSubmit).not.toHaveBeenCalled();

      rerender({ values: initial, options: { autoSave: { delay } } });
      await sleep(delay / 2);
      expect(onSubmit).not.toHaveBeenCalled();

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      await sleep(2 * delay);
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    test('switching autoSave off drops a save waiting out its delay', async () => {
      const onSubmit = saving();
      const { result, rerender } = renderAutoSaveForm(onSubmit, delay);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await sleep(delay / 2);
      rerender({ values: initial, options: { autoSave: false } });
      await sleep(3 * delay);
      expect(onSubmit).not.toHaveBeenCalled();

      rerender({ values: initial, options: { autoSave: { delay } } });
      await sleep(delay / 2);
      expect(onSubmit).not.toHaveBeenCalled();

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      await sleep(2 * delay);
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    test('a new delay applies from the next change', async () => {
      const onSubmit = saving();
      const { result, rerender } = renderAutoSaveForm(onSubmit, 50);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      rerender({ values: initial, options: { autoSave: { delay: 300 } } });
      // The running delay keeps its 50 ms
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 150 });

      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });
      await sleep(150);
      expect(onSubmit).toHaveBeenCalledTimes(1);

      // Within 450 ms of the edit
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2), { timeout: 300 });
    });

    test("an inline autoSave object doesn't restart the delay", async () => {
      const onSubmit = saving();
      const { result, rerender } = renderAutoSaveForm(onSubmit, delay);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await sleep(0.6 * delay);
      // Renders a new autoSave object, equal to the one before
      rerender({ values: initial, options: {} });
      await sleep(0.7 * delay);

      // A restarted delay would save at 1.6 × delay
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('React', () => {
    test('unmounting during the delay sends nothing', async () => {
      const onSubmit = saving();
      const { result, unmount } = renderAutoSaveForm(onSubmit, delay);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await sleep(delay / 2);
      unmount();
      await sleep(3 * delay);

      expect(onSubmit).not.toHaveBeenCalled();
    });

    test('saves once under StrictMode', async () => {
      // StrictMode reruns the effects only at mount, while the values are clean. So this guards that auto-save is still
      // on after its simulated remount, and that nothing runs twice.
      const onSubmit = saving();
      const { result } = renderHook(
        () => useForm(userValidator, { initialValues: initial, onSubmit, autoSave: { delay } }),
        { wrapper: StrictMode },
      );

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await sleep(3 * delay);

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    test('a save uses the onSubmit of the latest render', async () => {
      const first = saving();
      const latest = saving();
      const { result, rerender } = renderAutoSaveForm(first, delay);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await sleep(delay / 2);
      rerender({ values: initial, options: { onSubmit: latest } });
      await sleep(3 * delay);

      expect(latest).toHaveBeenCalledTimes(1);
      expect(first).not.toHaveBeenCalled();
    });
  });

  describe('basic auto-submission', () => {
    test('auto-submits valid dirty form after debounce delay', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const initialValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const { result } = renderHook(() => useForm(userValidator, { initialValues, onSubmit, autoSave: true }));

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

      const { result } = renderHook(() => useForm(userValidator, { initialValues, onSubmit, autoSave: true }));

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

      const { result } = renderHook(() => useForm(userValidator, { initialValues, onSubmit, autoSave: true }));

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

      const { result } = renderHook(() =>
        useForm(userValidator, { initialValues, onSubmit, autoSave: { delay: 200 } }),
      );

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

      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues,
          onSubmit,
          autoSave: { delay: 500 }, // Custom 500ms delay
        }),
      );

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

      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, {
          initialValues: { name: 'John' },
          onSubmit,
          validationMode: 'live', // Enable live validation to track validation calls
          autoSave: true,
        }),
      );

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

      const { result } = renderHook(() =>
        useForm(alwaysValidAsyncValidator, { initialValues: { name: 'John' }, onSubmit, autoSave: true }),
      );

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

      const { result } = renderHook(() =>
        useForm<{ name: string }>(alwaysInvalidValidator, {
          initialValues: { name: 'John' },
          onSubmit,
          autoSave: true,
        }),
      );

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
      const schema = passingSchema();
      const onSubmit = saving();
      const { result } = renderHook(() =>
        useForm(schema, { initialValues: initial, onSubmit, validationMode: 'submit', autoSave: { delay } }),
      );

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      const afterSave = schema.mock.calls.length;

      await sleep(3 * delay);

      expect(schema.mock.calls.length).toBe(afterSave);
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

      const { result } = renderHook(() =>
        useForm(userValidator, {
          initialValues,
          onSubmit,
          autoSave: { delay: 500 }, // Longer delay to allow reset
        }),
      );

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

      const { result, rerender } = renderHook(() =>
        useForm(userValidator, { initialValues, onSubmit, autoSave: true }),
      );

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

  describe('a form that goes clean', () => {
    test("a save waiting out its delay doesn't go out once the form follows a refetch", async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const { result, rerender } = renderAutoSaveForm(onSubmit, 50);

      // An edit undone within the delay, then a refetch
      act(() => {
        result.current.setFieldValue('name', 'Jo');
      });
      act(() => {
        result.current.setFieldValue('name', 'John');
      });
      rerender({ values: { ...initial, email: 'refetched@example.com' }, options: {} });
      expect(result.current.isDirty).toBe(false);
      await sleep(150);

      expect(onSubmit).not.toHaveBeenCalled();
    });

    test("a save waiting out its delay doesn't go out once resetForm() makes the form clean", async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const { result } = renderAutoSaveForm(onSubmit, 50);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      act(() => {
        result.current.resetForm();
      });
      await sleep(150);

      expect(onSubmit).not.toHaveBeenCalled();
    });

    test('saves an edit back to values it saved before a follow', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const { result, rerender } = renderAutoSaveForm(onSubmit, 20);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 500 });
      // The saved record comes back, then someone else sets the name back to John
      rerender({ values: { ...initial, name: 'Jane' }, options: {} });
      rerender({ values: { ...initial }, options: {} });
      expect(result.current.values.name).toBe('John');

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2), { timeout: 500 });
      expect(onSubmit.mock.calls[1]).toEqual([{ ...initial, name: 'Jane' }]);
    });

    test('saves a new record edited to the values the previous record was saved with', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const A: UserForm = { name: 'Ann', email: 'a@example.com', age: 30 };
      const B: UserForm = { name: 'Bob', email: 'a@example.com', age: 30 };
      const { result, rerender } = renderHook(
        ({ values, id }: { values: UserForm; id: string }) =>
          useForm(userValidator, { initialValues: values, resetKey: id, onSubmit, autoSave: { delay: 20 } }),
        { initialProps: { values: A, id: 'a' } },
      );

      act(() => {
        result.current.setFieldValue('name', 'Same');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 500 });
      rerender({ values: B, id: 'b' });
      act(() => {
        result.current.setFieldValue('name', 'Same');
      });

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2), { timeout: 500 });
      expect(onSubmit.mock.calls[1]).toEqual([{ ...B, name: 'Same' }]);
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

      const { result } = renderHook(() => useForm(userValidator, { initialValues, onSubmit, autoSave: true }));

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

      const { result } = renderHook(() => useForm(userValidator, { initialValues, onSubmit, autoSave: true }));

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

      // The form shows the fixed values valid, so they're submitted, though it was invalid on an earlier render
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

      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, { initialValues, onSubmit, autoSave: { delay: 50 } }),
      );

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
      const { result } = renderAutoSaveForm(onSubmit, 200);

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
      const { result } = renderAutoSaveForm(onSubmit, 200);

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
      const { result } = renderAutoSaveForm(onSubmit, 50);

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

    test("a held save isn't sent when its values turned invalid during the save", async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const { result } = renderAutoSaveForm(onSubmit, 50);

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
        result.current.setFieldValue('email', 'not-an-email');
      });
      expect(result.current.isValid).toBe(false);

      await act(async () => {
        saves[0]!.resolve(undefined);
        await nextTask();
      });
      await sleep(150);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(result.current.submitCount).toBe(1);
    });

    test('saves an edit back to the held values once the save settles and the form follows its answer', async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const { result, rerender } = renderAutoSaveForm(onSubmit, 50);

      act(() => {
        result.current.setFieldValue('name', 'jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });
      // Edits that come due during the save are held: the last one is the value being saved
      act(() => {
        result.current.setFieldValue('name', 'janet');
      });
      await sleep(150);
      act(() => {
        result.current.setFieldValue('name', 'jane');
      });
      await sleep(150);

      // The save settles, and its answer, with the name capitalized, arrives in the same commit
      await act(async () => {
        saves[0]!.resolve(undefined);
        await nextTask();
        rerender({ values: { ...initial, name: 'Jane' }, options: {} });
      });
      expect(result.current.isDirty).toBe(false);

      act(() => {
        result.current.setFieldValue('name', 'jane');
      });

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2), { timeout: 1000 });
      expect(onSubmit.mock.calls[1]).toEqual([{ ...initial, name: 'jane' }]);
    });

    test("after a resetKey switch, the new record's save waits for the previous record's running save", async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const other: UserForm = { name: 'Bob', email: 'bob@example.com', age: 30 };
      const { result, rerender } = renderHook(
        ({ values, id }: { values: UserForm; id: string }) =>
          useForm(userValidator, { initialValues: values, resetKey: id, onSubmit, autoSave: { delay: 50 } }),
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

    test("after a resetKey switch, the new record's held save goes out even with the values of the previous record's save", async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const other: UserForm = { ...initial, name: 'Bob' };
      const { result, rerender } = renderHook(
        ({ values, id }: { values: UserForm; id: string }) =>
          useForm(userValidator, { initialValues: values, resetKey: id, onSubmit, autoSave: { delay: 50 } }),
        { initialProps: { values: initial, id: 'a' } },
      );

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });

      rerender({ values: other, id: 'b' });
      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await sleep(300);
      expect(onSubmit).toHaveBeenCalledTimes(1);

      await act(async () => {
        saves[0]!.resolve(ok({ ...initial, name: 'Jane' }));
        await nextTask();
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2), { timeout: 1000 });
      expect(onSubmit.mock.calls[1]).toEqual([{ ...other, name: 'Jane' }]);
    });

    describe("a resetKey switch drops the previous record's unsent edits", () => {
      const other: UserForm = { name: 'Bob', email: 'bob@example.com', age: 30 };
      const renderSwitchingForm = (
        onSubmit: (values: UserForm) => Promise<Result<UserForm, ValidationError[]>>,
        autoSaveDelay: number,
      ) =>
        renderHook(
          ({ values, id }: { values: UserForm; id: string }) =>
            useForm(userValidator, {
              initialValues: values,
              resetKey: id,
              onSubmit,
              autoSave: { delay: autoSaveDelay },
            }),
          { initialProps: { values: initial, id: 'a' } },
        );

      test('one held behind a running save', async () => {
        const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
        const { result, rerender } = renderSwitchingForm(onSubmit, 50);

        act(() => {
          result.current.setFieldValue('name', 'Jane');
        });
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });
        act(() => {
          result.current.setFieldValue('name', 'Janet');
        });
        // The edit comes due during the save: it's held
        await sleep(150);

        rerender({ values: other, id: 'b' });
        await act(async () => {
          saves[0]!.resolve(undefined);
          await nextTask();
        });
        await sleep(150);

        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      test("and its hold doesn't send the new record's edit before that edit's delay ends", async () => {
        const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
        const { result, rerender } = renderSwitchingForm(onSubmit, 200);

        act(() => {
          result.current.setFieldValue('name', 'Jane');
        });
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });
        act(() => {
          result.current.setFieldValue('name', 'Janet');
        });
        // The edit comes due during the save: it's held
        await sleep(250);

        rerender({ values: other, id: 'b' });
        act(() => {
          result.current.setFieldValue('name', 'Bobby');
        });
        await act(async () => {
          saves[0]!.resolve(undefined);
          await nextTask();
        });
        await sleep(50);
        expect(onSubmit).toHaveBeenCalledTimes(1);

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2), { timeout: 1000 });
        expect(onSubmit.mock.calls[1]).toEqual([{ ...other, name: 'Bobby' }]);
      });
    });

    test("a failed save's field error about a value edited during it doesn't stop the edit's save", async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const { result } = renderAutoSaveForm(onSubmit, 50);

      act(() => {
        result.current.setFieldValue('name', 'Taken');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });
      act(() => {
        result.current.setFieldValue('name', 'Free');
      });
      // The edit comes due during the save: it's held
      await sleep(150);

      await act(async () => {
        saves[0]!.resolve(err([{ path: ['name'], message: 'Name taken' }]));
        await nextTask();
      });

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2), { timeout: 1000 });
      expect(onSubmit.mock.calls[1]).toEqual([{ ...initial, name: 'Free' }]);
    });

    test("keeps saving when the previous save's answer arrives during the held save", async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const { result, rerender } = renderAutoSaveForm(onSubmit, 50);

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
      rerender({ values: { ...initial, name: 'Jane' }, options: {} });
      act(() => {
        result.current.setFieldValue('name', 'Janette');
      });
      await act(async () => {
        saves[1]!.resolve(undefined);
        await nextTask();
      });
      // The held save's answer arrives
      rerender({ values: { ...initial, name: 'Janet' }, options: {} });
      expect(result.current.isStale).toBe(false);

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(3), { timeout: 1000 });
      expect(onSubmit.mock.calls[2]).toEqual([{ ...initial, name: 'Janette' }]);
    });
  });

  describe('a save that settles with an edit in the same render', () => {
    test('the edit is validated and saved', async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const { result } = renderAutoSaveForm(onSubmit, 50);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });
      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });
      // Held behind the running save
      await sleep(150);

      await act(async () => {
        saves[0]!.resolve(undefined);
        await nextTask();
        result.current.setFieldValue('name', 'Jo');
      });

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2), { timeout: 1000 });
      expect(onSubmit.mock.calls[1]![0].name).toBe('Jo');
    });
  });

  describe('values still validating', () => {
    /** The user schema, checked after a delay, as a server round trip would be. */
    const slowUserValidator: MaybeAsyncValidator<unknown, UserForm> = async (values) => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return validate(values, userValidator);
    };

    const renderSlowForm = (onSubmit: (values: UserForm) => Promise<Result<UserForm, ValidationError[]>>) =>
      renderHook(() => useForm(slowUserValidator, { initialValues: initial, onSubmit, autoSave: { delay: 50 } }));

    test('a held save waits for the validation of the values it would submit', async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const { result } = renderSlowForm(onSubmit);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });
      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });
      // The edit comes due during the save, and is held
      await sleep(150);
      act(() => {
        result.current.setFieldValue('name', '');
      });
      // The save settles while '' is still being validated
      await act(async () => {
        saves[0]!.resolve(undefined);
        await nextTask();
      });
      await sleep(150);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(result.current.submitCount).toBe(1);
    });

    test("an edit whose validation finishes after the form unmounted isn't saved", async () => {
      const onSubmit = mock((_values: UserForm) => Promise.resolve(ok(initial)));
      const { result, unmount } = renderSlowForm(onSubmit);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      // Unmounted while the edit is still being validated
      unmount();
      await sleep(200);

      expect(onSubmit).not.toHaveBeenCalled();
    });

    test('a delay that ends while the latest values are still being validated waits for their result', async () => {
      const { pending, gated } = createGatedValidator<UserForm>();
      const onSubmit = mock((_values: UserForm) => {});
      const { result } = renderHook(() =>
        useForm(gated, { initialValues: initial, onSubmit, autoSave: { delay: 50 } }),
      );

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      // Jane passes
      await act(async () => {
        for (const check of pending) check.resolve(ok({ ...initial, name: 'Jane' }));
        await nextTask();
      });
      act(() => {
        result.current.setFieldValue('name', '');
      });
      // The delay ends while '' is still being validated
      await sleep(150);

      expect(result.current.submitCount).toBe(0);
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

      const { result } = renderHook(() =>
        useForm(alwaysValidValidator, { initialValues, onSubmit, autoSave: { delay: 50 } }),
      );

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
      const { result, rerender } = renderAutoSaveForm(onSubmit, 50);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      rerender({ values: changed, options: {} });
      expect(result.current.isStale).toBe(true);

      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });
      await wait();

      expect(onSubmit).not.toHaveBeenCalled();
    });

    test('submits the edits made while stale once the form is no longer stale', async () => {
      const onSubmit = mock((_values: UserForm) => {});
      const { result, rerender } = renderAutoSaveForm(onSubmit, 50);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      rerender({ values: changed, options: {} });
      await wait();
      expect(onSubmit).not.toHaveBeenCalled();

      // The other user undid the change
      rerender({ values: { ...initial }, options: {} });
      expect(result.current.isStale).toBe(false);

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });
      expect(onSubmit.mock.calls[0]).toEqual([{ ...initial, name: 'Jane' }]);
    });

    test("a save that comes due during a save waits for it, and doesn't go out if that save ends stale", async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const { result, rerender } = renderAutoSaveForm(onSubmit, 50);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });

      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });
      rerender({ values: changed, options: {} });
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
      rerender({ values: { ...initial }, options: {} });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2), { timeout: 1000 });
      expect(onSubmit.mock.calls[1]).toEqual([{ ...initial, name: 'Janet' }]);
    });

    test("a save that comes due during a manual save doesn't go out if that save ends stale", async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const { result, rerender } = renderAutoSaveForm(onSubmit, 50);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      // The user clicks Save, and types on before the auto-save's delay ends
      let manualSave!: Promise<unknown>;
      act(() => {
        manualSave = result.current.handleSubmit();
      });
      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });
      // The auto-save comes due during the manual save, then someone else changes the record
      await wait();
      rerender({ values: changed, options: {} });

      await act(async () => {
        saves[0]!.resolve(err([{ path: [], message: 'Conflict' }]));
        await manualSave;
      });
      await wait();

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(result.current.isStale).toBe(true);
      expect(result.current.values.name).toBe('Janet');
    });

    test("a save dropped as stale doesn't come back as an invalid edit once the form is no longer stale", async () => {
      const { saves, onSubmit } = createGatedOnSubmit<UserForm>();
      const { result, rerender } = renderAutoSaveForm(onSubmit, 50);

      act(() => {
        result.current.setFieldValue('name', 'Jane');
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 1000 });

      act(() => {
        result.current.setFieldValue('name', 'Janet');
      });
      rerender({ values: changed, options: {} });
      await wait();
      await act(async () => {
        saves[0]!.resolve(err([{ path: [], message: 'Conflict' }]));
        await nextTask();
      });
      expect(result.current.isStale).toBe(true);

      act(() => {
        result.current.setFieldValue('email', 'not-an-email');
      });
      rerender({ values: { ...initial }, options: {} });
      await wait();

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(result.current.submitCount).toBe(1);
    });
  });
});
