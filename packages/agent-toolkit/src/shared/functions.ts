import { Address, parseEther } from "viem";
import { z } from "zod";

import { AccountInfo } from "@recallnet/sdk/account";
import { ListResult, QueryResult } from "@recallnet/sdk/bucket";
import { RecallClient } from "@recallnet/sdk/client";
import { CreditAccount } from "@recallnet/sdk/credit";

import type { Context } from "./configuration.js";
import {
  addObjectParameters,
  buyCreditParameters,
  createBucketParameters,
  getAccountInfoParameters,
  getCreditInfoParameters,
  getObjectParameters,
  getOrCreateBucketParameters,
  listBucketsParameters,
  queryObjectsParameters,
} from "./parameters.js";
import { Result } from "./util.js";

/**
 * Gets the account information for the current user.
 * @returns The account information.
 */
export const getAccountInfo = async (
  recall: RecallClient,
  context: Context,
  params: z.infer<ReturnType<typeof getAccountInfoParameters>>,
): Promise<Result<AccountInfo>> => {
  try {
    const address = params.address ? (params.address as Address) : undefined;
    const { result } = await recall.accountManager().info(address);
    if (!result) {
      return { success: false, error: "Failed to get account info" };
    }
    return { success: true, result };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: `Failed to get account info: ${error.message}`,
      };
    }
    return {
      success: false,
      error: "Failed to get account info: Unknown error",
    };
  }
};

/**
 * Lists all buckets for the current user.
 * @returns The list of buckets.
 */
export const listBuckets = async (
  recall: RecallClient,
  context: Context,
  params: z.infer<ReturnType<typeof listBucketsParameters>>,
): Promise<Result<ListResult>> => {
  try {
    const address = params.address ? (params.address as Address) : undefined;
    const { result } = await recall.bucketManager().list(address);
    if (!result) {
      return { success: false, error: "Failed to list buckets" };
    }
    return { success: true, result };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: `Failed to list buckets: ${error.message}`,
      };
    }
    return {
      success: false,
      error: "Failed to list buckets: Unknown error",
    };
  }
};

/**
 * Gets the credit information for the current user.
 * @returns The credit information.
 */
export const getCreditInfo = async (
  recall: RecallClient,
  context: Context,
  params: z.infer<ReturnType<typeof getCreditInfoParameters>>,
): Promise<Result<CreditAccount>> => {
  try {
    const address = params.address ? (params.address as Address) : undefined;
    const { result } = await recall.creditManager().getAccount(address);
    if (!result) {
      return { success: false, error: "Failed to get credit info" };
    }
    return { success: true, result };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: `Failed to get credit info: ${error.message}`,
      };
    }
    return {
      success: false,
      error: "Failed to get credit info: Unknown error",
    };
  }
};

/**
 * Buys credit for the current user.
 * @returns The transaction hash of the credit purchase.
 */
export const buyCredit = async (
  recall: RecallClient,
  context: Context,
  params: z.infer<ReturnType<typeof buyCreditParameters>>,
): Promise<Result<string>> => {
  try {
    const to = params.to ? (params.to as Address) : undefined;
    const { meta } = await recall
      .creditManager()
      .buy(parseEther(params.amount), to);
    if (!meta?.tx?.transactionHash) {
      return { success: false, error: "Transaction not found" };
    }
    return { success: true, result: meta.tx.transactionHash };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: `Failed to buy credit: ${error.message}`,
      };
    }
    return { success: false, error: "Failed to buy credit: Unknown error" };
  }
};

/**
 * Creates a new bucket for the current user.
 * @returns The bucket address and transaction hash.
 */
export const createBucket = async (
  recall: RecallClient,
  context: Context,
  params: z.infer<ReturnType<typeof createBucketParameters>>,
): Promise<Result<{ bucket: Address; txHash: string }>> => {
  try {
    const metadata = params.metadata ?? {};
    const { meta, result } = await recall.bucketManager().create({
      metadata: { alias: params.bucketAlias, ...metadata },
    });
    if (!meta?.tx || !result) {
      return { success: false, error: "Failed to create bucket" };
    }
    return {
      success: true,
      result: { bucket: result.bucket, txHash: meta.tx.transactionHash },
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: `Failed to create bucket: ${error.message}`,
      };
    }
    return {
      success: false,
      error: "Failed to create bucket: Unknown error",
    };
  }
};

