import { describe, test, expect, mock, spyOn } from 'bun:test';

import { err, isErr, isOk, ok, type Result } from '@railway-ts/pipelines/result';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';

import { useForm } from '../../src/useForm';
import { createGatedFieldValidator, createGatedValidator, nextTask } from '../fixtures/gates';
import { publishValidator, type PublishForm } from '../fixtures/validators';

import type { FormOptions, ResetKey } from '../../src/types';
import type { MaybeAsyncValidator, ValidationError } from '@railway-ts/pipelines/schema';

type Outcome = Result<PublishForm, ValidationError[]>;

const A: PublishForm = { title: 'Hello', status: 'draft', tags: [] };
const B: PublishForm = { title: 'B', status: 'published', tags: ['x'] };

type Props = { rec: PublishForm; id: ResetKey };

/** The default setup: a form editing the `rec` prop, keyed on the `id` prop, starting at record A. */
const renderForm = (
  options: Omit<FormOptions<PublishForm>, 'initialValues' | 'resetKey'> = {},
  initialProps: Props = { rec: A, id: 'a' },
) =>
  renderHook(({ rec, id }: Props) => useForm(publishValidator, { initialValues: rec, resetKey: id, ...options }), {
    initialProps,
  });

/**
 * An onSubmit whose calls stay pending until the test settles them, in call order. A call settled
 * with `undefined` saves, and one settled with an `err` fails.
 */
const createGatedOnSubmit = () => {
  const gates: PromiseWithResolvers<Outcome | undefined>[] = [];
  const onSubmit = mock(async (values: PublishForm): Promise<Outcome> => {
    const gate = Promise.withResolvers<Outcome | undefined>();
    gates.push(gate);
    return (await gate.promise) ?? ok(values);
  });
  return { onSubmit, gates };
};

