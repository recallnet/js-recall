/**
 * Pagination response structure
 */
export interface PaginationResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Build a pagination response object
 * @param total The total number of items
 * @param limit The number of items to return
 * @param offset The index of the first item to return
 * @returns The pagination response object
 */
export function buildPaginationResponse(
  total: number,
  limit: number,
  offset: number,
): PaginationResponse {
  return {
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}
