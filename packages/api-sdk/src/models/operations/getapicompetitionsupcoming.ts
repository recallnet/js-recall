/*
 * Code generated by Speakeasy (https://speakeasy.com). DO NOT EDIT.
 */
import * as z from "zod";

import { safeParse } from "../../lib/schemas.js";
import { ClosedEnum } from "../../types/enums.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";

/**
 * Competition status (always pending)
 */
export const GetApiCompetitionsUpcomingStatus = {
  Pending: "pending",
} as const;
/**
 * Competition status (always pending)
 */
export type GetApiCompetitionsUpcomingStatus = ClosedEnum<
  typeof GetApiCompetitionsUpcomingStatus
>;

/**
 * Competition type
 */
export const GetApiCompetitionsUpcomingType = {
  Trading: "trading",
} as const;
/**
 * Competition type
 */
export type GetApiCompetitionsUpcomingType = ClosedEnum<
  typeof GetApiCompetitionsUpcomingType
>;

/**
 * The type of cross-chain trading allowed in this competition
 */
export const GetApiCompetitionsUpcomingCrossChainTradingType = {
  DisallowAll: "disallowAll",
  DisallowXParent: "disallowXParent",
  Allow: "allow",
} as const;
/**
 * The type of cross-chain trading allowed in this competition
 */
export type GetApiCompetitionsUpcomingCrossChainTradingType = ClosedEnum<
  typeof GetApiCompetitionsUpcomingCrossChainTradingType
>;

