type Defer<T = unknown> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

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
  "withResolvers" in Promise
    ? (Promise.withResolvers as unknown as <T = unknown>() => Defer<T>)
    : deferPolyfill;

export type { Defer };
