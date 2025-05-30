/*
 * Code generated by Speakeasy (https://speakeasy.com). DO NOT EDIT.
 */
import * as z from "zod";

import { safeParse } from "../../lib/schemas.js";
import { ClosedEnum } from "../../types/enums.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";

export type GetApiCompetitionsCompetitionIdRequest = {
  /**
   * The ID of the competition to retrieve
   */
  competitionId: string;
};

/**
 * Competition status
 */
export const GetApiCompetitionsCompetitionIdStatus = {
  Pending: "pending",
  Active: "active",
  Completed: "completed",
} as const;
/**
 * Competition status
 */
export type GetApiCompetitionsCompetitionIdStatus = ClosedEnum<
  typeof GetApiCompetitionsCompetitionIdStatus
>;

/**
 * The type of cross-chain trading allowed in this competition
 */
export const GetApiCompetitionsCompetitionIdCrossChainTradingType = {
  DisallowAll: "disallowAll",
  DisallowXParent: "disallowXParent",
  Allow: "allow",
} as const;
/**
 * The type of cross-chain trading allowed in this competition
 */
export type GetApiCompetitionsCompetitionIdCrossChainTradingType = ClosedEnum<
  typeof GetApiCompetitionsCompetitionIdCrossChainTradingType
>;

export type GetApiCompetitionsCompetitionIdCompetition = {
  /**
   * Competition ID
   */
  id?: string | undefined;
  /**
   * Competition name
   */
  name?: string | undefined;
  /**
   * Competition description
   */
  description?: string | null | undefined;
  /**
   * External URL for competition details
   */
  externalUrl?: string | null | undefined;
  /**
   * URL to competition image
   */
  imageUrl?: string | null | undefined;
  /**
   * Competition status
   */
  status?: GetApiCompetitionsCompetitionIdStatus | undefined;
  /**
   * The type of cross-chain trading allowed in this competition
   */
  crossChainTradingType?:
    | GetApiCompetitionsCompetitionIdCrossChainTradingType
    | undefined;
  /**
   * Competition start date (null for pending competitions)
   */
  startDate?: Date | null | undefined;
  /**
   * Competition end date (null for pending/active competitions)
   */
  endDate?: Date | null | undefined;
  /**
   * When the competition was created
   */
  createdAt?: Date | undefined;
  /**
   * When the competition was last updated
   */
  updatedAt?: Date | undefined;
};

/**
 * Competition details retrieved successfully
 */
export type GetApiCompetitionsCompetitionIdResponse = {
  /**
   * Operation success status
   */
  success?: boolean | undefined;
  competition?: GetApiCompetitionsCompetitionIdCompetition | undefined;
};

/** @internal */
export const GetApiCompetitionsCompetitionIdRequest$inboundSchema: z.ZodType<
  GetApiCompetitionsCompetitionIdRequest,
  z.ZodTypeDef,
  unknown
> = z.object({
  competitionId: z.string(),
});

/** @internal */
export type GetApiCompetitionsCompetitionIdRequest$Outbound = {
  competitionId: string;
};

/** @internal */
export const GetApiCompetitionsCompetitionIdRequest$outboundSchema: z.ZodType<
  GetApiCompetitionsCompetitionIdRequest$Outbound,
  z.ZodTypeDef,
  GetApiCompetitionsCompetitionIdRequest
