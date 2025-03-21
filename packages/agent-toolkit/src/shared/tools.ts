import { z } from "zod";

import { Actions } from "./configuration.js";
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
  parameters: z.ZodObject<any, any, any, any>;
  actions: Actions;
};

/**
 * A list of {@link Tool}s that can be used by the agent.
 */
export const tools: Tool[] = [
  {
    method: "get_account_info",
    name: "Get Account Info",
    description: getAccountInfoPrompt,
    parameters: getAccountInfoParameters,
    actions: {
      account: {
        read: true,
      },
    },
  },
  {
    method: "get_credit_info",
    name: "Get Credit Info",
    description: getCreditInfoPrompt,
    parameters: getCreditInfoParameters,
    actions: {
      account: {
        read: true,
      },
    },
  },
  {
    method: "buy_credit",
    name: "Buy Credit",
    description: buyCreditPrompt,
    parameters: buyCreditParameters,
    actions: {
      account: {
        write: true,
      },
    },
  },
  {
    method: "create_bucket",
    name: "Create Bucket",
    description: createBucketPrompt,
    parameters: createBucketParameters,
    actions: {
      bucket: {
        write: true,
      },
    },
  },
  {
    method: "get_or_create_bucket",
    name: "Get or Create Bucket",
    description: getOrCreateBucketPrompt,
    parameters: getOrCreateBucketParameters,
    actions: {
      bucket: {
        read: true,
        write: true,
      },
    },
  },
  {
    method: "list_buckets",
    name: "List Buckets",
    description: listBucketsPrompt,
    parameters: listBucketsParameters,
    actions: {
      bucket: {
        read: true,
      },
    },
  },
  {
    method: "add_object",
    name: "Add Object",
    description: addObjectPrompt,
    parameters: addObjectParameters,
    actions: {
      bucket: {
        write: true,
      },
    },
  },
  {
    method: "get_object",
    name: "Get Object",
    description: getObjectPrompt,
    parameters: getObjectParameters,
    actions: {
      bucket: {
        read: true,
      },
    },
  },
  {
    method: "query_objects",
    name: "Query Objects",
    description: queryObjectsPrompt,
    parameters: queryObjectsParameters,
    actions: {
      bucket: {
        read: true,
      },
    },
  },
];
