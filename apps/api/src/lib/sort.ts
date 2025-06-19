import { ZodEffects, ZodOptional, ZodString, z } from "zod";

/**
 * Build a Zod schema that accepts
 *   "field" | "-field"
 * for any field name in the supplied list.
 * @param fields - The list of fields to accept
 * @returns A Zod schema that accepts "field" | "-field" for any field name in the supplied list
 */
export function makeSortFieldSchema<const FIELDS extends readonly string[]>(
  fields: FIELDS,
) {
  const fieldSet = new Set<string>(fields as readonly string[]);
  return z.string().refine((val) => {
    const core = val.startsWith("-") ? val.slice(1) : val;
    return fieldSet.has(core);
  }, "Invalid sort field");
}

/**
 * The type returned from `makeSortFieldSchema` extended to account for defaults and optionals.
 * This is used to type the `dbSortSchema` and `computeSortSchema` parameters of `splitSortField`.
 */
type SplitSortFieldSchemaType =
  | z.ZodEffects<z.ZodString, string, string>
  | z.ZodDefault<z.ZodEffects<z.ZodString, string, string>>
  | ZodOptional<ZodEffects<ZodString, string, string>>;

/**
 * Helper function to categorize sort fields and determine whether they should be applied
 * at the database level or post-processing level
 * @template TDbSort Database-level sort fields type
 * @template TPostProcessSort Post-processing sort fields type
 * @param sortField The sort field to categorize
 * @param dbSortSchema Zod schema for database-level sort fields (can use defaults)
 * @param computeSortSchema Zod schema for post-processing sort fields (can use defaults)
 * @returns Object with dbSort and postProcessSort fields
 */
// TODO: this considers only one sort field at a time
export function splitSortField<
  TDbSort extends SplitSortFieldSchemaType,
  TPostProcessSort extends SplitSortFieldSchemaType,
>(
  sortField: string | undefined,
  dbSortSchema: TDbSort,
  computeSortSchema: TPostProcessSort,
): {
  dbSort: z.infer<TDbSort> | undefined;
  computedSort: z.infer<TPostProcessSort> | undefined;
} {
  const dbSortResult = dbSortSchema.safeParse(sortField);
  const computedSortResult = computeSortSchema.safeParse(sortField);
  return {
    dbSort: dbSortResult.success ? dbSortResult.data : undefined,
    computedSort: computedSortResult.success
      ? computedSortResult.data
      : undefined,
  };
}

/**
 * Helper function to apply post-processing sorting to an array of objects
 * @template T The type of objects being sorted
 * @param items Array of items to sort
 * @param sortField Sort field string (e.g., "name", "-createdAt")
 * @returns void (sorts in place)
 */
export function applySorting<T extends Record<string, unknown>>(
  items: T[],
  sortField: string,
): T[] {
  const isDescending = sortField.startsWith("-");
  const fieldName = isDescending ? sortField.slice(1) : sortField;

  items.sort((a, b) => {
    const valA = a[fieldName];
    const valB = b[fieldName];

    // Handle null/undefined values
    if (valA == null && valB == null) return 0;
    if (valA == null) return isDescending ? 1 : -1;
    if (valB == null) return isDescending ? -1 : 1;

    // Handle different data types
    if (typeof valA === "number" && typeof valB === "number") {
      return isDescending ? valB - valA : valA - valB;
    }

    if (typeof valA === "string" && typeof valB === "string") {
      const comparison = valA.localeCompare(valB);
      return isDescending ? -comparison : comparison;
    }

    if (valA instanceof Date && valB instanceof Date) {
      const comparison = valA.getTime() - valB.getTime();
      return isDescending ? -comparison : comparison;
    }

    // Fallback to string comparison
    const aStr = String(valA);
    const bStr = String(valB);
    const comparison = aStr.localeCompare(bStr);
    return isDescending ? -comparison : comparison;
  });
  return items;
}

/**
 * Apply pagination to an array of items
 * @template T The type of objects being paginated
 * @param items Array of items to paginate
 * @param limit The number of items to return
 * @param offset The index of the first item to return
 * @returns The paginated array
 */
export function applyPagination<T extends Record<string, unknown>>(
  items: T[],
  limit?: number,
  offset?: number,
): T[] {
  return items.slice(offset || 0, (offset || 0) + (limit || 0));
}

/**
 * Apply sorting and pagination to an array of items. Typically used for computed sorting.
 * @template T The type of objects being sorted and paginated
 * @param items Array of items to sort and paginate
 * @param sortField Sort field string (e.g., "name", "-createdAt")
 * @param limit The number of items to return
 * @param offset The index of the first item to return
 * @returns The sorted and paginated array
 */
export function applySortingAndPagination<T extends Record<string, unknown>>(
  items: T[],
  sortField: string,
  limit: number,
  offset: number,
): T[] {
  const sortedItems = applySorting(items, sortField);
  return applyPagination(sortedItems, limit, offset);
}
