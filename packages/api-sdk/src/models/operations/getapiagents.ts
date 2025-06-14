/*
 * Code generated by Speakeasy (https://speakeasy.com). DO NOT EDIT.
 */
import * as z from "zod";

import { safeParse } from "../../lib/schemas.js";
import { ClosedEnum } from "../../types/enums.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";

export type GetApiAgentsRequest = {
  /**
   * Optional filtering agents based on name or wallet address
   */
  filter?: string | undefined;
  /**
   * Optional field(s) to sort by. Supports single or multiple fields separated by commas.
   *
   * @remarks
   * Prefix with '-' for descending order (e.g., '-name' or 'name,-createdAt').
   * Available fields: id, ownerId, walletAddress, name, description, imageUrl, status, createdAt, updatedAt.
   * When not specified, results are returned in database order.
   */
  sort?: string | undefined;
  /**
   * Optional field to choose max size of result set (default value is `10`)
   */
  limit?: string | undefined;
  /**
   * Optional field to choose offset of result set (default value is `0`)
   */
  offset?: string | undefined;
};

export type GetApiAgentsPagination = {
  total?: number | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export const GetApiAgentsStatus = {
  Active: "active",
  Suspended: "suspended",
  Deleted: "deleted",
} as const;
export type GetApiAgentsStatus = ClosedEnum<typeof GetApiAgentsStatus>;

export type GetApiAgentsAgent = {
  id?: string | undefined;
  ownerId?: string | undefined;
  walletAddress?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  imageUrl?: string | undefined;
  status?: GetApiAgentsStatus | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
};

/**
 * Agent profile retrieved successfully
 */
export type GetApiAgentsResponse = {
  success?: boolean | undefined;
  pagination?: GetApiAgentsPagination | undefined;
  agents?: Array<GetApiAgentsAgent> | undefined;
};

/** @internal */
export const GetApiAgentsRequest$inboundSchema: z.ZodType<
  GetApiAgentsRequest,
  z.ZodTypeDef,
  unknown
> = z.object({
  filter: z.string().optional(),
  sort: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

/** @internal */
export type GetApiAgentsRequest$Outbound = {
  filter?: string | undefined;
  sort?: string | undefined;
  limit?: string | undefined;
  offset?: string | undefined;
};

/** @internal */
export const GetApiAgentsRequest$outboundSchema: z.ZodType<
  GetApiAgentsRequest$Outbound,
  z.ZodTypeDef,
  GetApiAgentsRequest
> = z.object({
  filter: z.string().optional(),
  sort: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace GetApiAgentsRequest$ {
  /** @deprecated use `GetApiAgentsRequest$inboundSchema` instead. */
  export const inboundSchema = GetApiAgentsRequest$inboundSchema;
  /** @deprecated use `GetApiAgentsRequest$outboundSchema` instead. */
  export const outboundSchema = GetApiAgentsRequest$outboundSchema;
  /** @deprecated use `GetApiAgentsRequest$Outbound` instead. */
  export type Outbound = GetApiAgentsRequest$Outbound;
}

export function getApiAgentsRequestToJSON(
  getApiAgentsRequest: GetApiAgentsRequest,
): string {
  return JSON.stringify(
    GetApiAgentsRequest$outboundSchema.parse(getApiAgentsRequest),
  );
}

export function getApiAgentsRequestFromJSON(
  jsonString: string,
): SafeParseResult<GetApiAgentsRequest, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => GetApiAgentsRequest$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'GetApiAgentsRequest' from JSON`,
  );
}

/** @internal */
export const GetApiAgentsPagination$inboundSchema: z.ZodType<
  GetApiAgentsPagination,
  z.ZodTypeDef,
  unknown
> = z.object({
  total: z.number().int().optional(),
  limit: z.number().int().optional(),
  offset: z.number().int().optional(),
});

/** @internal */
export type GetApiAgentsPagination$Outbound = {
  total?: number | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

/** @internal */
export const GetApiAgentsPagination$outboundSchema: z.ZodType<
  GetApiAgentsPagination$Outbound,
  z.ZodTypeDef,
  GetApiAgentsPagination
> = z.object({
  total: z.number().int().optional(),
  limit: z.number().int().optional(),
  offset: z.number().int().optional(),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace GetApiAgentsPagination$ {
  /** @deprecated use `GetApiAgentsPagination$inboundSchema` instead. */
  export const inboundSchema = GetApiAgentsPagination$inboundSchema;
  /** @deprecated use `GetApiAgentsPagination$outboundSchema` instead. */
  export const outboundSchema = GetApiAgentsPagination$outboundSchema;
  /** @deprecated use `GetApiAgentsPagination$Outbound` instead. */
  export type Outbound = GetApiAgentsPagination$Outbound;
}

export function getApiAgentsPaginationToJSON(
  getApiAgentsPagination: GetApiAgentsPagination,
): string {
  return JSON.stringify(
    GetApiAgentsPagination$outboundSchema.parse(getApiAgentsPagination),
  );
}

export function getApiAgentsPaginationFromJSON(
  jsonString: string,
): SafeParseResult<GetApiAgentsPagination, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => GetApiAgentsPagination$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'GetApiAgentsPagination' from JSON`,
  );
}

/** @internal */
export const GetApiAgentsStatus$inboundSchema: z.ZodNativeEnum<
  typeof GetApiAgentsStatus
> = z.nativeEnum(GetApiAgentsStatus);

/** @internal */
export const GetApiAgentsStatus$outboundSchema: z.ZodNativeEnum<
  typeof GetApiAgentsStatus
> = GetApiAgentsStatus$inboundSchema;

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace GetApiAgentsStatus$ {
  /** @deprecated use `GetApiAgentsStatus$inboundSchema` instead. */
  export const inboundSchema = GetApiAgentsStatus$inboundSchema;
  /** @deprecated use `GetApiAgentsStatus$outboundSchema` instead. */
  export const outboundSchema = GetApiAgentsStatus$outboundSchema;
}

/** @internal */
export const GetApiAgentsAgent$inboundSchema: z.ZodType<
  GetApiAgentsAgent,
  z.ZodTypeDef,
  unknown
> = z.object({
  id: z.string().optional(),
  ownerId: z.string().optional(),
  walletAddress: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  status: GetApiAgentsStatus$inboundSchema.optional(),
  createdAt: z
    .string()
    .datetime({ offset: true })
    .transform((v) => new Date(v))
    .optional(),
  updatedAt: z
    .string()
    .datetime({ offset: true })
    .transform((v) => new Date(v))
    .optional(),
});

/** @internal */
export type GetApiAgentsAgent$Outbound = {
  id?: string | undefined;
  ownerId?: string | undefined;
  walletAddress?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  imageUrl?: string | undefined;
  status?: string | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
};

/** @internal */
export const GetApiAgentsAgent$outboundSchema: z.ZodType<
  GetApiAgentsAgent$Outbound,
  z.ZodTypeDef,
  GetApiAgentsAgent
> = z.object({
  id: z.string().optional(),
  ownerId: z.string().optional(),
  walletAddress: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  status: GetApiAgentsStatus$outboundSchema.optional(),
  createdAt: z
    .date()
    .transform((v) => v.toISOString())
    .optional(),
  updatedAt: z
    .date()
    .transform((v) => v.toISOString())
    .optional(),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace GetApiAgentsAgent$ {
  /** @deprecated use `GetApiAgentsAgent$inboundSchema` instead. */
  export const inboundSchema = GetApiAgentsAgent$inboundSchema;
  /** @deprecated use `GetApiAgentsAgent$outboundSchema` instead. */
  export const outboundSchema = GetApiAgentsAgent$outboundSchema;
  /** @deprecated use `GetApiAgentsAgent$Outbound` instead. */
  export type Outbound = GetApiAgentsAgent$Outbound;
}

export function getApiAgentsAgentToJSON(
  getApiAgentsAgent: GetApiAgentsAgent,
): string {
  return JSON.stringify(
    GetApiAgentsAgent$outboundSchema.parse(getApiAgentsAgent),
  );
}

export function getApiAgentsAgentFromJSON(
  jsonString: string,
): SafeParseResult<GetApiAgentsAgent, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => GetApiAgentsAgent$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'GetApiAgentsAgent' from JSON`,
  );
}

/** @internal */
export const GetApiAgentsResponse$inboundSchema: z.ZodType<
  GetApiAgentsResponse,
  z.ZodTypeDef,
  unknown
> = z.object({
  success: z.boolean().optional(),
  pagination: z.lazy(() => GetApiAgentsPagination$inboundSchema).optional(),
  agents: z.array(z.lazy(() => GetApiAgentsAgent$inboundSchema)).optional(),
});

/** @internal */
export type GetApiAgentsResponse$Outbound = {
  success?: boolean | undefined;
  pagination?: GetApiAgentsPagination$Outbound | undefined;
  agents?: Array<GetApiAgentsAgent$Outbound> | undefined;
};

/** @internal */
export const GetApiAgentsResponse$outboundSchema: z.ZodType<
  GetApiAgentsResponse$Outbound,
  z.ZodTypeDef,
  GetApiAgentsResponse
> = z.object({
  success: z.boolean().optional(),
  pagination: z.lazy(() => GetApiAgentsPagination$outboundSchema).optional(),
  agents: z.array(z.lazy(() => GetApiAgentsAgent$outboundSchema)).optional(),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace GetApiAgentsResponse$ {
  /** @deprecated use `GetApiAgentsResponse$inboundSchema` instead. */
  export const inboundSchema = GetApiAgentsResponse$inboundSchema;
  /** @deprecated use `GetApiAgentsResponse$outboundSchema` instead. */
  export const outboundSchema = GetApiAgentsResponse$outboundSchema;
  /** @deprecated use `GetApiAgentsResponse$Outbound` instead. */
  export type Outbound = GetApiAgentsResponse$Outbound;
}

export function getApiAgentsResponseToJSON(
  getApiAgentsResponse: GetApiAgentsResponse,
): string {
  return JSON.stringify(
    GetApiAgentsResponse$outboundSchema.parse(getApiAgentsResponse),
  );
}

export function getApiAgentsResponseFromJSON(
  jsonString: string,
): SafeParseResult<GetApiAgentsResponse, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => GetApiAgentsResponse$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'GetApiAgentsResponse' from JSON`,
  );
}
