// Names that exist only in a declaration bundler's internals must not be importable.
// @ts-expect-error `a` is not an export of @railway-ts/pipelines/result
import { a } from '@railway-ts/pipelines/result';

export const phantom: unknown = a;
