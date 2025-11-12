import { useRef, useCallback, useEffect } from 'react';

/**
 * A React hook that debounces a callback function, delaying its execution until after
 * a specified delay period has elapsed since the last time it was invoked.
 *
 * Useful for optimizing performance by limiting the rate at which a function is called,
 * such as in response to rapid user input or scroll events.
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

  // Keep callback ref up-to-date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Params) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}
