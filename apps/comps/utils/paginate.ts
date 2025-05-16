export const paginate = <T>(rows: T[], limit = 20, offset = 0) => ({
  metadata: { total: rows.length, limit, offset },
  data: rows.slice(offset, offset + limit),
});
