import { describe, test, expect, mock, spyOn } from 'bun:test';

import { ok, err } from '@railway-ts/pipelines/result';
import * as S from '@railway-ts/pipelines/schema';
import { renderHook, act } from '@testing-library/react';
import { StrictMode } from 'react';

import { useForm } from '../../src/useForm';
import { withDeps } from '../../src/withDeps';
import { createGatedFieldValidator, createGatedValidator, nextTask, thenableOf } from '../fixtures/gates';
import {
  alwaysValidValidator,
  publishValidator,
  userValidator,
  userWithAddressValidator,
  type PublishForm,
} from '../fixtures/validators';

const draft: PublishForm = { title: 'Hello', status: 'draft', tags: [] };
const user = { name: 'John', email: 'john@test.com', age: 25 };

/**
 * A form whose `name` validator returns an error while `on`, and is switched off as `off` gives. `wrapper` renders
 * around it, as StrictMode does.
 */
const renderSwitchable = (
  off: { name?: undefined } = {},
  options: { onSubmit?: () => void } = {},
  wrapper?: typeof StrictMode,
) =>
  renderHook(
    ({ on }: { on: boolean }) =>
      useForm(userValidator, {
        initialValues: user,
        validationMode: 'live',
        fieldValidators: on ? { name: () => 'Name is taken' } : off,
        ...options,
      }),
    { initialProps: { on: true }, wrapper },
  );

/** A draft form whose `title` validator is `check` while `on`, and is switched off by leaving its key out. */
const renderTitleSwitch = (
  schema: S.MaybeAsyncValidator<unknown, PublishForm>,
  check: (value: string) => string | undefined | Promise<string | undefined>,
  { on: startsOn = true, ...options }: { on?: boolean; onSubmit?: () => void } = {},
) =>
  renderHook(
    ({ on }: { on: boolean }) =>
      useForm(schema, {
        initialValues: draft,
        validationMode: 'live',
        fieldValidators: on ? { title: check } : {},
        ...options,
      }),
    { initialProps: { on: startsOn } },
  );

describe('switching a field validator off', () => {
  test.each([
    ['leaving its key out', {}, undefined],
    ['setting it to undefined', { name: undefined }, undefined],
    ['leaving its key out, under StrictMode,', {}, StrictMode],
  ])('by %s drops the error it set', (_, off, wrapper) => {
    const { result, rerender } = renderSwitchable(off, {}, wrapper);
    act(() => result.current.setFieldValue('name', 'Jane'));
    expect(result.current.errors.name).toBe('Name is taken');

    rerender({ on: false });

    expect(result.current.errors.name).toBeUndefined();
    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.isValid).toBe(true);
  });

  test('the render that switches it off already shows the error dropped', () => {
    const validInRender: boolean[] = [];
    const { result, rerender } = renderHook(
      ({ on }: { on: boolean }) => {
        const form = useForm(userValidator, {
          initialValues: user,
          validationMode: 'live',
          fieldValidators: on ? { name: () => 'Name is taken' } : {},
        });
        validInRender.push(form.isValid);
        return form;
      },
      { initialProps: { on: true } },
    );
    act(() => result.current.setFieldValue('name', 'Jane'));
    const switchingRender = validInRender.length;

    rerender({ on: false });

    expect(validInRender[switchingRender]).toBe(true);
  });

  test('keeps the schema and server errors', () => {
    const { result, rerender } = renderSwitchable();
    act(() => result.current.setFieldValue('name', 'Jane'));
    act(() => result.current.setFieldValue('email', ''));
    act(() => result.current.setServerErrors([{ path: ['name'], message: 'Server says no' }]));

    rerender({ on: false });

    expect(result.current.errors).toEqual({ name: 'Server says no', email: 'Email is required' });
  });

  test("switching it back on doesn't bring its error back", () => {
    const { result, rerender } = renderSwitchable();
    act(() => result.current.setFieldValue('name', 'Jane'));

    rerender({ on: false });
    rerender({ on: true });

    expect(result.current.fieldErrors).toEqual({});
  });

  test('lets a submit save', async () => {
    const onSubmit = mock(() => {});
    const { result, rerender } = renderSwitchable({}, { onSubmit });
    act(() => result.current.setFieldValue('name', 'Jane'));

    rerender({ on: false });
    let outcome!: Awaited<ReturnType<typeof result.current.handleSubmit>>;
    await act(async () => {
      outcome = await result.current.handleSubmit();
    });

    expect(outcome).toEqual(ok({ ...user, name: 'Jane' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.isValid).toBe(true);
  });

  test('drops its check still running, even once switched back on', async () => {
    const { calls, gate } = createGatedFieldValidator();
    const { result, rerender } = renderTitleSwitch(publishValidator, () => gate());
    act(() => result.current.setFieldValue('title', 'x'));
    expect(result.current.validatingFields).toEqual({ title: true });

    rerender({ on: false });
    expect(result.current.validatingFields).toEqual({});
    expect(result.current.isValidating).toBe(false);

    rerender({ on: true });
    await act(async () => {
      calls[0]!.resolve('Taken');
      await nextTask();
    });

    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.validatingFields).toEqual({});
  });

  test("doesn't run it for a check still waiting on the schema", async () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const checkTitle = mock(() => 'Taken');
    const { result, rerender } = renderTitleSwitch(gated, checkTitle);
    act(() => result.current.setFieldValue('title', 'x'));

    rerender({ on: false });
    await act(async () => {
      pending[0]!.resolve(ok({ ...draft, title: 'x' }));
      await nextTask();
    });

    expect(checkTitle).not.toHaveBeenCalled();
    expect(result.current.fieldErrors).toEqual({});
  });

  test('a submit counts a check switched off while it ran as never run', async () => {
    const { calls, gate } = createGatedFieldValidator();
    const onSubmit = mock(() => {});
    const { result, rerender } = renderTitleSwitch(publishValidator, () => gate(), { onSubmit });

    let submitting!: ReturnType<typeof result.current.handleSubmit>;
    await act(async () => {
      submitting = result.current.handleSubmit();
      await nextTask();
    });
    expect(calls).toHaveLength(1);
    rerender({ on: false });
    let outcome: Awaited<typeof submitting> | undefined;
    await act(async () => {
      calls[0]!.resolve('Taken');
      outcome = await submitting;
    });

    expect(outcome).toEqual(ok(draft));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.isValid).toBe(true);
  });

  test('a submit logs the rejection of a check switched off while it ran', async () => {
    const consoleError = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { calls, gate } = createGatedFieldValidator();
      const onSubmit = mock(() => {});
      const { result, rerender } = renderTitleSwitch(publishValidator, () => gate(), { onSubmit });

      let submitting!: ReturnType<typeof result.current.handleSubmit>;
      await act(async () => {
        submitting = result.current.handleSubmit();
        await nextTask();
      });
      rerender({ on: false });
      const down = new Error('down');
      let outcome: Awaited<typeof submitting> | undefined;
      await act(async () => {
        calls[0]!.reject(down);
        outcome = await submitting;
      });

      expect(outcome).toEqual(ok(draft));
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith('Form validation error:', down);
    } finally {
      consoleError.mockRestore();
    }
  });

  test('a submit that a rejection fails still logs a later rejection whose validator was switched off', async () => {
    const consoleError = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const title = createGatedFieldValidator();
      const status = createGatedFieldValidator();
      const onSubmit = mock(() => {});
      const { result, rerender } = renderHook(
        ({ statusOn }: { statusOn: boolean }) =>
          useForm(publishValidator, {
            initialValues: draft,
            fieldValidators: statusOn
              ? { title: () => title.gate(), status: () => status.gate() }
              : { title: () => title.gate() },
            onSubmit,
          }),
        { initialProps: { statusOn: true } },
      );

      let submitting!: ReturnType<typeof result.current.handleSubmit>;
      await act(async () => {
        submitting = result.current.handleSubmit();
        await nextTask();
      });
      rerender({ statusOn: false });
      const titleDown = new Error('title down');
      const statusDown = new Error('status down');
      let outcome: Awaited<typeof submitting> | undefined;
      await act(async () => {
        title.calls[0]!.reject(titleDown);
        status.calls[0]!.reject(statusDown);
        outcome = await submitting;
      });

      expect(outcome).toEqual(err([{ path: [], message: 'Something went wrong. Please try again.' }]));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith('Form submission error:', titleDown);
      expect(consoleError).toHaveBeenCalledWith('Form validation error:', statusDown);
    } finally {
      consoleError.mockRestore();
    }
  });

  test("a submit doesn't count an error whose validator was switched off while another check ran", async () => {
    const { calls, gate } = createGatedFieldValidator();
    const { result, rerender } = renderHook(
      ({ titleOn }: { titleOn: boolean }) =>
        useForm(publishValidator, {
          initialValues: draft,
          fieldValidators: titleOn ? { title: () => 'Taken', status: () => gate() } : { status: () => gate() },
        }),
      { initialProps: { titleOn: true } },
    );

    let submitting!: ReturnType<typeof result.current.handleSubmit>;
    await act(async () => {
      submitting = result.current.handleSubmit();
      await nextTask();
    });
    expect(result.current.fieldErrors).toEqual({ title: 'Taken' });
    expect(calls).toHaveLength(1);

    rerender({ titleOn: false });
    expect(result.current.fieldErrors).toEqual({});

    let outcome: Awaited<typeof submitting> | undefined;
    await act(async () => {
      calls[0]!.resolve(undefined);
      outcome = await submitting;
    });

    expect(outcome).toEqual(ok(draft));
  });

  test("a follow in the commit that switches it off doesn't re-check its field", () => {
    const { result, rerender } = renderHook(
      ({ on, initial }: { on: boolean; initial: typeof user }) =>
        useForm(userValidator, {
          initialValues: initial,
          validationMode: 'submit',
          fieldValidators: on ? { name: () => 'Name is taken' } : {},
        }),
      { initialProps: { on: true, initial: user } },
    );
    act(() => result.current.setFieldValue('name', 'John', true));
    expect(result.current.fieldErrors).toEqual({ name: 'Name is taken' });

    rerender({ on: false, initial: { ...user, email: '' } });

    // Nothing else calls for validation in submit mode, so the new version's schema error doesn't show yet
    expect(result.current.values.email).toBe('');
    expect(result.current.errors).toEqual({});
  });

  test('an inline fieldValidators adds no render', () => {
    let renders = 0;
    const { rerender } = renderHook(() => {
      renders++;
      return useForm(userValidator, { initialValues: user, fieldValidators: { name: () => undefined } });
    });
    const before = renders;

    rerender();

    expect(renders).toBe(before + 1);
  });
});

