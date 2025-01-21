export function displayAddress(
  address: string,
  options?: { numChars?: number; separator?: string },
) {
  const numChars = options?.numChars ?? 4;
  const separator = options?.separator ?? "…";
  return `${address.slice(0, numChars)}${separator}${address.slice(-numChars)}`;
}
