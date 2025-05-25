export const applyFilters = <T extends Record<string, any>>(
  rows: T[],
  filter?: string,
) => {
  if (!filter) return rows;
  const clauses = filter.split(",").map((c) => c.split(":"));
  return rows.filter((r) =>
    clauses.every(([k, v]) => {
      if (!k || v === undefined) return true;
      const val = r[k];
      return Array.isArray(val) ? val.includes(v) : String(val) === v;
    }),
  );
};
