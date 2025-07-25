/*
 * Code generated by Speakeasy (https://speakeasy.com). DO NOT EDIT.
 */
import * as z from "zod";

import { remap as remap$ } from "../../lib/primitives.js";
import { safeParse } from "../../lib/schemas.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";

export type PostApiUserVoteSecurity = {
  siweSession: string;
};

export type PostApiUserVoteRequest = {
  /**
   * ID of the agent to vote for
   */
  agentId: string;
  /**
   * ID of the competition the agent is participating in
   */
  competitionId: string;
};

export type PostApiUserVoteVote = {
  id?: string | undefined;
  userId?: string | undefined;
  agentId?: string | undefined;
  competitionId?: string | undefined;
  createdAt?: Date | undefined;
};

/**
 * Vote cast successfully
 */
export type PostApiUserVoteResponse = {
  success?: boolean | undefined;
  message?: string | undefined;
  vote?: PostApiUserVoteVote | undefined;
};

/** @internal */
export const PostApiUserVoteSecurity$inboundSchema: z.ZodType<
  PostApiUserVoteSecurity,
  z.ZodTypeDef,
  unknown
> = z
  .object({
    SIWESession: z.string(),
  })
  .transform((v) => {
    return remap$(v, {
      SIWESession: "siweSession",
    });
  });

/** @internal */
export type PostApiUserVoteSecurity$Outbound = {
  SIWESession: string;
};

/** @internal */
export const PostApiUserVoteSecurity$outboundSchema: z.ZodType<
  PostApiUserVoteSecurity$Outbound,
  z.ZodTypeDef,
  PostApiUserVoteSecurity
> = z
  .object({
    siweSession: z.string(),
  })
  .transform((v) => {
    return remap$(v, {
      siweSession: "SIWESession",
    });
  });

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace PostApiUserVoteSecurity$ {
  /** @deprecated use `PostApiUserVoteSecurity$inboundSchema` instead. */
  export const inboundSchema = PostApiUserVoteSecurity$inboundSchema;
  /** @deprecated use `PostApiUserVoteSecurity$outboundSchema` instead. */
  export const outboundSchema = PostApiUserVoteSecurity$outboundSchema;
  /** @deprecated use `PostApiUserVoteSecurity$Outbound` instead. */
  export type Outbound = PostApiUserVoteSecurity$Outbound;
}

export function postApiUserVoteSecurityToJSON(
  postApiUserVoteSecurity: PostApiUserVoteSecurity,
): string {
  return JSON.stringify(
    PostApiUserVoteSecurity$outboundSchema.parse(postApiUserVoteSecurity),
  );
}

export function postApiUserVoteSecurityFromJSON(
  jsonString: string,
): SafeParseResult<PostApiUserVoteSecurity, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => PostApiUserVoteSecurity$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'PostApiUserVoteSecurity' from JSON`,
  );
}

/** @internal */
export const PostApiUserVoteRequest$inboundSchema: z.ZodType<
  PostApiUserVoteRequest,
  z.ZodTypeDef,
  unknown
> = z.object({
  agentId: z.string(),
  competitionId: z.string(),
});

/** @internal */
export type PostApiUserVoteRequest$Outbound = {
  agentId: string;
  competitionId: string;
};

/** @internal */
export const PostApiUserVoteRequest$outboundSchema: z.ZodType<
  PostApiUserVoteRequest$Outbound,
  z.ZodTypeDef,
  PostApiUserVoteRequest
> = z.object({
  agentId: z.string(),
  competitionId: z.string(),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace PostApiUserVoteRequest$ {
  /** @deprecated use `PostApiUserVoteRequest$inboundSchema` instead. */
  export const inboundSchema = PostApiUserVoteRequest$inboundSchema;
  /** @deprecated use `PostApiUserVoteRequest$outboundSchema` instead. */
  export const outboundSchema = PostApiUserVoteRequest$outboundSchema;
  /** @deprecated use `PostApiUserVoteRequest$Outbound` instead. */
  export type Outbound = PostApiUserVoteRequest$Outbound;
}

export function postApiUserVoteRequestToJSON(
  postApiUserVoteRequest: PostApiUserVoteRequest,
): string {
  return JSON.stringify(
    PostApiUserVoteRequest$outboundSchema.parse(postApiUserVoteRequest),
  );
}

export function postApiUserVoteRequestFromJSON(
  jsonString: string,
): SafeParseResult<PostApiUserVoteRequest, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => PostApiUserVoteRequest$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'PostApiUserVoteRequest' from JSON`,
  );
}

