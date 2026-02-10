import { flow } from '@/composition';
import { match, mapWith } from '@/result';
import {
  validate,
  object,
  required,
  chain,
  number,
  min,
  max,
  formatErrors,
  type InferSchemaType,
  type ValidationError,
  type ValidationResult,
} from '@/schema';

// Types
type Vec3 = { x: number; y: number; z: number };

// Constants
const MU = 398_600.4418; // Earth's gravitational parameter

// Enhanced input schema validation with physical bounds
const relativeStateSchema = object({
  position: required(
    object({
      x: required(chain(number(), min(-1000), max(1000, 'Radial position exceeds 1000 km'))),
      y: required(chain(number(), min(-1000), max(1000, 'Along-track position exceeds 1000 km'))),
      z: required(chain(number(), min(-1000), max(1000, 'Cross-track position exceeds 1000 km'))),
    }),
  ),
  velocity: required(
    object({
      x: required(chain(number(), min(-0.1), max(0.1, 'Radial velocity exceeds 100 m/s'))),
      y: required(chain(number(), min(-0.1), max(0.1, 'Along-track velocity exceeds 100 m/s'))),
      z: required(chain(number(), min(-0.1), max(0.1, 'Cross-track velocity exceeds 100 m/s'))),
    }),
  ),
  semiMajorAxis: required(
    chain(
      number(),
      min(6538, 'Semi-major axis must be above 160 km altitude'),
      max(42_164, 'Semi-major axis exceeds GEO altitude'),
    ),
  ),
  time: required(
    chain(number(), min(0, 'Time must be non-negative'), max(86_400, 'HCW equations lose accuracy beyond 1 day')),
  ),
});

type RelativeState = InferSchemaType<typeof relativeStateSchema>;

// Pure helper functions
const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

const meanMotion = (radius: number): number => Math.sqrt(MU / radius ** 3);

const trigNT = (n: number, t: number) => {
  const nt = n * t;
  return { s: Math.sin(nt), c: Math.cos(nt) };
};

// Flattened propagation functions - no currying
const propagateX = (x0: number, vx0: number, vy0: number, n: number, t: number) => {
  const { s, c } = trigNT(n, t);
  return (4 - 3 * c) * x0 + (s / n) * vx0 + ((2 * (1 - c)) / n) * vy0;
};

const propagateY = (x0: number, y0: number, vx0: number, vy0: number, n: number, t: number) => {
  const { s, c } = trigNT(n, t);
  return 6 * (s - n * t) * x0 + y0 - ((2 * (1 - c)) / n) * vx0 + ((4 * s - 3 * n * t) / n) * vy0;
};

const propagateZ = (z0: number, vz0: number, n: number, t: number) => {
  const { s, c } = trigNT(n, t);
  return c * z0 + (s / n) * vz0;
};

const propagateVx = (x0: number, vx0: number, vy0: number, n: number, t: number) => {
  const { s, c } = trigNT(n, t);
  return 3 * n * s * x0 + c * vx0 + 2 * s * vy0;
};

const propagateVy = (x0: number, vx0: number, vy0: number, n: number, t: number) => {
  const { s, c } = trigNT(n, t);
  return 6 * n * (c - 1) * x0 - 2 * s * vx0 + (4 * c - 3) * vy0;
};

const propagateVz = (z0: number, vz0: number, n: number, t: number) => {
  const { s, c } = trigNT(n, t);
  return -n * s * z0 + c * vz0;
};

// Main propagation function - works on validated input
const propagateRelativeMotion = (state: RelativeState) => {
  const n = meanMotion(state.semiMajorAxis);
  const t = state.time;
  const { position: p0, velocity: v0 } = state;

  // Calculate new position
  const x = propagateX(p0.x, v0.x, v0.y, n, t);
  const y = propagateY(p0.x, p0.y, v0.x, v0.y, n, t);
  const z = propagateZ(p0.z, v0.z, n, t);

  // Calculate new velocity
  const vx = propagateVx(p0.x, v0.x, v0.y, n, t);
  const vy = propagateVy(p0.x, v0.x, v0.y, n, t);
  const vz = propagateVz(p0.z, v0.z, n, t);

  return {
    position: vec3(x, y, z),
    velocity: vec3(vx, vy, vz),
  };
};

// Calculate relative distance
const relativeDistance = (state: { position: Vec3 }) =>
  Math.hypot(state.position.x, state.position.y, state.position.z);

// Add distance to propagated state
const addDistance = (state: { position: Vec3; velocity: Vec3 }) => ({
  ...state,
  distance: relativeDistance(state),
});

// The main point-free pipeline using curried functions
const hillsPropagation = flow(
  (input: unknown) => validate(input, relativeStateSchema),
  mapWith(propagateRelativeMotion),
  mapWith(addDistance),
);

// Derive the output type from the addDistance function
type PropagatedState = ReturnType<typeof addDistance>;

// Usage - ISS rendezvous scenario
const propagationResult = hillsPropagation({
  position: vec3(0.1, 0.5, 0), // 100m radial, 500m along-track
  velocity: vec3(0, -0.001, 0), // small closing velocity
  semiMajorAxis: 6778, // ISS orbit (~400km altitude)
  time: 300, // 5 minutes later
});

const result = match<PropagatedState, ValidationError[], ValidationResult<PropagatedState>>(propagationResult, {
  ok: (state) => ({
    valid: true,
    data: state,
  }),
  err: (errors) => ({
    valid: false,
    errors: formatErrors(errors),
  }),
});

// === flow + validate: ISS Rendezvous ===
console.log('=== flow + validate: ISS Rendezvous ===');

console.log(result);

// Example: Calculate drift over time - using point-free pipeline composition
const calculateTrajectory = (state: RelativeState) => {
  const times = [0, 300, 600, 900, 1800, 3600]; // 0, 5, 10, 15, 30, 60 minutes
  return times.map((t) => ({
    time: t,
    state: propagateRelativeMotion({ ...state, time: t }),
  }));
};

const trajectoryToDistances = (trajectory: Array<{ time: number; state: { position: Vec3; velocity: Vec3 } }>) =>
  trajectory.map((point) => ({
    time: point.time / 60,
    distance: relativeDistance(point.state),
  }));

const driftAnalysis = flow(
  (input: unknown) => validate(input, relativeStateSchema),
  mapWith(calculateTrajectory),
  mapWith(trajectoryToDistances),
);

// Derive the output type from the trajectoryToDistances function
type DriftPoint = ReturnType<typeof trajectoryToDistances>[number];

const driftResult = driftAnalysis({
  position: vec3(0.01, 0, 0), // 10m radial offset
  velocity: vec3(0, 0, 0), // no initial relative velocity
  semiMajorAxis: 6778,
  time: 0, // will be overridden in the analysis
});

const drift = match<DriftPoint[], ValidationError[], ValidationResult<DriftPoint[]>>(driftResult, {
  ok: (points) => ({
    valid: true,
    data: points,
  }),
  err: (errors) => ({
    valid: false,
    errors: formatErrors(errors),
  }),
});

// === flow + validate: Free Drift Analysis ===
console.log('\n=== flow + validate: Free Drift Analysis ===');

console.log(drift);
