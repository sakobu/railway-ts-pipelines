import { pipe, flow, curry, uncurry, tupled, untupled } from '@/composition';

// Composition utilities working together in a realistic mini-pipeline
const clamp = (min: number, max: number, value: number) => Math.min(max, Math.max(min, value));

const multiply = (a: number, b: number) => a * b;

const divmod = ([n, d]: [number, number]): [number, number] => [Math.floor(n / d), n % d];

// Clamp -> scale -> split into quotient/remainder -> combine
const pipeline = flow(curry(clamp)(0)(100), curry(multiply)(1.5), (n) => divmod([n, 7]), tupled(multiply));

console.log(pipeline(50)); // 50
console.log(pipeline(150)); // 63

// Convert curried <-> uncurried APIs
const curriedClamp = (min: number) => (max: number) => (value: number) => clamp(min, max, value);
const normalClamp = uncurry(curriedClamp);

const tupleDivmod = divmod;
const normalDivmod = untupled(tupleDivmod);

console.log(normalClamp(0, 100, 150)); // 100
console.log(normalDivmod(20, 7)); // [2, 6]

// Adapting third-party style (positional args) for composition
const externalApi = { process: (x: number, y: number, z: number) => x + y * z };

const composableProcess = curry(externalApi.process);
const result = pipe(10, composableProcess(5)(2));

console.log(result); // 25