/** @internal */
export const PostApiUserVoteVote$inboundSchema: z.ZodType<
  PostApiUserVoteVote,
  z.ZodTypeDef,
  unknown
> = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  agentId: z.string().optional(),
  competitionId: z.string().optional(),
  createdAt: z
    .string()
    .datetime({ offset: true })
    .transform((v) => new Date(v))
    .optional(),
});

/** @internal */
export type PostApiUserVoteVote$Outbound = {
  id?: string | undefined;
  userId?: string | undefined;
  agentId?: string | undefined;
  competitionId?: string | undefined;
  createdAt?: string | undefined;
};

/** @internal */
export const PostApiUserVoteVote$outboundSchema: z.ZodType<
  PostApiUserVoteVote$Outbound,
  z.ZodTypeDef,
  PostApiUserVoteVote
> = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  agentId: z.string().optional(),
  competitionId: z.string().optional(),
  createdAt: z
    .date()
    .transform((v) => v.toISOString())
    .optional(),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace PostApiUserVoteVote$ {
  /** @deprecated use `PostApiUserVoteVote$inboundSchema` instead. */
  export const inboundSchema = PostApiUserVoteVote$inboundSchema;
  /** @deprecated use `PostApiUserVoteVote$outboundSchema` instead. */
  export const outboundSchema = PostApiUserVoteVote$outboundSchema;
  /** @deprecated use `PostApiUserVoteVote$Outbound` instead. */
  export type Outbound = PostApiUserVoteVote$Outbound;
}

export function postApiUserVoteVoteToJSON(
  postApiUserVoteVote: PostApiUserVoteVote,
): string {
  return JSON.stringify(
    PostApiUserVoteVote$outboundSchema.parse(postApiUserVoteVote),
  );
}

export function postApiUserVoteVoteFromJSON(
  jsonString: string,
): SafeParseResult<PostApiUserVoteVote, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => PostApiUserVoteVote$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'PostApiUserVoteVote' from JSON`,
  );
}

/** @internal */
export const PostApiUserVoteResponse$inboundSchema: z.ZodType<
  PostApiUserVoteResponse,
  z.ZodTypeDef,
  unknown
> = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  vote: z.lazy(() => PostApiUserVoteVote$inboundSchema).optional(),
});

/** @internal */
export type PostApiUserVoteResponse$Outbound = {
  success?: boolean | undefined;
  message?: string | undefined;
  vote?: PostApiUserVoteVote$Outbound | undefined;
};

/** @internal */
export const PostApiUserVoteResponse$outboundSchema: z.ZodType<
  PostApiUserVoteResponse$Outbound,
  z.ZodTypeDef,
  PostApiUserVoteResponse
> = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  vote: z.lazy(() => PostApiUserVoteVote$outboundSchema).optional(),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace PostApiUserVoteResponse$ {
  /** @deprecated use `PostApiUserVoteResponse$inboundSchema` instead. */
  export const inboundSchema = PostApiUserVoteResponse$inboundSchema;
  /** @deprecated use `PostApiUserVoteResponse$outboundSchema` instead. */
  export const outboundSchema = PostApiUserVoteResponse$outboundSchema;
  /** @deprecated use `PostApiUserVoteResponse$Outbound` instead. */
  export type Outbound = PostApiUserVoteResponse$Outbound;
}

export function postApiUserVoteResponseToJSON(
  postApiUserVoteResponse: PostApiUserVoteResponse,
): string {
  return JSON.stringify(
    PostApiUserVoteResponse$outboundSchema.parse(postApiUserVoteResponse),
  );
}

export function postApiUserVoteResponseFromJSON(
  jsonString: string,
): SafeParseResult<PostApiUserVoteResponse, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => PostApiUserVoteResponse$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'PostApiUserVoteResponse' from JSON`,
  );
}
