export function removePrefix(key: string, prefix: string) {
  return key.replace(new RegExp(`^${prefix ?? ""}`), "");
}
