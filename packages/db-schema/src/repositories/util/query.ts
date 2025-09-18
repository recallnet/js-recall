import { AnyColumn, asc, desc } from "drizzle-orm";
import { PgSelect } from "drizzle-orm/pg-core";

import { ParsingError } from "../../errors.js";

/**
 * Apply sorting to a Drizzle query based on sort string
 * @param query The Drizzle query to apply sorting to
 * @param sortString Comma-separated sort fields with optional direction.
 *                   Use "-field" for descending, "field" for ascending.
 *                   Examples: "name", "-createdAt", "name,-createdAt"
 * @param orderByOptions Available fields that can be sorted by
 * @returns The query with sorting applied
 */
export function getSort<T extends PgSelect>(
  query: T,
  sortString: string,
  orderByOptions: Record<string, AnyColumn>,
) {
  const parts = sortString.split(",");

  if (parts.length < 1) {
    throw new Error("cannot sort by undefined");
  }
  if (parts.length > 3) {
    throw new ParsingError(
      "compound sorting with more than 3 fields not allowed",
    );
  }

  // Collect all ordering criteria
  const orderByCriteria = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (typeof part !== "string") {
      throw new ParsingError("cannot build sort with undefined");
    }

    // Standard format: "-field" for desc, "field" for asc
    const isDesc = part.startsWith("-");
    const column = isDesc ? part.slice(1) : part;

    const orderBy = orderByOptions[column];
    if (typeof orderBy === "undefined") {
      throw new ParsingError(`cannot sort by field: '${part}'`);
    }

    // Add to criteria array instead of applying immediately
    orderByCriteria.push(isDesc ? desc(orderBy) : asc(orderBy));
  }

  // Apply all ordering criteria in a single orderBy call
  return query.orderBy(...orderByCriteria);
}
