import { describe, test, expect } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import * as S from '@railway-ts/pipelines/schema';
import { useForm } from '../../src/useForm';

const tupleSchema = S.object({
  r1: S.required(S.tupleOf(S.chain(S.parseNumber(), S.positive()), 3)),
});

type TupleValues = S.InferSchemaType<typeof tupleSchema>;

describe('tuple/array path keys', () => {
  const failingValues: TupleValues = { r1: [-1, 0, 0] };

  test('schema errors land at canonical dot keys after submit', async () => {
    const { result } = renderHook(() =>
      useForm(tupleSchema, { initialValues: failingValues }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.errors['r1.0']).toBeDefined();
    expect(result.current.errors['r1[0]']).toBeUndefined();
  });

  test('getFieldError finds the schema error using the dot-form path', async () => {
    const { result } = renderHook(() =>
      useForm(tupleSchema, { initialValues: failingValues }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.touched['r1.0']).toBe(true);
    expect(result.current.getFieldError('r1.0')).toBeDefined();
  });

  test('bracket-form callers still resolve to the same canonical entry', () => {
    const { result } = renderHook(() =>
      useForm(tupleSchema, { initialValues: failingValues }),
    );

    act(() => {
      result.current.setFieldTouched('r1[0]', true);
    });

    expect(result.current.touched['r1.0']).toBe(true);
    expect(result.current.touched['r1[0]']).toBeUndefined();
  });

  test('getFieldError accepts bracket-form input and resolves to the canonical entry', async () => {
    const { result } = renderHook(() =>
      useForm(tupleSchema, { initialValues: failingValues }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    const dotForm = result.current.getFieldError('r1.0');
    const bracketForm = (result.current.getFieldError as (f: string) => string | undefined)('r1[0]');

    expect(dotForm).toBeDefined();
    expect(bracketForm).toBe(dotForm);
  });

  test('blur on tuple field triggers validation and surfaces the error', () => {
    const { result } = renderHook(() =>
      useForm(tupleSchema, {
        initialValues: failingValues,
        validationMode: 'blur',
      }),
    );

    const props = result.current.getFieldProps('r1.0');

    act(() => {
      props.onBlur();
    });

    expect(result.current.touched['r1.0']).toBe(true);
    expect(result.current.getFieldError('r1.0')).toBeDefined();
  });
});
