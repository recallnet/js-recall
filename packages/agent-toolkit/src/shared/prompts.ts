import { Context } from "./configuration.js";

/**
 * Prompt for the getAccountInfo function
 * @returns The prompt for getting account info
 */
export const getAccountInfoPrompt = (_context: Context = {}) => `
This tool will get account information from Recall, including token $RECALL balances, address, and nonce.

Arguments:
- address (str, optional): The address of the account, else, defaults to the connected user's account address.
`;

/**
 * Prompt for the listBuckets function
 * @returns The prompt for listing buckets
 */
export const listBucketsPrompt = (_context: Context = {}) => `
Lists all buckets owned by the connected account in Recall.

Arguments:
- owner (str, optional): The address of the account, else, defaults to the connected user's account address.
`;

/**
 * Prompt for the getCreditInfo function
 * @returns The prompt for getting credit info
 */
export const getCreditInfoPrompt = (_context: Context = {}) => `
Gets the credit information for the connected account.

Arguments:
- address (str, optional): The address of the account, else, defaults to the connected user's account address.
`;

/**
 * Prompt for the buyCredit function
 * @returns The prompt for buying credit
 */
export const buyCreditPrompt = (_context: Context = {}) => `
Buys credit for the connected account.

Arguments:
- amount (str): The amount of credit to buy in ETH.
- to (str, optional): The address of the account to buy credit for, else, defaults to the connected user's account address.
`;

/**
 * Prompt for the createBucket function
 * @returns The prompt for creating bucket
 */
export const createBucketPrompt = (_context: Context = {}) => `
Creates a new bucket in Recall.

Arguments:
- bucketAlias (str): The alias to assign to the new bucket.
`;

/**
 * Prompt for the getOrCreateBucket function
 * @returns The prompt for getting or creating bucket
 */
export const getOrCreateBucketPrompt = (_context: Context = {}) => `
Gets an existing bucket by alias or creates a new one if it doesn't exist.

Arguments:
- bucketAlias (str): The alias of the bucket to retrieve or create.
`;

/**
 * Prompt for the addObject function
 * @returns The prompt for adding object
 */
export const addObjectPrompt = (_context: Context = {}) => `
Adds an object to a bucket in Recall.

Arguments:
- bucket (str): The address of the bucket (EVM hex string address).
- key (str): The key under which to store the object.
- data (str | Uint8Array): The data to store.
- overwrite (bool, optional): Whether to overwrite existing data. Defaults to false.
`;

/**
 * Prompt for the getObject function
 * @returns The prompt for getting object
 */
export const getObjectPrompt = (_context: Context = {}) => `
Gets an object from a bucket in Recall.

Arguments:
- bucket (str): The address of the bucket (EVM hex string address).
- key (str): The key under which the object is stored.
- outputType (str, optional): The type of output to return ("string" or "uint8array"). Defaults to "uint8array".
`;

/**
 * Prompt for the queryObjects function
 * @returns The prompt for querying objects
 */
export const queryObjectsPrompt = (_context: Context = {}) => `
Queries objects from a bucket in Recall.

Arguments:
- bucket (str): The address of the bucket (EVM hex string address).
- prefix (str, optional): The prefix of the objects to query.
- delimiter (str, optional): The delimiter of the objects to query.
- startKey (str, optional): The starting key of the objects to query.
- limit (int, optional): The maximum number of objects to return.
`;
