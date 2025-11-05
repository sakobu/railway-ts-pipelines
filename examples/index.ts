export * from './option/option-examples';
export * from './result/result-examples';
export * from './interop/interop-examples';
export * from './composition/curry-basics';
export * from './composition/tupled-basics';
export * from './composition/advanced-composition';
export * from './schema/basic';
export * from './schema/union';
export * from './complete-pipelines/hill-clohessy-wiltshire';
export * from './complete-pipelines/hohmann-transfer';
export * from './complete-pipelines/async';
export * from './complete-pipelines/async-launch';

/*
Example Categories:

OPTION EXAMPLES:
- Safe property access (nullable object properties)
- Safe array access (out-of-bounds protection)  
- Configuration values (environment variables with defaults)

RESULT EXAMPLES:
- Division by zero (classic explicit error handling)
- JSON parsing (converting exceptions to Results)
- Chaining operations (flatMapResult for multiple failing steps)

INTEROP EXAMPLES:
- Option -> Result (adding error context to missing values)
- Result -> Option (dropping error details when only success/failure matters)
- Mixed workflow (combining both types in real scenarios)

COMPOSITION EXAMPLES:
- Curry basics (making multi-arg functions pipeable)
- Tupled basics (working with tuple data)
- Advanced composition (real-world function transformation patterns)

SCHEMA / VALIDATION EXAMPLES:
- Basic schema (required fields, type checks)
- Nested objects (validating structured data)
- Unions and enums (discriminated unions, string enums)

COMPLETE PIPELINES:
- Hill-Clohessy-Wiltshire (spacecraft relative motion)
- Hohmann Transfer (orbital maneuvers)
- Async API call (input validation + network request + error handling)
- Async Launch Decision (input validation + multiple async steps + final decision)
*/
