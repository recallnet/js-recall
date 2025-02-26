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
  if (!metadata) return undefined;
  return JSON.parse(metadata) as Record<string, string>;
}

export function arrayToDisplay(
  array: readonly { key: string; value: string }[],
) {
  const rec = arrayToRecord(array);
  return JSON.stringify(rec, null, 2);
}

export function recordToDisplay(record: Record<string, string>) {
  return JSON.stringify(record, null, 2);
}
