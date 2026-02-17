export * from './option/basics';
export * from './option/transforms';
export * from './option/combining-and-conversions';
export * from './option/pipelines';
export * from './result/basics';
export * from './result/transforms';
export * from './result/combining-and-conversions';
export * from './result/pipelines';
export * from './interop/interop-examples';
export * from './composition/curry-basics';
export * from './composition/tupled-basics';
export * from './composition/advanced-composition';
export * from './composition/async-composition';
export * from './schema/basic';
export * from './schema/union';
export * from './schema/tuple';
export * from './schema/async-validation';
export * from './schema/standard-schema';
export * from './complete-pipelines/hill-clohessy-wiltshire';
export * from './complete-pipelines/hohmann-transfer';
export * from './complete-pipelines/async';
export * from './complete-pipelines/async-launch';
export * from './complete-pipelines/async-flow';

/*
Example Categories:

OPTION EXAMPLES:
- Basics (some, none, fromNullable, isSome, isNone, match, unwrapOr, unwrapOrElse)
- Transforms (map, flatMap, bimap, filter, tap)
- Combining & Conversions (combine, mapToResult)
- Pipelines (curried helpers in pipe: mapWith, flatMapWith, filterWith, tapWith)

RESULT EXAMPLES:
- Basics (ok, err, isOk, isErr, match, unwrap, unwrapOr, unwrapOrElse)
- Transforms (map, flatMap, mapErr, bimap, filter, tap, tapErr, orElse)
- Combining & Conversions (combine, combineAll, fromTry, fromPromise, toPromise, mapToOption)
- Pipelines (curried helpers in pipe/pipeAsync: mapWith, flatMapWith, filterWith, etc.)

INTEROP EXAMPLES:
- Option -> Result (adding error context to missing values)
- Result -> Option (dropping error details when only success/failure matters)
- Mixed workflow (combining both types in real scenarios)

COMPOSITION EXAMPLES:
- Curry basics (making multi-arg functions pipeable)
- Tupled basics (working with tuple data)
- Advanced composition (real-world function transformation patterns)
- Async composition (pipeAsync and flowAsync for async pipelines)

SCHEMA / VALIDATION EXAMPLES:
- Basic schema (required fields, type checks)
- Nested objects (validating structured data)
- Unions and enums (discriminated unions, string enums)
- Tuples (heterogeneous and homogeneous tuples)
- Async validation (refineAsync, chainAsync, refineAtAsync)
- Standard Schema interop (toStandardSchema for tRPC, TanStack, etc.)

COMPLETE PIPELINES:
- Hill-Clohessy-Wiltshire (spacecraft relative motion)
- Hohmann Transfer (orbital maneuvers)
- Async API call (input validation + network request + error handling)
- Async Launch Decision (input validation + multiple async steps + final decision)
- Async Flow (schema validation + Result operators + flowAsync pipeline)
*/
