import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../../src/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    // Use fake timers for testing
    mock.module('bun:test', () => ({
      useFakeTimers: () => {},
    }));
  });

  afterEach(() => {
    mock.restore();
  });

  test('calls callback after delay', async () => {
    const callback = mock((_value: string) => {});
    const { result } = renderHook(() => useDebounce(callback, 500));

    // Call the debounced function
    act(() => {
      result.current('test value');
    });

    // Callback should not be called immediately
    expect(callback).not.toHaveBeenCalled();

    // Wait for debounce delay
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Callback should be called with the value
    expect(callback).toHaveBeenCalledWith('test value');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('cancels previous timeout on rapid calls', async () => {
    const callback = mock((_value: string) => {});
    const { result } = renderHook(() => useDebounce(callback, 500));

    // Call multiple times rapidly
    act(() => {
      result.current('value1');
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    act(() => {
      result.current('value2');
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    act(() => {
      result.current('value3');
    });

    // Wait for debounce delay
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Only the last call should be executed
    expect(callback).toHaveBeenCalledWith('value3');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('updates debounced function when callback changes', async () => {
    const callback1 = mock((_value: string) => {});
    const callback2 = mock((_value: string) => {});

    const { result, rerender } = renderHook(
      ({ cb, delay }) => useDebounce(cb, delay),
      {
        initialProps: { cb: callback1, delay: 500 },
      }
    );

    // Call with first callback
    act(() => {
      result.current('test1');
    });

    // Change callback
    rerender({ cb: callback2, delay: 500 });

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Second callback should be called (not first)
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledWith('test1');
  });

  test('cleans up timeout on unmount', async () => {
    const callback = mock((_value: string) => {});
    const { result, unmount } = renderHook(() => useDebounce(callback, 500));

    // Call the debounced function
    act(() => {
      result.current('test value');
    });

    // Unmount before delay completes
    unmount();

    // Wait past the delay
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Callback should not be called
    expect(callback).not.toHaveBeenCalled();
  });

  test('handles zero delay', async () => {
    const callback = mock((_value: string) => {});
    const { result } = renderHook(() => useDebounce(callback, 0));

    act(() => {
      result.current('test value');
    });

    // Even with 0 delay, it should still use setTimeout
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(callback).toHaveBeenCalledWith('test value');
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
