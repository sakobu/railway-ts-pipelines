// Compiled by display.test.ts, which prints each export's type the way an editor's hover does.
import { discriminatedUnion, literal, number, object, required, type InferSchemaType } from '@/schema';

const shape = discriminatedUnion('type', {
  circle: object({ type: required(literal('circle' as const)), r: required(number()) }),
  square: object({ type: required(literal('square' as const)), s: required(number()) }),
});
const holder = object({ shape: required(shape) });

declare function inferOf<V>(validator: V): InferSchemaType<V>;

export const shapeValue = inferOf(shape);
export const holderValue = inferOf(holder);
export const shapeValidator = shape;
