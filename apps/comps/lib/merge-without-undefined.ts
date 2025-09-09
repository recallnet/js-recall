export function mergeWithoutUndefined<A, B extends Partial<A>>(
  objA: A,
  objB: B,
): A {
  const result = { ...objA };

  for (const key in objB) {
    if (objB[key] !== undefined) {
      (result as any)[key] = objB[key];
    }
  }

  return result;
}