describe('a submit and its field checks', () => {
  test('shows its field checks in validatingFields', async () => {
    const { calls, gate } = createGatedFieldValidator();
    const { result } = renderHook(() =>
      useForm(publishValidator, { initialValues: draft, fieldValidators: { title: () => gate() } }),
    );

    let submitting!: ReturnType<typeof result.current.handleSubmit>;
    await act(async () => {
      submitting = result.current.handleSubmit();
      await nextTask();
    });
    expect(result.current.validatingFields).toEqual({ title: true });
    expect(result.current.isValidating).toBe(true);

    await act(async () => {
      calls[0]!.resolve(undefined);
      await submitting;
    });

    expect(result.current.validatingFields).toEqual({});
    expect(result.current.isValidating).toBe(false);
  });

  test('replaces a field check still running from typing', async () => {
    const { calls, gate } = createGatedFieldValidator();
    const { result } = renderHook(() =>
      useForm(publishValidator, {
        initialValues: draft,
        validationMode: 'live',
        fieldValidators: { title: () => gate() },
      }),
    );

    act(() => result.current.setFieldValue('title', 'x'));
    expect(calls).toHaveLength(1);
    let submitting!: ReturnType<typeof result.current.handleSubmit>;
    await act(async () => {
      submitting = result.current.handleSubmit();
      await nextTask();
    });
    expect(calls).toHaveLength(2);

    await act(async () => {
      calls[0]!.resolve('Old');
      await nextTask();
    });
    expect(result.current.fieldErrors).toEqual({});

    await act(async () => {
      calls[1]!.resolve(undefined);
      await submitting;
    });
    expect(result.current.fieldErrors).toEqual({});
  });

  test('runs a validator switched on during its schema step', async () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const checkTitle = mock(() => 'Taken');
    const { result, rerender } = renderTitleSwitch(gated, checkTitle, { on: false });

    let submitting!: ReturnType<typeof result.current.handleSubmit>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    rerender({ on: true });
    let outcome: Awaited<typeof submitting> | undefined;
    await act(async () => {
      pending[0]!.resolve(ok(draft));
      outcome = await submitting;
    });

    expect(checkTitle).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual(err([{ path: ['title'], message: 'Taken' }]));
  });

  test('skips a validator switched off during its schema step', async () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const checkTitle = mock(() => 'Taken');
    const onSubmit = mock(() => {});
    const { result, rerender } = renderTitleSwitch(gated, checkTitle, { onSubmit });

    let submitting!: ReturnType<typeof result.current.handleSubmit>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    rerender({ on: false });
    let outcome: Awaited<typeof submitting> | undefined;
    await act(async () => {
      pending[0]!.resolve(ok(draft));
      outcome = await submitting;
    });

    expect(checkTitle).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual(ok(draft));
  });
});

describe('an error while its field is re-checked', () => {
  test('resubmitting an unchanged value keeps its error while the check runs', async () => {
    const { calls, gate } = createGatedFieldValidator();
    const { result } = renderHook(() =>
      useForm(publishValidator, {
        initialValues: draft,
        validationMode: 'submit',
        fieldValidators: { title: () => gate() },
      }),
    );

    let submitting!: ReturnType<typeof result.current.handleSubmit>;
    await act(async () => {
      submitting = result.current.handleSubmit();
      await nextTask();
    });
    await act(async () => {
      calls[0]!.resolve('Taken');
      await submitting;
    });
    expect(result.current.fieldErrors).toEqual({ title: 'Taken' });

    await act(async () => {
      submitting = result.current.handleSubmit();
      await nextTask();
    });
    expect(result.current.fieldErrors).toEqual({ title: 'Taken' });
    expect(result.current.isValid).toBe(false);
    expect(result.current.validatingFields).toEqual({ title: true });

    await act(async () => {
      calls[1]!.resolve(undefined);
      await submitting;
    });
    expect(result.current.fieldErrors).toEqual({});
  });

  test('blurring an unchanged value in blur mode keeps its error while it re-checks', async () => {
    const { calls, gate } = createGatedFieldValidator();
    const { result } = renderHook(() =>
      useForm(publishValidator, {
        initialValues: draft,
        validationMode: 'blur',
        fieldValidators: { title: () => gate() },
      }),
    );

    act(() => result.current.setFieldTouched('title'));
    await act(async () => {
      calls[0]!.resolve('Taken');
      await nextTask();
    });
    expect(result.current.fieldErrors).toEqual({ title: 'Taken' });

    act(() => result.current.setFieldTouched('title'));
    expect(result.current.fieldErrors).toEqual({ title: 'Taken' });
    expect(result.current.isValid).toBe(false);
    expect(result.current.validatingFields).toEqual({ title: true });

    await act(async () => {
      calls[1]!.resolve(undefined);
      await nextTask();
    });
    expect(result.current.fieldErrors).toEqual({});
  });

  test('typing a new value hides the old error at once, while an async schema runs', async () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const { result } = renderHook(() =>
      useForm(gated, {
        initialValues: draft,
        validationMode: 'live',
        fieldValidators: { title: (value) => (value === 'taken' ? 'Taken' : undefined) },
      }),
    );

    act(() => result.current.setFieldValue('title', 'taken'));
    await act(async () => {
      pending[0]!.resolve(ok({ ...draft, title: 'taken' }));
      await nextTask();
    });
    expect(result.current.fieldErrors).toEqual({ title: 'Taken' });

    act(() => result.current.setFieldValue('title', 'fresh'));

    expect(pending).toHaveLength(2);
    expect(result.current.fieldErrors).toEqual({});
  });

  test('a validator that throws on an unchanged value keeps the error it showed', () => {
    let checked = 0;
    const checkTitle = () => {
      checked++;
      if (checked === 1) return 'Taken';
      throw new Error('down');
    };
    const { result, rerender } = renderHook(() =>
      useForm(publishValidator, {
        initialValues: draft,
        validationMode: 'blur',
        fieldValidators: { title: checkTitle },
      }),
    );

    act(() => result.current.setFieldTouched('title'));
    expect(result.current.fieldErrors).toEqual({ title: 'Taken' });

    expect(() => act(() => result.current.setFieldTouched('title'))).toThrow('down');
    // An act that throws doesn't render the store's change: render it, so the assertions read the store
    rerender();

    expect(result.current.fieldErrors).toEqual({ title: 'Taken' });
    expect(result.current.validatingFields).toEqual({});
  });
});

