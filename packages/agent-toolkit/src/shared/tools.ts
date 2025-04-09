import { z } from "zod";

import { RecallClient } from "@recallnet/sdk/client";

import { Actions, Context } from "./configuration.js";
import {
  addObject,
  buyCredit,
  createBucket,
  getAccountInfo,
  getCreditInfo,
  getObject,
  getOrCreateBucket,
  listBuckets,
  queryObjects,
} from "./functions.js";
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
import {
  addObjectPrompt,
  buyCreditPrompt,
  createBucketPrompt,
  getAccountInfoPrompt,
  getCreditInfoPrompt,
  getObjectPrompt,
  getOrCreateBucketPrompt,
  listBucketsPrompt,
  queryObjectsPrompt,
} from "./prompts.js";
import { Result } from "./util.js";

/**
 * A tool is a function that can be called by the agent.
 * @param method - The method name.
 * @param name - The name of the tool.
 * @param description - The description of the tool.
 * @param parameters - The parameters of the tool.
 * @param actions - The {@link Actions} of the tool.
 */
export type Tool = {
  method: string;
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters: z.ZodObject<any, any, any, any>;
  actions: Actions;
  execute: (
    recall: RecallClient,
    context: Context,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<Result<any>>;
};

/**
 * A list of {@link Tool}s that can be used by the agent.
 */
export const tools = (context?: Context): Tool[] => [
  // Account read methods
  {
    method: "get_account_info",
    name: "Get Account Info",
    description: getAccountInfoPrompt(context),
    parameters: getAccountInfoParameters(context),
    actions: {
      account: {
        read: true,
      },
    },
    execute: getAccountInfo,
  },
  {
    method: "get_credit_info",
    name: "Get Credit Info",
    description: getCreditInfoPrompt(context),
    parameters: getCreditInfoParameters(context),
    actions: {
      account: {
        read: true,
      },
    },
    execute: getCreditInfo,
  },
  // Account write methods
  {
    method: "buy_credit",
    name: "Buy Credit",
    description: buyCreditPrompt(context),
    parameters: buyCreditParameters(context),
    actions: {
      account: {
        write: true,
      },
    },
    execute: buyCredit,
  },
  // Bucket read methods
  {
    method: "list_buckets",
    name: "List Buckets",
    description: listBucketsPrompt(context),
    parameters: listBucketsParameters(context),
    actions: {
      bucket: {
        read: true,
      },
    },
    execute: listBuckets,
  },
  {
    method: "get_object",
    name: "Get Object",
    description: getObjectPrompt(context),
    parameters: getObjectParameters(context),
    actions: {
      bucket: {
        read: true,
      },
    },
    execute: getObject,
  },
  {
    method: "query_objects",
    name: "Query Objects",
    description: queryObjectsPrompt(context),
    parameters: queryObjectsParameters(context),
    actions: {
      bucket: {
        read: true,
      },
    },
    execute: queryObjects,
  },
  // Bucket write methods
  {
    method: "create_bucket",
    name: "Create Bucket",
    description: createBucketPrompt(context),
    parameters: createBucketParameters(context),
    actions: {
      bucket: {
        write: true,
      },
    },
    execute: createBucket,
  },
  {
    method: "get_or_create_bucket",
    name: "Get or Create Bucket",
    description: getOrCreateBucketPrompt(context),
    parameters: getOrCreateBucketParameters(context),
    actions: {
      bucket: {
        read: true,
        write: true,
      },
    },
    execute: getOrCreateBucket,
  },
  {
    method: "add_object",
    name: "Add Object",
    description: addObjectPrompt(context),
    parameters: addObjectParameters(context),
    actions: {
      bucket: {
        write: true,
      },
    },
    execute: addObject,
  },
];
