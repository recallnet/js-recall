import { BlockchainType, SpecificChain } from '../types';

/**
 * Database Types
 * Type definitions for database entities and records
 */

/**
 * Price record interface for database operations
 */
export interface PriceRecord {
  id?: number;
  token: string;
  price: number;
  timestamp: Date;
  chain: BlockchainType;
  specificChain: SpecificChain;
}

/**
 * Portfolio snapshot interface for database operations
 */
export interface PortfolioSnapshot {
  id: number;
  teamId: string;
  competitionId: string;
  timestamp: Date;
  totalValue: number;
}

/**
 * Portfolio token value interface for database operations
 */
export interface PortfolioTokenValue {
  id?: number;
  portfolioSnapshotId: number;
  tokenAddress: string;
  amount: number;
  valueUsd: number;
  price: number;
  specificChain: SpecificChain;
}

/**
 * Database row type for generic row mapping
 */
export type DatabaseRow = Record<string, unknown>;

/**
 * Database query result interface
 */
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

/**
 * Repository filter options
 */
export interface RepositoryFilter {
  limit?: number;
  offset?: number;
  orderBy?: string;
  order?: 'ASC' | 'DESC';
  [key: string]: unknown;
}