describe('resetKey', () => {
  test('a resetKey change starts the form over with the new initialValues', async () => {
    const { onSubmit, gates } = createGatedOnSubmit();
    const { result, rerender } = renderForm({ onSubmit });

    // Saved first, so the edits and errors below come after anything the submit clears
    act(() => result.current.setFieldValue('title', 'Mine'));
    let saving!: Promise<Outcome>;
    act(() => {
      saving = result.current.handleSubmit();
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await act(async () => {
      gates[0]!.resolve(undefined);
      await saving;
    });
    expect(result.current.submitCount).toBe(1);
    expect(result.current.touched).toEqual({ title: true, status: true, tags: true });

    act(() => result.current.setFieldValue('title', ''));
    act(() =>
      result.current.setServerErrors([
        { path: ['status'], message: 'Taken' },
        { path: [], message: 'Down' },
      ]),
    );
    expect(result.current.errors).toEqual({ title: 'Title is required', status: 'Taken', _root: 'Down' });

    rerender({ rec: B, id: 'b' });

    expect(result.current.values).toEqual(B);
    expect(result.current.touched).toEqual({});
    expect(result.current.errors).toEqual({});
    expect(result.current.submitCount).toBe(0);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isStale).toBe(false);
  });

  test('fires onValuesChange for the reset', () => {
    const onValuesChange = mock((_values: PublishForm, _prev: PublishForm) => {});
    const { rerender } = renderForm({ onValuesChange });
    onValuesChange.mockClear();

    rerender({ rec: B, id: 'b' });

    expect(onValuesChange).toHaveBeenCalledWith(B, A);
  });

  test('keeps the component mounted', () => {
    const Editor = ({ rec, id }: Props) => {
      const form = useForm(publishValidator, { initialValues: rec, resetKey: id });
      return <output data-testid="title">{form.values.title}</output>;
    };
    const { getByTestId, rerender } = render(<Editor rec={A} id="a" />);
    const node = getByTestId('title');

    rerender(<Editor rec={B} id="b" />);

    expect(getByTestId('title')).toBe(node);
    expect(node.textContent).toBe('B');
  });

  test('methods keep their identity across a resetKey change', () => {
    const { onSubmit } = createGatedOnSubmit();
    const { result, rerender } = renderForm({ onSubmit });
    const before = result.current;

    rerender({ rec: B, id: 'b' });

    expect(result.current.setFieldValue).toBe(before.setFieldValue);
    expect(result.current.setValues).toBe(before.setValues);
    expect(result.current.setFieldTouched).toBe(before.setFieldTouched);
    expect(result.current.resetForm).toBe(before.resetForm);
    expect(result.current.handleSubmit).toBe(before.handleSubmit);
  });

  test("a running save's results do not land on the new record", async () => {
    const { onSubmit, gates } = createGatedOnSubmit();
    const { result, rerender } = renderForm({ onSubmit });

    act(() => result.current.setFieldValue('title', 'Mine'));
    let pending!: Promise<Outcome>;
    act(() => {
      pending = result.current.handleSubmit();
    });
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));

    rerender({ rec: B, id: 'b' });
    expect(result.current.isSubmitting).toBe(false);

    await act(async () => {
      gates[0]!.resolve(
        err([
          { path: ['title'], message: 'Taken' },
          { path: [], message: 'Conflict' },
        ]),
      );
      await nextTask();
    });

    expect(isErr(await pending)).toBe(true);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.isSubmitting).toBe(false);
  });

  test('a stale async validation result is dropped', async () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const { result, rerender } = renderHook(
      ({ rec, id }: Props) => useForm(gated, { initialValues: rec, resetKey: id, validationMode: 'live' }),
      { initialProps: { rec: A, id: 'a' } },
    );

    act(() => result.current.setFieldValue('title', 'x'));
    rerender({ rec: B, id: 'b' });
    await act(async () => {
      pending[0]!.resolve(err([{ path: ['title'], message: 'Stale' }]));
      await nextTask();
    });

    expect(result.current.clientErrors).toEqual({});
    expect(result.current.isValidating).toBe(false);
  });

  test('a field validator still running for A is dropped', async () => {
    const { calls, gate } = createGatedFieldValidator();
    const { result, rerender } = renderForm({ validationMode: 'blur', fieldValidators: { title: () => gate() } });

    act(() => result.current.setFieldTouched('title'));
    rerender({ rec: B, id: 'b' });
    await act(async () => {
      calls[0]!.resolve('Stale');
      await nextTask();
    });

    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.validatingFields).toEqual({});
  });

  test("B's submit starts while A's is still pending", async () => {
    const { onSubmit } = createGatedOnSubmit();
    const { result, rerender } = renderForm({ onSubmit });

    act(() => {
      void result.current.handleSubmit();
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    rerender({ rec: B, id: 'b' });
    act(() => {
      void result.current.handleSubmit();
    });

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1]![0]).toEqual(B);
  });

  test("a follow-up queued on A submits A's values, not B's", async () => {
    const { onSubmit, gates } = createGatedOnSubmit();
    const { result, rerender } = renderForm({ onSubmit });

    act(() => result.current.setFieldValue('title', 'A1'));
    act(() => {
      void result.current.handleSubmit();
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    act(() => result.current.setFieldValue('title', 'A2'));
    act(() => {
      void result.current.handleSubmit();
    });
    rerender({ rec: B, id: 'b' });

    await act(async () => {
      gates[0]!.resolve(undefined);
      await nextTask();
    });

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1]![0].title).toBe('A2');
  });

  test("a follow-up queued on A that starts after the switch doesn't change B's state", async () => {
    const { onSubmit, gates } = createGatedOnSubmit();
    const { result, rerender } = renderForm({ onSubmit });

    act(() => result.current.setFieldValue('title', 'A1'));
    act(() => {
      void result.current.handleSubmit();
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    act(() => result.current.setFieldValue('title', 'A2'));
    let followUp!: Promise<Outcome>;
    act(() => {
      followUp = result.current.handleSubmit();
    });
    rerender({ rec: B, id: 'b' });
    act(() => result.current.setFieldTouched('title'));
    const values = result.current.values;

    // A's save settles, and its follow-up starts while B's state is current
    await act(async () => {
      gates[0]!.resolve(undefined);
      await nextTask();
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(result.current.touched).toEqual({ title: true });
    expect(result.current.submitCount).toBe(0);
    expect(result.current.isSubmitting).toBe(false);

    await act(async () => {
      gates[1]!.resolve(undefined);
      await nextTask();
    });

    expect(isOk(await followUp)).toBe(true);
    expect(result.current.values).toBe(values);
    expect(result.current.touched).toEqual({ title: true });
    expect(result.current.submitCount).toBe(0);
    expect(result.current.isSubmitting).toBe(false);

    // The follow-up's success didn't settle B's baseline on A's values: B still follows its next version
    rerender({ rec: { ...B, title: 'B2' }, id: 'b' });
    expect(result.current.values.title).toBe('B2');
  });

  test("a follow-up queued on A that starts after the switch doesn't drop B's validation still running", async () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    // Async only for B's edit, so A's submissions validate at once
    const validator: MaybeAsyncValidator<unknown, PublishForm> = (value, path) =>
      (value as PublishForm).title === 'Bx' ? gated(value, path) : publishValidator(value, path);
    const { onSubmit, gates } = createGatedOnSubmit();
    const { result, rerender } = renderHook(
      ({ rec, id }: Props) => useForm(validator, { initialValues: rec, resetKey: id, onSubmit }),
      { initialProps: { rec: A, id: 'a' } },
    );

    act(() => result.current.setFieldValue('title', 'A1'));
    act(() => {
      void result.current.handleSubmit();
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    act(() => result.current.setFieldValue('title', 'A2'));
    act(() => {
      void result.current.handleSubmit();
    });
    rerender({ rec: B, id: 'b' });
    act(() => result.current.setFieldValue('title', 'Bx'));

    await act(async () => {
      gates[0]!.resolve(undefined);
      await nextTask();
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    await act(async () => {
      pending[0]!.resolve(err([{ path: ['title'], message: 'Taken' }]));
      await nextTask();
    });

    expect(result.current.clientErrors).toEqual({ title: 'Taken' });
    expect(result.current.isValidating).toBe(false);
  });

  test('mount mode validates and touches every field after a resetKey change', () => {
    const { result, rerender } = renderForm({ validationMode: 'mount' });

    rerender({ rec: { ...B, title: '' }, id: 'b' });

    expect(result.current.clientErrors.title).toBe('Title is required');
    expect(result.current.touched.title).toBe(true);
  });

  test('under StrictMode, a resetKey change validates once in mount mode', () => {
    const validator = mock((value: unknown, path?: string[]) => publishValidator(value, path));
    const { rerender } = renderHook(
      ({ rec, id }: Props) => useForm(validator, { initialValues: rec, resetKey: id, validationMode: 'mount' }),
      { initialProps: { rec: A, id: 'a' }, wrapper: StrictMode },
    );
    validator.mockClear();

    rerender({ rec: B, id: 'b' });

    expect(validator).toHaveBeenCalledTimes(1);
  });

  test('a change from undefined to an id resets', () => {
    const { result, rerender } = renderForm({}, { rec: A, id: undefined });

    // An edit: a plain follow would keep it, so only a reset shows B
    act(() => result.current.setFieldValue('title', 'Mine'));
    rerender({ rec: B, id: 'b' });

    expect(result.current.values).toEqual(B);
  });

  test('unmounting during a switched-away save still resolves its promise, without errors', async () => {
    const consoleError = spyOn(console, 'error');
    try {
      const { onSubmit, gates } = createGatedOnSubmit();
      const { result, rerender, unmount } = renderForm({ onSubmit });

      let pending!: Promise<Outcome>;
      act(() => {
        pending = result.current.handleSubmit();
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      rerender({ rec: B, id: 'b' });
      unmount();
      gates[0]!.resolve(undefined);

      expect(isOk(await pending)).toBe(true);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
