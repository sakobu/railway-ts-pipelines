import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from 'bun:test';

import { err, ok } from '@railway-ts/pipelines/result';
import {
  chain,
  number,
  object,
  optional,
  required,
  string,
  transform,
  type MaybeAsyncValidator,
} from '@railway-ts/pipelines/schema';
import { render, renderHook, act, waitFor, fireEvent } from '@testing-library/react';
import { Component, StrictMode, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';

import { useForm } from '../../src/useForm';
import { createGatedFieldValidator, createGatedOnSubmit, createGatedValidator, nextTask } from '../fixtures/gates';
import { publishValidator, type PublishForm } from '../fixtures/validators';

import type { FormOptions, UseFormReturn } from '../../src/types';

const draft: PublishForm = { title: 'Hello', status: 'draft', tags: [] };
const loaded: PublishForm = { title: 'Loaded', status: 'published', tags: ['a'] };

/** The default setup: a form whose initialValues come from the `initial` prop, starting at `draft`. */
const renderForm = (options: Omit<FormOptions<PublishForm>, 'initialValues'> = {}) =>
  renderHook(
    ({ initial }: { initial: PublishForm }) => useForm(publishValidator, { initialValues: initial, ...options }),
    { initialProps: { initial: draft } },
  );

describe('following new initialValues', () => {
  test('follows a new version when the form has no edits', () => {
    const { result, rerender } = renderForm();

    rerender({ initial: loaded });

    expect(result.current.values).toEqual(loaded);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isStale).toBe(false);
  });

  test('keeps edits and reports isStale when someone else changed the record', () => {
    const { result, rerender } = renderForm();

    act(() => result.current.setFieldValue('title', 'Mine'));
    rerender({ initial: { ...draft, status: 'published' } });

    expect(result.current.values.title).toBe('Mine');
    expect(result.current.values.status).toBe('draft');
    expect(result.current.isDirty).toBe(true);
    expect(result.current.isStale).toBe(true);
  });

  test('an inline object with the same content does nothing', () => {
    const onValuesChange = mock((_values: PublishForm, _prev: PublishForm) => {});
    const { result, rerender } = renderHook(
      ({ initial }: { initial: PublishForm }) =>
        useForm(publishValidator, { initialValues: { ...initial }, onValuesChange }),
      { initialProps: { initial: draft } },
    );
    const before = result.current.values;
    onValuesChange.mockClear();

    rerender({ initial: draft });

    expect(result.current.values).toBe(before);
    expect(onValuesChange).not.toHaveBeenCalled();
  });

  test("a child's layout effect that writes in the commit that brings a new version builds on the followed version", () => {
    let form!: UseFormReturn<PublishForm>;
    const TagChild = ({
      initial,
      setFieldValue,
    }: {
      initial: PublishForm;
      setFieldValue: (f: 'tags', v: string[]) => void;
    }) => {
      useLayoutEffect(() => {
        if (initial !== draft) setFieldValue('tags', ['x']);
      }, [initial, setFieldValue]);
      return null;
    };
    const Probe = ({ initial }: { initial: PublishForm }) => {
      form = useForm(publishValidator, { initialValues: initial });
      return <TagChild initial={initial} setFieldValue={form.setFieldValue} />;
    };
    const { rerender } = render(<Probe initial={draft} />);

    rerender(<Probe initial={loaded} />);

    expect(form.values).toEqual({ ...loaded, tags: ['x'] });
    expect(form.isStale).toBe(false);
  });

  test('effects in the commit that receives a new version see the followed values', () => {
    const seen: string[] = [];
    const Probe = ({ initial }: { initial: PublishForm }) => {
      const form = useForm(publishValidator, { initialValues: initial });
      useEffect(() => {
        seen.push(`${form.values.title}:${String(form.isDirty)}`);
      }, [form.values, form.isDirty]);
      return null;
    };
    const { rerender } = render(<Probe initial={draft} />);
    seen.length = 0;

    rerender(<Probe initial={loaded} />);

    expect(seen).toEqual(['Loaded:false']);
  });

  test('calls onValuesChange once for a follow, under StrictMode', () => {
    const onValuesChange = mock((_values: PublishForm, _prev: PublishForm) => {});
    const { rerender } = renderHook(
      ({ initial }: { initial: PublishForm }) => useForm(publishValidator, { initialValues: initial, onValuesChange }),
      { initialProps: { initial: draft }, wrapper: StrictMode },
    );
    onValuesChange.mockClear();

    rerender({ initial: loaded });

    expect(onValuesChange).toHaveBeenCalledTimes(1);
    expect(onValuesChange).toHaveBeenCalledWith(loaded, draft);
  });

  test('autoSave does not submit after a follow', async () => {
    const onSubmit = mock((_values: PublishForm) => {});
    const { rerender } = renderHook(
      ({ initial }: { initial: PublishForm }) => {
        useForm(publishValidator, { initialValues: initial, onSubmit, autoSave: { delay: 10 } });
      },
      { initialProps: { initial: draft } },
    );

    rerender({ initial: loaded });
    await act(() => new Promise((r) => setTimeout(r, 50)));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('keeps isSubmitting true when a version lands during a submission', async () => {
    const { onSubmit, saves } = createGatedOnSubmit<PublishForm>();
    const { result, rerender } = renderForm({ onSubmit });

    let submitting!: Promise<unknown>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));

    rerender({ initial: loaded });
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      saves[0]!.resolve(undefined);
      await submitting;
    });
    await waitFor(() => expect(result.current.isSubmitting).toBe(false));
  });
});