test('a follow re-checks a field whose check was waiting on the schema', async () => {
  const { pending, gated } = createGatedValidator<PublishForm>();
  const checkTitle = mock((_value: string) => undefined);
  const { result, rerender } = renderHook(
    ({ initial }: { initial: PublishForm }) =>
      useForm(gated, { initialValues: initial, validationMode: 'blur', fieldValidators: { title: checkTitle } }),
    { initialProps: { initial: draft } },
  );

  act(() => result.current.setFieldTouched('title'));
  rerender({ initial: { ...draft, title: 'Updated' } });
  await act(async () => {
    pending[0]!.resolve(ok(draft));
    pending[1]!.resolve(ok({ ...draft, title: 'Updated' }));
    await nextTask();
  });

  expect(checkTitle).toHaveBeenCalledTimes(1);
  expect(checkTitle).toHaveBeenCalledWith('Updated');
});

test('isValidating ends once the newest schema check moves on a field check that waited on a replaced one', async () => {
  const { pending, gated } = createGatedValidator<PublishForm>();
  const { result } = renderHook(() =>
    useForm(gated, { initialValues: draft, validationMode: 'live', fieldValidators: { title: () => undefined } }),
  );

  // title's check waits on the first schema check. Typing in status starts the second, which ends first.
  act(() => result.current.setFieldValue('title', 'x'));
  act(() => result.current.setFieldValue('status', 'published'));
  await act(async () => {
    pending[1]!.resolve(ok({ ...draft, title: 'x', status: 'published' }));
    await nextTask();
  });
  // Rule 8: the newest schema check's end moved title's waiting check on, so it no longer waits on the first
  expect(result.current.isValidating).toBe(false);
  expect(result.current.validatingFields).toEqual({});

  await act(async () => {
    pending[0]!.resolve(ok({ ...draft, title: 'x' }));
    await nextTask();
  });
  expect(result.current.isValidating).toBe(false);
});

