export const applySort = <T>(rows: T[], sort?: string) => {
  if (!sort) return rows;
  const fields = sort.split(",");
  return [...rows].sort((a: any, b: any) => {
    for (const f of fields) {
      const desc = f.startsWith("-");
      const key = desc ? f.slice(1) : f;
      if (a[key] === b[key]) continue;
      return (a[key] > b[key] ? 1 : -1) * (desc ? -1 : 1);
    }
    return 0;
  });
};
