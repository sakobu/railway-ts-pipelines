import { describe, test, expect, mock, spyOn } from 'bun:test';

import { ok, err, type Result } from '@railway-ts/pipelines/result';
import { validate, type ValidationError } from '@railway-ts/pipelines/schema';
import { renderHook, act, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';

import { useForm } from '../../src/useForm';
import { createGatedOnSubmit, createGatedValidator, nextTask, withoutAct } from '../fixtures/gates';
import { userValidator, type UserForm } from '../fixtures/validators';

import type { FormOptions } from '../../src/types';

const initial: UserForm = { name: 'John', email: 'john@example.com', age: 25 };

/** How long auto-save waits, unless a test sets its own. */
const delay = 100;

const sleep = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

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
      await sleep(100);
      expect(onSubmit).not.toHaveBeenCalled();

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
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
});