describe('errors after a follow', () => {
  test('live mode re-validates the followed values', () => {
    const { result, rerender } = renderForm();

    rerender({ initial: { ...draft, title: '' } });

    expect(result.current.clientErrors.title).toBe('Title is required');
  });

  test('submit mode does not start showing errors', () => {
    const { result, rerender } = renderForm({ validationMode: 'submit' });

    rerender({ initial: { ...draft, title: '' } });

    expect(result.current.clientErrors).toEqual({});
  });

  test('blur mode re-validates once a field was blurred, even with no errors shown', () => {
    const { result, rerender } = renderForm({ validationMode: 'blur' });
    act(() => result.current.setFieldTouched('title'));
    expect(result.current.clientErrors).toEqual({});

    rerender({ initial: { ...draft, title: '' } });

    expect(result.current.getFieldError('title')).toBe('Title is required');
    expect(result.current.isValid).toBe(false);
  });

  test("blur mode doesn't start validating before any field was blurred", () => {
    const { result, rerender } = renderForm({ validationMode: 'blur' });

    rerender({ initial: { ...draft, title: '' } });

    expect(result.current.clientErrors).toEqual({});
  });

  test('submit mode re-validates after a submit attempt, even with no errors shown', async () => {
    const { result, rerender } = renderForm({ validationMode: 'submit', onSubmit: () => {} });
    await act(() => result.current.handleSubmit());
    expect(result.current.clientErrors).toEqual({});

    rerender({ initial: { ...draft, title: '' } });

    expect(result.current.getFieldError('title')).toBe('Title is required');
  });

  test("submit mode doesn't start validating when a field is only marked touched", () => {
    const { result, rerender } = renderForm({ validationMode: 'submit' });
    act(() => result.current.setFieldTouched('title'));

    rerender({ initial: { ...draft, title: '' } });

    expect(result.current.clientErrors).toEqual({});
  });

  test('blur mode re-validates when client errors already exist', () => {
    const { result, rerender } = renderHook(
      ({ initial }: { initial: PublishForm }) =>
        useForm(publishValidator, { initialValues: initial, validationMode: 'blur' }),
      { initialProps: { initial: { ...draft, title: '' } } },
    );
    act(() => result.current.setFieldTouched('title'));
    expect(result.current.clientErrors.title).toBe('Title is required');

    rerender({ initial: draft });

    expect(result.current.clientErrors).toEqual({});
  });

  test('a follow re-validates when only server errors showed, as for other errors', () => {
    const { result, rerender } = renderForm({ validationMode: 'submit' });
    act(() => result.current.setServerErrors([{ path: ['title'], message: 'Server says no' }]));

    rerender({ initial: { ...draft, title: '' } });

    expect(result.current.serverErrors).toEqual({});
    expect(result.current.clientErrors).toEqual({ title: 'Title is required' });
  });

  test('mount mode marks the fields of a followed version touched', () => {
    const { result, rerender } = renderForm({ validationMode: 'mount' });

    rerender({ initial: { ...draft, tags: ['a', 'b'] } });

    expect(result.current.touched['tags.1']).toBe(true);
  });

  test("the old values' schema errors don't show on the followed values while their async check runs", async () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const { result, rerender } = renderHook(
      ({ initial }: { initial: PublishForm }) => useForm(gated, { initialValues: initial, validationMode: 'mount' }),
      { initialProps: { initial: { ...draft, title: '' } } },
    );
    await act(async () => {
      pending[0]!.resolve(err([{ path: ['title'], message: 'Title is required' }]));
      await nextTask();
    });
    expect(result.current.clientErrors.title).toBe('Title is required');

    rerender({ initial: loaded });

    expect(result.current.clientErrors).toEqual({});
    expect(result.current.isValidating).toBe(true);
  });

  test("the old values' field errors don't show on the followed values while the schema check runs", async () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const { result, rerender } = renderHook(
      ({ initial }: { initial: PublishForm }) =>
        useForm(gated, { initialValues: initial, validationMode: 'blur', fieldValidators: { title: () => 'Taken' } }),
      { initialProps: { initial: draft } },
    );
    act(() => result.current.setFieldTouched('title'));
    await act(async () => {
      pending[0]!.resolve(ok(draft));
      await nextTask();
    });
    expect(result.current.fieldErrors.title).toBe('Taken');

    rerender({ initial: loaded });

    expect(result.current.fieldErrors).toEqual({});
  });

  test('a schema validation still running for the old values does not land on the followed values', async () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const { result, rerender } = renderHook(
      ({ initial }: { initial: PublishForm }) => useForm(gated, { initialValues: initial, validationMode: 'blur' }),
      { initialProps: { initial: draft } },
    );

    act(() => result.current.setFieldTouched('title'));
    rerender({ initial: loaded });
    await act(async () => {
      pending[0]!.resolve(err([{ path: ['title'], message: 'Stale' }]));
      pending[1]!.resolve(ok(loaded));
      await nextTask();
    });

    expect(result.current.clientErrors).toEqual({});
    expect(result.current.isValidating).toBe(false);
  });

  test("a field validator still running for the old value ends, and outside live mode isn't re-run", async () => {
    const { calls, gate } = createGatedFieldValidator();
    const { result, rerender } = renderForm({ validationMode: 'blur', fieldValidators: { title: () => gate() } });

    act(() => result.current.setFieldTouched('title'));
    rerender({ initial: loaded });
    expect(result.current.validatingFields).toEqual({});
    await act(async () => {
      calls[0]!.resolve('Stale');
      await nextTask();
    });

    expect(calls).toHaveLength(1);
    expect(result.current.fieldErrors).toEqual({});
  });

  test('in live mode, a field validator still running for the old value is re-run for the followed value', async () => {
    const { calls, gate } = createGatedFieldValidator();
    const { result, rerender } = renderForm({ validationMode: 'live', fieldValidators: { title: () => gate() } });

    // A check of the title as it is, so the form stays clean and follows
    act(() => result.current.setFieldValue('title', draft.title, true));
    rerender({ initial: loaded });
    await act(async () => {
      calls[0]!.resolve('Stale');
      calls[1]!.resolve(undefined);
      await nextTask();
    });

    expect(calls).toHaveLength(2);
    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.validatingFields).toEqual({});
  });

  test("a field validator waiting for a schema check started before the follow doesn't run", async () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const { result, rerender } = renderHook(
      ({ initial }: { initial: PublishForm }) =>
        useForm(gated, {
          initialValues: initial,
          validationMode: 'blur',
          fieldValidators: { title: (value) => (value === 'Hello' ? 'Checked the old title' : undefined) },
        }),
      { initialProps: { initial: draft } },
    );

    act(() => result.current.setFieldTouched('title'));
    rerender({ initial: loaded });
    await act(async () => {
      pending[0]!.resolve(ok(draft));
      pending[1]!.resolve(ok(loaded));
      await nextTask();
    });

    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.isValidating).toBe(false);
  });

  test('a field validator that finishes at once for the followed value clears its validating flag', async () => {
    const { calls, gate } = createGatedFieldValidator();
    const { result, rerender } = renderForm({
      validationMode: 'blur',
      fieldValidators: { title: (value) => (value === 'Hello' ? gate() : undefined) },
    });

    act(() => result.current.setFieldTouched('title'));
    rerender({ initial: loaded });
    await act(async () => {
      calls[0]!.resolve('Stale');
      await nextTask();
    });

    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.validatingFields).toEqual({});
    expect(result.current.isValidating).toBe(false);
  });

  test('a schema check that finishes at once for the followed values clears isValidating', async () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const mixed: MaybeAsyncValidator<unknown, PublishForm> = (value, path) =>
      (value as PublishForm).title === 'Hello' ? gated(value, path) : publishValidator(value, path);
    const { result, rerender } = renderHook(
      ({ initial }: { initial: PublishForm }) => useForm(mixed, { initialValues: initial, validationMode: 'blur' }),
      { initialProps: { initial: draft } },
    );

    act(() => result.current.setFieldTouched('title'));
    rerender({ initial: loaded });
    await act(async () => {
      pending[0]!.resolve(err([{ path: ['title'], message: 'Stale' }]));
      await nextTask();
    });

    expect(result.current.clientErrors).toEqual({});
    expect(result.current.isValidating).toBe(false);
  });

  test("a field validator re-run for the followed values doesn't run when the schema fails for its field", () => {
    const { result, rerender } = renderForm({ validationMode: 'blur', fieldValidators: { title: () => 'Taken' } });

    act(() => result.current.setFieldTouched('title'));
    expect(result.current.fieldErrors.title).toBe('Taken');

    rerender({ initial: { ...draft, title: '' } });

    expect(result.current.errors.title).toBe('Title is required');
    expect(result.current.fieldErrors).toEqual({});
  });

  test('a field whose validator was removed clears its error and validating flag when a follow re-runs it', async () => {
    const { calls, gate } = createGatedFieldValidator();
    const { result, rerender } = renderHook(
      ({ initial, checkFields }: { initial: PublishForm; checkFields: boolean }) =>
        useForm(publishValidator, {
          initialValues: initial,
          validationMode: 'blur',
          fieldValidators: checkFields ? { title: () => gate(), status: () => 'Bad' } : undefined,
        }),
      { initialProps: { initial: draft, checkFields: true } },
    );

    act(() => result.current.setFieldTouched('title'));
    act(() => result.current.setFieldTouched('status'));
    expect(result.current.validatingFields).toEqual({ title: true });
    expect(result.current.fieldErrors).toEqual({ status: 'Bad' });

    rerender({ initial: draft, checkFields: false });
    rerender({ initial: loaded, checkFields: false });
    await act(async () => {
      calls[0]!.resolve('Stale');
      await nextTask();
    });

    expect(result.current.values).toEqual(loaded);
    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.validatingFields).toEqual({});
    expect(result.current.isValidating).toBe(false);
  });

  test("a submission's validation of the old values does not land on the followed values", async () => {
    const { pending, gated } = createGatedValidator<PublishForm>();
    const { result, rerender } = renderHook(
      ({ initial }: { initial: PublishForm }) => useForm(gated, { initialValues: initial }),
      { initialProps: { initial: draft } },
    );

    let submitting!: Promise<unknown>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    rerender({ initial: loaded });
    expect(result.current.values).toEqual(loaded);

    // The follow's check settles first, so the submission's result for the old values would land last
    await act(async () => {
      pending[1]!.resolve(ok(loaded));
      await nextTask();
    });
    await act(async () => {
      pending[0]!.resolve(err([{ path: ['title'], message: 'Stale' }]));
      await submitting;
    });

    expect(result.current.clientErrors).toEqual({});
    expect(result.current.isValidating).toBe(false);
  });

  describe('a validator that throws on the followed values', () => {
    let consoleError: ReturnType<typeof spyOn>;
    beforeEach(() => {
      consoleError = spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
      consoleError.mockRestore();
    });

    /** The publish schema, except that a title of 'Boom' makes it throw, as a bug in a validator would. */
    const throwsOnBoom: MaybeAsyncValidator<unknown, PublishForm> = (value, path) => {
      if ((value as PublishForm).title === 'Boom') throw new Error('boom');
      return publishValidator(value, path);
    };

    test("is logged, and the old values' errors are cleared", () => {
      const { result, rerender } = renderHook(
        ({ initial }: { initial: PublishForm }) => useForm(throwsOnBoom, { initialValues: initial }),
        { initialProps: { initial: draft } },
      );
      rerender({ initial: { ...draft, title: '' } });
      expect(result.current.clientErrors).toEqual({ title: 'Title is required' });

      rerender({ initial: { ...draft, title: 'Boom' } });

      expect(result.current.values.title).toBe('Boom');
      expect(result.current.clientErrors).toEqual({});
      expect(consoleError).toHaveBeenCalledWith('Form validation error:', expect.any(Error));
    });

    test('a field validator that throws is logged', () => {
      const { result, rerender } = renderForm({
        fieldValidators: {
          title: (value) => {
            if (value === 'Boom') throw new Error('boom');
            return value === 'Bad' ? 'Bad title' : undefined;
          },
        },
      });
      act(() => result.current.setFieldValue('title', 'Bad'));
      expect(result.current.fieldErrors).toEqual({ title: 'Bad title' });
      // The values come to equal the latest version: the form has no edits, so it follows the next one
      rerender({ initial: { ...draft, title: 'Bad' } });

      rerender({ initial: { ...draft, title: 'Boom' } });

      expect(result.current.values.title).toBe('Boom');
      expect(consoleError).toHaveBeenCalledWith('Form validation error:', expect.any(Error));
    });

    test('an async validator that rejects is logged, and isValidating clears', async () => {
      const rejectsOnBoom: MaybeAsyncValidator<unknown, PublishForm> = async (value, path) => throwsOnBoom(value, path);
      const { result, rerender } = renderHook(
        ({ initial }: { initial: PublishForm }) => useForm(rejectsOnBoom, { initialValues: initial }),
        { initialProps: { initial: draft } },
      );

      rerender({ initial: { ...draft, title: 'Boom' } });
      expect(result.current.isValidating).toBe(true);

      await waitFor(() => expect(result.current.isValidating).toBe(false));
      expect(consoleError).toHaveBeenCalledWith('Form validation error:', expect.any(Error));
    });

    test('a save whose saved record it throws on still succeeds', async () => {
      const { onSubmit, saves } = createGatedOnSubmit<PublishForm>();
      const { result, rerender } = renderHook(
        ({ initial }: { initial: PublishForm }) => useForm(throwsOnBoom, { initialValues: initial, onSubmit }),
        { initialProps: { initial: draft } },
      );

      act(() => result.current.setFieldValue('title', ' Boom '));
      let submitting!: ReturnType<typeof result.current.handleSubmit>;
      act(() => {
        submitting = result.current.handleSubmit();
      });
      await waitFor(() => expect(result.current.isSubmitting).toBe(true));
      // The saved record, trimmed, arrives before onSubmit returns: the form follows it when the save settles
      rerender({ initial: { ...draft, title: 'Boom' } });
      let outcome!: Awaited<typeof submitting>;
      await act(async () => {
        saves[0]!.resolve(undefined);
        outcome = await submitting;
      });

      expect(outcome).toEqual(ok({ ...draft, title: ' Boom ' }));
      expect(result.current.values.title).toBe('Boom');
      expect(result.current.errors._root).toBeUndefined();
      expect(consoleError).toHaveBeenCalledWith('Form validation error:', expect.any(Error));
    });
  });
});

