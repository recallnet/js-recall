/*
 * Code generated by Speakeasy (https://speakeasy.com). DO NOT EDIT.
 */
import * as z from "zod";

import { safeParse } from "../../lib/schemas.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";

export type PostApiAuthLoginRequest = {
  /**
   * The SIWE message to be verified
   */
  message: string;
  /**
   * The signature of the SIWE message
   */
  signature: string;
};

/**
 * Authentication successful, session created
 */
export type PostApiAuthLoginResponse = {
  /**
   * The ID of the authenticated agent
   */
  agentId: string | null;
  /**
   * The wallet address of the authenticated agent
   */
  wallet: string;
};

/** @internal */
export const PostApiAuthLoginRequest$inboundSchema: z.ZodType<
  PostApiAuthLoginRequest,
  z.ZodTypeDef,
  unknown
> = z.object({
  message: z.string(),
  signature: z.string(),
});

/** @internal */
export type PostApiAuthLoginRequest$Outbound = {
  message: string;
  signature: string;
};

/** @internal */
export const PostApiAuthLoginRequest$outboundSchema: z.ZodType<
  PostApiAuthLoginRequest$Outbound,
  z.ZodTypeDef,
  PostApiAuthLoginRequest
> = z.object({
  message: z.string(),
  signature: z.string(),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace PostApiAuthLoginRequest$ {
  /** @deprecated use `PostApiAuthLoginRequest$inboundSchema` instead. */
  export const inboundSchema = PostApiAuthLoginRequest$inboundSchema;
  /** @deprecated use `PostApiAuthLoginRequest$outboundSchema` instead. */
  export const outboundSchema = PostApiAuthLoginRequest$outboundSchema;
  /** @deprecated use `PostApiAuthLoginRequest$Outbound` instead. */
  export type Outbound = PostApiAuthLoginRequest$Outbound;
}

export function postApiAuthLoginRequestToJSON(
  postApiAuthLoginRequest: PostApiAuthLoginRequest,
): string {
  return JSON.stringify(
    PostApiAuthLoginRequest$outboundSchema.parse(postApiAuthLoginRequest),
  );
}

export function postApiAuthLoginRequestFromJSON(
  jsonString: string,
): SafeParseResult<PostApiAuthLoginRequest, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => PostApiAuthLoginRequest$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'PostApiAuthLoginRequest' from JSON`,
  );
}

/** @internal */
export const PostApiAuthLoginResponse$inboundSchema: z.ZodType<
  PostApiAuthLoginResponse,
  z.ZodTypeDef,
  unknown
> = z.object({
  agentId: z.nullable(z.string()),
  wallet: z.string(),
});

/** @internal */
export type PostApiAuthLoginResponse$Outbound = {
  agentId: string | null;
  wallet: string;
};

/** @internal */
export const PostApiAuthLoginResponse$outboundSchema: z.ZodType<
  PostApiAuthLoginResponse$Outbound,
  z.ZodTypeDef,
  PostApiAuthLoginResponse
> = z.object({
  agentId: z.nullable(z.string()),
  wallet: z.string(),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace PostApiAuthLoginResponse$ {
  /** @deprecated use `PostApiAuthLoginResponse$inboundSchema` instead. */
  export const inboundSchema = PostApiAuthLoginResponse$inboundSchema;
  /** @deprecated use `PostApiAuthLoginResponse$outboundSchema` instead. */
  export const outboundSchema = PostApiAuthLoginResponse$outboundSchema;
  /** @deprecated use `PostApiAuthLoginResponse$Outbound` instead. */
  export type Outbound = PostApiAuthLoginResponse$Outbound;
}

export function postApiAuthLoginResponseToJSON(
  postApiAuthLoginResponse: PostApiAuthLoginResponse,
): string {
  return JSON.stringify(
    PostApiAuthLoginResponse$outboundSchema.parse(postApiAuthLoginResponse),
  );
}

export function postApiAuthLoginResponseFromJSON(
  jsonString: string,
): SafeParseResult<PostApiAuthLoginResponse, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => PostApiAuthLoginResponse$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'PostApiAuthLoginResponse' from JSON`,
  );
}