/**
 * Gets or creates a bucket for the current user.
 * @returns The bucket address and transaction hash.
 */
export const getOrCreateBucket = async (
  recall: RecallClient,
  context: Context,
  params: z.infer<ReturnType<typeof getOrCreateBucketParameters>>,
): Promise<Result<{ bucket: Address; tx: string }>> => {
  try {
    // Try to find the bucket by alias
    const buckets = await recall.bucketManager().list();
    if (buckets?.result) {
      const bucket = buckets.result.find(
        (b) => b.metadata?.alias === params.bucketAlias,
      );
      if (bucket) {
        return { success: true, result: { bucket: bucket.addr, tx: "" } };
      }
    }

    // Create new bucket if not found
    const metadata = params.metadata ?? {};
    const { result, meta } = await recall.bucketManager().create({
      metadata: { alias: params.bucketAlias, ...metadata },
    });
    if (!meta?.tx || !result) {
      return { success: false, error: "Transaction not found" };
    }
    return {
      success: true,
      result: { bucket: result.bucket, tx: meta.tx.transactionHash },
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: `Failed to get or create bucket: ${error.message}`,
      };
    }
    return {
      success: false,
      error: "Failed to get or create bucket: Unknown error",
    };
  }
};

/**
 * Adds an object to a bucket.
 * @returns The transaction hash of the object addition.
 */
export const addObject = async (
  recall: RecallClient,
  context: Context,
  params: z.infer<ReturnType<typeof addObjectParameters>>,
): Promise<Result<{ txHash: string }>> => {
  try {
    const metadata = params.metadata ?? {};
    const dataToStore =
      typeof params.data === "string"
        ? new TextEncoder().encode(params.data)
        : params.data;

    const { meta } = await recall
      .bucketManager()
      .add(params.bucket as Address, params.key, dataToStore, {
        overwrite: params.overwrite ?? false,
        metadata: { ...metadata },
      });
    if (!meta?.tx) {
      return { success: false, error: "Transaction not found" };
    }
    return { success: true, result: { txHash: meta.tx.transactionHash } };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: `Failed to add object: ${error.message}`,
      };
    }
    return { success: false, error: "Failed to add object: Unknown error" };
  }
};

/**
 * Gets an object from a bucket.
 * @returns The object.
 */
export const getObject = async (
  recall: RecallClient,
  context: Context,
  params: z.infer<ReturnType<typeof getObjectParameters>>,
): Promise<Result<string | Uint8Array>> => {
  try {
    const { result } = await recall
      .bucketManager()
      .get(params.bucket as Address, params.key);

    if (!result) {
      return { success: false, error: "Object not found" };
    }

    return params.outputType === "string" || params.outputType === undefined
      ? { success: true, result: new TextDecoder().decode(result) }
      : { success: true, result };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: `Failed to get object: ${error.message}`,
      };
    }
    return { success: false, error: "Failed to get object: Unknown error" };
  }
};

/**
 * Queries objects in a bucket.
 * @returns The query result.
 */
export const queryObjects = async (
  recall: RecallClient,
  context: Context,
  params: z.infer<ReturnType<typeof queryObjectsParameters>>,
): Promise<Result<QueryResult>> => {
  try {
    const { result } = await recall
      .bucketManager()
      .query(params.bucket as Address, {
        prefix: params.prefix,
        delimiter: params.delimiter,
        startKey: params.startKey,
        limit: params.limit,
      });
    if (!result) {
      return { success: false, error: "Failed to query objects" };
    }
    return { success: true, result };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: `Failed to query objects: ${error.message}`,
      };
    }
    return { success: false, error: "Failed to query objects: Unknown error" };
  }
};
