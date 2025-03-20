//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// BlobManager
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**

*/
export const blobManagerAbi = [
  {
    type: "function",
    inputs: [
      {
        name: "params",
        internalType: "struct AddBlobParams",
        type: "tuple",
        components: [
          { name: "sponsor", internalType: "address", type: "address" },
          { name: "source", internalType: "string", type: "string" },
          { name: "blobHash", internalType: "string", type: "string" },
          { name: "metadataHash", internalType: "string", type: "string" },
          { name: "subscriptionId", internalType: "string", type: "string" },
          { name: "size", internalType: "uint64", type: "uint64" },
          { name: "ttl", internalType: "uint64", type: "uint64" },
          { name: "from", internalType: "address", type: "address" },
        ],
      },
    ],
    name: "addBlob",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "subscriber", internalType: "address", type: "address" },
      { name: "blobHash", internalType: "string", type: "string" },
      { name: "subscriptionId", internalType: "string", type: "string" },
      { name: "from", internalType: "address", type: "address" },
    ],
    name: "deleteBlob",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "size", internalType: "uint32", type: "uint32" }],
    name: "getAddedBlobs",
    outputs: [
      {
        name: "blobs",
        internalType: "struct BlobTuple[]",
        type: "tuple[]",
        components: [
          { name: "blobHash", internalType: "string", type: "string" },
          {
            name: "sourceInfo",
            internalType: "struct BlobSourceInfo[]",
            type: "tuple[]",
            components: [
              { name: "subscriber", internalType: "address", type: "address" },
              {
                name: "subscriptionId",
                internalType: "string",
                type: "string",
              },
              { name: "source", internalType: "string", type: "string" },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "blobHash", internalType: "string", type: "string" }],
    name: "getBlob",
    outputs: [
      {
        name: "blob",
        internalType: "struct Blob",
        type: "tuple",
        components: [
          { name: "size", internalType: "uint64", type: "uint64" },
          { name: "metadataHash", internalType: "string", type: "string" },
          {
            name: "subscribers",
            internalType: "struct Subscriber[]",
            type: "tuple[]",
            components: [
              {
                name: "subscriptionId",
                internalType: "string",
                type: "string",
              },
              { name: "expiry", internalType: "uint64", type: "uint64" },
            ],
          },
          { name: "status", internalType: "enum BlobStatus", type: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "subscriber", internalType: "address", type: "address" },
      { name: "blobHash", internalType: "string", type: "string" },
      { name: "subscriptionId", internalType: "string", type: "string" },
    ],
    name: "getBlobStatus",
    outputs: [
      { name: "status", internalType: "enum BlobStatus", type: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "size", internalType: "uint32", type: "uint32" }],
    name: "getPendingBlobs",
    outputs: [
      {
        name: "blobs",
        internalType: "struct BlobTuple[]",
        type: "tuple[]",
        components: [
          { name: "blobHash", internalType: "string", type: "string" },
          {
            name: "sourceInfo",
            internalType: "struct BlobSourceInfo[]",
            type: "tuple[]",
            components: [
              { name: "subscriber", internalType: "address", type: "address" },
              {
                name: "subscriptionId",
                internalType: "string",
                type: "string",
              },
              { name: "source", internalType: "string", type: "string" },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "getPendingBlobsCount",
    outputs: [{ name: "", internalType: "uint64", type: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "getPendingBytesCount",
    outputs: [{ name: "", internalType: "uint64", type: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "getStorageStats",
    outputs: [
      {
        name: "stats",
        internalType: "struct StorageStats",
        type: "tuple",
        components: [
          { name: "capacityFree", internalType: "uint64", type: "uint64" },
          { name: "capacityUsed", internalType: "uint64", type: "uint64" },
          { name: "numBlobs", internalType: "uint64", type: "uint64" },
          { name: "numResolving", internalType: "uint64", type: "uint64" },
          { name: "numAccounts", internalType: "uint64", type: "uint64" },
          { name: "bytesResolving", internalType: "uint64", type: "uint64" },
          { name: "numAdded", internalType: "uint64", type: "uint64" },
          { name: "bytesAdded", internalType: "uint64", type: "uint64" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "addr", internalType: "address", type: "address" }],
    name: "getStorageUsage",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "getSubnetStats",
    outputs: [
      {
        name: "stats",
        internalType: "struct SubnetStats",
        type: "tuple",
        components: [
          { name: "balance", internalType: "uint256", type: "uint256" },
          { name: "capacityFree", internalType: "uint64", type: "uint64" },
          { name: "capacityUsed", internalType: "uint64", type: "uint64" },
          { name: "creditSold", internalType: "uint256", type: "uint256" },
          { name: "creditCommitted", internalType: "uint256", type: "uint256" },
          { name: "creditDebited", internalType: "uint256", type: "uint256" },
          { name: "tokenCreditRate", internalType: "uint256", type: "uint256" },
          { name: "numAccounts", internalType: "uint64", type: "uint64" },
          { name: "numBlobs", internalType: "uint64", type: "uint64" },
          { name: "numAdded", internalType: "uint64", type: "uint64" },
          { name: "bytesAdded", internalType: "uint64", type: "uint64" },
          { name: "numResolving", internalType: "uint64", type: "uint64" },
          { name: "bytesResolving", internalType: "uint64", type: "uint64" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "oldHash", internalType: "string", type: "string" },
      {
        name: "params",
        internalType: "struct AddBlobParams",
        type: "tuple",
        components: [
          { name: "sponsor", internalType: "address", type: "address" },
          { name: "source", internalType: "string", type: "string" },
          { name: "blobHash", internalType: "string", type: "string" },
          { name: "metadataHash", internalType: "string", type: "string" },
          { name: "subscriptionId", internalType: "string", type: "string" },
          { name: "size", internalType: "uint64", type: "uint64" },
          { name: "ttl", internalType: "uint64", type: "uint64" },
          { name: "from", internalType: "address", type: "address" },
        ],
      },
    ],
    name: "overwriteBlob",
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/**

*/
export const blobManagerAddress = {
  2481632: "0x6E3f94065567560c6e1Bbc5e4584127220c15e14",
  248163216: "0x8ce361602B935680E8DeC218b820ff5056BeB7af",
} as const;

/**

*/
export const blobManagerConfig = {
  address: blobManagerAddress,
  abi: blobManagerAbi,
} as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// BucketManager
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**

*/
export const bucketManagerAbi = [
  {
    type: "function",
    inputs: [
      { name: "bucket", internalType: "address", type: "address" },
      { name: "source", internalType: "string", type: "string" },
      { name: "key", internalType: "string", type: "string" },
      { name: "blobHash", internalType: "string", type: "string" },
      { name: "recoveryHash", internalType: "string", type: "string" },
      { name: "size", internalType: "uint64", type: "uint64" },
      { name: "from", internalType: "address", type: "address" },
    ],
    name: "addObject",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "bucket", internalType: "address", type: "address" },
      {
        name: "params",
        internalType: "struct AddObjectParams",
        type: "tuple",
        components: [
          { name: "source", internalType: "string", type: "string" },
          { name: "key", internalType: "string", type: "string" },
          { name: "blobHash", internalType: "string", type: "string" },
          { name: "recoveryHash", internalType: "string", type: "string" },
          { name: "size", internalType: "uint64", type: "uint64" },
          { name: "ttl", internalType: "uint64", type: "uint64" },
          {
            name: "metadata",
            internalType: "struct KeyValue[]",
            type: "tuple[]",
            components: [
              { name: "key", internalType: "string", type: "string" },
              { name: "value", internalType: "string", type: "string" },
            ],
          },
          { name: "overwrite", internalType: "bool", type: "bool" },
          { name: "from", internalType: "address", type: "address" },
        ],
      },
    ],
    name: "addObject",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [],
    name: "createBucket",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "owner", internalType: "address", type: "address" },
      {
        name: "metadata",
        internalType: "struct KeyValue[]",
        type: "tuple[]",
        components: [
          { name: "key", internalType: "string", type: "string" },
          { name: "value", internalType: "string", type: "string" },
        ],
      },
    ],
    name: "createBucket",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "owner", internalType: "address", type: "address" }],
    name: "createBucket",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "bucket", internalType: "address", type: "address" },
      { name: "key", internalType: "string", type: "string" },
      { name: "from", internalType: "address", type: "address" },
    ],
    name: "deleteObject",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "bucket", internalType: "address", type: "address" },
      { name: "key", internalType: "string", type: "string" },
    ],
    name: "getObject",
    outputs: [
      {
        name: "",
        internalType: "struct ObjectValue",
        type: "tuple",
        components: [
          { name: "blobHash", internalType: "string", type: "string" },
          { name: "recoveryHash", internalType: "string", type: "string" },
          { name: "size", internalType: "uint64", type: "uint64" },
          { name: "expiry", internalType: "uint64", type: "uint64" },
          {
            name: "metadata",
            internalType: "struct KeyValue[]",
            type: "tuple[]",
            components: [
              { name: "key", internalType: "string", type: "string" },
              { name: "value", internalType: "string", type: "string" },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "listBuckets",
    outputs: [
      {
        name: "",
        internalType: "struct Machine[]",
        type: "tuple[]",
        components: [
          { name: "kind", internalType: "enum Kind", type: "uint8" },
          { name: "addr", internalType: "address", type: "address" },
          {
            name: "metadata",
            internalType: "struct KeyValue[]",
            type: "tuple[]",
            components: [
              { name: "key", internalType: "string", type: "string" },
              { name: "value", internalType: "string", type: "string" },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "owner", internalType: "address", type: "address" }],
    name: "listBuckets",
    outputs: [
      {
        name: "",
        internalType: "struct Machine[]",
        type: "tuple[]",
        components: [
          { name: "kind", internalType: "enum Kind", type: "uint8" },
          { name: "addr", internalType: "address", type: "address" },
          {
            name: "metadata",
            internalType: "struct KeyValue[]",
            type: "tuple[]",
            components: [
              { name: "key", internalType: "string", type: "string" },
              { name: "value", internalType: "string", type: "string" },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "bucket", internalType: "address", type: "address" }],
    name: "queryObjects",
    outputs: [
      {
        name: "",
        internalType: "struct Query",
        type: "tuple",
        components: [
          {
            name: "objects",
            internalType: "struct Object[]",
            type: "tuple[]",
            components: [
              { name: "key", internalType: "string", type: "string" },
              {
                name: "state",
                internalType: "struct ObjectState",
                type: "tuple",
                components: [
                  { name: "blobHash", internalType: "string", type: "string" },
                  { name: "size", internalType: "uint64", type: "uint64" },
                  { name: "expiry", internalType: "uint64", type: "uint64" },
                  {
                    name: "metadata",
                    internalType: "struct KeyValue[]",
                    type: "tuple[]",
                    components: [
                      { name: "key", internalType: "string", type: "string" },
                      { name: "value", internalType: "string", type: "string" },
                    ],
                  },
                ],
              },
            ],
          },
          {
            name: "commonPrefixes",
            internalType: "string[]",
            type: "string[]",
          },
          { name: "nextKey", internalType: "string", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "bucket", internalType: "address", type: "address" },
      { name: "prefix", internalType: "string", type: "string" },
      { name: "delimiter", internalType: "string", type: "string" },
      { name: "startKey", internalType: "string", type: "string" },
      { name: "limit", internalType: "uint64", type: "uint64" },
    ],
    name: "queryObjects",
    outputs: [
      {
        name: "",
        internalType: "struct Query",
        type: "tuple",
        components: [
          {
            name: "objects",
            internalType: "struct Object[]",
            type: "tuple[]",
            components: [
              { name: "key", internalType: "string", type: "string" },
              {
                name: "state",
                internalType: "struct ObjectState",
                type: "tuple",
                components: [
                  { name: "blobHash", internalType: "string", type: "string" },
                  { name: "size", internalType: "uint64", type: "uint64" },
                  { name: "expiry", internalType: "uint64", type: "uint64" },
                  {
                    name: "metadata",
                    internalType: "struct KeyValue[]",
                    type: "tuple[]",
                    components: [
                      { name: "key", internalType: "string", type: "string" },
                      { name: "value", internalType: "string", type: "string" },
                    ],
                  },
                ],
              },
            ],
          },
          {
            name: "commonPrefixes",
            internalType: "string[]",
            type: "string[]",
          },
          { name: "nextKey", internalType: "string", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "bucket", internalType: "address", type: "address" },
      { name: "prefix", internalType: "string", type: "string" },
      { name: "delimiter", internalType: "string", type: "string" },
    ],
    name: "queryObjects",
    outputs: [
      {
        name: "",
        internalType: "struct Query",
        type: "tuple",
        components: [
          {
            name: "objects",
            internalType: "struct Object[]",
            type: "tuple[]",
            components: [
              { name: "key", internalType: "string", type: "string" },
              {
                name: "state",
                internalType: "struct ObjectState",
                type: "tuple",
                components: [
                  { name: "blobHash", internalType: "string", type: "string" },
                  { name: "size", internalType: "uint64", type: "uint64" },
                  { name: "expiry", internalType: "uint64", type: "uint64" },
                  {
                    name: "metadata",
                    internalType: "struct KeyValue[]",
                    type: "tuple[]",
                    components: [
                      { name: "key", internalType: "string", type: "string" },
                      { name: "value", internalType: "string", type: "string" },
                    ],
                  },
                ],
              },
            ],
          },
          {
            name: "commonPrefixes",
            internalType: "string[]",
            type: "string[]",
          },
          { name: "nextKey", internalType: "string", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "bucket", internalType: "address", type: "address" },
      { name: "prefix", internalType: "string", type: "string" },
      { name: "delimiter", internalType: "string", type: "string" },
      { name: "startKey", internalType: "string", type: "string" },
    ],
    name: "queryObjects",
    outputs: [
      {
        name: "",
        internalType: "struct Query",
        type: "tuple",
        components: [
          {
            name: "objects",
            internalType: "struct Object[]",
            type: "tuple[]",
            components: [
              { name: "key", internalType: "string", type: "string" },
              {
                name: "state",
                internalType: "struct ObjectState",
                type: "tuple",
                components: [
                  { name: "blobHash", internalType: "string", type: "string" },
                  { name: "size", internalType: "uint64", type: "uint64" },
                  { name: "expiry", internalType: "uint64", type: "uint64" },
                  {
                    name: "metadata",
                    internalType: "struct KeyValue[]",
                    type: "tuple[]",
                    components: [
                      { name: "key", internalType: "string", type: "string" },
                      { name: "value", internalType: "string", type: "string" },
                    ],
                  },
                ],
              },
            ],
          },
          {
            name: "commonPrefixes",
            internalType: "string[]",
            type: "string[]",
          },
          { name: "nextKey", internalType: "string", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "bucket", internalType: "address", type: "address" },
      { name: "prefix", internalType: "string", type: "string" },
    ],
    name: "queryObjects",
    outputs: [
      {
        name: "",
        internalType: "struct Query",
        type: "tuple",
        components: [
          {
            name: "objects",
            internalType: "struct Object[]",
            type: "tuple[]",
            components: [
              { name: "key", internalType: "string", type: "string" },
              {
                name: "state",
                internalType: "struct ObjectState",
                type: "tuple",
                components: [
                  { name: "blobHash", internalType: "string", type: "string" },
                  { name: "size", internalType: "uint64", type: "uint64" },
                  { name: "expiry", internalType: "uint64", type: "uint64" },
                  {
                    name: "metadata",
                    internalType: "struct KeyValue[]",
                    type: "tuple[]",
                    components: [
                      { name: "key", internalType: "string", type: "string" },
                      { name: "value", internalType: "string", type: "string" },
                    ],
                  },
                ],
              },
            ],
          },
          {
            name: "commonPrefixes",
            internalType: "string[]",
            type: "string[]",
          },
          { name: "nextKey", internalType: "string", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "bucket", internalType: "address", type: "address" },
      { name: "key", internalType: "string", type: "string" },
      {
        name: "metadata",
        internalType: "struct KeyValue[]",
        type: "tuple[]",
        components: [
          { name: "key", internalType: "string", type: "string" },
          { name: "value", internalType: "string", type: "string" },
        ],
      },
      { name: "from", internalType: "address", type: "address" },
    ],
    name: "updateObjectMetadata",
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/**

*/
export const bucketManagerAddress = {
  2481632: "0x7a9Cec860adF2C64274D0aD7fbF0b5Bf0426a200",
  248163216: "0xeD1DB453C3156Ff3155a97AD217b3087D5Dc5f6E",
} as const;

/**

*/
export const bucketManagerConfig = {
  address: bucketManagerAddress,
  abi: bucketManagerAbi,
} as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// CreditManager
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**

*/
export const creditManagerAbi = [
  {
    type: "function",
    inputs: [{ name: "to", internalType: "address", type: "address" }],
    name: "approveCredit",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "from", internalType: "address", type: "address" },
      { name: "to", internalType: "address", type: "address" },
      { name: "caller", internalType: "address[]", type: "address[]" },
    ],
    name: "approveCredit",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "from", internalType: "address", type: "address" },
      { name: "to", internalType: "address", type: "address" },
      { name: "caller", internalType: "address[]", type: "address[]" },
      { name: "creditLimit", internalType: "uint256", type: "uint256" },
      { name: "gasFeeLimit", internalType: "uint256", type: "uint256" },
      { name: "ttl", internalType: "uint64", type: "uint64" },
    ],
    name: "approveCredit",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "from", internalType: "address", type: "address" },
      { name: "to", internalType: "address", type: "address" },
    ],
    name: "approveCredit",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [],
    name: "buyCredit",
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    inputs: [{ name: "recipient", internalType: "address", type: "address" }],
    name: "buyCredit",
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    inputs: [{ name: "addr", internalType: "address", type: "address" }],
    name: "getAccount",
    outputs: [
      {
        name: "account",
        internalType: "struct Account",
        type: "tuple",
        components: [
          { name: "capacityUsed", internalType: "uint64", type: "uint64" },
          { name: "creditFree", internalType: "uint256", type: "uint256" },
          { name: "creditCommitted", internalType: "uint256", type: "uint256" },
          { name: "creditSponsor", internalType: "address", type: "address" },
          { name: "lastDebitEpoch", internalType: "uint64", type: "uint64" },
          {
            name: "approvalsTo",
            internalType: "struct Approval[]",
            type: "tuple[]",
            components: [
              { name: "addr", internalType: "address", type: "address" },
              {
                name: "approval",
                internalType: "struct CreditApproval",
                type: "tuple",
                components: [
                  {
                    name: "creditLimit",
                    internalType: "uint256",
                    type: "uint256",
                  },
                  {
                    name: "gasFeeLimit",
                    internalType: "uint256",
                    type: "uint256",
                  },
                  { name: "expiry", internalType: "uint64", type: "uint64" },
                  {
                    name: "creditUsed",
                    internalType: "uint256",
                    type: "uint256",
                  },
                  {
                    name: "gasFeeUsed",
                    internalType: "uint256",
                    type: "uint256",
                  },
                ],
              },
            ],
          },
          {
            name: "approvalsFrom",
            internalType: "struct Approval[]",
            type: "tuple[]",
            components: [
              { name: "addr", internalType: "address", type: "address" },
              {
                name: "approval",
                internalType: "struct CreditApproval",
                type: "tuple",
                components: [
                  {
                    name: "creditLimit",
                    internalType: "uint256",
                    type: "uint256",
                  },
                  {
                    name: "gasFeeLimit",
                    internalType: "uint256",
                    type: "uint256",
                  },
                  { name: "expiry", internalType: "uint64", type: "uint64" },
                  {
                    name: "creditUsed",
                    internalType: "uint256",
                    type: "uint256",
                  },
                  {
                    name: "gasFeeUsed",
                    internalType: "uint256",
                    type: "uint256",
                  },
                ],
              },
            ],
          },
          { name: "maxTtl", internalType: "uint64", type: "uint64" },
          { name: "gasAllowance", internalType: "uint256", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "from", internalType: "address", type: "address" },
      { name: "to", internalType: "address", type: "address" },
    ],
    name: "getCreditApproval",
    outputs: [
      {
        name: "approval",
        internalType: "struct CreditApproval",
        type: "tuple",
        components: [
          { name: "creditLimit", internalType: "uint256", type: "uint256" },
          { name: "gasFeeLimit", internalType: "uint256", type: "uint256" },
          { name: "expiry", internalType: "uint64", type: "uint64" },
          { name: "creditUsed", internalType: "uint256", type: "uint256" },
          { name: "gasFeeUsed", internalType: "uint256", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "addr", internalType: "address", type: "address" }],
    name: "getCreditBalance",
    outputs: [
      {
        name: "balance",
        internalType: "struct Balance",
        type: "tuple",
        components: [
          { name: "creditFree", internalType: "uint256", type: "uint256" },
          { name: "creditCommitted", internalType: "uint256", type: "uint256" },
          { name: "creditSponsor", internalType: "address", type: "address" },
          { name: "lastDebitEpoch", internalType: "uint64", type: "uint64" },
          {
            name: "approvalsTo",
            internalType: "struct Approval[]",
            type: "tuple[]",
            components: [
              { name: "addr", internalType: "address", type: "address" },
              {
                name: "approval",
                internalType: "struct CreditApproval",
                type: "tuple",
                components: [
                  {
                    name: "creditLimit",
                    internalType: "uint256",
                    type: "uint256",
                  },
                  {
                    name: "gasFeeLimit",
                    internalType: "uint256",
                    type: "uint256",
                  },
                  { name: "expiry", internalType: "uint64", type: "uint64" },
                  {
                    name: "creditUsed",
                    internalType: "uint256",
                    type: "uint256",
                  },
                  {
                    name: "gasFeeUsed",
                    internalType: "uint256",
                    type: "uint256",
                  },
                ],
              },
            ],
          },
          {
            name: "approvalsFrom",
            internalType: "struct Approval[]",
            type: "tuple[]",
            components: [
              { name: "addr", internalType: "address", type: "address" },
              {
                name: "approval",
                internalType: "struct CreditApproval",
                type: "tuple",
                components: [
                  {
                    name: "creditLimit",
                    internalType: "uint256",
                    type: "uint256",
                  },
                  {
                    name: "gasFeeLimit",
                    internalType: "uint256",
                    type: "uint256",
                  },
                  { name: "expiry", internalType: "uint64", type: "uint64" },
                  {
                    name: "creditUsed",
                    internalType: "uint256",
                    type: "uint256",
                  },
                  {
                    name: "gasFeeUsed",
                    internalType: "uint256",
                    type: "uint256",
                  },
                ],
              },
            ],
          },
          { name: "gasAllowance", internalType: "uint256", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "getCreditStats",
    outputs: [
      {
        name: "stats",
        internalType: "struct CreditStats",
        type: "tuple",
        components: [
          { name: "balance", internalType: "uint256", type: "uint256" },
          { name: "creditSold", internalType: "uint256", type: "uint256" },
          { name: "creditCommitted", internalType: "uint256", type: "uint256" },
          { name: "creditDebited", internalType: "uint256", type: "uint256" },
          { name: "tokenCreditRate", internalType: "uint256", type: "uint256" },
          { name: "numAccounts", internalType: "uint64", type: "uint64" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "from", internalType: "address", type: "address" },
      { name: "to", internalType: "address", type: "address" },
    ],
    name: "revokeCredit",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "to", internalType: "address", type: "address" }],
    name: "revokeCredit",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "from", internalType: "address", type: "address" },
      { name: "to", internalType: "address", type: "address" },
      { name: "caller", internalType: "address", type: "address" },
    ],
    name: "revokeCredit",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "from", internalType: "address", type: "address" },
      { name: "sponsor", internalType: "address", type: "address" },
    ],
    name: "setAccountSponsor",
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/**

*/
export const creditManagerAddress = {
  2481632: "0x61F50eEC83043a4635956B54EEDf5Eea8CcaBc76",
  248163216: "0x196dBCBb54b8ec4958c959D8949EBFE87aC2Aaaf",
} as const;

/**

*/
export const creditManagerConfig = {
  address: creditManagerAddress,
  abi: creditManagerAbi,
} as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// GatewayManagerFacet
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * -
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0x136066500b332e7D72643EE7690E9C708702c7e6)
 */
export const gatewayManagerFacetAbi = [
  {
    type: "function",
    inputs: [{ name: "amount", internalType: "uint256", type: "uint256" }],
    name: "addStake",
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    inputs: [
      {
        name: "subnetId",
        internalType: "struct SubnetID",
        type: "tuple",
        components: [
          { name: "root", internalType: "uint64", type: "uint64" },
          { name: "route", internalType: "address[]", type: "address[]" },
        ],
      },
      {
        name: "to",
        internalType: "struct FvmAddress",
        type: "tuple",
        components: [
          { name: "addrType", internalType: "uint8", type: "uint8" },
          { name: "payload", internalType: "bytes", type: "bytes" },
        ],
      },
    ],
    name: "fund",
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    inputs: [
      {
        name: "subnetId",
        internalType: "struct SubnetID",
        type: "tuple",
        components: [
          { name: "root", internalType: "uint64", type: "uint64" },
          { name: "route", internalType: "address[]", type: "address[]" },
        ],
      },
      {
        name: "to",
        internalType: "struct FvmAddress",
        type: "tuple",
        components: [
          { name: "addrType", internalType: "uint8", type: "uint8" },
          { name: "payload", internalType: "bytes", type: "bytes" },
        ],
      },
      { name: "amount", internalType: "uint256", type: "uint256" },
    ],
    name: "fundWithToken",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [],
    name: "kill",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "genesisCircSupply", internalType: "uint256", type: "uint256" },
      { name: "collateral", internalType: "uint256", type: "uint256" },
    ],
    name: "register",
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    inputs: [
      {
        name: "to",
        internalType: "struct FvmAddress",
        type: "tuple",
        components: [
          { name: "addrType", internalType: "uint8", type: "uint8" },
          { name: "payload", internalType: "bytes", type: "bytes" },
        ],
      },
    ],
    name: "release",
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    inputs: [{ name: "amount", internalType: "uint256", type: "uint256" }],
    name: "releaseStake",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "epoch",
        internalType: "uint256",
        type: "uint256",
        indexed: true,
      },
    ],
    name: "NewBottomUpMsgBatch",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "subnet",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "message",
        internalType: "struct IpcEnvelope",
        type: "tuple",
        components: [
          { name: "kind", internalType: "enum IpcMsgKind", type: "uint8" },
          {
            name: "to",
            internalType: "struct IPCAddress",
            type: "tuple",
            components: [
              {
                name: "subnetId",
                internalType: "struct SubnetID",
                type: "tuple",
                components: [
                  { name: "root", internalType: "uint64", type: "uint64" },
                  {
                    name: "route",
                    internalType: "address[]",
                    type: "address[]",
                  },
                ],
              },
              {
                name: "rawAddress",
                internalType: "struct FvmAddress",
                type: "tuple",
                components: [
                  { name: "addrType", internalType: "uint8", type: "uint8" },
                  { name: "payload", internalType: "bytes", type: "bytes" },
                ],
              },
            ],
          },
          {
            name: "from",
            internalType: "struct IPCAddress",
            type: "tuple",
            components: [
              {
                name: "subnetId",
                internalType: "struct SubnetID",
                type: "tuple",
                components: [
                  { name: "root", internalType: "uint64", type: "uint64" },
                  {
                    name: "route",
                    internalType: "address[]",
                    type: "address[]",
                  },
                ],
              },
              {
                name: "rawAddress",
                internalType: "struct FvmAddress",
                type: "tuple",
                components: [
                  { name: "addrType", internalType: "uint8", type: "uint8" },
                  { name: "payload", internalType: "bytes", type: "bytes" },
                ],
              },
            ],
          },
          { name: "nonce", internalType: "uint64", type: "uint64" },
          { name: "value", internalType: "uint256", type: "uint256" },
          { name: "message", internalType: "bytes", type: "bytes" },
        ],
        indexed: false,
      },
    ],
    name: "NewTopDownMessage",
  },
  {
    type: "error",
    inputs: [{ name: "target", internalType: "address", type: "address" }],
    name: "AddressEmptyCode",
  },
  {
    type: "error",
    inputs: [{ name: "account", internalType: "address", type: "address" }],
    name: "AddressInsufficientBalance",
  },
  { type: "error", inputs: [], name: "AlreadyRegisteredSubnet" },
  { type: "error", inputs: [], name: "CallFailed" },
  { type: "error", inputs: [], name: "CannotReleaseZero" },
  { type: "error", inputs: [], name: "FailedInnerCall" },
  { type: "error", inputs: [], name: "InsufficientFunds" },
  { type: "error", inputs: [], name: "InvalidActorAddress" },
  {
    type: "error",
    inputs: [
      {
        name: "reason",
        internalType: "enum InvalidXnetMessageReason",
        type: "uint8",
      },
    ],
    name: "InvalidXnetMessage",
  },
  {
    type: "error",
    inputs: [{ name: "reason", internalType: "string", type: "string" }],
    name: "MethodNotAllowed",
  },
  { type: "error", inputs: [], name: "NotEmptySubnetCircSupply" },
  { type: "error", inputs: [], name: "NotEnoughBalance" },
  { type: "error", inputs: [], name: "NotEnoughFunds" },
  { type: "error", inputs: [], name: "NotEnoughFundsToRelease" },
  { type: "error", inputs: [], name: "NotRegisteredSubnet" },
  { type: "error", inputs: [], name: "ReentrancyError" },
  {
    type: "error",
    inputs: [{ name: "token", internalType: "address", type: "address" }],
    name: "SafeERC20FailedOperation",
  },
] as const;

/**
 * -
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0x136066500b332e7D72643EE7690E9C708702c7e6)
 */
export const gatewayManagerFacetAddress = {
  31337: "0x9A676e781A523b5d0C0e43731313A708CB607508",
  314159: "0x136066500b332e7D72643EE7690E9C708702c7e6",
  2481632: "0x77Aa40B105843728088c0132e43FC44348881DA8",
  248163216: "0x77Aa40B105843728088c0132e43FC44348881DA8",
  1942764459484029: "0x77Aa40B105843728088c0132e43FC44348881DA8",
} as const;

/**
 * -
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0x136066500b332e7D72643EE7690E9C708702c7e6)
 */
export const gatewayManagerFacetConfig = {
  address: gatewayManagerFacetAddress,
  abi: gatewayManagerFacetAbi,
} as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IMachineFacade
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const iMachineFacadeAbi = [
  {
    type: "event",
    anonymous: false,
    inputs: [
      { name: "kind", internalType: "uint8", type: "uint8", indexed: true },
      {
        name: "owner",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "metadata",
        internalType: "bytes",
        type: "bytes",
        indexed: false,
      },
    ],
    name: "MachineCreated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      { name: "kind", internalType: "uint8", type: "uint8", indexed: true },
      {
        name: "machineAddress",
        internalType: "address",
        type: "address",
        indexed: false,
      },
    ],
    name: "MachineInitialized",
  },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// RecallERC20
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * -
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0x9E5ea73a639484CcE57F865dC1E582Cd01F3251F)
 */
export const recallErc20Abi = [
  {
    type: "function",
    inputs: [
      { name: "owner", internalType: "address", type: "address" },
      { name: "spender", internalType: "address", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "spender", internalType: "address", type: "address" },
      { name: "value", internalType: "uint256", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "account", internalType: "address", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "to", internalType: "address", type: "address" },
      { name: "value", internalType: "uint256", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "from", internalType: "address", type: "address" },
      { name: "to", internalType: "address", type: "address" },
      { name: "value", internalType: "uint256", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "owner",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "spender",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "value",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "Approval",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      { name: "from", internalType: "address", type: "address", indexed: true },
      { name: "to", internalType: "address", type: "address", indexed: true },
      {
        name: "value",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "Transfer",
  },
] as const;

/**
 * -
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0x9E5ea73a639484CcE57F865dC1E582Cd01F3251F)
 */
export const recallErc20Address = {
  31337: "0x4A679253410272dd5232B3Ff7cF5dbB88f295319",
  314159: "0x9E5ea73a639484CcE57F865dC1E582Cd01F3251F",
} as const;

/**
 * -
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0x9E5ea73a639484CcE57F865dC1E582Cd01F3251F)
 */
export const recallErc20Config = {
  address: recallErc20Address,
  abi: recallErc20Abi,
} as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SubnetGetterFacet
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * -
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0xdf3Fe12002826Ff617F2d7500c61B72A8e3E9436)
 */
export const subnetGetterFacetAbi = [
  {
    type: "function",
    inputs: [],
    name: "getGateway",
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "getSubnetActorCheckpointerFacet",
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "getSubnetActorCheckpointerSelectors",
    outputs: [{ name: "", internalType: "bytes4[]", type: "bytes4[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "getSubnetActorGetterFacet",
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "getSubnetActorGetterSelectors",
    outputs: [{ name: "", internalType: "bytes4[]", type: "bytes4[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "getSubnetActorManagerFacet",
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "getSubnetActorManagerSelectors",
    outputs: [{ name: "", internalType: "bytes4[]", type: "bytes4[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "getSubnetActorPauserFacet",
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "getSubnetActorPauserSelectors",
    outputs: [{ name: "", internalType: "bytes4[]", type: "bytes4[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "getSubnetActorRewarderFacet",
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "getSubnetActorRewarderSelectors",
    outputs: [{ name: "", internalType: "bytes4[]", type: "bytes4[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "owner", internalType: "address", type: "address" },
      { name: "nonce", internalType: "uint64", type: "uint64" },
    ],
    name: "getSubnetDeployedByNonce",
    outputs: [{ name: "subnet", internalType: "address", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "user", internalType: "address", type: "address" }],
    name: "getUserLastNonce",
    outputs: [{ name: "nonce", internalType: "uint64", type: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "owner", internalType: "address", type: "address" }],
    name: "latestSubnetDeployed",
    outputs: [{ name: "subnet", internalType: "address", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "newGetterFacet", internalType: "address", type: "address" },
      { name: "newManagerFacet", internalType: "address", type: "address" },
      {
        name: "newSubnetGetterSelectors",
        internalType: "bytes4[]",
        type: "bytes4[]",
      },
      {
        name: "newSubnetManagerSelectors",
        internalType: "bytes4[]",
        type: "bytes4[]",
      },
    ],
    name: "updateReferenceSubnetContract",
    outputs: [],
    stateMutability: "nonpayable",
  },
  { type: "error", inputs: [], name: "CannotFindSubnet" },
  { type: "error", inputs: [], name: "FacetCannotBeZero" },
  { type: "error", inputs: [], name: "NotOwner" },
] as const;

/**
 * -
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0xdf3Fe12002826Ff617F2d7500c61B72A8e3E9436)
 */
export const subnetGetterFacetAddress = {
  31337: "0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44",
  314159: "0xdf3Fe12002826Ff617F2d7500c61B72A8e3E9436",
  2481632: "0x74539671A1D2F1c8f200826bAbA665179F53a1b7",
  248163216: "0x74539671A1D2F1c8f200826bAbA665179F53a1b7",
  1942764459484029: "0x74539671A1D2F1c8f200826bAbA665179F53a1b7",
} as const;

/**
 * -
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0xdf3Fe12002826Ff617F2d7500c61B72A8e3E9436)
 */
export const subnetGetterFacetConfig = {
  address: subnetGetterFacetAddress,
  abi: subnetGetterFacetAbi,
} as const;
