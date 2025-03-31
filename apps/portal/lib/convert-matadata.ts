/**
 * Converts a record (key-value object) to an array of key-value objects
 *
 * @param record - A record with string keys and string values
 * @returns An array of objects with key and value properties
 * @example
 * ```ts
 * const record = { name: "John", age: "30" };
 * const array = recordToArray(record);
 * // Result: [{ key: "name", value: "John" }, { key: "age", value: "30" }]
 * ```
 */
export function recordToArray(record: Record<string, string>) {
  return Object.entries(record).map(([key, value]) => ({
    /** The property key from the original record */
    key,
    /** The property value from the original record */
    value,
  }));
}

/**
 * Converts an array of key-value objects to a record (key-value object)
 *
 * @param array - An array of objects with key and value properties
 * @returns A record with string keys and string values
 * @example
 * ```ts
 * const array = [{ key: "name", value: "John" }, { key: "age", value: "30" }];
 * const record = arrayToRecord(array);
 * // Result: { name: "John", age: "30" }
 * ```
 */
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

/**
 * Converts a JSON string to a record object
 *
 * @param metadata - A JSON string representing a record
 * @returns A record with string keys and string values, or undefined if input is falsy
 * @example
 * ```ts
 * const jsonString = '{"name":"John","age":"30"}';
 * const record = dislpayToRecord(jsonString);
 * // Result: { name: "John", age: "30" }
 * ```
 */
export function dislpayToRecord(metadata: string) {
  if (!metadata) return undefined;
  return JSON.parse(metadata) as Record<string, string>;
}

/**
 * Converts an array of key-value objects to a formatted JSON string
 *
 * @param array - An array of objects with key and value properties
 * @returns A formatted JSON string representation of the record
 * @example
 * ```ts
 * const array = [{ key: "name", value: "John" }, { key: "age", value: "30" }];
 * const jsonString = arrayToDisplay(array);
 * // Result: '{\n  "name": "John",\n  "age": "30"\n}'
 * ```
 */
export function arrayToDisplay(
  array: readonly { key: string; value: string }[],
) {
  const rec = arrayToRecord(array);
  return JSON.stringify(rec, null, 2);
}

/**
 * Converts a record to a formatted JSON string
 *
 * @param record - A record with string keys and string values
 * @returns A formatted JSON string representation of the record
 * @example
 * ```ts
 * const record = { name: "John", age: "30" };
 * const jsonString = recordToDisplay(record);
 * // Result: '{\n  "name": "John",\n  "age": "30"\n}'
 * ```
 */
export function recordToDisplay(record: Record<string, string>) {
  return JSON.stringify(record, null, 2);
}
