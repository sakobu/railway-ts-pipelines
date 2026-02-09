export type MaybeAsync<T> = T | Promise<T>;

export type UnknownFunction = (...params: unknown[]) => unknown;
