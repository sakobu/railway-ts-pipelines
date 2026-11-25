import { describe, test, expect, mock, spyOn } from 'bun:test';

import { ok, err } from '@railway-ts/pipelines/result';
import * as S from '@railway-ts/pipelines/schema';
import { renderHook, act } from '@testing-library/react';
import { StrictMode } from 'react';

import { useForm } from '../../src/useForm';
import { createGatedFieldValidator, createGatedValidator, nextTask } from '../fixtures/gates';
import { publishValidator, userValidator, type PublishForm } from '../fixtures/validators';

const draft: PublishForm = { title: 'Hello', status: 'draft', tags: [] };
const user = { name: 'John', email: 'john@test.com', age: 25 };

describe('switching a field validator off', () => {
  /** A form whose `name` validator returns an error while `on`, and is switched off as `off` gives. */
  const renderSwitchable = (off: { name?: undefined } = {}, options: { onSubmit?: () => void } = {}) =>
    renderHook(
      ({ on }: { on: boolean }) =>
        useForm(userValidator, {
          initialValues: user,
          validationMode: 'live',
          fieldValidators: on ? { name: () => 'Name is taken' } : off,
          ...options,
        }),
      { initialProps: { on: true } },
    );

  test.each([
    ['leaving its key out', {}],
    ['setting it to undefined', { name: undefined }],
  ])('by %s drops the error it set', (_, off) => {
    const { result, rerender } = renderSwitchable(off);
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
    const { result, rerender } = renderHook(
      ({ on }: { on: boolean }) =>
        useForm(publishValidator, {
          initialValues: draft,
          validationMode: 'live',
          fieldValidators: on ? { title: () => gate() } : {},
        }),
      { initialProps: { on: true } },
    );
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
    const { result, rerender } = renderHook(
      ({ on }: { on: boolean }) =>
        useForm(gated, {
          initialValues: draft,
          validationMode: 'live',
          fieldValidators: on ? { title: checkTitle } : {},
        }),
      { initialProps: { on: true } },
    );
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
    const { result, rerender } = renderHook(
      ({ on }: { on: boolean }) =>
        useForm(publishValidator, {
          initialValues: draft,
          fieldValidators: on ? { title: () => gate() } : {},
          onSubmit,
        }),
      { initialProps: { on: true } },
    );

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

  test('switching off works under StrictMode', () => {
    const { result, rerender } = renderHook(
      ({ on }: { on: boolean }) =>
        useForm(userValidator, {
          initialValues: user,
          validationMode: 'live',
          fieldValidators: on ? { name: () => 'Name is taken' } : {},
        }),
      { initialProps: { on: true }, wrapper: StrictMode },
    );
    act(() => result.current.setFieldValue('name', 'Jane'));
    expect(result.current.errors.name).toBe('Name is taken');

    rerender({ on: false });

    expect(result.current.errors.name).toBeUndefined();
    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.isValid).toBe(true);
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
    const { result, rerender } = renderHook(
      ({ on }: { on: boolean }) =>
        useForm(gated, { initialValues: draft, fieldValidators: on ? { title: checkTitle } : {} }),
      { initialProps: { on: false } },
    );

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
    const { result, rerender } = renderHook(
      ({ on }: { on: boolean }) =>
        useForm(gated, { initialValues: draft, fieldValidators: on ? { title: checkTitle } : {}, onSubmit }),
      { initialProps: { on: true } },
    );

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
  const checkTitle = mock((_value: string, _values: PublishForm) => undefined);
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
  expect(checkTitle).toHaveBeenCalledWith('Updated', { ...draft, title: 'Updated' });
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
