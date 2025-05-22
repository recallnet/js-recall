import { AnyColumn, asc, desc } from "drizzle-orm";
import { PgSelect } from "drizzle-orm/pg-core";

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
    throw new Error("compound sorting with more than 3 fields not allowed");
  }

  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];
    if (typeof part !== "string") {
      throw new Error("cannot build sort with undefined");
    }

    const isDesc = part.startsWith("-");
    const column = isDesc ? (part = part.slice(1)) : part;

    const orderBy = orderByOptions[column];
    if (typeof orderBy === "undefined") {
      throw new Error(`cannot sort by field: '${part}'`);
    }

    query = isDesc ? query.orderBy(desc(orderBy)) : query.orderBy(asc(orderBy));
  }

  return query;
}
