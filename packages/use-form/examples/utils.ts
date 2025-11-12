import { pipe } from '@railway-ts/pipelines/composition';

// Helper to transform a single value for API submission
const transformValue = (value: unknown): unknown =>
  value instanceof Date
    ? value.toISOString().split('T')[0]
    : value && typeof value === 'object' && !Array.isArray(value)
      ? prepareForAPI(value as Record<string, unknown>)
      : value;

// Helper to prepare form values for API submission (Railway-style)
export function prepareForAPI<T extends Record<string, unknown>>(values: T): T {
  return pipe(
    values,
    Object.entries,
    (entries) => entries.map(([key, value]) => [key, transformValue(value)]),
    Object.fromEntries
  ) as T;
}