describe('isStale', () => {
  /** A form with an edit, after someone else published the record. */
  const renderStaleForm = () => {
    const rendered = renderForm();
    act(() => rendered.result.current.setFieldValue('title', 'Mine'));
    rendered.rerender({ initial: { ...draft, status: 'published' } });
    return rendered;
  };

  test('clears when resetForm() reloads the latest version', () => {
    const { result } = renderStaleForm();
    expect(result.current.isStale).toBe(true);
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.resetForm());

    expect(result.current.isStale).toBe(false);
    expect(result.current.values).toEqual({ ...draft, status: 'published' });
    expect(result.current.isDirty).toBe(false);
  });

  test("clears when the user's edits come to match the latest version", () => {
    const { result } = renderStaleForm();

    act(() => result.current.setFieldValue('status', 'published'));
    expect(result.current.isStale).toBe(true); // the title still differs
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.setFieldValue('title', 'Hello'));
    expect(result.current.isStale).toBe(false);
    expect(result.current.isDirty).toBe(false);
  });

  test('an edit that undoes every edit shows the latest version, as a form with no edits does', () => {
    const { result } = renderStaleForm();

    act(() => result.current.setFieldValue('title', 'Hello'));

    expect(result.current.values).toEqual({ ...draft, status: 'published' });
    expect(result.current.isStale).toBe(false);
    expect(result.current.isDirty).toBe(false);
  });

  test('the version shown on such an edit is re-validated, as on any follow', () => {
    const { result, rerender } = renderForm({ validationMode: 'blur' });
    act(() => result.current.setFieldTouched('title'));
    act(() => result.current.setFieldValue('status', 'published'));
    // Someone else cleared the title
    rerender({ initial: { ...draft, title: '' } });
    expect(result.current.isStale).toBe(true);

    act(() => result.current.setFieldValue('status', 'draft'));

    expect(result.current.values.title).toBe('');
    expect(result.current.errors.title).toBe('Title is required');
  });

  test('values that come to equal the latest version count as clean, so the next version is followed', () => {
    const { result, rerender } = renderForm();

    act(() => result.current.setFieldValue('title', 'Mine'));
    // Saved outside handleSubmit, and the saved record passed back in
    rerender({ initial: { ...draft, title: 'Mine' } });
    rerender({ initial: { ...draft, title: 'Mine', status: 'published' } });

    expect(result.current.values).toEqual({ ...draft, title: 'Mine', status: 'published' });
    expect(result.current.isStale).toBe(false);
    expect(result.current.isDirty).toBe(false);
  });

  test('a wrapper that feeds the values back as initialValues follows its own reset', () => {
    const { result } = renderHook(() => {
      const [value, setValue] = useState(draft);
      const form = useForm(publishValidator, {
        initialValues: value,
        onFieldChange: (_field, _value, values) => setValue(values),
      });
      return { form, reset: () => setValue(draft) };
    });

    act(() => result.current.form.setFieldValue('title', 'Mine'));
    act(() => result.current.reset());

    expect(result.current.form.values).toEqual(draft);
    expect(result.current.form.isStale).toBe(false);
  });

  test('reads false while a save runs, and shows again when the save fails', async () => {
    const { onSubmit, saves } = createGatedOnSubmit<PublishForm>();
    const { result, rerender } = renderForm({ onSubmit });

    act(() => result.current.setFieldValue('title', 'Mine'));
    let submitting!: Promise<unknown>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));
    rerender({ initial: { ...draft, status: 'published' } });
    expect(result.current.isStale).toBe(false);

    await act(async () => {
      saves[0]!.resolve(err([{ path: [], message: 'Conflict' }]));
      await submitting;
    });

    expect(result.current.isStale).toBe(true);
    expect(result.current.isDirty).toBe(true);
    expect(result.current.errors._root).toBe('Conflict');
  });
});

