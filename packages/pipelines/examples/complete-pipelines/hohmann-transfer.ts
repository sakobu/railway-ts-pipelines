import { flow, curry } from '@/composition';
import { mapWith, match } from '@/result';
import {
  validate,
  object,
  required,
  chain,
  number,
  min,
  max,
  finite,
  refine,
  formatErrors,
  type InferSchemaType,
} from '@/schema';

// Constants
const EARTH_RADIUS = 6378;
const MU = 398_600.4418;

// Types
type Burn = {
  deltaV: number;
  location: string;
  altitude: number;
  velocity: {
    before: number;
    after: number;
  };
};

type TransferDetails = {
  departure: Burn;
  arrival: Burn;
  transferTime: number;
  totalDeltaV: number;
  orbits: {
    initial: { altitude: number; velocity: number };
    final: { altitude: number; velocity: number };
  };
};

// Reusable altitude validator (km)
const altitude = chain(
  number(),
  finite(),
  min(160, 'Must be above 160 km (atmospheric drag)'),
  max(100_000, 'Altitude too high for Earth-centered Hohmann (<=100,000 km)'),
);

// Input schema validation - validate ONCE at the boundary
const transferInputSchema = chain(
  object({
    fromAltitude: required(altitude),
    toAltitude: required(altitude),
  }),
  refine(({ fromAltitude, toAltitude }) => fromAltitude !== toAltitude, 'fromAltitude and toAltitude must differ'),
);

type TransferInput = InferSchemaType<typeof transferInputSchema>;

// Pure calculation functions
const altitudeToRadius = (altitude: number): number => EARTH_RADIUS + altitude;
const circularVelocity = (radius: number): number => Math.sqrt(MU / radius);
const semiMajorAxis = curry((r1: number, r2: number) => (r1 + r2) / 2);
const ellipticalVelocity = curry((r: number, a: number) => Math.sqrt(MU * (2 / r - 1 / a)));
const transferTime = curry((r1: number, r2: number) => Math.PI * Math.sqrt(semiMajorAxis(r1)(r2) ** 3 / MU));

// Main calculation with burn details
const calculateTransfer = (input: TransferInput): TransferDetails => {
  const r1 = altitudeToRadius(input.fromAltitude);
  const r2 = altitudeToRadius(input.toAltitude);
  const a = semiMajorAxis(r1)(r2);
  const isRaising = r2 > r1;

  // Velocities
  const v1Circular = circularVelocity(r1);
  const v2Circular = circularVelocity(r2);
  const vTransferAtDeparture = ellipticalVelocity(r1)(a);
  const vTransferAtArrival = ellipticalVelocity(r2)(a);

  // Delta-v calculations
  const departureDV = Math.abs(vTransferAtDeparture - v1Circular);
  const arrivalDV = Math.abs(v2Circular - vTransferAtArrival);

  return {
    departure: {
      deltaV: departureDV,
      location: isRaising ? 'periapsis' : 'apoapsis',
      altitude: input.fromAltitude,
      velocity: {
        before: v1Circular,
        after: vTransferAtDeparture,
      },
    },
    arrival: {
      deltaV: arrivalDV,
      location: isRaising ? 'apoapsis' : 'periapsis',
      altitude: input.toAltitude,
      velocity: {
        before: vTransferAtArrival,
        after: v2Circular,
      },
    },
    transferTime: transferTime(r1)(r2) / 3600,
    totalDeltaV: departureDV + arrivalDV,
    orbits: {
      initial: { altitude: input.fromAltitude, velocity: v1Circular },
      final: { altitude: input.toAltitude, velocity: v2Circular },
    },
  };
};

// Main pipeline — validate at the boundary, then let it flow
const hohmannTransfer = (input: unknown) => {
  const result = flow((i: unknown) => validate(i, transferInputSchema), mapWith(calculateTransfer))(input);

  return match(result, {
    ok: (data) => ({ valid: true as const, data }),
    err: (errors) => ({ valid: false as const, errors: formatErrors(errors) }),
  });
};

// === flow + validate: LEO to GEO Transfer ===
console.log('=== flow + validate: LEO to GEO Transfer ===');

console.log(JSON.stringify(hohmannTransfer({ fromAltitude: 400, toAltitude: 35_786 }), null, 2));

// === flow + validate: Invalid Altitude ===
console.log('\n=== flow + validate: Invalid Altitude ===');

console.log(JSON.stringify(hohmannTransfer({ fromAltitude: 100, toAltitude: 35_786 }), null, 2));
