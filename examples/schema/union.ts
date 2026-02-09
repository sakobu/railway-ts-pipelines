import { match } from '@/result';
import {
  between,
  boolean,
  chain,
  discriminatedUnion,
  formatErrors,
  literal,
  object,
  parseDate,
  parseNumber,
  pattern,
  required,
  string,
  stringEnum,
  validate,
  type InferSchemaType,
  type ValidationError,
  type ValidationResult,
} from '@/schema';

// === Literal Constants ===
export const ALERT_TYPES = {
  ENGINE: 'engine',
  HYDRAULIC: 'hydraulic',
  ELECTRICAL: 'electrical',
  FUEL: 'fuel',
} as const;

export const SEVERITY_LEVELS = ['warning', 'caution', 'advisory'] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export const ENGINE_NUMBERS = ['1', '2', '3', '4'] as const;
export type EngineNumber = (typeof ENGINE_NUMBERS)[number];

export const ENGINE_PARAMETERS = ['temperature', 'pressure', 'vibration', 'oil'] as const;
export type EngineParameter = (typeof ENGINE_PARAMETERS)[number];

export const HYDRAULIC_SYSTEMS = ['primary', 'backup', 'emergency'] as const;
export type HydraulicSystem = (typeof HYDRAULIC_SYSTEMS)[number];

export const ELECTRICAL_BUSES = ['main', 'essential', 'battery'] as const;
export type ElectricalBus = (typeof ELECTRICAL_BUSES)[number];

export const POWER_SOURCES = ['generator', 'apu', 'battery', 'external'] as const;
export type PowerSource = (typeof POWER_SOURCES)[number];

export const FUEL_TANKS = ['left_main', 'right_main', 'center', 'auxiliary'] as const;
export type FuelTank = (typeof FUEL_TANKS)[number];

// === Helper function to create common field definitions ===
const createCommonFields = () => ({
  timestamp: required(parseDate()),
  aircraftId: required(chain(string(), pattern(/^[A-Z]-[A-Z0-9]{4,5}$/))), // e.g., N-12345, G-ABCD
  flightNumber: required(chain(string(), pattern(/^[A-Z]{2,3}\d{1,4}$/))), // e.g., UA123, DLH4567
  severity: required(stringEnum<SeverityLevel>([...SEVERITY_LEVELS], 'Invalid severity level')),
  acknowledged: required(boolean()),
});

// === Engine Alert Schema ===
const engineAlertSchema = object({
  ...createCommonFields(),
  type: required(literal(ALERT_TYPES.ENGINE)),
  engineNumber: required(chain(stringEnum<EngineNumber>([...ENGINE_NUMBERS], 'Invalid engine number'), parseNumber())),
  parameter: required(stringEnum<EngineParameter>([...ENGINE_PARAMETERS], 'Invalid engine parameter')),
  value: required(chain(parseNumber(), between(0, 1000))),
  threshold: required(chain(parseNumber(), between(0, 1000))),
  exceedanceTime: required(chain(parseNumber(), between(0, 3600))),
});

// === Hydraulic System Alert Schema ===
const hydraulicAlertSchema = object({
  ...createCommonFields(),
  type: required(literal(ALERT_TYPES.HYDRAULIC)),
  system: required(stringEnum<HydraulicSystem>([...HYDRAULIC_SYSTEMS], 'Invalid hydraulic system')),
  pressure: required(chain(parseNumber(), between(0, 5000))),
  fluidLevel: required(chain(parseNumber(), between(0, 100))),
  temperature: required(chain(parseNumber(), between(-50, 150))),
});

// === Electrical System Alert Schema ===
const electricalAlertSchema = object({
  ...createCommonFields(),
  type: required(literal(ALERT_TYPES.ELECTRICAL)),
  bus: required(stringEnum<ElectricalBus>([...ELECTRICAL_BUSES], 'Invalid electrical bus')),
  voltage: required(chain(parseNumber(), between(0, 30))),
  current: required(chain(parseNumber(), between(0, 200))),
  source: required(stringEnum<PowerSource>([...POWER_SOURCES], 'Invalid power source')),
  frequency: required(chain(parseNumber(), between(380, 420))),
});

// === Fuel System Alert Schema ===
const fuelAlertSchema = object({
  ...createCommonFields(),
  type: required(literal(ALERT_TYPES.FUEL)),
  tank: required(stringEnum<FuelTank>([...FUEL_TANKS], 'Invalid fuel tank')),
  quantity: required(chain(parseNumber(), between(0, 50_000))),
  imbalance: required(boolean()),
  consumptionRate: required(chain(parseNumber(), between(0, 10_000))),
  estimatedEndurance: required(chain(parseNumber(), between(0, 24))),
});

// === Create Discriminated Union ===
// Output type is inferred from the validator map — no manual type parameter needed.
const completeAlertSchema = discriminatedUnion('type', {
  [ALERT_TYPES.ENGINE]: engineAlertSchema,
  [ALERT_TYPES.HYDRAULIC]: hydraulicAlertSchema,
  [ALERT_TYPES.ELECTRICAL]: electricalAlertSchema,
  [ALERT_TYPES.FUEL]: fuelAlertSchema,
});

type CompleteAlertSchema = InferSchemaType<typeof completeAlertSchema>;

// Result type used in this example that includes extra display fields
type AlertValidationDisplay = ValidationResult<CompleteAlertSchema> & {
  summary?: string;
  errorCount?: number;
};