export type GetApiCompetitionsUpcomingCompetition = {
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
   * Competition status (always pending)
   */
  status?: GetApiCompetitionsUpcomingStatus | undefined;
  /**
   * Competition type
   */
  type?: GetApiCompetitionsUpcomingType | undefined;
  /**
   * The type of cross-chain trading allowed in this competition
   */
  crossChainTradingType?:
    | GetApiCompetitionsUpcomingCrossChainTradingType
    | undefined;
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
 * Upcoming competitions retrieved successfully
 */
export type GetApiCompetitionsUpcomingResponse = {
  /**
   * Operation success status
   */
  success?: boolean | undefined;
  competitions?: Array<GetApiCompetitionsUpcomingCompetition> | undefined;
};

/** @internal */
export const GetApiCompetitionsUpcomingStatus$inboundSchema: z.ZodNativeEnum<
  typeof GetApiCompetitionsUpcomingStatus
> = z.nativeEnum(GetApiCompetitionsUpcomingStatus);

/** @internal */
export const GetApiCompetitionsUpcomingStatus$outboundSchema: z.ZodNativeEnum<
  typeof GetApiCompetitionsUpcomingStatus
> = GetApiCompetitionsUpcomingStatus$inboundSchema;

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace GetApiCompetitionsUpcomingStatus$ {
  /** @deprecated use `GetApiCompetitionsUpcomingStatus$inboundSchema` instead. */
  export const inboundSchema = GetApiCompetitionsUpcomingStatus$inboundSchema;
  /** @deprecated use `GetApiCompetitionsUpcomingStatus$outboundSchema` instead. */
  export const outboundSchema = GetApiCompetitionsUpcomingStatus$outboundSchema;
}

/** @internal */
export const GetApiCompetitionsUpcomingType$inboundSchema: z.ZodNativeEnum<
  typeof GetApiCompetitionsUpcomingType
> = z.nativeEnum(GetApiCompetitionsUpcomingType);

/** @internal */
export const GetApiCompetitionsUpcomingType$outboundSchema: z.ZodNativeEnum<
  typeof GetApiCompetitionsUpcomingType
> = GetApiCompetitionsUpcomingType$inboundSchema;

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace GetApiCompetitionsUpcomingType$ {
  /** @deprecated use `GetApiCompetitionsUpcomingType$inboundSchema` instead. */
  export const inboundSchema = GetApiCompetitionsUpcomingType$inboundSchema;
  /** @deprecated use `GetApiCompetitionsUpcomingType$outboundSchema` instead. */
  export const outboundSchema = GetApiCompetitionsUpcomingType$outboundSchema;
}

/** @internal */
export const GetApiCompetitionsUpcomingCrossChainTradingType$inboundSchema: z.ZodNativeEnum<
  typeof GetApiCompetitionsUpcomingCrossChainTradingType
> = z.nativeEnum(GetApiCompetitionsUpcomingCrossChainTradingType);

/** @internal */
export const GetApiCompetitionsUpcomingCrossChainTradingType$outboundSchema: z.ZodNativeEnum<
  typeof GetApiCompetitionsUpcomingCrossChainTradingType
> = GetApiCompetitionsUpcomingCrossChainTradingType$inboundSchema;

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace GetApiCompetitionsUpcomingCrossChainTradingType$ {
  /** @deprecated use `GetApiCompetitionsUpcomingCrossChainTradingType$inboundSchema` instead. */
  export const inboundSchema =
    GetApiCompetitionsUpcomingCrossChainTradingType$inboundSchema;
  /** @deprecated use `GetApiCompetitionsUpcomingCrossChainTradingType$outboundSchema` instead. */
  export const outboundSchema =
    GetApiCompetitionsUpcomingCrossChainTradingType$outboundSchema;
}

/** @internal */
export const GetApiCompetitionsUpcomingCompetition$inboundSchema: z.ZodType<
  GetApiCompetitionsUpcomingCompetition,
  z.ZodTypeDef,
  unknown
> = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.nullable(z.string()).optional(),
  externalUrl: z.nullable(z.string()).optional(),
  imageUrl: z.nullable(z.string()).optional(),
  status: GetApiCompetitionsUpcomingStatus$inboundSchema.optional(),
  type: GetApiCompetitionsUpcomingType$inboundSchema.optional(),
  crossChainTradingType:
    GetApiCompetitionsUpcomingCrossChainTradingType$inboundSchema.optional(),
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
export type GetApiCompetitionsUpcomingCompetition$Outbound = {
  id?: string | undefined;
  name?: string | undefined;
  description?: string | null | undefined;
  externalUrl?: string | null | undefined;
  imageUrl?: string | null | undefined;
  status?: string | undefined;
  type?: string | undefined;
  crossChainTradingType?: string | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
};

/** @internal */
export const GetApiCompetitionsUpcomingCompetition$outboundSchema: z.ZodType<
  GetApiCompetitionsUpcomingCompetition$Outbound,
  z.ZodTypeDef,
  GetApiCompetitionsUpcomingCompetition
> = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.nullable(z.string()).optional(),
  externalUrl: z.nullable(z.string()).optional(),
  imageUrl: z.nullable(z.string()).optional(),
  status: GetApiCompetitionsUpcomingStatus$outboundSchema.optional(),
  type: GetApiCompetitionsUpcomingType$outboundSchema.optional(),
  crossChainTradingType:
    GetApiCompetitionsUpcomingCrossChainTradingType$outboundSchema.optional(),
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
export namespace GetApiCompetitionsUpcomingCompetition$ {
  /** @deprecated use `GetApiCompetitionsUpcomingCompetition$inboundSchema` instead. */
  export const inboundSchema =
    GetApiCompetitionsUpcomingCompetition$inboundSchema;
  /** @deprecated use `GetApiCompetitionsUpcomingCompetition$outboundSchema` instead. */
  export const outboundSchema =
    GetApiCompetitionsUpcomingCompetition$outboundSchema;
  /** @deprecated use `GetApiCompetitionsUpcomingCompetition$Outbound` instead. */
  export type Outbound = GetApiCompetitionsUpcomingCompetition$Outbound;
}

export function getApiCompetitionsUpcomingCompetitionToJSON(
  getApiCompetitionsUpcomingCompetition: GetApiCompetitionsUpcomingCompetition,
): string {
  return JSON.stringify(
    GetApiCompetitionsUpcomingCompetition$outboundSchema.parse(
      getApiCompetitionsUpcomingCompetition,
    ),
  );
}

export function getApiCompetitionsUpcomingCompetitionFromJSON(
  jsonString: string,
): SafeParseResult<GetApiCompetitionsUpcomingCompetition, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) =>
      GetApiCompetitionsUpcomingCompetition$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'GetApiCompetitionsUpcomingCompetition' from JSON`,
  );
}

/** @internal */
export const GetApiCompetitionsUpcomingResponse$inboundSchema: z.ZodType<
  GetApiCompetitionsUpcomingResponse,
  z.ZodTypeDef,
  unknown
> = z.object({
  success: z.boolean().optional(),
  competitions: z
    .array(z.lazy(() => GetApiCompetitionsUpcomingCompetition$inboundSchema))
    .optional(),
});

/** @internal */
export type GetApiCompetitionsUpcomingResponse$Outbound = {
  success?: boolean | undefined;
  competitions?:
    | Array<GetApiCompetitionsUpcomingCompetition$Outbound>
    | undefined;
};

/** @internal */
export const GetApiCompetitionsUpcomingResponse$outboundSchema: z.ZodType<
  GetApiCompetitionsUpcomingResponse$Outbound,
  z.ZodTypeDef,
  GetApiCompetitionsUpcomingResponse
> = z.object({
  success: z.boolean().optional(),
  competitions: z
    .array(z.lazy(() => GetApiCompetitionsUpcomingCompetition$outboundSchema))
    .optional(),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace GetApiCompetitionsUpcomingResponse$ {
  /** @deprecated use `GetApiCompetitionsUpcomingResponse$inboundSchema` instead. */
  export const inboundSchema = GetApiCompetitionsUpcomingResponse$inboundSchema;
  /** @deprecated use `GetApiCompetitionsUpcomingResponse$outboundSchema` instead. */
  export const outboundSchema =
    GetApiCompetitionsUpcomingResponse$outboundSchema;
  /** @deprecated use `GetApiCompetitionsUpcomingResponse$Outbound` instead. */
  export type Outbound = GetApiCompetitionsUpcomingResponse$Outbound;
}

export function getApiCompetitionsUpcomingResponseToJSON(
  getApiCompetitionsUpcomingResponse: GetApiCompetitionsUpcomingResponse,
): string {
  return JSON.stringify(
    GetApiCompetitionsUpcomingResponse$outboundSchema.parse(
      getApiCompetitionsUpcomingResponse,
    ),
  );
}

export function getApiCompetitionsUpcomingResponseFromJSON(
  jsonString: string,
): SafeParseResult<GetApiCompetitionsUpcomingResponse, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) =>
      GetApiCompetitionsUpcomingResponse$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'GetApiCompetitionsUpcomingResponse' from JSON`,
  );
}
