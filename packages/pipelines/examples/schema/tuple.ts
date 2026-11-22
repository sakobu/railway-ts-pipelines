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

// === tuple: Heterogeneous Tuples ===
console.log('=== tuple: Heterogeneous Tuples ===');

const userRecordSchema = tuple([
  string(), // id
  chain(number(), integer(), min(0)), // age
  boolean(), // active
]);

const validUserRecord = ['user123', 25, true];
const invalidUserRecord = ['user123', -5, true]; // negative age

console.log(validateAndFormatResult(validUserRecord, userRecordSchema));
console.log(validateAndFormatResult(invalidUserRecord, userRecordSchema));

// === tupleOf: Homogeneous Tuples ===
console.log('\n=== tupleOf: Homogeneous Tuples ===');

const MAX_POSITION = 1_000_000_000;
const vector3Schema = tupleOf(chain(number(), finite(), min(-MAX_POSITION), max(MAX_POSITION)), 3);

const validVector = [100.5, -200.3, 50.0];
const invalidVector = [100, 200]; // wrong length (2 instead of 3)

console.log(validateAndFormatResult(validVector, vector3Schema));
console.log(validateAndFormatResult(invalidVector, vector3Schema));

// === tuple: Geographic Coordinates ===
console.log('\n=== tuple: Geographic Coordinates ===');

const coordinateSchema = tuple([
  chain(number(), min(-90), max(90)), // latitude
  chain(number(), min(-180), max(180)), // longitude
]);

const validCoordinate = [37.7749, -122.4194]; // San Francisco
const invalidCoordinate = [100, -122]; // latitude out of range

console.log(validateAndFormatResult(validCoordinate, coordinateSchema));
console.log(validateAndFormatResult(invalidCoordinate, coordinateSchema));

// === object + tupleOf: Nested Tuple Schemas ===
console.log('\n=== object + tupleOf: Nested Tuple Schemas ===');

const spacecraftStateSchema = object({
  position: required(tupleOf(chain(number(), finite()), 3)),
  velocity: required(tupleOf(chain(number(), finite()), 3)),
  timestamp: required(number()),
});

const validSpacecraftState = {
  position: [100, 200, 300],
  velocity: [1.5, -2.3, 0.5],
  timestamp: Date.now(),
};

const invalidSpacecraftState = {
  position: [100, 200], // wrong length
  velocity: [1.5, -2.3, 0.5],
  timestamp: Date.now(),
};

console.log(validateAndFormatResult(validSpacecraftState, spacecraftStateSchema));
console.log(validateAndFormatResult(invalidSpacecraftState, spacecraftStateSchema));

// === Type Exports ===

export type UserRecord = InferSchemaType<typeof userRecordSchema>;
export type Vector3 = InferSchemaType<typeof vector3Schema>;
export type Coordinate = InferSchemaType<typeof coordinateSchema>;
export type SpacecraftState = InferSchemaType<typeof spacecraftStateSchema>;
