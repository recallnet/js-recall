import { Context } from "./configuration.js";

/**
 * Prompt for the getAccountInfo function
 * @returns The prompt for getting account info
 */
export const getAccountInfoPrompt = (_context: Context = {}) => `
Gets account information from Recall, including token $RECALL balances, address, and nonce.

Arguments:
- address (str, optional): The address of the account, else, defaults to the connected user's account address.

Returns the account's balance, address, and nonce information. 
`;

/**
 * Prompt for the listBuckets function
 * @returns The prompt for listing buckets
 */
export const listBucketsPrompt = (_context: Context = {}) => `
Lists all buckets owned by the connected account in Recall.

Arguments:
- owner (str, optional): The address of the account, else, defaults to the connected user's account address.

Returns an array of buckets, each containing the bucket's address and metadata (which includes the alias, if present).
`;

/**
 * Prompt for the getCreditInfo function
 * @returns The prompt for getting credit info
 */
export const getCreditInfoPrompt = (_context: Context = {}) => `
Gets the credit information for the connected account.

Arguments:
- address (str, optional): The address of the account, else, defaults to the connected user's account address.

Returns the account's credit balance and credit approval information (used for access control).
`;

/**
 * Prompt for the buyCredit function
 * @returns The prompt for buying credit
 */
export const buyCreditPrompt = (_context: Context = {}) => `
Buys credit for the connected account. Use this to purchase storage and computation credits.

Arguments:
- amount (str): The amount of credit to buy (denominated in RECALL tokens).
- to (str, optional): The address of the account to buy credit for, else, defaults to the connected user's account address.

Returns a transaction hash confirming the credit purchase.
`;

/**
 * Prompt for the createBucket function
 * @returns The prompt for creating bucket
 */
export const createBucketPrompt = (_context: Context = {}) => `
Creates a new bucket in Recall. Buckets are containers for storing objects and data.

Arguments:
- bucketAlias (str): The alias to assign to the new bucket. Choose a descriptive name for your use case.

Returns the new bucket's address (unique identifier) and the transaction hash at which it was created.
`;

/**
 * Prompt for the getOrCreateBucket function
 * @returns The prompt for getting or creating bucket
 */
export const getOrCreateBucketPrompt = (_context: Context = {}) => `
Gets an existing bucket by alias, or creates a new one if it doesn't exist. Use this to ensure you have a bucket for storage.

Arguments:
- bucketAlias (str): The alias of the bucket to retrieve or create.

Returns the bucket's address (unique identifier) and the transaction hash at which it was created.
`;

/**
 * Prompt for the addObject function
 * @returns The prompt for adding object
 */
export const addObjectPrompt = (_context: Context = {}) => `
Adds an object to a bucket in Recall. Use this to store data like files, JSON, or raw bytes.

Arguments:
- bucket (str): The address of the bucket (EVM hex string address).
- key (str): The key under which to store the object. Use a descriptive path-like structure (e.g. "users/profile/avatar.jpg").
- data (str): The data to store as a string value.
- overwrite (bool, optional): Whether to overwrite existing data. Defaults to false.

Returns the transaction hash at which the object was stored.
`;

/**
 * Prompt for the getObject function
 * @returns The prompt for getting object
 */
export const getObjectPrompt = (_context: Context = {}) => `
Gets an object from a bucket in Recall. Use this to retrieve previously stored data.

Arguments:
- bucket (str): The address of the bucket (EVM hex string address).
- key (str): The key under which the object is stored.

Returns the object's data as a string value.
`;

/**
 * Prompt for the queryObjects function
 * @returns The prompt for querying objects
 */
export const queryObjectsPrompt = (_context: Context = {}) => `
Queries objects from a bucket in Recall. Use this to list or search for stored objects matching certain criteria.

Arguments:
- bucket (str): The address of the bucket (EVM hex string address).
- prefix (str, optional): The prefix of the objects to query (e.g. "users/" to list all user-related objects).
- delimiter (str, optional): The delimiter of the objects to query (e.g. "/" to group by directory-like structure).
- startKey (str, optional): The starting key of the objects to query, useful for pagination.
- limit (int, optional): The maximum number of objects to return.

Returns an array of objects matching the query criteria, including keys, blake3 hashes, sizes, and storage information.
`;
