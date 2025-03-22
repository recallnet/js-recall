export function recordToArray(record: Record<string, string>) {
  return Object.entries(record).map(([key, value]) => ({
    key,
    value,
  }));
}

export function arrayToRecord(
  array: readonly { key: string; value: string }[],
) {
  return array.reduce(
    (acc, { key, value }) => {
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>,
  );
}

export function dislpayToRecord(metadata: string) {
  return metadata
    .split("\n")
    .filter((line) => line.trim())
    .reduce((acc, line) => {
      const parts = line.split(": ");
      if (parts.length >= 2) {
        const [key, ...valueParts] = parts;
        acc[key] = valueParts.join(": ");
      }
      return acc;
    }, {} as Record<string, string>);
}

export function arrayToDisplay(
  metadata: Record<string, string> | { key: string; value: string }[] | null | undefined,
): [string, string][] {
  if (!metadata) return [];
  if (Array.isArray(metadata)) {
    return metadata.map(({ key, value }) => [key, value]);
  }
  return Object.entries(metadata);
}

export function recordToDisplay(record: Record<string, string>) {
  return Object.entries(record)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}