describe('a waiting field check follows the newest schema check', () => {
  /** A live draft form on a schema gated per call, whose `title` validator is a mock answering `answer`. */
  const renderLiveTitle = (answer: string | undefined, onSubmit?: () => void) => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const checkTitle = mock((_value: string): string | undefined => answer);
    const { result } = renderHook(() =>
      useForm(gated, {
        initialValues: draft,
        validationMode: 'live',
        fieldValidators: { title: checkTitle },
        ...(onSubmit && { onSubmit }),
      }),
    );
    return { pending, checkTitle, result };
  };

  /** A blur-mode draft form on a schema gated per call, whose `title` validator is a mock answering `Taken`. */
  const renderBlurTitle = () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const checkTitle = mock((_value: string): string | undefined => 'Taken');
    const { result } = renderHook(() =>
      useForm(gated, { initialValues: draft, validationMode: 'blur', fieldValidators: { title: checkTitle } }),
    );
    return { pending, checkTitle, result };
  };

  const typed = { ...draft, title: 'x', status: 'published' };

  test("moves on with the newest schema check's result when its own never comes", async () => {
    const { pending, checkTitle, result } = renderLiveTitle('Taken');

    // title's check waits on the first schema check, which never settles, as a debouncer's replaced call doesn't
    act(() => result.current.setFieldValue('title', 'x'));
    act(() => result.current.setFieldValue('status', 'published'));
    await act(async () => {
      pending[1]!.resolve(ok(typed));
      await nextTask();
    });

    expect(checkTitle).toHaveBeenCalledTimes(1);
    expect(checkTitle).toHaveBeenCalledWith('x');
    expect(result.current.fieldErrors).toEqual({ title: 'Taken' });
    expect(result.current.isValidating).toBe(false);
  });

  test("an edit ends a waiting check, so a newer schema check doesn't run its validator", async () => {
    const { pending, checkTitle, result } = renderBlurTitle();

    act(() => result.current.setFieldTouched('title'));
    // blur mode: the change starts no check
    act(() => result.current.setFieldValue('title', 'new'));
    act(() => result.current.setFieldTouched('status'));
    await act(async () => {
      pending[1]!.resolve(ok({ ...draft, title: 'new' }));
      await nextTask();
    });

    expect(checkTitle).not.toHaveBeenCalled();
    expect(result.current.isValidating).toBe(false);
  });

  test('an edit drops the error of a check waiting on a schema check that never settles', async () => {
    const { pending, checkTitle, result } = renderBlurTitle();
    act(() => result.current.setFieldTouched('title'));
    await act(async () => {
      pending[0]!.resolve(ok(draft));
      await nextTask();
    });
    expect(result.current.fieldErrors).toEqual({ title: 'Taken' });

    // A re-check of the unchanged value keeps the error while it waits, on a schema check that never settles
    act(() => result.current.setFieldTouched('title'));
    act(() => result.current.setFieldValue('title', 'new'));
    expect(result.current.fieldErrors).toEqual({});
    act(() => result.current.setFieldTouched('status'));
    await act(async () => {
      pending[2]!.resolve(ok({ ...draft, title: 'new' }));
      await nextTask();
    });

    expect(checkTitle).toHaveBeenCalledTimes(1);
    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.isValidating).toBe(false);
  });

  test('ends with no error when the newest schema check rejects', async () => {
    const consoleError = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { pending, checkTitle, result } = renderLiveTitle('Taken');

      act(() => result.current.setFieldValue('title', 'x'));
      act(() => result.current.setFieldValue('status', 'published'));
      await act(async () => {
        pending[1]!.reject(new Error('down'));
        await nextTask();
      });

      expect(checkTitle).not.toHaveBeenCalled();
      expect(result.current.isValidating).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });

  test("doesn't run the validator again when its own schema result arrives later", async () => {
    const { pending, checkTitle, result } = renderLiveTitle('Taken');

    act(() => result.current.setFieldValue('title', 'x'));
    act(() => result.current.setFieldValue('status', 'published'));
    await act(async () => {
      pending[1]!.resolve(ok(typed));
      await nextTask();
    });
    expect(checkTitle).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending[0]!.resolve(ok({ ...draft, title: 'x' }));
      await nextTask();
    });

    expect(checkTitle).toHaveBeenCalledTimes(1);
    expect(result.current.fieldErrors).toEqual({ title: 'Taken' });
  });

  test('logs a throw from a validator it moves on, and moves the other waiting checks on', async () => {
    const consoleError = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { pending, gated } = createGatedValidator<PublishForm>();
      const down = new Error('down');
      const checkStatus = mock((_value: string, _deps: { readonly title: string }): string | undefined => undefined);
      const { result } = renderHook(() =>
        useForm(gated, {
          initialValues: draft,
          validationMode: 'live',
          fieldValidators: {
            title: () => {
              throw down;
            },
            status: withDeps(['title'], checkStatus),
          },
        }),
      );

      // title's and status's checks each wait on a schema check that never settles. Typing in tags starts the newest.
      act(() => result.current.setFieldValue('title', 'x'));
      act(() => result.current.setFieldValue('status', 'published'));
      act(() => result.current.setFieldValue('tags', ['a']));
      const tagged = { ...typed, tags: ['a'] };
      await act(async () => {
        pending[2]!.resolve(ok(tagged));
        await nextTask();
      });

      expect(consoleError).toHaveBeenCalledWith('Form validation error:', down);
      expect(checkStatus).toHaveBeenCalledWith('published', { title: 'x' });
      expect(result.current.isValidating).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });

  test('a landing check of values the form no longer holds leaves it waiting on its own result', async () => {
    const { pending, checkTitle, result } = renderLiveTitle('Taken');
    // The render's copy of the values, which the edit below leaves behind
    const stale = result.current.values;

    act(() => result.current.setFieldValue('title', 'x'));
    act(() => {
      void result.current.validateForm(stale);
    });
    await act(async () => {
      pending[1]!.resolve(ok(stale));
      await nextTask();
    });
    expect(checkTitle).not.toHaveBeenCalled();
    expect(result.current.isValidating).toBe(true);

    await act(async () => {
      pending[0]!.resolve(ok({ ...draft, title: 'x' }));
      await nextTask();
    });

    expect(checkTitle).toHaveBeenCalledTimes(1);
    expect(checkTitle).toHaveBeenCalledWith('x');
    expect(result.current.fieldErrors).toEqual({ title: 'Taken' });
    expect(result.current.isValidating).toBe(false);
  });

  test('a landing check of the values the form held when it started moves it on, though an edit came since', async () => {
    const { pending, checkTitle, result } = renderBlurTitle();

    // The first blur's schema call never settles, as a debouncer's replaced call doesn't
    act(() => result.current.setFieldTouched('title'));
    act(() => result.current.setFieldTouched('status'));
    // blur mode: the edit starts no check, while the second blur's is in flight
    act(() => result.current.setFieldValue('tags', ['a']));
    await act(async () => {
      pending[1]!.resolve(ok(draft));
      await nextTask();
    });

    expect(checkTitle).toHaveBeenCalledTimes(1);
    expect(checkTitle).toHaveBeenCalledWith('Hello');
    expect(result.current.isValidating).toBe(false);
  });

  test('a landing check of values the form no longer holds gives no validator those values', async () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const checkTitle = mock((_value: string, { status }: { readonly status: string }): string | undefined =>
      status === 'draft' ? 'Draft needs a longer title' : undefined,
    );
    const { result } = renderHook(() =>
      useForm(gated, {
        initialValues: draft,
        validationMode: 'blur',
        fieldValidators: { title: withDeps(['status'], checkTitle) },
      }),
    );
    const stale = result.current.values;

    // blur mode: the change starts no check. The blur's check of title then waits on the values with status published.
    act(() => result.current.setFieldValue('status', 'published'));
    act(() => result.current.setFieldTouched('title'));
    act(() => {
      void result.current.validateForm(stale);
    });
    await act(async () => {
      pending[1]!.resolve(ok(stale));
      await nextTask();
    });
    await act(async () => {
      pending[0]!.resolve(ok({ ...draft, status: 'published' }));
      await nextTask();
    });

    expect(checkTitle).toHaveBeenCalledTimes(1);
    expect(checkTitle).toHaveBeenCalledWith('Hello', { status: 'published' });
    expect(result.current.fieldErrors).toEqual({});
  });

  test("a sync schema result in a re-check of the field doesn't run its validator twice", async () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    // Sync for a bad status, async otherwise, as a schema whose async refinement runs once its sync checks pass
    const mixed: S.MaybeAsyncValidator<unknown, PublishForm> = (values, path) =>
      (values as PublishForm).status === 'bad'
        ? err([{ path: ['status'], message: 'Bad status' }])
        : gated(values, path);
    const checkTitle = mock((_value: string): string | undefined => undefined);
    const { result } = renderHook(() =>
      useForm(mixed, { initialValues: draft, validationMode: 'blur', fieldValidators: { title: checkTitle } }),
    );

    // The first blur's check of title waits on an async schema check. The second blur's schema check is sync.
    act(() => result.current.setFieldTouched('title'));
    act(() => result.current.setFieldValue('status', 'bad'));
    act(() => result.current.setFieldTouched('title'));
    expect(checkTitle).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending[0]!.resolve(ok(draft));
      await nextTask();
    });

    expect(checkTitle).toHaveBeenCalledTimes(1);
    expect(result.current.isValidating).toBe(false);
  });

  test('a schema validator that throws while typing ends the field check, and the throw reaches the caller', () => {
    const down = new Error('down');
    const throws: S.Validator<unknown, PublishForm> = () => {
      throw down;
    };
    const checkTitle = mock((_value: string): string | undefined => 'Taken');
    const { result, rerender } = renderHook(() =>
      useForm(throws, { initialValues: draft, validationMode: 'live', fieldValidators: { title: checkTitle } }),
    );

    expect(() => act(() => result.current.setFieldValue('title', 'x'))).toThrow(down);
    // An act that throws doesn't render the store's change: render it, so the assertions read the store
    rerender();

    expect(checkTitle).not.toHaveBeenCalled();
    expect(result.current.isValidating).toBe(false);
  });

  test('a submit that stops at its schema step moves it on', async () => {
    const onSubmit = mock(() => {});
    const { pending, checkTitle, result } = renderLiveTitle('Taken', onSubmit);
    act(() => result.current.setFieldValue('title', 'x'));

    const statusWrong = err([{ path: ['status'], message: 'Status is wrong' }]);
    let outcome: Awaited<ReturnType<typeof result.current.handleSubmit>> | undefined;
    await act(async () => {
      const submitting = result.current.handleSubmit();
      pending[1]!.resolve(statusWrong);
      outcome = await submitting;
    });

    expect(outcome).toEqual(statusWrong);
    expect(checkTitle).toHaveBeenCalledTimes(1);
    expect(checkTitle).toHaveBeenCalledWith('x');
    expect(result.current.isValidating).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("a submit whose field step follows doesn't run it twice", async () => {
    const onSubmit = mock(() => {});
    const { pending, checkTitle, result } = renderLiveTitle(undefined, onSubmit);
    act(() => result.current.setFieldValue('title', 'x'));

    await act(async () => {
      const submitting = result.current.handleSubmit();
      pending[1]!.resolve(ok({ ...draft, title: 'x' }));
      await submitting;
    });

    expect(checkTitle).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(result.current.isValidating).toBe(false);
  });
});

test('a submit whose schema validator rejects leaves isValidating false', async () => {
  const consoleError = spyOn(console, 'error').mockImplementation(() => {});
  try {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const onSubmit = mock(() => {});
    const { result } = renderHook(() => useForm(gated, { initialValues: draft, onSubmit }));

    let submitting!: ReturnType<typeof result.current.handleSubmit>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    let outcome: Awaited<typeof submitting> | undefined;
    await act(async () => {
      pending[0]!.reject(new Error('down'));
      outcome = await submitting;
    });

    expect(outcome).toEqual(err([{ path: [], message: 'Something went wrong. Please try again.' }]));
    expect(result.current.isValidating).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  } finally {
    consoleError.mockRestore();
  }
});

test('a schema validator whose result is malformed leaves isValidating false', () => {
  // A Result-like value with no errors to format: reading its errors throws
  const malformed = (() => ({ ok: false })) as unknown as S.Validator<unknown, PublishForm>;
  const { result, rerender } = renderHook(() => useForm(malformed, { initialValues: draft, validationMode: 'live' }));

  expect(() => act(() => result.current.setFieldValue('title', 'x'))).toThrow();
  // An act that throws doesn't render the store's change: render it, so the assertion reads the store
  rerender();

  expect(result.current.isValidating).toBe(false);
});