// === Valid Data Examples ===
const validEngineAlert = {
  // Common fields
  timestamp: new Date('2025-01-17T14:30:00Z'),
  aircraftId: 'N-12345',
  flightNumber: 'UA456',
  severity: 'warning',
  acknowledged: false,
  // Engine-specific fields
  type: ALERT_TYPES.ENGINE,
  engineNumber: '2',
  parameter: 'temperature',
  value: 850,
  threshold: 800,
  exceedanceTime: 45,
};

const validHydraulicAlert = {
  // Common fields
  timestamp: new Date('2025-01-17T14:35:00Z'),
  aircraftId: 'G-ABCD',
  flightNumber: 'BA789',
  severity: 'caution',
  acknowledged: true,
  // Hydraulic-specific fields
  type: ALERT_TYPES.HYDRAULIC,
  system: 'primary',
  pressure: 2950,
  fluidLevel: 85,
  temperature: 45,
};

// === Invalid Data Examples ===
const invalidAircraftIdPattern = {
  timestamp: new Date('2025-01-17T14:40:00Z'),
  aircraftId: '12345', // Missing prefix letter and dash
  flightNumber: 'DL123',
  severity: 'advisory',
  acknowledged: false,
  type: ALERT_TYPES.ELECTRICAL,
  bus: 'main',
  voltage: 28,
  current: 50,
  source: 'generator',
  frequency: 400,
};

const invalidEngineNumber = {
  timestamp: new Date('2025-01-17T14:45:00Z'),
  aircraftId: 'N-98765',
  flightNumber: 'AA100',
  severity: 'warning',
  acknowledged: false,
  type: ALERT_TYPES.ENGINE,
  engineNumber: '5', // Invalid engine number (only 1-4 allowed)
  parameter: 'pressure',
  value: 450,
  threshold: 400,
  exceedanceTime: 120,
};

const invalidFuelQuantity = {
  timestamp: new Date('2025-01-17T14:50:00Z'),
  aircraftId: 'C-FGHI',
  flightNumber: 'AC202',
  severity: 'caution',
  acknowledged: true,
  type: ALERT_TYPES.FUEL,
  tank: 'center',
  quantity: 75_000, // Exceeds maximum of 50_000 pounds
  imbalance: true,
  consumptionRate: 5000,
  estimatedEndurance: 10,
};

const invalidAlertType = {
  timestamp: new Date('2025-01-17T14:55:00Z'),
  aircraftId: 'D-JKLM',
  flightNumber: 'LH404',
  severity: 'warning',
  acknowledged: false,
  type: 'navigation', // Invalid alert type
  latitude: 45.5,
  longitude: -73.5,
};

const missingCommonField = {
  // Missing timestamp
  aircraftId: 'F-NOPQ',
  flightNumber: 'AF505',
  severity: 'advisory',
  acknowledged: false,
  type: ALERT_TYPES.HYDRAULIC,
  system: 'backup',
  pressure: 3000,
  fluidLevel: 90,
  temperature: 25,
};

const extraFieldsInjection = {
  // Test that extra fields are rejected
  timestamp: new Date('2025-01-17T15:00:00Z'),
  aircraftId: 'N-54321',
  flightNumber: 'UA999',
  severity: 'warning',
  acknowledged: false,
  type: ALERT_TYPES.ENGINE,
  engineNumber: '1',
  parameter: 'temperature',
  value: 750,
  threshold: 700,
  exceedanceTime: 30,
  // Attempting to inject extra fields
  maliciousField: 'should-be-rejected',
  __proto__: { injected: true },
  constructor: { name: 'hack' },
};

// === Validation Function ===
const processValidation = (data: unknown) => {
  const validationResult = validate(data, completeAlertSchema);
  return match<CompleteAlertSchema, ValidationError[], AlertValidationDisplay>(validationResult, {
    ok: (validData) => ({
      valid: true,
      data: validData,
      summary: `Alert processed: ${validData.type} on ${validData.aircraftId} (${validData.severity})`,
    }),
    err: (errors) => ({
      valid: false,
      errors: formatErrors(errors),
      errorCount: errors.length,
    }),
  });
};

// === discriminatedUnion: Valid Alerts ===
console.log('=== discriminatedUnion: Valid Alerts ===');

const validEngineResult = processValidation(validEngineAlert);
console.log(validEngineResult);

const validHydraulicResult = processValidation(validHydraulicAlert);
console.log(validHydraulicResult);

// === discriminatedUnion: Validation Errors ===
console.log('\n=== discriminatedUnion: Validation Errors ===');

const invalidPatternResult = processValidation(invalidAircraftIdPattern);
console.log(invalidPatternResult);

const invalidEngineResult = processValidation(invalidEngineNumber);
console.log(invalidEngineResult);

const invalidFuelResult = processValidation(invalidFuelQuantity);
console.log(invalidFuelResult);

// === discriminatedUnion: Structural Errors ===
console.log('\n=== discriminatedUnion: Structural Errors ===');

const invalidTypeResult = processValidation(invalidAlertType);
console.log(invalidTypeResult);

const missingFieldResult = processValidation(missingCommonField);
console.log(missingFieldResult);

// === discriminatedUnion: Extra Fields Rejection ===
console.log('\n=== discriminatedUnion: Extra Fields Rejection ===');

const injectionResult = processValidation(extraFieldsInjection);
console.log(injectionResult);

console.log("Does a fresh object have 'injected'? ->", ({} as any).injected); // undefined
console.log("Does Object.prototype have 'injected'? ->", (Object.prototype as any).injected); // undefined
console.log('Note: Extra fields should be rejected in strict mode');
