/*
 * Code generated by Speakeasy (https://speakeasy.com). DO NOT EDIT.
 */
import * as z from "zod";

import { safeParse } from "../../lib/schemas.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";

export type GetApiAdminAgentsAgentIdRequest = {
  /**
   * ID of the agent
   */
  agentId: string;
};

export type GetApiAdminAgentsAgentIdAgent = {
  /**
   * Agent ID
   */
  id?: string | undefined;
  /**
   * Agent owner ID
   */
  ownerId?: string | undefined;
  /**
   * Agent name
   */
  name?: string | undefined;
  /**
   * Agent description
   */
  description?: string | null | undefined;
  /**
   * Agent status
   */
  status?: string | undefined;
  /**
   * URL to the agent's image
   */
  imageUrl?: string | null | undefined;
  /**
   * Agent creation timestamp
   */
  createdAt?: Date | undefined;
  /**
   * Agent update timestamp
   */
  updatedAt?: Date | undefined;
};

/**
 * Agent details retrieved successfully
 */
export type GetApiAdminAgentsAgentIdResponse = {
  /**
   * Operation success status
   */
  success?: boolean | undefined;
  agent?: GetApiAdminAgentsAgentIdAgent | undefined;
};

/** @internal */
export const GetApiAdminAgentsAgentIdRequest$inboundSchema: z.ZodType<
  GetApiAdminAgentsAgentIdRequest,
  z.ZodTypeDef,
  unknown
> = z.object({
  agentId: z.string(),
});

/** @internal */
export type GetApiAdminAgentsAgentIdRequest$Outbound = {
  agentId: string;
};

/** @internal */
export const GetApiAdminAgentsAgentIdRequest$outboundSchema: z.ZodType<
  GetApiAdminAgentsAgentIdRequest$Outbound,
  z.ZodTypeDef,
  GetApiAdminAgentsAgentIdRequest
> = z.object({
  agentId: z.string(),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace GetApiAdminAgentsAgentIdRequest$ {
  /** @deprecated use `GetApiAdminAgentsAgentIdRequest$inboundSchema` instead. */
  export const inboundSchema = GetApiAdminAgentsAgentIdRequest$inboundSchema;
  /** @deprecated use `GetApiAdminAgentsAgentIdRequest$outboundSchema` instead. */
  export const outboundSchema = GetApiAdminAgentsAgentIdRequest$outboundSchema;
  /** @deprecated use `GetApiAdminAgentsAgentIdRequest$Outbound` instead. */
  export type Outbound = GetApiAdminAgentsAgentIdRequest$Outbound;
}

export function getApiAdminAgentsAgentIdRequestToJSON(
  getApiAdminAgentsAgentIdRequest: GetApiAdminAgentsAgentIdRequest,
): string {
  return JSON.stringify(
    GetApiAdminAgentsAgentIdRequest$outboundSchema.parse(
      getApiAdminAgentsAgentIdRequest,
    ),
  );
}

export function getApiAdminAgentsAgentIdRequestFromJSON(
  jsonString: string,
): SafeParseResult<GetApiAdminAgentsAgentIdRequest, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => GetApiAdminAgentsAgentIdRequest$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'GetApiAdminAgentsAgentIdRequest' from JSON`,
  );
}

/** @internal */
export const GetApiAdminAgentsAgentIdAgent$inboundSchema: z.ZodType<
  GetApiAdminAgentsAgentIdAgent,
  z.ZodTypeDef,
  unknown
> = z.object({
  id: z.string().optional(),
  ownerId: z.string().optional(),
  name: z.string().optional(),
  description: z.nullable(z.string()).optional(),
  status: z.string().optional(),
  imageUrl: z.nullable(z.string()).optional(),
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
export type GetApiAdminAgentsAgentIdAgent$Outbound = {
  id?: string | undefined;
  ownerId?: string | undefined;
  name?: string | undefined;
  description?: string | null | undefined;
  status?: string | undefined;
  imageUrl?: string | null | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
};

/** @internal */
export const GetApiAdminAgentsAgentIdAgent$outboundSchema: z.ZodType<
  GetApiAdminAgentsAgentIdAgent$Outbound,
  z.ZodTypeDef,
  GetApiAdminAgentsAgentIdAgent
> = z.object({
  id: z.string().optional(),
  ownerId: z.string().optional(),
  name: z.string().optional(),
  description: z.nullable(z.string()).optional(),
  status: z.string().optional(),
  imageUrl: z.nullable(z.string()).optional(),
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
export namespace GetApiAdminAgentsAgentIdAgent$ {
  /** @deprecated use `GetApiAdminAgentsAgentIdAgent$inboundSchema` instead. */
  export const inboundSchema = GetApiAdminAgentsAgentIdAgent$inboundSchema;
  /** @deprecated use `GetApiAdminAgentsAgentIdAgent$outboundSchema` instead. */
  export const outboundSchema = GetApiAdminAgentsAgentIdAgent$outboundSchema;
  /** @deprecated use `GetApiAdminAgentsAgentIdAgent$Outbound` instead. */
  export type Outbound = GetApiAdminAgentsAgentIdAgent$Outbound;
}

export function getApiAdminAgentsAgentIdAgentToJSON(
  getApiAdminAgentsAgentIdAgent: GetApiAdminAgentsAgentIdAgent,
): string {
  return JSON.stringify(
    GetApiAdminAgentsAgentIdAgent$outboundSchema.parse(
      getApiAdminAgentsAgentIdAgent,
    ),
  );
}

export function getApiAdminAgentsAgentIdAgentFromJSON(
  jsonString: string,
): SafeParseResult<GetApiAdminAgentsAgentIdAgent, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => GetApiAdminAgentsAgentIdAgent$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'GetApiAdminAgentsAgentIdAgent' from JSON`,
  );
}

