type Defer<T = unknown> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

function deferWithResolvers<T = unknown>(): Defer<T> {
  // @ts-expect-error withResolvers might not be available in the environment
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  return { promise, resolve, reject };
}

function deferPolyfill<T = unknown>(): Defer<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Use if Promise.withResolvers is available.
// Otherwise, use the fallback implementation.
export const defer: <T = unknown>() => Defer<T> =
  "withResolvers" in Promise ? deferWithResolvers : deferPolyfill;

export type { Defer };