> = z.object({
  competitionId: z.string(),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace GetApiCompetitionsCompetitionIdRequest$ {
  /** @deprecated use `GetApiCompetitionsCompetitionIdRequest$inboundSchema` instead. */
  export const inboundSchema =
    GetApiCompetitionsCompetitionIdRequest$inboundSchema;
  /** @deprecated use `GetApiCompetitionsCompetitionIdRequest$outboundSchema` instead. */
  export const outboundSchema =
    GetApiCompetitionsCompetitionIdRequest$outboundSchema;
  /** @deprecated use `GetApiCompetitionsCompetitionIdRequest$Outbound` instead. */
  export type Outbound = GetApiCompetitionsCompetitionIdRequest$Outbound;
}

export function getApiCompetitionsCompetitionIdRequestToJSON(
  getApiCompetitionsCompetitionIdRequest: GetApiCompetitionsCompetitionIdRequest,
): string {
  return JSON.stringify(
    GetApiCompetitionsCompetitionIdRequest$outboundSchema.parse(
      getApiCompetitionsCompetitionIdRequest,
    ),
  );
}

export function getApiCompetitionsCompetitionIdRequestFromJSON(
  jsonString: string,
): SafeParseResult<GetApiCompetitionsCompetitionIdRequest, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) =>
      GetApiCompetitionsCompetitionIdRequest$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'GetApiCompetitionsCompetitionIdRequest' from JSON`,
  );
}

/** @internal */
export const GetApiCompetitionsCompetitionIdStatus$inboundSchema: z.ZodNativeEnum<
  typeof GetApiCompetitionsCompetitionIdStatus
> = z.nativeEnum(GetApiCompetitionsCompetitionIdStatus);

/** @internal */
export const GetApiCompetitionsCompetitionIdStatus$outboundSchema: z.ZodNativeEnum<
  typeof GetApiCompetitionsCompetitionIdStatus
> = GetApiCompetitionsCompetitionIdStatus$inboundSchema;

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace GetApiCompetitionsCompetitionIdStatus$ {
  /** @deprecated use `GetApiCompetitionsCompetitionIdStatus$inboundSchema` instead. */
  export const inboundSchema =
    GetApiCompetitionsCompetitionIdStatus$inboundSchema;
  /** @deprecated use `GetApiCompetitionsCompetitionIdStatus$outboundSchema` instead. */
  export const outboundSchema =
    GetApiCompetitionsCompetitionIdStatus$outboundSchema;
}

/** @internal */
export const GetApiCompetitionsCompetitionIdCrossChainTradingType$inboundSchema: z.ZodNativeEnum<
  typeof GetApiCompetitionsCompetitionIdCrossChainTradingType
> = z.nativeEnum(GetApiCompetitionsCompetitionIdCrossChainTradingType);

/** @internal */
export const GetApiCompetitionsCompetitionIdCrossChainTradingType$outboundSchema: z.ZodNativeEnum<
  typeof GetApiCompetitionsCompetitionIdCrossChainTradingType
> = GetApiCompetitionsCompetitionIdCrossChainTradingType$inboundSchema;

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace GetApiCompetitionsCompetitionIdCrossChainTradingType$ {
  /** @deprecated use `GetApiCompetitionsCompetitionIdCrossChainTradingType$inboundSchema` instead. */
  export const inboundSchema =
    GetApiCompetitionsCompetitionIdCrossChainTradingType$inboundSchema;
  /** @deprecated use `GetApiCompetitionsCompetitionIdCrossChainTradingType$outboundSchema` instead. */
  export const outboundSchema =
    GetApiCompetitionsCompetitionIdCrossChainTradingType$outboundSchema;
}

/** @internal */
export const GetApiCompetitionsCompetitionIdCompetition$inboundSchema: z.ZodType<
  GetApiCompetitionsCompetitionIdCompetition,
  z.ZodTypeDef,
  unknown
> = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.nullable(z.string()).optional(),
  externalUrl: z.nullable(z.string()).optional(),
  imageUrl: z.nullable(z.string()).optional(),
  status: GetApiCompetitionsCompetitionIdStatus$inboundSchema.optional(),
  crossChainTradingType:
    GetApiCompetitionsCompetitionIdCrossChainTradingType$inboundSchema.optional(),
  startDate: z
    .nullable(
      z
        .string()
        .datetime({ offset: true })
        .transform((v) => new Date(v)),
    )
    .optional(),
  endDate: z
    .nullable(
      z
        .string()
        .datetime({ offset: true })
        .transform((v) => new Date(v)),
    )
    .optional(),
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
export type GetApiCompetitionsCompetitionIdCompetition$Outbound = {
  id?: string | undefined;
  name?: string | undefined;
  description?: string | null | undefined;
  externalUrl?: string | null | undefined;
  imageUrl?: string | null | undefined;
  status?: string | undefined;
  crossChainTradingType?: string | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
};

/** @internal */
export const GetApiCompetitionsCompetitionIdCompetition$outboundSchema: z.ZodType<
  GetApiCompetitionsCompetitionIdCompetition$Outbound,
  z.ZodTypeDef,
  GetApiCompetitionsCompetitionIdCompetition
> = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.nullable(z.string()).optional(),
  externalUrl: z.nullable(z.string()).optional(),
  imageUrl: z.nullable(z.string()).optional(),
  status: GetApiCompetitionsCompetitionIdStatus$outboundSchema.optional(),
  crossChainTradingType:
    GetApiCompetitionsCompetitionIdCrossChainTradingType$outboundSchema.optional(),
  startDate: z.nullable(z.date().transform((v) => v.toISOString())).optional(),
  endDate: z.nullable(z.date().transform((v) => v.toISOString())).optional(),
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
export namespace GetApiCompetitionsCompetitionIdCompetition$ {
  /** @deprecated use `GetApiCompetitionsCompetitionIdCompetition$inboundSchema` instead. */
  export const inboundSchema =
    GetApiCompetitionsCompetitionIdCompetition$inboundSchema;
  /** @deprecated use `GetApiCompetitionsCompetitionIdCompetition$outboundSchema` instead. */
  export const outboundSchema =
    GetApiCompetitionsCompetitionIdCompetition$outboundSchema;
  /** @deprecated use `GetApiCompetitionsCompetitionIdCompetition$Outbound` instead. */
  export type Outbound = GetApiCompetitionsCompetitionIdCompetition$Outbound;
}

export function getApiCompetitionsCompetitionIdCompetitionToJSON(
  getApiCompetitionsCompetitionIdCompetition: GetApiCompetitionsCompetitionIdCompetition,
): string {
  return JSON.stringify(
    GetApiCompetitionsCompetitionIdCompetition$outboundSchema.parse(
      getApiCompetitionsCompetitionIdCompetition,
    ),
  );
}

export function getApiCompetitionsCompetitionIdCompetitionFromJSON(
  jsonString: string,
): SafeParseResult<
  GetApiCompetitionsCompetitionIdCompetition,
  SDKValidationError
> {
  return safeParse(
    jsonString,
    (x) =>
      GetApiCompetitionsCompetitionIdCompetition$inboundSchema.parse(
        JSON.parse(x),
      ),
    `Failed to parse 'GetApiCompetitionsCompetitionIdCompetition' from JSON`,
  );
}

/** @internal */
export const GetApiCompetitionsCompetitionIdResponse$inboundSchema: z.ZodType<
  GetApiCompetitionsCompetitionIdResponse,
  z.ZodTypeDef,
  unknown
> = z.object({
  success: z.boolean().optional(),
  competition: z
    .lazy(() => GetApiCompetitionsCompetitionIdCompetition$inboundSchema)
    .optional(),
});

/** @internal */
export type GetApiCompetitionsCompetitionIdResponse$Outbound = {
  success?: boolean | undefined;
  competition?: GetApiCompetitionsCompetitionIdCompetition$Outbound | undefined;
};

/** @internal */
export const GetApiCompetitionsCompetitionIdResponse$outboundSchema: z.ZodType<
  GetApiCompetitionsCompetitionIdResponse$Outbound,
  z.ZodTypeDef,
  GetApiCompetitionsCompetitionIdResponse
> = z.object({
  success: z.boolean().optional(),
  competition: z
    .lazy(() => GetApiCompetitionsCompetitionIdCompetition$outboundSchema)
    .optional(),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace GetApiCompetitionsCompetitionIdResponse$ {
  /** @deprecated use `GetApiCompetitionsCompetitionIdResponse$inboundSchema` instead. */
  export const inboundSchema =
    GetApiCompetitionsCompetitionIdResponse$inboundSchema;
  /** @deprecated use `GetApiCompetitionsCompetitionIdResponse$outboundSchema` instead. */
  export const outboundSchema =
    GetApiCompetitionsCompetitionIdResponse$outboundSchema;
  /** @deprecated use `GetApiCompetitionsCompetitionIdResponse$Outbound` instead. */
  export type Outbound = GetApiCompetitionsCompetitionIdResponse$Outbound;
}

export function getApiCompetitionsCompetitionIdResponseToJSON(
  getApiCompetitionsCompetitionIdResponse: GetApiCompetitionsCompetitionIdResponse,
): string {
  return JSON.stringify(
    GetApiCompetitionsCompetitionIdResponse$outboundSchema.parse(
      getApiCompetitionsCompetitionIdResponse,
    ),
  );
}

export function getApiCompetitionsCompetitionIdResponseFromJSON(
  jsonString: string,
): SafeParseResult<
  GetApiCompetitionsCompetitionIdResponse,
  SDKValidationError
> {
  return safeParse(
    jsonString,
    (x) =>
      GetApiCompetitionsCompetitionIdResponse$inboundSchema.parse(
        JSON.parse(x),
      ),
    `Failed to parse 'GetApiCompetitionsCompetitionIdResponse' from JSON`,
  );
}