/** @internal */
export const GetApiAdminAgentsAgentIdResponse$inboundSchema: z.ZodType<
  GetApiAdminAgentsAgentIdResponse,
  z.ZodTypeDef,
  unknown
> = z.object({
  success: z.boolean().optional(),
  agent: z.lazy(() => GetApiAdminAgentsAgentIdAgent$inboundSchema).optional(),
});

/** @internal */
export type GetApiAdminAgentsAgentIdResponse$Outbound = {
  success?: boolean | undefined;
  agent?: GetApiAdminAgentsAgentIdAgent$Outbound | undefined;
};

/** @internal */
export const GetApiAdminAgentsAgentIdResponse$outboundSchema: z.ZodType<
  GetApiAdminAgentsAgentIdResponse$Outbound,
  z.ZodTypeDef,
  GetApiAdminAgentsAgentIdResponse
> = z.object({
  success: z.boolean().optional(),
  agent: z.lazy(() => GetApiAdminAgentsAgentIdAgent$outboundSchema).optional(),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace GetApiAdminAgentsAgentIdResponse$ {
  /** @deprecated use `GetApiAdminAgentsAgentIdResponse$inboundSchema` instead. */
  export const inboundSchema = GetApiAdminAgentsAgentIdResponse$inboundSchema;
  /** @deprecated use `GetApiAdminAgentsAgentIdResponse$outboundSchema` instead. */
  export const outboundSchema = GetApiAdminAgentsAgentIdResponse$outboundSchema;
  /** @deprecated use `GetApiAdminAgentsAgentIdResponse$Outbound` instead. */
  export type Outbound = GetApiAdminAgentsAgentIdResponse$Outbound;
}

export function getApiAdminAgentsAgentIdResponseToJSON(
  getApiAdminAgentsAgentIdResponse: GetApiAdminAgentsAgentIdResponse,
): string {
  return JSON.stringify(
    GetApiAdminAgentsAgentIdResponse$outboundSchema.parse(
      getApiAdminAgentsAgentIdResponse,
    ),
  );
}

export function getApiAdminAgentsAgentIdResponseFromJSON(
  jsonString: string,
): SafeParseResult<GetApiAdminAgentsAgentIdResponse, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => GetApiAdminAgentsAgentIdResponse$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'GetApiAdminAgentsAgentIdResponse' from JSON`,
  );
}
