import {
  boolean,
  chain,
  finite,
  integer,
  max,
  min,
  number,
  object,
  required,
  string,
  tuple,
  tupleOf,
  validateAndFormatResult,
  type InferSchemaType,
} from '@/schema';

// === Schema Definitions ===

// Heterogeneous tuple - different types per position
const userRecordSchema = tuple([
  string(), // id
  chain(number(), integer(), min(0)), // age
  boolean(), // active
]);

// Homogeneous tuple - 3D vector with constraints
const MAX_POSITION = 1_000_000_000;
const vector3Schema = tupleOf(chain(number(), finite(), min(-MAX_POSITION), max(MAX_POSITION)), 3);

// Geographic coordinates [latitude, longitude]
const coordinateSchema = tuple([
  chain(number(), min(-90), max(90)), // latitude
  chain(number(), min(-180), max(180)), // longitude
]);

// Integration with object() - Spacecraft state
const spacecraftStateSchema = object({
  position: required(tupleOf(chain(number(), finite()), 3)),
  velocity: required(tupleOf(chain(number(), finite()), 3)),
  timestamp: required(number()),
});

// === Type Exports ===

export type UserRecord = InferSchemaType<typeof userRecordSchema>;
export type Vector3 = InferSchemaType<typeof vector3Schema>;
export type Coordinate = InferSchemaType<typeof coordinateSchema>;
export type SpacecraftState = InferSchemaType<typeof spacecraftStateSchema>;

// === Valid Data Examples ===

const validUserRecord = ['user123', 25, true];

const validVector = [100.5, -200.3, 50.0];

const validCoordinate = [37.7749, -122.4194]; // San Francisco

const validSpacecraftState = {
  position: [100, 200, 300],
  velocity: [1.5, -2.3, 0.5],
  timestamp: Date.now(),
};

// === Invalid Data Examples ===

const invalidUserRecord = ['user123', -5, true]; // negative age

const invalidVector = [100, 200]; // wrong length (2 instead of 3)

const invalidCoordinate = [100, -122]; // latitude out of range

const invalidSpacecraftState = {
  position: [100, 200], // wrong length
  velocity: [1.5, -2.3, 0.5],
  timestamp: Date.now(),
};

// === Validation and Output ===

console.log('=== Tuple Validator Examples ===\n');

console.log('--- Valid User Record [id, age, active] ---');
const userResult1 = validateAndFormatResult(validUserRecord, userRecordSchema);
console.log(userResult1);

console.log('\n--- Invalid User Record (negative age) ---');
const userResult2 = validateAndFormatResult(invalidUserRecord, userRecordSchema);
console.log(userResult2);

console.log('\n--- Valid 3D Vector ---');
const vectorResult1 = validateAndFormatResult(validVector, vector3Schema);
console.log(vectorResult1);

console.log('\n--- Invalid 3D Vector (wrong length) ---');
const vectorResult2 = validateAndFormatResult(invalidVector, vector3Schema);
console.log(vectorResult2);

console.log('\n--- Valid Geographic Coordinate ---');
const coordResult1 = validateAndFormatResult(validCoordinate, coordinateSchema);
console.log(coordResult1);

console.log('\n--- Invalid Geographic Coordinate (latitude out of range) ---');
const coordResult2 = validateAndFormatResult(invalidCoordinate, coordinateSchema);
console.log(coordResult2);

console.log('\n--- Valid Spacecraft State ---');
const stateResult1 = validateAndFormatResult(validSpacecraftState, spacecraftStateSchema);
console.log(stateResult1);

console.log('\n--- Invalid Spacecraft State (wrong position length) ---');
const stateResult2 = validateAndFormatResult(invalidSpacecraftState, spacecraftStateSchema);
console.log(stateResult2);
