import { useRef, useCallback, useEffect, useInsertionEffect } from 'react';

/**
 * A React hook that debounces a callback function, delaying its execution until after
 * a specified delay period has elapsed since the last time it was invoked.
 *
 * Useful for optimizing performance by limiting the rate at which a function is called,
 * such as in response to rapid user input or scroll events.
 *
 * Unmounting cancels a call still waiting, and a call made after unmount does nothing, such as one from a
 * promise that settles later.
 *
 * @template T - The callback function type
 * @template Params - The parameter types of the callback function
 * @template Return - The return type of the callback function
 *
 * @param callback - The function to debounce
 * @param delay - The number of milliseconds to delay execution
 * @returns A debounced version of the callback function that can be called with the same parameters
 *
 * @example
 * // Debounce a search function
 * const debouncedSearch = useDebounce((query: string) => {
 *   fetchSearchResults(query);
 * }, 300);
 *
 * @example
 * // Use in an input handler
 * const handleInputChange = useDebounce((value: string) => {
 *   form.setFieldValue('search', value);
 * }, 500);
 */
export function useDebounce<
  T extends (...args: Params) => Return,
  Params extends unknown[] = Parameters<T>,
  Return = ReturnType<T>,
>(callback: T, delay: number): (...args: Params) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const unmountedRef = useRef(false);

  // Keep callback ref up-to-date. An insertion effect runs before any layout or passive effect of the commit,
  // so a timer that comes due after a commit never runs the previous render's callback.
  useInsertionEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cancel the waiting call on unmount. Set again on mount, as StrictMode remounts.
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Params) => {
      if (unmountedRef.current) return;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay],
  );
}
