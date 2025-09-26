export function assertNever(x: never): never {
  throw new Error("Unexpected error type: " + x);
}