describe('saving', () => {
  const CHANGED_WHILE_SAVING =
    'The record changed while saving, so nothing was saved. Review the latest version and save again.';

  /** A form in submit mode, so only the submission calls the gated validator. */
  const renderGatedForm = (
    onSubmit: (values: PublishForm) => void,
    options: Omit<FormOptions<PublishForm>, 'initialValues' | 'onSubmit'> = {},
  ) => {
    const gate = createGatedValidator<PublishForm>();
    const rendered = renderHook(
      ({ initial }: { initial: PublishForm }) =>
        useForm(gate.gated, { initialValues: initial, onSubmit, validationMode: 'submit', ...options }),
      { initialProps: { initial: draft } },
    );
    return { ...rendered, pending: gate.pending };
  };

  test("a version that makes the form stale while the save validates cancels it: onSubmit isn't called", async () => {
    const onSubmit = mock((_values: PublishForm) => {});
    const { result, rerender, pending } = renderGatedForm(onSubmit);

    act(() => result.current.setFieldValue('title', 'Mine'));
    let submitting!: ReturnType<typeof result.current.handleSubmit>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    rerender({ initial: { ...draft, status: 'published' } });
    let outcome!: Awaited<typeof submitting>;
    await act(async () => {
      pending[0]!.resolve(ok({ ...draft, title: 'Mine' }));
      outcome = await submitting;
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(outcome).toEqual(err([{ path: [], message: CHANGED_WHILE_SAVING }]));
    expect(result.current.errors._root).toBe(CHANGED_WHILE_SAVING);
    expect(result.current.isStale).toBe(true);
    expect(result.current.values.title).toBe('Mine');
  });

  test('resetForm() while the save validates lets it go out, with initialValues built inline', async () => {
    const gate = createGatedValidator<PublishForm>();
    const onSubmit = mock((_values: PublishForm) => {});
    const { result } = renderHook(() =>
      useForm(gate.gated, { initialValues: { ...draft }, onSubmit, validationMode: 'submit' }),
    );

    act(() => result.current.setFieldValue('title', 'Mine'));
    let submitting!: ReturnType<typeof result.current.handleSubmit>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    act(() => result.current.resetForm());
    await act(async () => {
      gate.pending[0]!.resolve(ok({ ...draft, title: 'Mine' }));
      await submitting;
    });

    expect(onSubmit).toHaveBeenCalledWith({ ...draft, title: 'Mine' });
    expect(result.current.errors._root).toBeUndefined();
  });

  test('messages.changedWhileSaving replaces the message of a cancelled save', async () => {
    const { result, rerender, pending } = renderGatedForm(() => {}, {
      messages: { changedWhileSaving: 'Otra persona cambió este registro.' },
    });

    act(() => result.current.setFieldValue('title', 'Mine'));
    let submitting!: ReturnType<typeof result.current.handleSubmit>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    rerender({ initial: { ...draft, status: 'published' } });
    let outcome!: Awaited<typeof submitting>;
    await act(async () => {
      pending[0]!.resolve(ok({ ...draft, title: 'Mine' }));
      outcome = await submitting;
    });

    expect(outcome).toEqual(err([{ path: [], message: 'Otra persona cambió este registro.' }]));
    expect(result.current.errors._root).toBe('Otra persona cambió este registro.');
  });

  test('a version followed while the save validates cancels it too', async () => {
    const onSubmit = mock((_values: PublishForm) => {});
    const { result, rerender, pending } = renderGatedForm(onSubmit);

    let submitting!: ReturnType<typeof result.current.handleSubmit>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    rerender({ initial: loaded });
    await act(async () => {
      for (const check of pending) check.resolve(ok(draft));
      await submitting;
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.values).toEqual(loaded);
    expect(result.current.errors._root).toBe(CHANGED_WHILE_SAVING);
  });

  test('a save started while the form shows isStale goes out: the app chose to overwrite', async () => {
    const onSubmit = mock((_values: PublishForm) => {});
    const { result, rerender, pending } = renderGatedForm(onSubmit);

    act(() => result.current.setFieldValue('title', 'Mine'));
    rerender({ initial: { ...draft, status: 'published' } });
    expect(result.current.isStale).toBe(true);
    let submitting!: ReturnType<typeof result.current.handleSubmit>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    await act(async () => {
      pending[0]!.resolve(ok({ ...draft, title: 'Mine' }));
      await submitting;
    });

    expect(onSubmit).toHaveBeenCalledWith({ ...draft, title: 'Mine' });
  });

  test("a failed save's field errors don't land after resetForm() during it, but its submit error does", async () => {
    const { onSubmit, saves } = createGatedOnSubmit<PublishForm>();
    const { result } = renderForm({ onSubmit });

    act(() => result.current.setFieldValue('title', 'Mine'));
    let submitting!: Promise<unknown>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    act(() => result.current.resetForm());
    await act(async () => {
      saves[0]!.resolve(
        err([
          { path: ['title'], message: 'Taken' },
          { path: [], message: 'Down' },
        ]),
      );
      await submitting;
    });

    expect(result.current.serverErrors).toEqual({ _root: 'Down' });
    expect(result.current.touched).toEqual({});
  });

  test("a failed save's field errors don't land on a version followed during it", async () => {
    const { onSubmit, saves } = createGatedOnSubmit<PublishForm>();
    const { result, rerender } = renderForm({ onSubmit });

    let submitting!: Promise<unknown>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    rerender({ initial: loaded });
    await act(async () => {
      saves[0]!.resolve(err([{ path: ['title'], message: 'Taken' }]));
      await submitting;
    });

    expect(result.current.values).toEqual(loaded);
    expect(result.current.serverErrors).toEqual({});
  });

  test('after a save of an unedited form, a later change by someone else still raises isStale', async () => {
    const { result, rerender } = renderForm({ onSubmit: () => {} });

    await act(() => result.current.handleSubmit());
    // The saved record comes back with the same content
    rerender({ initial: { ...draft } });
    act(() => result.current.setFieldValue('title', 'Mine'));
    rerender({ initial: { ...draft, status: 'published' } });

    expect(result.current.isStale).toBe(true);
  });

  test("a submit with no onSubmit saves nothing: the values stay edits, and a newer version doesn't replace them", async () => {
    const { result, rerender } = renderForm();

    act(() => result.current.setFieldValue('title', 'Mine'));
    await act(() => result.current.handleSubmit());
    rerender({ initial: { ...draft, status: 'published' } });

    expect(result.current.values.title).toBe('Mine');
    expect(result.current.isStale).toBe(true);
  });

  test("a failed save's field error doesn't land on a field edited during the save; the others do", async () => {
    const { onSubmit, saves } = createGatedOnSubmit<PublishForm>();
    const { result } = renderForm({ onSubmit });

    act(() => result.current.setFieldValue('title', 'Taken'));
    let submitting!: Promise<unknown>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    act(() => result.current.setFieldValue('title', 'Free'));
    await act(async () => {
      saves[0]!.resolve(
        err([
          { path: ['title'], message: 'Title taken' },
          { path: ['status'], message: 'Not allowed' },
          { path: [], message: 'Not saved' },
        ]),
      );
      await submitting;
    });

    expect(result.current.serverErrors).toEqual({ status: 'Not allowed', _root: 'Not saved' });
    expect(result.current.isValid).toBe(false);
  });

  test('follows a saved record that differs from the submitted values', async () => {
    const { result, rerender } = renderForm({ onSubmit: () => {} });

    act(() => result.current.setFieldValue('title', ' Mine '));
    await act(() => result.current.handleSubmit());
    rerender({ initial: { ...draft, title: 'Mine' } });

    expect(result.current.values.title).toBe('Mine');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isStale).toBe(false);
  });

  test('keeps typing done during a save, without isStale, when the saved record arrives', async () => {
    const { onSubmit, saves } = createGatedOnSubmit<PublishForm>();
    const { result, rerender } = renderForm({ onSubmit });

    act(() => result.current.setFieldValue('title', 'A'));
    let submitting!: Promise<unknown>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    act(() => result.current.setFieldValue('title', 'AB'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await act(async () => {
      saves[0]!.resolve(undefined);
      await submitting;
    });
    rerender({ initial: { ...draft, title: 'A' } });

    expect(result.current.values.title).toBe('AB');
    expect(result.current.isStale).toBe(false);
    expect(result.current.isDirty).toBe(true);
  });

  test("keeps edits through an optimistic write and a failed save's rollback", async () => {
    const { onSubmit, saves } = createGatedOnSubmit<PublishForm>();
    const { result, rerender } = renderForm({ onSubmit });

    act(() => result.current.setFieldValue('title', 'Mine'));
    let submitting!: Promise<unknown>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    // onSubmit's mutation writes the typed values to the cache, and rolls them back once the save has failed
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    rerender({ initial: { ...draft, title: 'Mine' } });
    await act(async () => {
      saves[0]!.resolve(err([{ path: [], message: 'Conflict' }]));
      await submitting;
    });
    rerender({ initial: draft });

    expect(result.current.values.title).toBe('Mine');
    expect(result.current.isStale).toBe(false);
    expect(result.current.errors._root).toBe('Conflict');
  });

  test('resetForm() inside onSubmit, then the saved record arrives: the form follows it', async () => {
    let form!: UseFormReturn<PublishForm>;
    const { result, rerender } = renderHook(
      ({ initial }: { initial: PublishForm }) => {
        const current = useForm(publishValidator, {
          initialValues: initial,
          onSubmit: () => {
            form.resetForm();
          },
        });
        form = current;
        return current;
      },
      { initialProps: { initial: draft } },
    );

    act(() => result.current.setFieldValue('title', 'Mine'));
    await act(() => result.current.handleSubmit());
    rerender({ initial: { ...draft, title: 'Mine' } });

    expect(result.current.values.title).toBe('Mine');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isStale).toBe(false);
  });

  test('follows a saved record that arrives before onSubmit returns', async () => {
    const { onSubmit, saves } = createGatedOnSubmit<PublishForm>();
    const { result, rerender } = renderForm({ onSubmit });

    act(() => result.current.setFieldValue('title', ' Mine '));
    let submitting!: Promise<unknown>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));
    rerender({ initial: { ...draft, title: 'Mine' } });
    expect(result.current.isStale).toBe(false);

    await act(async () => {
      saves[0]!.resolve(undefined);
      await submitting;
    });

    expect(result.current.values.title).toBe('Mine');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isStale).toBe(false);
  });

  test('bases typing done during a save on a saved record that arrives before onSubmit returns', async () => {
    const { onSubmit, saves } = createGatedOnSubmit<PublishForm>();
    const { result, rerender } = renderForm({ onSubmit });

    act(() => result.current.setFieldValue('title', 'A'));
    let submitting!: Promise<unknown>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));
    act(() => result.current.setFieldValue('title', 'AB'));
    rerender({ initial: { ...draft, title: 'A' } });
    await act(async () => {
      saves[0]!.resolve(undefined);
      await submitting;
    });

    expect(result.current.values.title).toBe('AB');
    expect(result.current.isStale).toBe(false);
    expect(result.current.isDirty).toBe(true);

    // The saved record is the base, so another user's later change still shows
    rerender({ initial: { ...draft, title: 'A', status: 'published' } });
    expect(result.current.isStale).toBe(true);
    expect(result.current.isDirty).toBe(true);
  });

  test('a follow on a successful save re-validates like any follow', async () => {
    const { onSubmit, saves } = createGatedOnSubmit<PublishForm>();
    const { result, rerender } = renderForm({ onSubmit, validationMode: 'live' });

    act(() => result.current.setFieldValue('title', 'Mine'));
    let submitting!: Promise<unknown>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));
    rerender({ initial: { ...draft, title: '' } });
    await act(async () => {
      saves[0]!.resolve(undefined);
      await submitting;
    });

    expect(result.current.values.title).toBe('');
    expect(result.current.clientErrors.title).toBe('Title is required');
  });

  describe("the base coming back during a save isn't followed as the save's answer", () => {
    /** Saves edits made on a stale form, while the version the edits started from comes back as `base`. */
    const saveWhileTheBaseComesBack = async (base: PublishForm) => {
      const { onSubmit, saves } = createGatedOnSubmit<PublishForm>();
      const { result, rerender } = renderForm({ onSubmit });

      act(() => result.current.setFieldValue('title', 'Mine'));
      rerender({ initial: { ...draft, status: 'published' } });
      let submitting!: Promise<unknown>;
      act(() => {
        submitting = result.current.handleSubmit();
      });
      await waitFor(() => expect(result.current.isSubmitting).toBe(true));
      rerender({ initial: base });
      await act(async () => {
        saves[0]!.resolve(undefined);
        await submitting;
      });

      return result;
    };

    test('as the same object', async () => {
      const result = await saveWhileTheBaseComesBack(draft);

      expect(result.current.values.title).toBe('Mine');
      expect(result.current.isDirty).toBe(true);
      expect(result.current.isStale).toBe(false);
    });

    test('as a new object with the same content', async () => {
      const result = await saveWhileTheBaseComesBack({ ...draft });

      expect(result.current.values.title).toBe('Mine');
      expect(result.current.isDirty).toBe(true);
      expect(result.current.isStale).toBe(false);
    });
  });

  test("a change undone during a save, then typing, doesn't make the save's answer raise isStale", async () => {
    const { onSubmit, saves } = createGatedOnSubmit<PublishForm>();
    const { result, rerender } = renderForm({ onSubmit });

    act(() => result.current.setFieldValue('title', 'Mine'));
    let submitting!: Promise<unknown>;
    act(() => {
      submitting = result.current.handleSubmit();
    });
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));
    // Someone else changes the record and undoes it, each version a new object
    rerender({ initial: { ...draft, status: 'published' } });
    rerender({ initial: { ...draft } });
    act(() => result.current.setFieldValue('title', 'Mine more'));
    await act(async () => {
      saves[0]!.resolve(undefined);
      await submitting;
    });
    // The save's answer
    rerender({ initial: { ...draft, title: 'Mine' } });

    expect(result.current.values.title).toBe('Mine more');
    expect(result.current.isStale).toBe(false);
    expect(result.current.isDirty).toBe(true);
  });

  describe('savedValues', () => {
    /** A form whose onSubmit returns the record the server stored, and savedValues reads it. */
    const renderSavingForm = () => {
      const gate = createGatedOnSubmit<PublishForm>();
      const rendered = renderForm({ onSubmit: gate.onSubmit, savedValues: (saved) => saved });
      return { ...rendered, saves: gate.saves, onSubmit: gate.onSubmit };
    };

    /** Starts a save of ' Mine ', which the server trims. */
    const startSave = async (rendered: ReturnType<typeof renderSavingForm>) => {
      act(() => rendered.result.current.setFieldValue('title', ' Mine '));
      let submitting!: Promise<unknown>;
      act(() => {
        submitting = rendered.result.current.handleSubmit();
      });
      await waitFor(() => expect(rendered.onSubmit).toHaveBeenCalledTimes(1));
      return async () => {
        await act(async () => {
          rendered.saves[0]!.resolve(ok({ ...draft, title: 'Mine' }));
          await submitting;
        });
      };
    };

    test('a refetched record without an optional key is the answer to a save of values without it', async () => {
      // The schema trims, so the record the server stores differs from the typed values
      const schema = object({
        name: required(
          chain(
            string(),
            transform((name: string) => name.trim()),
          ),
        ),
        age: optional(number()),
      });
      // onSubmit returns nothing, so savedValues reads the validated values: no age key, as the form values have none
      const { result, rerender } = renderHook(
        ({ initial }: { initial: { name: string; age?: number | undefined } }) =>
          useForm(schema, { initialValues: initial, onSubmit: () => {}, savedValues: (saved) => saved }),
        { initialProps: { initial: { name: 'a' } } },
      );

      act(() => result.current.setFieldValue('name', ' b '));
      await act(async () => {
        await result.current.handleSubmit();
      });
      act(() => result.current.setFieldValue('name', 'c'));
      rerender({ initial: { name: 'b' } });

      expect(result.current.isStale).toBe(false);
      expect(result.current.values).toStrictEqual({ name: 'c' });
    });

    test("an optimistic copy of the saved values isn't taken for the save's answer, with typing during the save", async () => {
      const rendered = renderSavingForm();
      const finish = await startSave(rendered);
      // onSubmit writes the submitted values to the cache before the request ends
      rendered.rerender({ initial: { ...draft, title: ' Mine ' } });
      act(() => rendered.result.current.setFieldValue('status', 'published'));
      await finish();

      rendered.rerender({ initial: { ...draft, title: 'Mine' } });

      expect(rendered.result.current.isStale).toBe(false);
      expect(rendered.result.current.values).toEqual({ ...draft, title: ' Mine ', status: 'published' });
    });

    test('nor with typing after it, and the form follows the answer when nothing was typed', async () => {
      const typed = renderSavingForm();
      const finishTyped = await startSave(typed);
      typed.rerender({ initial: { ...draft, title: ' Mine ' } });
      await finishTyped();
      act(() => typed.result.current.setFieldValue('status', 'published'));
      typed.rerender({ initial: { ...draft, title: 'Mine' } });
      expect(typed.result.current.isStale).toBe(false);

      const untouched = renderSavingForm();
      const finishUntouched = await startSave(untouched);
      untouched.rerender({ initial: { ...draft, title: ' Mine ' } });
      await finishUntouched();
      untouched.rerender({ initial: { ...draft, title: 'Mine' } });
      expect(untouched.result.current.values.title).toBe('Mine');
      expect(untouched.result.current.isDirty).toBe(false);
    });

    test('a saved record equal to the version before the save is followed, and a later change still shows', async () => {
      const { result, rerender, saves, onSubmit } = renderSavingForm();

      act(() => result.current.setFieldValue('title', ' Hello '));
      let submitting!: Promise<unknown>;
      act(() => {
        submitting = result.current.handleSubmit();
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      await act(async () => {
        saves[0]!.resolve(ok({ ...draft }));
        await submitting;
      });

      expect(result.current.values.title).toBe('Hello');
      expect(result.current.isDirty).toBe(false);

      act(() => result.current.setFieldValue('title', 'Mine'));
      rerender({ initial: { ...draft, status: 'published' } });
      expect(result.current.isStale).toBe(true);
    });

    test('one that throws is logged, the save still succeeds, and the next version is taken for its answer', async () => {
      const consoleError = spyOn(console, 'error').mockImplementation(() => {});
      const boom = new Error('boom');
      const { onSubmit, saves } = createGatedOnSubmit<PublishForm>();
      const { result, rerender } = renderForm({
        onSubmit,
        savedValues: () => {
          throw boom;
        },
      });

      act(() => result.current.setFieldValue('title', ' Mine '));
      let submitting!: ReturnType<typeof result.current.handleSubmit>;
      act(() => {
        submitting = result.current.handleSubmit();
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      let outcome!: Awaited<typeof submitting>;
      await act(async () => {
        saves[0]!.resolve(ok({ ...draft, title: 'Mine' }));
        outcome = await submitting;
      });

      expect(outcome).toEqual(ok({ ...draft, title: 'Mine' }));
      expect(result.current.errors._root).toBeUndefined();
      expect(consoleError).toHaveBeenCalledWith('Form submission error:', boom);

      rerender({ initial: { ...draft, title: 'Mine' } });
      expect(result.current.values.title).toBe('Mine');
      expect(result.current.isStale).toBe(false);
      consoleError.mockRestore();
    });

    test("a change by someone else that arrives during the save shows, until the save's answer arrives after it", async () => {
      const rendered = renderSavingForm();
      const finish = await startSave(rendered);
      rendered.rerender({ initial: { ...draft, status: 'published' } });
      act(() => rendered.result.current.setFieldValue('tags', ['x']));
      await finish();

      expect(rendered.result.current.isStale).toBe(true);

      // The save's answer is newer than their change
      rendered.rerender({ initial: { ...draft, title: 'Mine' } });
      expect(rendered.result.current.isStale).toBe(false);
    });
  });

  describe("a second Save while the first save's answer is pending", () => {
    /** Saves ' Mine ' once, with its answer still to come, then starts a second Save held in its field check. */
    const startSecondSave = async () => {
      const { calls, gate } = createGatedFieldValidator();
      const onSubmit = mock((_values: PublishForm) => {});
      const rendered = renderForm({ onSubmit, validationMode: 'submit', fieldValidators: { title: () => gate() } });
      const { result } = rendered;

      act(() => result.current.setFieldValue('title', ' Mine '));
      let first!: ReturnType<typeof result.current.handleSubmit>;
      act(() => {
        first = result.current.handleSubmit();
      });
      await waitFor(() => expect(calls).toHaveLength(1));
      await act(async () => {
        calls[0]!.resolve(undefined);
        await first;
      });
      expect(result.current.isDirty).toBe(true);

      let second!: ReturnType<typeof result.current.handleSubmit>;
      act(() => {
        second = result.current.handleSubmit();
      });
      await waitFor(() => expect(calls).toHaveLength(2));
      const finish = async () => {
        let outcome!: Awaited<typeof second>;
        await act(async () => {
          calls[1]!.resolve(undefined);
          outcome = await second;
        });
        return outcome;
      };
      return { ...rendered, onSubmit, finish };
    };

    test("isn't cancelled when that answer arrives during it", async () => {
      const { result, rerender, onSubmit, finish } = await startSecondSave();

      // The first save's answer, trimmed by the server
      rerender({ initial: { ...draft, title: 'Mine' } });
      const outcome = await finish();

      expect(outcome).toEqual(ok({ ...draft, title: ' Mine ' }));
      expect(onSubmit).toHaveBeenCalledTimes(2);
      expect(result.current.errors._root).toBeUndefined();
    });

    test('is cancelled by a change from someone else that arrives after that answer', async () => {
      const { result, rerender, onSubmit, finish } = await startSecondSave();

      rerender({ initial: { ...draft, title: 'Mine' } });
      rerender({ initial: { ...draft, title: 'Mine', status: 'published' } });
      const outcome = await finish();

      expect(outcome).toEqual(err([{ path: [], message: CHANGED_WHILE_SAVING }]));
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(result.current.errors._root).toBe(CHANGED_WHILE_SAVING);
    });
  });

  test('a saved record equal to the version before the save keeps the typed values', async () => {
    const { result, rerender } = renderForm({ onSubmit: () => {} });

    act(() => result.current.setFieldValue('title', 'Hello '));
    await act(() => result.current.handleSubmit());
    // The server trims the title back to the version the form already had. By content, that can't be told
    // apart from the same data rendered again, so the form stays dirty (a documented gap)
    rerender({ initial: { ...draft } });

    expect(result.current.values.title).toBe('Hello ');
    expect(result.current.isDirty).toBe(true);
    expect(result.current.isStale).toBe(false);
  });

  describe("back-to-back saves, the first one's answer arriving during the second", () => {
    /** Saves `First`, then queues a save of `second` that starts once the first succeeds, before its answer. */
    const saveTwice = async (second: string) => {
      const { onSubmit, saves } = createGatedOnSubmit<PublishForm>();
      const rendered = renderForm({ onSubmit });
      const { result } = rendered;

      act(() => result.current.setFieldValue('title', 'First'));
      act(() => {
        void result.current.handleSubmit();
      });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      act(() => result.current.setFieldValue('title', second));
      act(() => {
        void result.current.handleSubmit();
      });
      await act(async () => {
        saves[0]!.resolve(undefined);
        await nextTask();
      });
      expect(onSubmit).toHaveBeenCalledTimes(2);

      return { ...rendered, saves };
    };

    test("the second save's success isn't read as the answer to the first", async () => {
      const { result, rerender, saves } = await saveTwice(' Second ');

      rerender({ initial: { ...draft, title: 'First' } });
      await act(async () => {
        saves[1]!.resolve(undefined);
        await nextTask();
      });

      expect(result.current.values.title).toBe(' Second ');

      // The second save's answer is followed
      rerender({ initial: { ...draft, title: 'Second' } });
      expect(result.current.values.title).toBe('Second');
      expect(result.current.isDirty).toBe(false);
      expect(result.current.isStale).toBe(false);
    });

    test("typing during the second save doesn't make its answer raise isStale", async () => {
      const { result, rerender, saves } = await saveTwice('Second');

      rerender({ initial: { ...draft, title: 'First' } });
      act(() => result.current.setFieldValue('title', 'Second and more'));
      await act(async () => {
        saves[1]!.resolve(undefined);
        await nextTask();
      });
      rerender({ initial: { ...draft, title: 'Second' } });

      expect(result.current.values.title).toBe('Second and more');
      expect(result.current.isStale).toBe(false);
      expect(result.current.isDirty).toBe(true);
    });
  });
});

describe('state identity', () => {
  test('a follow changes errors and serverErrors once', () => {
    const runs = { errors: 0, serverErrors: 0 };
    const { result, rerender } = renderHook(
      ({ initial }: { initial: PublishForm }) => {
        // blur mode, with title touched by the server error: the follow re-validates, and its valid result keeps
        // clientErrors as they were, so only the follow's own change shows
        const form = useForm(publishValidator, { initialValues: initial, validationMode: 'blur' });
        useEffect(() => {
          runs.errors += 1;
        }, [form.errors]);
        useEffect(() => {
          runs.serverErrors += 1;
        }, [form.serverErrors]);
        return form;
      },
      { initialProps: { initial: draft } },
    );
    act(() => result.current.setServerErrors([{ path: ['title'], message: 'Taken' }]));
    runs.errors = 0;
    runs.serverErrors = 0;

    rerender({ initial: loaded });

    expect(result.current.values).toEqual(loaded);
    expect(result.current.serverErrors).toEqual({});
    expect(runs).toEqual({ errors: 1, serverErrors: 1 });
  });

  test('a resetKey change changes touched once', () => {
    let runs = 0;
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => {
        const form = useForm(publishValidator, { initialValues: draft, resetKey: id });
        useEffect(() => {
          runs += 1;
        }, [form.touched]);
        return form;
      },
      { initialProps: { id: 'a' } },
    );
    act(() => result.current.setFieldTouched('title'));
    runs = 0;

    rerender({ id: 'b' });

    expect(result.current.touched).toEqual({});
    expect(runs).toBe(1);
  });
});

describe('initialValues that changes on its own', () => {
  let consoleError: ReturnType<typeof spyOn<Console, 'error'>>;

  beforeEach(() => {
    consoleError = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  /** How many times this form's message was logged. React reports caught errors to console.error too. */
  const reports = () =>
    consoleError.mock.calls.filter(
      ([message]) => typeof message === 'string' && message.includes('keeps changing along with'),
    ).length;

  /** A random id still loops until React's own update-depth error ends it. Those tests render through this. */
  class Boundary extends Component<{ children: ReactNode }, { message?: string }> {
    override state: { message?: string } = {};
    static getDerivedStateFromError(error: unknown) {
      return { message: error instanceof Error ? error.message : String(error) };
    }
    override render() {
      return this.state.message ?? this.props.children;
    }
  }

  test("a random id logs the message within one cascade, and React's update-depth error ends the loop", () => {
    const Generated = () => {
      // eslint-disable-next-line @eslint-react/purity -- the impure render is the case under test
      const form = useForm(publishValidator, { initialValues: { ...draft, title: crypto.randomUUID() } });
      return <output>{form.values.status}</output>;
    };
    const { container, rerender } = render(
      <Boundary>
        <Generated />
      </Boundary>,
    );

    rerender(
      <Boundary>
        <Generated />
      </Boundary>,
    );

    expect(reports()).toBe(1);
    expect(container.textContent).toContain('Maximum update depth exceeded');
  });

  test('logs it when the app also writes to the form after every change', () => {
    const Generated = () => {
      // eslint-disable-next-line @eslint-react/purity -- the impure render is the case under test
      const form = useForm(publishValidator, { initialValues: { ...draft, title: crypto.randomUUID() } });
      const { values, setFieldTouched } = form;
      useEffect(() => {
        setFieldTouched('title', true, false);
      }, [values, setFieldTouched]);
      return <output>{form.values.status}</output>;
    };
    const { container, rerender } = render(
      <Boundary>
        <Generated />
      </Boundary>,
    );

    rerender(
      <Boundary>
        <Generated />
      </Boundary>,
    );

    expect(reports()).toBe(1);
    expect(container.textContent).toContain('Maximum update depth exceeded');
  });

  test('a value that changes between form updates logs on the third update, once, and the form keeps working', () => {
    // Stands in for new Date() with a counter the test controls, so the clock can't make it flaky
    let clock = 0;
    const Clocked = () => {
      const form = useForm(publishValidator, { initialValues: { ...draft, title: `t${clock}` } });
      return <input aria-label="status" {...form.getFieldProps('status')} />;
    };
    const { getByLabelText } = render(<Clocked />);
    const type = (value: string, tick: boolean) => {
      if (tick) clock += 1;
      fireEvent.change(getByLabelText('status'), { target: { value } });
    };

    type('a', true);
    type('b', true);
    type('c', false); // initialValues held still: the count resets
    type('d', true);
    type('e', true);
    expect(reports()).toBe(0);

    type('f', true);
    expect(reports()).toBe(1);

    type('g', true);
    expect(reports()).toBe(1);
    expect((getByLabelText('status') as HTMLInputElement).value).toBe('g');
  });

  test('logs it when the parent also re-renders from onValuesChange', () => {
    // Stands in for new Date() at typing speed: it moves before each keystroke, and before the render that
    // onValuesChange causes
    let clock = 0;
    const Previewed = () => {
      const [preview, setPreview] = useState('');
      const form = useForm(publishValidator, {
        initialValues: { ...draft, title: `t${clock}` },
        onValuesChange: (values) => {
          if (values.status !== draft.status) clock += 1;
          setPreview(values.status);
        },
      });
      return (
        <>
          <input aria-label="status" {...form.getFieldProps('status')} />
          <output>{preview}</output>
        </>
      );
    };
    const { getByLabelText } = render(<Previewed />);
    const type = (value: string) => {
      clock += 1;
      fireEvent.change(getByLabelText('status'), { target: { value } });
    };

    type('a');
    type('b');
    type('c');

    expect(reports()).toBe(1);
  });

  test("a wrapper that feeds the values back as initialValues logs nothing: the version echoes the form's values", () => {
    const Controlled = () => {
      const [value, setValue] = useState(draft);
      const form = useForm(publishValidator, {
        initialValues: value,
        onFieldChange: (_field, _value, values) => setValue(values),
      });
      return <input aria-label="title" {...form.getFieldProps('title')} />;
    };
    const { getByLabelText } = render(<Controlled />);

    for (const value of ['a', 'ab', 'abc', 'abcd']) fireEvent.change(getByLabelText('title'), { target: { value } });

    expect((getByLabelText('title') as HTMLInputElement).value).toBe('abcd');
    expect(reports()).toBe(0);
  });

  test("a parent's layout effect that adjusts initialValues during a follow logs nothing", () => {
    const Child = ({ data, extra }: { data: PublishForm; extra: number }) => {
      const form = useForm(publishValidator, { initialValues: { ...data, tags: [String(extra)] } });
      return <output data-testid="tags">{form.values.tags.join(',')}</output>;
    };
    const Parent = ({ data }: { data: PublishForm }) => {
      const [extra, setExtra] = useState(0);
      useLayoutEffect(() => {
        // eslint-disable-next-line @eslint-react/set-state-in-effect -- the layout-effect update is the case under test
        setExtra(data.title.length);
      }, [data]);
      return <Child data={data} extra={extra} />;
    };
    const { getByTestId, rerender } = render(<Parent data={draft} />);

    rerender(<Parent data={loaded} />);

    expect(getByTestId('tags').textContent).toBe('6');
    expect(reports()).toBe(0);
  });
});
