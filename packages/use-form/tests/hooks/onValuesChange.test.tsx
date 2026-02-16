import { describe, test, expect, mock } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useForm } from '../../src/useForm';
import { alwaysValidValidator } from '../fixtures/validators';

// =========================================================================
// onValuesChange
// =========================================================================

describe('onValuesChange', () => {
  test('fires on mount with (initialValues, initialValues)', () => {
    const spy = mock(() => {});

    renderHook(() =>
      useForm(alwaysValidValidator, {
        initialValues: { name: 'Apollo' },
        onValuesChange: spy,
      })
    );

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ name: 'Apollo' }, { name: 'Apollo' });
  });

  test('provides previous values on field change', () => {
    const spy = mock(() => {});

    const { result } = renderHook(() =>
      useForm(alwaysValidValidator, {
        initialValues: { name: 'Apollo' },
        onValuesChange: spy,
      })
    );

    spy.mockClear();

    act(() => {
      result.current.setFieldValue('name', 'Gemini');
    });

    expect(spy).toHaveBeenCalledWith({ name: 'Gemini' }, { name: 'Apollo' });
  });

  test('tracks prevValues across multiple changes', () => {
    const spy = mock(() => {});

    const { result } = renderHook(() =>
      useForm(alwaysValidValidator, {
        initialValues: { name: '' },
        onValuesChange: spy,
      })
    );

    spy.mockClear();

    act(() => result.current.setFieldValue('name', 'A'));
    act(() => result.current.setFieldValue('name', 'AB'));

    expect(spy).toHaveBeenNthCalledWith(1, { name: 'A' }, { name: '' });
    expect(spy).toHaveBeenNthCalledWith(2, { name: 'AB' }, { name: 'A' });
  });

  test('fires on resetForm with initialValues', () => {
    const spy = mock(() => {});

    const { result } = renderHook(() =>
      useForm(alwaysValidValidator, {
        initialValues: { name: 'Original' },
        onValuesChange: spy,
      })
    );

    act(() => result.current.setFieldValue('name', 'Changed'));
    spy.mockClear();

    act(() => result.current.resetForm());

    expect(spy).toHaveBeenCalledWith({ name: 'Original' }, { name: 'Changed' });
  });

  test('fires on setValues', () => {
    const spy = mock(() => {});

    const { result } = renderHook(() =>
      useForm(alwaysValidValidator, {
        initialValues: { name: '' },
        onValuesChange: spy,
      })
    );

    spy.mockClear();

    act(() => result.current.setValues({ name: 'Mercury' }));

    expect(spy).toHaveBeenCalledWith({ name: 'Mercury' }, { name: '' });
  });

  test('handles inline functions without infinite loops', () => {
    const spy = mock(() => {});

    const { rerender } = renderHook(
      ({ cb }) =>
        useForm(alwaysValidValidator, {
          initialValues: { name: '' },
          onValuesChange: cb,
        }),
      { initialProps: { cb: spy } }
    );

    spy.mockClear();

    // Re-render with new function identity — should NOT fire again
    rerender({ cb: mock(() => {}) });

    expect(spy).not.toHaveBeenCalled();
  });

  test('is optional — no error when omitted', () => {
    expect(() => {
      renderHook(() =>
        useForm(alwaysValidValidator, { initialValues: { name: '' } })
      );
    }).not.toThrow();
  });
});

// =========================================================================
// onFieldChange
// =========================================================================

describe('onFieldChange', () => {
  test('does NOT fire on mount', () => {
    const spy = mock(() => {});

    renderHook(() =>
      useForm(alwaysValidValidator, {
        initialValues: { name: 'Apollo' },
        onFieldChange: spy,
      })
    );

    expect(spy).not.toHaveBeenCalled();
  });

  test('fires with field path, value, and computed next values', () => {
    const spy = mock(() => {});

    const { result } = renderHook(() =>
      useForm(alwaysValidValidator, {
        initialValues: { name: '' },
        onFieldChange: spy,
      })
    );

    act(() => {
      result.current.setFieldValue('name', 'Gemini');
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('name', 'Gemini', { name: 'Gemini' });
  });

  test('does NOT fire on setValues (batch update)', () => {
    const spy = mock(() => {});

    const { result } = renderHook(() =>
      useForm(alwaysValidValidator, {
        initialValues: { name: '' },
        onFieldChange: spy,
      })
    );

    act(() => {
      result.current.setValues({ name: 'Batch' });
    });

    expect(spy).not.toHaveBeenCalled();
  });

  test('does NOT fire on resetForm', () => {
    const spy = mock(() => {});

    const { result } = renderHook(() =>
      useForm(alwaysValidValidator, {
        initialValues: { name: 'Original' },
        onFieldChange: spy,
      })
    );

    act(() => result.current.setFieldValue('name', 'Changed'));
    spy.mockClear();

    act(() => result.current.resetForm());

    expect(spy).not.toHaveBeenCalled();
  });

  test('fires for each individual setFieldValue call', () => {
    const spy = mock(() => {});

    const { result } = renderHook(() =>
      useForm(alwaysValidValidator, {
        initialValues: { name: '' },
        onFieldChange: spy,
      })
    );

    act(() => {
      result.current.setFieldValue('name', 'A');
      result.current.setFieldValue('name', 'AB');
    });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, 'name', 'A', { name: 'A' });
    expect(spy).toHaveBeenNthCalledWith(2, 'name', 'AB', { name: 'AB' });
  });

  test('is optional — no error when omitted', () => {
    expect(() => {
      renderHook(() =>
        useForm(alwaysValidValidator, { initialValues: { name: '' } })
      );
    }).not.toThrow();
  });
});

// =========================================================================
// Both callbacks together
// =========================================================================

describe('onValuesChange + onFieldChange together', () => {
  test('both fire on setFieldValue', () => {
    const valuesSpy = mock(() => {});
    const fieldSpy = mock(() => {});

    const { result } = renderHook(() =>
      useForm(alwaysValidValidator, {
        initialValues: { name: '' },
        onValuesChange: valuesSpy,
        onFieldChange: fieldSpy,
      })
    );

    valuesSpy.mockClear();

    act(() => {
      result.current.setFieldValue('name', 'Both');
    });

    // onFieldChange fires synchronously from setFieldValue
    expect(fieldSpy).toHaveBeenCalledWith('name', 'Both', { name: 'Both' });

    // onValuesChange fires via useEffect after state update
    expect(valuesSpy).toHaveBeenCalledWith({ name: 'Both' }, { name: '' });
  });

  test('only onValuesChange fires on setValues', () => {
    const valuesSpy = mock(() => {});
    const fieldSpy = mock(() => {});

    const { result } = renderHook(() =>
      useForm(alwaysValidValidator, {
        initialValues: { name: '' },
        onValuesChange: valuesSpy,
        onFieldChange: fieldSpy,
      })
    );

    valuesSpy.mockClear();

    act(() => {
      result.current.setValues({ name: 'Batch' });
    });

    expect(valuesSpy).toHaveBeenCalled();
    expect(fieldSpy).not.toHaveBeenCalled();
  });
});
