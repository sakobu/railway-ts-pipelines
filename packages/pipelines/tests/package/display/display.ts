// Compiled by check.mjs, which reads the declarations tsc writes for this file. They print each export's type
// the way an editor's hover shows it to a consumer of the built package.
import {
  discriminatedUnion,
  literal,
  number,
  object,
  required,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

const shape = discriminatedUnion('type', {
  circle: object({ type: required(literal('circle' as const)), r: required(number()) }),
  square: object({ type: required(literal('square' as const)), s: required(number()) }),
});

declare function inferOf<V>(validator: V): InferSchemaType<V>;

export const shapeValidator = shape;
export const shapeValue = inferOf(shape);
export const holderValue = inferOf(object({ shape: required(shape) }));