describe('a submission whose record a resetKey switch retired', () => {
  test('counts a check of a validator the new record switched off', async () => {
    const { calls, gate } = createGatedFieldValidator();
    const onSubmit = mock(() => {});
    const { result, rerender } = renderHook(
      ({ record }: { record: number }) =>
        useForm(publishValidator, {
          initialValues: draft,
          resetKey: record,
          fieldValidators: record === 1 ? { title: () => gate() } : {},
          onSubmit,
        }),
      { initialProps: { record: 1 } },
    );

    let submitting!: ReturnType<typeof result.current.handleSubmit>;
    await act(async () => {
      submitting = result.current.handleSubmit();
      await nextTask();
    });
    rerender({ record: 2 });
    let outcome: Awaited<typeof submitting> | undefined;
    await act(async () => {
      calls[0]!.resolve('Taken');
      outcome = await submitting;
    });

    expect(outcome).toEqual(err([{ path: ['title'], message: 'Taken' }]));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("runs its record's field validators, not the new record's", async () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const checkTitle = mock(() => 'Taken');
    const checkStatus = mock(() => undefined);
    const onSubmit = mock(() => {});
    const { result, rerender } = renderHook(
      ({ record }: { record: number }) =>
        useForm(gated, {
          initialValues: draft,
          resetKey: record,
          fieldValidators: record === 1 ? { title: checkTitle } : { status: checkStatus },
          onSubmit,
        }),
      { initialProps: { record: 1 } },
    );

    let submitting!: ReturnType<typeof result.current.handleSubmit>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    rerender({ record: 2 });
    let outcome: Awaited<typeof submitting> | undefined;
    await act(async () => {
      pending[0]!.resolve(ok(draft));
      outcome = await submitting;
    });

    expect(checkTitle).toHaveBeenCalledTimes(1);
    expect(checkStatus).not.toHaveBeenCalled();
    expect(outcome).toEqual(err([{ path: ['title'], message: 'Taken' }]));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

test('a form with fieldValidators renders once on mount', () => {
  let renders = 0;
  renderHook(() => {
    renders++;
    return useForm(userValidator, { initialValues: user, fieldValidators: { name: () => undefined } });
  });

  expect(renders).toBe(1);
});

test('setFieldValue and handleSubmit keep their identity when an inline fieldValidators changes', () => {
  const { result, rerender } = renderHook(() =>
    useForm(userValidator, { initialValues: user, fieldValidators: { name: () => undefined } }),
  );
  const { setFieldValue, handleSubmit } = result.current;

  rerender();

  expect(result.current.setFieldValue).toBe(setFieldValue);
  expect(result.current.handleSubmit).toBe(handleSubmit);
});

test('a bracket path finds its field validator', () => {
  const tupleSchema = S.object({ r1: S.required(S.tupleOf(S.chain(S.parseNumber(), S.positive()), 3)) });
  const { result } = renderHook(() =>
    useForm(tupleSchema, {
      initialValues: { r1: [1, 1, 1] },
      // The options type a tuple item's value as unknown
      fieldValidators: { 'r1.0': (value: unknown) => (Number(value) > 10 ? 'Too big' : undefined) },
    }),
  );

  act(() => result.current.setFieldValue('r1[0]', 20));

  expect(result.current.fieldErrors).toEqual({ 'r1.0': 'Too big' });
});

describe('a validator that answers an empty message', () => {
  test.each([
    ['at once', () => ''],
    ['asynchronously', () => Promise.resolve('')],
  ])('shows no error when it answers %s', async (_, checkName) => {
    const { result } = renderHook(() =>
      useForm(userValidator, { initialValues: user, validationMode: 'live', fieldValidators: { name: checkName } }),
    );

    await act(async () => {
      result.current.setFieldValue('name', 'Jane');
      await nextTask();
    });

    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.isValid).toBe(true);
  });

  test('lets a submit save', async () => {
    const onSubmit = mock(() => {});
    const { result } = renderHook(() =>
      useForm(userValidator, { initialValues: user, fieldValidators: { name: () => '' }, onSubmit }),
    );

    let outcome!: Awaited<ReturnType<typeof result.current.handleSubmit>>;
    await act(async () => {
      outcome = await result.current.handleSubmit();
    });

    expect(outcome).toEqual(ok(user));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe.each(['constructor', 'toString', 'hasOwnProperty'])('a field named %s', (name) => {
  test('gets its field validator', () => {
    const { result } = renderHook(() =>
      useForm(alwaysValidValidator, {
        initialValues: { [name]: 'a' },
        validationMode: 'live',
        fieldValidators: { [name]: () => 'Bad' },
      }),
    );

    act(() => result.current.setFieldValue(name, 'x'));

    expect(result.current.fieldErrors).toEqual({ [name]: 'Bad' });
  });

  test('gets its field validator while the schema has an error on another field', () => {
    const otherFails: S.Validator<unknown, Record<string, unknown>> = () =>
      err([{ path: ['other'], message: 'Other is wrong' }]);
    const { result } = renderHook(() =>
      useForm(otherFails, {
        initialValues: { [name]: 'a', other: '' },
        validationMode: 'live',
        fieldValidators: { [name]: () => 'Bad' },
      }),
    );

    act(() => result.current.setFieldValue(name, 'x'));

    expect(result.current.errors).toEqual({ [name]: 'Bad', other: 'Other is wrong' });
  });

  test('is marked touched on change, so getFieldError shows its error', () => {
    const { result } = renderHook(() =>
      useForm(alwaysValidValidator, {
        initialValues: { [name]: 'a' },
        validationMode: 'live',
        fieldValidators: { [name]: () => 'Bad' },
      }),
    );

    act(() => result.current.setFieldValue(name, 'x'));

    expect(result.current.touched).toEqual({ [name]: true });
    expect(result.current.getFieldError(name)).toBe('Bad');
  });

  test('reads no error from getFieldError while it has none', () => {
    const { result } = renderHook(() =>
      useForm(alwaysValidValidator, { initialValues: { [name]: 'a' }, validationMode: 'live' }),
    );

    act(() => result.current.setFieldValue(name, 'x'));

    expect(result.current.touched).toEqual({ [name]: true });
    expect(result.current.getFieldError(name)).toBeUndefined();
  });
});

test('a fieldValidators with its own __proto__ key mounts and rerenders', () => {
  // Built from entries, an own key, as JSON.parse makes too. Not a field name the form supports, but it mustn't loop.
  const { result, rerender } = renderHook(() =>
    useForm(userValidator, {
      initialValues: user,
      fieldValidators: Object.fromEntries([['__proto__', () => undefined]]),
    }),
  );

  rerender();

  expect(result.current.isValid).toBe(true);
});

describe("a validator that answers with a thenable that isn't a native Promise", () => {
  test('a field validator shows the error it settles to, on a live check', async () => {
    const { result } = renderHook(() =>
      useForm(userValidator, {
        initialValues: user,
        validationMode: 'live',
        fieldValidators: { name: () => thenableOf('Taken') },
      }),
    );

    await act(async () => {
      result.current.setFieldValue('name', 'Jane');
      await nextTask();
    });

    expect(result.current.fieldErrors).toEqual({ name: 'Taken' });
    expect(result.current.isValidating).toBe(false);
  });

  test('a field validator shows the error it settles to, and fails a submit with it', async () => {
    const onSubmit = mock(() => {});
    const { result } = renderHook(() =>
      useForm(userValidator, { initialValues: user, fieldValidators: { name: () => thenableOf('Taken') }, onSubmit }),
    );

    let outcome!: Awaited<ReturnType<typeof result.current.handleSubmit>>;
    await act(async () => {
      outcome = await result.current.handleSubmit();
    });

    expect(outcome).toEqual(err([{ path: ['name'], message: 'Taken' }]));
    expect(result.current.fieldErrors).toEqual({ name: 'Taken' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('a schema validator shows the errors it settles to', async () => {
    const schema: S.MaybeAsyncValidator<unknown, PublishForm> = () =>
      thenableOf(err([{ path: ['title'], message: 'Title is taken' }]));
    const { result } = renderHook(() => useForm(schema, { initialValues: draft, validationMode: 'live' }));

    await act(async () => {
      result.current.setFieldValue('title', 'x');
      await nextTask();
    });

    expect(result.current.clientErrors).toEqual({ title: 'Title is taken' });
    expect(result.current.isValidating).toBe(false);
  });
});

describe('an error lasts only while its values hold (#58)', () => {
  const nameSchema = S.object({ name: S.required(S.string()), email: S.required(S.string()) });
  const blank = { name: '', email: 'a@b.co' };
  const taken = (value: string) => (value === 'Taken' ? 'Name taken' : undefined);

  test('submit mode: an edit drops the error a submit put on the field', async () => {
    const { result } = renderHook(() =>
      useForm(nameSchema, {
        initialValues: blank,
        validationMode: 'submit',
        fieldValidators: { name: taken },
        onSubmit: () => {},
      }),
    );
    act(() => result.current.setFieldValue('name', 'Taken'));
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.errors.name).toBe('Name taken');

    act(() => result.current.setFieldValue('name', 'Free'));

    expect(result.current.errors.name).toBeUndefined();
    expect(result.current.isValid).toBe(true);
  });

  test('blur mode: an edit drops the error a blur put on the field', async () => {
    const { result } = renderHook(() =>
      useForm(nameSchema, { initialValues: blank, validationMode: 'blur', fieldValidators: { name: taken } }),
    );
    act(() => result.current.setFieldValue('name', 'Taken'));
    await act(async () => {
      result.current.setFieldTouched('name');
      await nextTask();
    });
    expect(result.current.errors.name).toBe('Name taken');

    act(() => result.current.setFieldValue('name', 'Free'));

    expect(result.current.errors.name).toBeUndefined();
    expect(result.current.isValid).toBe(true);
  });

  test('live mode: setValues drops the error of a field it changes', async () => {
    const { result } = renderHook(() =>
      useForm(nameSchema, { initialValues: blank, fieldValidators: { name: taken } }),
    );
    await act(async () => {
      result.current.setFieldValue('name', 'Taken');
      await nextTask();
    });
    expect(result.current.errors.name).toBe('Name taken');

    act(() => result.current.setValues({ name: 'Free' }));

    expect(result.current.errors.name).toBeUndefined();
    expect(result.current.isValid).toBe(true);
  });
});

describe('one call, one check pass (#57)', () => {
  /** The publish schema, as a mock that counts its calls. */
  const countingSchema = () => mock(publishValidator);

  test('#57: an onFieldChange cascade runs a waiting field check once', async () => {
    // Sync when status is 'bad', async otherwise, as in the issue
    const halfAsync: S.MaybeAsyncValidator<unknown, PublishForm> = (input, path) =>
      typeof input === 'object' && input !== null && 'status' in input && input.status === 'bad'
        ? publishValidator(input, path)
        : Promise.resolve(publishValidator(input, path));
    const checkTitle = mock((_value: string) => undefined);
    let cascade = false;
    const { result } = renderHook(() =>
      useForm(halfAsync, {
        initialValues: draft,
        fieldValidators: { title: checkTitle },
        onFieldChange: (field) => {
          if (cascade && field === 'title') result.current.setFieldValue('status', 'bad');
        },
      }),
    );
    act(() => {
      result.current.setFieldValue('title', 'x'); // its check waits on the async schema
      cascade = true;
      result.current.setFieldValue('title', 'x');
    });
    await act(async () => {
      await nextTask();
    });

    expect(checkTitle).toHaveBeenCalledTimes(1);
  });

  test('an onFieldChange that rewrites its own field runs the validator once and the schema once', () => {
    const schema = countingSchema();
    const checkTitle = mock((_value: string) => undefined);
    const { result } = renderHook(() =>
      useForm(schema, {
        initialValues: draft,
        fieldValidators: { title: checkTitle },
        onFieldChange: (field, value) => {
          if (field === 'title' && typeof value === 'string' && value !== value.trim()) {
            result.current.setFieldValue('title', value.trim());
          }
        },
      }),
    );
    schema.mockClear();
    checkTitle.mockClear();

    act(() => result.current.setFieldValue('title', ' x '));

    expect(checkTitle).toHaveBeenCalledTimes(1);
    expect(checkTitle.mock.calls[0]![0]).toBe('x');
    expect(schema).toHaveBeenCalledTimes(1);
  });

  test('the setValues reset pattern in onFieldChange runs each validator once and the schema once', () => {
    const schema = countingSchema();
    const checkTitle = mock((_value: string) => undefined);
    const checkStatus = mock((_value: string) => undefined);
    let cascade = false;
    const { result } = renderHook(() =>
      useForm(schema, {
        initialValues: draft,
        fieldValidators: { title: checkTitle, status: checkStatus },
        onFieldChange: (field, value) => {
          if (cascade && field === 'status' && typeof value === 'string') {
            result.current.setValues({ ...draft, status: value });
          }
        },
      }),
    );
    act(() => result.current.setFieldValue('title', 'Edited'));
    schema.mockClear();
    checkTitle.mockClear();
    checkStatus.mockClear();

    cascade = true;
    act(() => result.current.setFieldValue('status', 'published'));

    expect(checkTitle).toHaveBeenCalledTimes(1);
    expect(checkStatus).toHaveBeenCalledTimes(1);
    expect(schema).toHaveBeenCalledTimes(1);
  });

  test('a cascade write with shouldValidate false is still checked on the final values', () => {
    const schema = countingSchema();
    const checkTitle = mock((_value: string) => undefined);
    const { result } = renderHook(() =>
      useForm(schema, {
        initialValues: draft,
        fieldValidators: { title: checkTitle },
        onFieldChange: (field) => {
          if (field === 'status') result.current.setFieldValue('title', 'Changed', false);
        },
      }),
    );

    act(() => result.current.setFieldValue('status', 'published'));

    // title isn't a recorded path, and no validator lists status
    expect(checkTitle).not.toHaveBeenCalled();
    expect(schema).toHaveBeenCalledTimes(1);
    expect(schema.mock.calls.at(-1)?.[0]).toEqual({ ...draft, status: 'published', title: 'Changed' });
  });

  test('after onFieldChange throws, the errors its edit outdated are gone, and the next call still validates', () => {
    const checkTitle = mock((value: string) => (value === 'Taken' ? 'Taken' : undefined));
    let failing = false;
    const { result, rerender } = renderHook(() =>
      useForm(publishValidator, {
        initialValues: draft,
        fieldValidators: { title: checkTitle },
        onFieldChange: () => {
          if (failing) throw new Error('boom');
        },
      }),
    );
    act(() => result.current.setFieldValue('title', 'Taken'));
    expect(result.current.fieldErrors).toEqual({ title: 'Taken' });

    failing = true;
    expect(() => act(() => result.current.setFieldValue('title', 'a'))).toThrow();
    // An act that throws doesn't render the store's change: render it, so the assertions read the store
    rerender();

    // The event ran no check, and the edit outdated the error
    expect(checkTitle).toHaveBeenCalledTimes(1);
    expect(result.current.fieldErrors).toEqual({});

    failing = false;
    act(() => result.current.setFieldValue('title', 'b'));

    expect(checkTitle).toHaveBeenCalledTimes(2);
  });

  test('a sync validator throw asked for inside a cascade reaches the outermost call', () => {
    const checkTitle = mock((value: string): string | undefined => {
      if (value === 'boom') throw new Error('boom');
      return undefined;
    });
    const { result, rerender } = renderHook(() =>
      useForm(publishValidator, {
        initialValues: draft,
        fieldValidators: { title: checkTitle },
        onFieldChange: (field) => {
          if (field === 'status') result.current.setFieldValue('title', 'boom');
        },
      }),
    );

    expect(() => act(() => result.current.setFieldValue('status', 'x'))).toThrow('boom');
    rerender();

    // The outer call's body finished, marking status touched, before the pass threw
    expect(result.current.touched).toEqual({ title: true, status: true });
  });

  test('when one validator throws in the pass, the rest still run, and the first throw reaches the caller', () => {
    const checkTitle = mock((): string | undefined => {
      throw new Error('boom');
    });
    const checkStatus = mock((_v: string) => undefined);
    const { result, rerender } = renderHook(() =>
      useForm(publishValidator, { initialValues: draft, fieldValidators: { title: checkTitle, status: checkStatus } }),
    );

    // One event reaches both validators. title comes first, so it runs first.
    expect(() => act(() => result.current.setValues({ title: 'a', status: 'b' }))).toThrow('boom');
    rerender();

    expect(checkStatus).toHaveBeenCalledTimes(1);
    expect(checkStatus.mock.calls[0]![0]).toBe('b');
    expect(result.current.isValidating).toBe(false);
  });

  test('when two validators throw in the pass, the first throw reaches the caller and the second is logged', () => {
    const consoleError = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const first = new Error('title boom');
      const second = new Error('status boom');
      const { result, rerender } = renderHook(() =>
        useForm(publishValidator, {
          initialValues: draft,
          fieldValidators: {
            title: () => {
              throw first;
            },
            status: () => {
              throw second;
            },
          },
        }),
      );

      expect(() => act(() => result.current.setValues({ title: 'a', status: 'b' }))).toThrow(first);
      rerender();

      expect(consoleError).toHaveBeenCalledWith('Form validation error:', second);
      expect(consoleError).not.toHaveBeenCalledWith('Form validation error:', first);
      expect(result.current.isValidating).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });

  test('resetForm in mount mode throws a sync schema throw to its caller', () => {
    let failing = false;
    const flagged: S.Validator<unknown, PublishForm> = (input, path) => {
      if (failing) throw new Error('boom');
      return publishValidator(input, path);
    };
    const { result } = renderHook(() => useForm(flagged, { initialValues: draft, validationMode: 'mount' }));

    failing = true;
    expect(() => act(() => result.current.resetForm())).toThrow('boom');
  });

  test('an edit that makes the form follow throws a sync schema throw to its caller', () => {
    let failing = false;
    const flagged: S.Validator<unknown, PublishForm> = (input, path) => {
      if (failing) throw new Error('boom');
      return publishValidator(input, path);
    };
    const { result, rerender } = renderHook(
      ({ initial }: { initial: PublishForm }) => useForm(flagged, { initialValues: initial, validationMode: 'live' }),
      { initialProps: { initial: draft } },
    );
    act(() => result.current.setFieldValue('title', 'Edited'));
    rerender({ initial: { ...draft, status: 'published' } });
    expect(result.current.isStale).toBe(true);

    failing = true;
    // Setting the title back leaves no edits, so the form follows the newer version
    expect(() => act(() => result.current.setFieldValue('title', draft.title))).toThrow('boom');
  });

  test('setValues clears the schema errors at the paths it changed while an async check runs', async () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const { result } = renderHook(() => useForm(gated, { initialValues: draft, validationMode: 'live' }));
    act(() => result.current.setFieldValue('title', ''));
    await act(async () => {
      pending[0]!.resolve(err([{ path: ['title'], message: 'Title is required' }]));
      await nextTask();
    });
    expect(result.current.errors.title).toBe('Title is required');

    act(() => result.current.setValues({ title: 'New' }));

    expect(pending).toHaveLength(2);
    expect(result.current.errors.title).toBeUndefined();
  });

  test('setValues with shouldValidate true runs field validators in submit mode', () => {
    const checkTitle = mock((_value: string) => undefined);
    const { result } = renderHook(() =>
      useForm(publishValidator, {
        initialValues: draft,
        validationMode: 'submit',
        fieldValidators: { title: checkTitle },
      }),
    );

    act(() => result.current.setValues({ title: 'x' }, true));

    expect(checkTitle).toHaveBeenCalledTimes(1);
  });

  test('setValues reaches only the validators whose values it changed', () => {
    const checkTitle = mock((_value: string) => undefined);
    const checkStatus = mock((_value: string) => undefined);
    const { result } = renderHook(() =>
      useForm(publishValidator, { initialValues: draft, fieldValidators: { title: checkTitle, status: checkStatus } }),
    );

    act(() => result.current.setValues({ title: draft.title, status: 'published' }));

    expect(checkTitle).not.toHaveBeenCalled();
    expect(checkStatus).toHaveBeenCalledTimes(1);
  });

  test('setValues that replaces an array runs its validator once', () => {
    const checkTags = mock(() => undefined);
    const { result } = renderHook(() =>
      useForm(publishValidator, { initialValues: draft, fieldValidators: { tags: checkTags } }),
    );

    act(() => result.current.setValues({ tags: ['a'] }));

    expect(checkTags).toHaveBeenCalledTimes(1);
  });

  test('a validator on a parent field reruns when a child changes, and the reverse', () => {
    const checkAddress = mock(() => undefined);
    const checkCity = mock(() => undefined);
    // Every field is filled, so no schema error skips either one
    const { result } = renderHook(() =>
      useForm(userWithAddressValidator, {
        initialValues: { name: 'Ann', address: { street: 's', city: 'c', zip: '1' } },
        fieldValidators: { address: checkAddress, 'address.city': checkCity },
      }),
    );

    act(() => result.current.setFieldValue('address.city', 'Oslo'));

    expect(checkAddress).toHaveBeenCalledTimes(1);
    expect(checkCity).toHaveBeenCalledTimes(1);

    checkAddress.mockClear();
    checkCity.mockClear();
    act(() => result.current.setFieldValue('address', { street: 's', city: 'Bergen', zip: '1' }));

    expect(checkAddress).toHaveBeenCalledTimes(1);
    expect(checkCity).toHaveBeenCalledTimes(1);
  });
});

describe('withDeps', () => {
  const slugSchema = S.object({
    workspaceId: S.required(S.string()),
    slug: S.required(S.string()),
    name: S.required(S.string()),
  });
  type SlugForm = S.InferSchemaType<typeof slugSchema>;
  const record: SlugForm = { workspaceId: 'w1', slug: '', name: '' };
  const slugCheck = () =>
    mock((slug: string, { workspaceId }: { readonly workspaceId: string }) =>
      slug === 'taken' && workspaceId === 'w1' ? 'Slug taken' : undefined,
    );
  /** For a form whose list switches between renders: `validate` gets one listed field or the other. */
  const eitherDeps = () =>
    mock((slug: string, deps: { readonly workspaceId?: string; readonly name?: string }) =>
      slug === 'taken' && deps.workspaceId === 'w1' ? 'Slug taken' : undefined,
    );

  test('#58: live mode re-runs a validator when a field it lists changes', () => {
    const validate = slugCheck();
    const { result } = renderHook(() =>
      useForm(slugSchema, { initialValues: record, fieldValidators: { slug: withDeps(['workspaceId'], validate) } }),
    );
    act(() => result.current.setFieldValue('slug', 'taken'));
    expect(result.current.errors.slug).toBe('Slug taken');

    act(() => result.current.setFieldValue('workspaceId', 'w2'));

    expect(validate).toHaveBeenLastCalledWith('taken', { workspaceId: 'w2' });
    expect(result.current.errors.slug).toBeUndefined();
    expect(result.current.isValid).toBe(true);
  });

  test('a list changed between renders applies from the next check', () => {
    const validate = eitherDeps();
    const { result, rerender } = renderHook(
      ({ byName }: { byName: boolean }) =>
        useForm(slugSchema, {
          initialValues: record,
          fieldValidators: { slug: withDeps(byName ? ['name'] : ['workspaceId'], validate) },
        }),
      { initialProps: { byName: false } },
    );

    rerender({ byName: true });
    act(() => result.current.setFieldValue('name', 'n'));
    expect(validate).toHaveBeenLastCalledWith('', { name: 'n' });

    validate.mockClear();
    act(() => result.current.setFieldValue('workspaceId', 'w3'));
    expect(validate).not.toHaveBeenCalled();
  });

  test('blur mode re-runs it when a listed field is blurred', () => {
    const validate = slugCheck();
    const { result } = renderHook(() =>
      useForm(slugSchema, {
        initialValues: record,
        validationMode: 'blur',
        fieldValidators: { slug: withDeps(['workspaceId'], validate) },
      }),
    );
    act(() => result.current.setFieldValue('slug', 'taken'));
    act(() => result.current.setFieldTouched('slug'));
    expect(result.current.errors.slug).toBe('Slug taken');

    act(() => result.current.setFieldValue('workspaceId', 'w2'));
    expect(result.current.errors.slug).toBeUndefined();
    expect(validate).toHaveBeenCalledTimes(1);

    act(() => result.current.setFieldTouched('workspaceId'));
    expect(validate).toHaveBeenCalledTimes(2);
    expect(validate).toHaveBeenLastCalledWith('taken', { workspaceId: 'w2' });
  });

  // Mount mode checks the schema only, so the error comes from the submit
  test.each(['submit', 'mount'] as const)(
    '%s mode drops the error at an edit of a listed field without calling the validator',
    async (validationMode) => {
      const validate = slugCheck();
      const { result } = renderHook(() =>
        useForm(slugSchema, {
          initialValues: { ...record, slug: 'taken' },
          validationMode,
          fieldValidators: { slug: withDeps(['workspaceId'], validate) },
        }),
      );
      await act(async () => {
        await result.current.handleSubmit();
      });
      expect(result.current.errors.slug).toBe('Slug taken');

      validate.mockClear();
      act(() => result.current.setFieldValue('workspaceId', 'w2'));

      expect(result.current.errors.slug).toBeUndefined();
      expect(result.current.isValid).toBe(true);
      expect(validate).not.toHaveBeenCalled();
    },
  );

  test('a schema error at a listed field skips the validator', () => {
    const strictSchema = S.object({
      workspaceId: S.required(S.chain(S.string(), S.nonEmpty('Pick a workspace'))),
      slug: S.required(S.string()),
      name: S.required(S.string()),
    });
    const validate = slugCheck();
    const { result } = renderHook(() =>
      useForm(strictSchema, { initialValues: record, fieldValidators: { slug: withDeps(['workspaceId'], validate) } }),
    );

    act(() => result.current.setFieldValue('workspaceId', ''));
    act(() => result.current.setFieldValue('slug', 'x'));

    expect(validate).not.toHaveBeenCalled();
    expect(result.current.errors.workspaceId).toBe('Pick a workspace');
  });

  test('validate gets exactly the listed fields, and a function gets only its value', () => {
    const validate = slugCheck();
    const checkName = mock((_v: string) => undefined);
    const { result } = renderHook(() =>
      useForm(slugSchema, {
        initialValues: record,
        fieldValidators: { slug: withDeps(['workspaceId'], validate), name: checkName },
      }),
    );

    act(() => result.current.setFieldValue('slug', 'x'));
    act(() => result.current.setFieldValue('name', 'n'));

    expect(validate.mock.calls[0]).toHaveLength(2);
    expect(Object.keys(validate.mock.calls[0]![1])).toEqual(['workspaceId']);
    expect(checkName.mock.calls[0]).toHaveLength(1);
  });

  test('a check running when its list changes ends without calling the validator', async () => {
    const { pending, gated } = createGatedValidator<SlugForm>();
    const validate = eitherDeps();
    const { result, rerender } = renderHook(
      ({ byName }: { byName: boolean }) =>
        useForm(gated, {
          initialValues: record,
          fieldValidators: { slug: withDeps(byName ? ['name'] : ['workspaceId'], validate) },
        }),
      { initialProps: { byName: false } },
    );
    // The check waits on the first schema check
    act(() => result.current.setFieldValue('slug', 'x'));

    rerender({ byName: true });
    await act(async () => {
      pending[0]!.resolve(ok({ ...record, slug: 'x' }));
      await nextTask();
    });

    expect(validate).not.toHaveBeenCalled();
    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.validatingFields).toEqual({});
    expect(result.current.isValidating).toBe(false);
  });

  test('an inline withDeps adds no render', () => {
    const validate = slugCheck();
    let renders = 0;
    const { rerender } = renderHook(() => {
      renders++;
      return useForm(slugSchema, {
        initialValues: record,
        fieldValidators: { slug: withDeps(['workspaceId'], validate) },
      });
    });
    const before = renders;

    rerender();

    expect(renders).toBe(before + 1);
  });

  test('a listed-field edit checks a validator that never ran', () => {
    const validate = slugCheck();
    const { result } = renderHook(() =>
      useForm(slugSchema, {
        initialValues: { ...record, workspaceId: 'w2', slug: 'taken' },
        fieldValidators: { slug: withDeps(['workspaceId'], validate) },
      }),
    );

    act(() => result.current.setFieldValue('workspaceId', 'w1'));

    expect(validate).toHaveBeenCalledWith('taken', { workspaceId: 'w1' });
    expect(result.current.errors.slug).toBe('Slug taken');
  });

  test('a cascade that reaches the same validator through its list runs it once', () => {
    const validate = slugCheck();
    const { result } = renderHook(() =>
      useForm(slugSchema, {
        initialValues: record,
        fieldValidators: { slug: withDeps(['workspaceId'], validate) },
        onFieldChange: (field) => {
          if (field === 'workspaceId') result.current.setFieldValue('slug', 'taken');
        },
      }),
    );
    validate.mockClear();

    // The value is unchanged, but the call still counts
    act(() => result.current.setFieldValue('workspaceId', 'w1'));

    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate).toHaveBeenCalledWith('taken', { workspaceId: 'w1' });
  });

  test('a cascade write with shouldValidate false to a listed field is checked on the final values', () => {
    const validate = slugCheck();
    const { result } = renderHook(() =>
      useForm(slugSchema, {
        initialValues: { ...record, workspaceId: 'w2' },
        fieldValidators: { slug: withDeps(['workspaceId'], validate) },
        onFieldChange: (field) => {
          if (field === 'slug') result.current.setFieldValue('workspaceId', 'w1', false);
        },
      }),
    );

    act(() => result.current.setFieldValue('slug', 'taken'));

    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate).toHaveBeenCalledWith('taken', { workspaceId: 'w1' });
  });

  test("a running check whose listed field changes doesn't land", async () => {
    const { calls, gate } = createGatedFieldValidator();
    const { result } = renderHook(() =>
      useForm(slugSchema, {
        initialValues: record,
        fieldValidators: { slug: withDeps(['workspaceId'], (_slug, _deps) => gate()) },
      }),
    );
    act(() => result.current.setFieldValue('slug', 'taken'));
    expect(result.current.validatingFields).toEqual({ slug: true });

    act(() => result.current.setFieldValue('workspaceId', 'w2', false));
    await act(async () => {
      calls[0]!.resolve('Slug taken');
      await nextTask();
    });

    expect(result.current.errors.slug).toBeUndefined();
    expect(result.current.validatingFields).toEqual({});
  });

  test("an object entry withDeps didn't make is off", async () => {
    const validate = slugCheck();
    const { result } = renderHook(() =>
      useForm(slugSchema, {
        initialValues: record,
        fieldValidators: {
          // @ts-expect-error -- untyped code: an object withDeps didn't make
          slug: { deps: ['workspaceId'], validate },
        },
      }),
    );

    expect(() => act(() => result.current.setFieldValue('slug', 'taken'))).not.toThrow();
    expect(validate).not.toHaveBeenCalled();
    expect(result.current.isValid).toBe(true);

    let outcome!: Awaited<ReturnType<typeof result.current.handleSubmit>>;
    await act(async () => {
      outcome = await result.current.handleSubmit();
    });

    expect(outcome).toEqual(ok({ ...record, slug: 'taken' }));
  });
});
