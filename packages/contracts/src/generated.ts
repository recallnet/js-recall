//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// BlobManager
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 *
 */
export const blobManagerAbi = [
  {
    type: 'function',
    inputs: [
      {
        name: 'params',
        internalType: 'struct AddBlobParams',
        type: 'tuple',
        components: [
          { name: 'sponsor', internalType: 'address', type: 'address' },
          { name: 'source', internalType: 'string', type: 'string' },
          { name: 'blobHash', internalType: 'string', type: 'string' },
          { name: 'metadataHash', internalType: 'string', type: 'string' },
          { name: 'subscriptionId', internalType: 'string', type: 'string' },
          { name: 'size', internalType: 'uint64', type: 'uint64' },
          { name: 'ttl', internalType: 'uint64', type: 'uint64' },
        ],
      },
    ],
    name: 'addBlob',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'subscriber', internalType: 'address', type: 'address' },
      { name: 'blobHash', internalType: 'string', type: 'string' },
      { name: 'subscriptionId', internalType: 'string', type: 'string' },
    ],
    name: 'deleteBlob',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'size', internalType: 'uint32', type: 'uint32' }],
    name: 'getAddedBlobs',
    outputs: [
      {
        name: 'blobs',
        internalType: 'struct BlobTuple[]',
        type: 'tuple[]',
        components: [
          { name: 'blobHash', internalType: 'string', type: 'string' },
          {
            name: 'sourceInfo',
            internalType: 'struct BlobSourceInfo[]',
            type: 'tuple[]',
            components: [
              { name: 'subscriber', internalType: 'address', type: 'address' },
              {
                name: 'subscriptionId',
                internalType: 'string',
                type: 'string',
              },
              { name: 'source', internalType: 'string', type: 'string' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'blobHash', internalType: 'string', type: 'string' }],
    name: 'getBlob',
    outputs: [
      {
        name: 'blob',
        internalType: 'struct Blob',
        type: 'tuple',
        components: [
          { name: 'size', internalType: 'uint64', type: 'uint64' },
          { name: 'metadataHash', internalType: 'string', type: 'string' },
          {
            name: 'subscribers',
            internalType: 'struct Subscriber[]',
            type: 'tuple[]',
            components: [
              { name: 'subscriber', internalType: 'address', type: 'address' },
              {
                name: 'subscriptionGroup',
                internalType: 'struct SubscriptionGroup[]',
                type: 'tuple[]',
                components: [
                  {
                    name: 'subscriptionId',
                    internalType: 'string',
                    type: 'string',
                  },
                  {
                    name: 'subscription',
                    internalType: 'struct Subscription',
                    type: 'tuple',
                    components: [
                      { name: 'added', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'expiry',
                        internalType: 'uint64',
                        type: 'uint64',
                      },
                      {
                        name: 'source',
                        internalType: 'string',
                        type: 'string',
                      },
                      {
                        name: 'delegate',
                        internalType: 'address',
                        type: 'address',
                      },
                      { name: 'failed', internalType: 'bool', type: 'bool' },
                    ],
                  },
                ],
              },
            ],
          },
          { name: 'status', internalType: 'enum BlobStatus', type: 'uint8' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'subscriber', internalType: 'address', type: 'address' },
      { name: 'blobHash', internalType: 'string', type: 'string' },
      { name: 'subscriptionId', internalType: 'string', type: 'string' },
    ],
    name: 'getBlobStatus',
    outputs: [
      { name: 'status', internalType: 'enum BlobStatus', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'size', internalType: 'uint32', type: 'uint32' }],
    name: 'getPendingBlobs',
    outputs: [
      {
        name: 'blobs',
        internalType: 'struct BlobTuple[]',
        type: 'tuple[]',
        components: [
          { name: 'blobHash', internalType: 'string', type: 'string' },
          {
            name: 'sourceInfo',
            internalType: 'struct BlobSourceInfo[]',
            type: 'tuple[]',
            components: [
              { name: 'subscriber', internalType: 'address', type: 'address' },
              {
                name: 'subscriptionId',
                internalType: 'string',
                type: 'string',
              },
              { name: 'source', internalType: 'string', type: 'string' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getPendingBlobsCount',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getPendingBytesCount',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getStorageStats',
    outputs: [
      {
        name: 'stats',
        internalType: 'struct StorageStats',
        type: 'tuple',
        components: [
          { name: 'capacityFree', internalType: 'uint64', type: 'uint64' },
          { name: 'capacityUsed', internalType: 'uint64', type: 'uint64' },
          { name: 'numBlobs', internalType: 'uint64', type: 'uint64' },
          { name: 'numResolving', internalType: 'uint64', type: 'uint64' },
          { name: 'numAccounts', internalType: 'uint64', type: 'uint64' },
          { name: 'bytesResolving', internalType: 'uint64', type: 'uint64' },
          { name: 'numAdded', internalType: 'uint64', type: 'uint64' },
          { name: 'bytesAdded', internalType: 'uint64', type: 'uint64' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'addr', internalType: 'address', type: 'address' }],
    name: 'getStorageUsage',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getSubnetStats',
    outputs: [
      {
        name: 'stats',
        internalType: 'struct SubnetStats',
        type: 'tuple',
        components: [
          { name: 'balance', internalType: 'uint256', type: 'uint256' },
          { name: 'capacityFree', internalType: 'uint64', type: 'uint64' },
          { name: 'capacityUsed', internalType: 'uint64', type: 'uint64' },
          { name: 'creditSold', internalType: 'uint256', type: 'uint256' },
          { name: 'creditCommitted', internalType: 'uint256', type: 'uint256' },
          { name: 'creditDebited', internalType: 'uint256', type: 'uint256' },
          { name: 'tokenCreditRate', internalType: 'uint256', type: 'uint256' },
          { name: 'numAccounts', internalType: 'uint64', type: 'uint64' },
          { name: 'numBlobs', internalType: 'uint64', type: 'uint64' },
          { name: 'numAdded', internalType: 'uint64', type: 'uint64' },
          { name: 'bytesAdded', internalType: 'uint64', type: 'uint64' },
          { name: 'numResolving', internalType: 'uint64', type: 'uint64' },
          { name: 'bytesResolving', internalType: 'uint64', type: 'uint64' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'oldHash', internalType: 'string', type: 'string' },
      {
        name: 'params',
        internalType: 'struct AddBlobParams',
        type: 'tuple',
        components: [
          { name: 'sponsor', internalType: 'address', type: 'address' },
          { name: 'source', internalType: 'string', type: 'string' },
          { name: 'blobHash', internalType: 'string', type: 'string' },
          { name: 'metadataHash', internalType: 'string', type: 'string' },
          { name: 'subscriptionId', internalType: 'string', type: 'string' },
          { name: 'size', internalType: 'uint64', type: 'uint64' },
          { name: 'ttl', internalType: 'uint64', type: 'uint64' },
        ],
      },
    ],
    name: 'overwriteBlob',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'caller',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'sponsor',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'blobHash',
        internalType: 'string',
        type: 'string',
        indexed: false,
      },
      {
        name: 'subscriptionId',
        internalType: 'string',
        type: 'string',
        indexed: false,
      },
    ],
    name: 'AddBlob',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'caller',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'subscriber',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'blobHash',
        internalType: 'string',
        type: 'string',
        indexed: false,
      },
      {
        name: 'subscriptionId',
        internalType: 'string',
        type: 'string',
        indexed: false,
      },
    ],
    name: 'DeleteBlob',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'caller',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'oldHash',
        internalType: 'string',
        type: 'string',
        indexed: false,
      },
      {
        name: 'newHash',
        internalType: 'string',
        type: 'string',
        indexed: false,
      },
      {
        name: 'subscriptionId',
        internalType: 'string',
        type: 'string',
        indexed: false,
      },
    ],
    name: 'OverwriteBlob',
  },
] as const

/**
 *
 */
export const blobManagerAddress = {
  2481632: '0x0A884E8117f04Dd0C8da03B18d2D4516069Dd7C3',
} as const

/**
 *
 */
export const blobManagerConfig = {
  address: blobManagerAddress,
  abi: blobManagerAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// BucketManager
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 *
 */
export const bucketManagerAbi = [
  {
    type: 'function',
    inputs: [
      { name: 'bucket', internalType: 'address', type: 'address' },
      {
        name: 'params',
        internalType: 'struct AddObjectParams',
        type: 'tuple',
        components: [
          { name: 'source', internalType: 'string', type: 'string' },
          { name: 'key', internalType: 'string', type: 'string' },
          { name: 'blobHash', internalType: 'string', type: 'string' },
          { name: 'recoveryHash', internalType: 'string', type: 'string' },
          { name: 'size', internalType: 'uint64', type: 'uint64' },
          { name: 'ttl', internalType: 'uint64', type: 'uint64' },
          {
            name: 'metadata',
            internalType: 'struct KeyValue[]',
            type: 'tuple[]',
            components: [
              { name: 'key', internalType: 'string', type: 'string' },
              { name: 'value', internalType: 'string', type: 'string' },
            ],
          },
          { name: 'overwrite', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    name: 'addObject',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'bucket', internalType: 'address', type: 'address' },
      { name: 'source', internalType: 'string', type: 'string' },
      { name: 'key', internalType: 'string', type: 'string' },
      { name: 'blobHash', internalType: 'string', type: 'string' },
      { name: 'recoveryHash', internalType: 'string', type: 'string' },
      { name: 'size', internalType: 'uint64', type: 'uint64' },
    ],
    name: 'addObject',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'createBucket',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      {
        name: 'metadata',
        internalType: 'struct KeyValue[]',
        type: 'tuple[]',
        components: [
          { name: 'key', internalType: 'string', type: 'string' },
          { name: 'value', internalType: 'string', type: 'string' },
        ],
      },
    ],
    name: 'createBucket',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'createBucket',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'bucket', internalType: 'address', type: 'address' },
      { name: 'key', internalType: 'string', type: 'string' },
    ],
    name: 'deleteObject',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'bucket', internalType: 'address', type: 'address' },
      { name: 'key', internalType: 'string', type: 'string' },
    ],
    name: 'getObject',
    outputs: [
      {
        name: '',
        internalType: 'struct ObjectValue',
        type: 'tuple',
        components: [
          { name: 'blobHash', internalType: 'string', type: 'string' },
          { name: 'recoveryHash', internalType: 'string', type: 'string' },
          { name: 'size', internalType: 'uint64', type: 'uint64' },
          { name: 'expiry', internalType: 'uint64', type: 'uint64' },
          {
            name: 'metadata',
            internalType: 'struct KeyValue[]',
            type: 'tuple[]',
            components: [
              { name: 'key', internalType: 'string', type: 'string' },
              { name: 'value', internalType: 'string', type: 'string' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'listBuckets',
    outputs: [
      {
        name: '',
        internalType: 'struct Machine[]',
        type: 'tuple[]',
        components: [
          { name: 'kind', internalType: 'enum Kind', type: 'uint8' },
          { name: 'addr', internalType: 'address', type: 'address' },
          {
            name: 'metadata',
            internalType: 'struct KeyValue[]',
            type: 'tuple[]',
            components: [
              { name: 'key', internalType: 'string', type: 'string' },
              { name: 'value', internalType: 'string', type: 'string' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'listBuckets',
    outputs: [
      {
        name: '',
        internalType: 'struct Machine[]',
        type: 'tuple[]',
        components: [
          { name: 'kind', internalType: 'enum Kind', type: 'uint8' },
          { name: 'addr', internalType: 'address', type: 'address' },
          {
            name: 'metadata',
            internalType: 'struct KeyValue[]',
            type: 'tuple[]',
            components: [
              { name: 'key', internalType: 'string', type: 'string' },
              { name: 'value', internalType: 'string', type: 'string' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'bucket', internalType: 'address', type: 'address' }],
    name: 'queryObjects',
    outputs: [
      {
        name: '',
        internalType: 'struct Query',
        type: 'tuple',
        components: [
          {
            name: 'objects',
            internalType: 'struct Object[]',
            type: 'tuple[]',
            components: [
              { name: 'key', internalType: 'string', type: 'string' },
              {
                name: 'state',
                internalType: 'struct ObjectState',
                type: 'tuple',
                components: [
                  { name: 'blobHash', internalType: 'string', type: 'string' },
                  { name: 'size', internalType: 'uint64', type: 'uint64' },
                  {
                    name: 'metadata',
                    internalType: 'struct KeyValue[]',
                    type: 'tuple[]',
                    components: [
                      { name: 'key', internalType: 'string', type: 'string' },
                      { name: 'value', internalType: 'string', type: 'string' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            name: 'commonPrefixes',
            internalType: 'string[]',
            type: 'string[]',
          },
          { name: 'nextKey', internalType: 'string', type: 'string' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'bucket', internalType: 'address', type: 'address' },
      { name: 'prefix', internalType: 'string', type: 'string' },
      { name: 'delimiter', internalType: 'string', type: 'string' },
      { name: 'startKey', internalType: 'string', type: 'string' },
      { name: 'limit', internalType: 'uint64', type: 'uint64' },
    ],
    name: 'queryObjects',
    outputs: [
      {
        name: '',
        internalType: 'struct Query',
        type: 'tuple',
        components: [
          {
            name: 'objects',
            internalType: 'struct Object[]',
            type: 'tuple[]',
            components: [
              { name: 'key', internalType: 'string', type: 'string' },
              {
                name: 'state',
                internalType: 'struct ObjectState',
                type: 'tuple',
                components: [
                  { name: 'blobHash', internalType: 'string', type: 'string' },
                  { name: 'size', internalType: 'uint64', type: 'uint64' },
                  {
                    name: 'metadata',
                    internalType: 'struct KeyValue[]',
                    type: 'tuple[]',
                    components: [
                      { name: 'key', internalType: 'string', type: 'string' },
                      { name: 'value', internalType: 'string', type: 'string' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            name: 'commonPrefixes',
            internalType: 'string[]',
            type: 'string[]',
          },
          { name: 'nextKey', internalType: 'string', type: 'string' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'bucket', internalType: 'address', type: 'address' },
      { name: 'prefix', internalType: 'string', type: 'string' },
      { name: 'delimiter', internalType: 'string', type: 'string' },
    ],
    name: 'queryObjects',
    outputs: [
      {
        name: '',
        internalType: 'struct Query',
        type: 'tuple',
        components: [
          {
            name: 'objects',
            internalType: 'struct Object[]',
            type: 'tuple[]',
            components: [
              { name: 'key', internalType: 'string', type: 'string' },
              {
                name: 'state',
                internalType: 'struct ObjectState',
                type: 'tuple',
                components: [
                  { name: 'blobHash', internalType: 'string', type: 'string' },
                  { name: 'size', internalType: 'uint64', type: 'uint64' },
                  {
                    name: 'metadata',
                    internalType: 'struct KeyValue[]',
                    type: 'tuple[]',
                    components: [
                      { name: 'key', internalType: 'string', type: 'string' },
                      { name: 'value', internalType: 'string', type: 'string' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            name: 'commonPrefixes',
            internalType: 'string[]',
            type: 'string[]',
          },
          { name: 'nextKey', internalType: 'string', type: 'string' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'bucket', internalType: 'address', type: 'address' },
      { name: 'prefix', internalType: 'string', type: 'string' },
      { name: 'delimiter', internalType: 'string', type: 'string' },
      { name: 'startKey', internalType: 'string', type: 'string' },
    ],
    name: 'queryObjects',
    outputs: [
      {
        name: '',
        internalType: 'struct Query',
        type: 'tuple',
        components: [
          {
            name: 'objects',
            internalType: 'struct Object[]',
            type: 'tuple[]',
            components: [
              { name: 'key', internalType: 'string', type: 'string' },
              {
                name: 'state',
                internalType: 'struct ObjectState',
                type: 'tuple',
                components: [
                  { name: 'blobHash', internalType: 'string', type: 'string' },
                  { name: 'size', internalType: 'uint64', type: 'uint64' },
                  {
                    name: 'metadata',
                    internalType: 'struct KeyValue[]',
                    type: 'tuple[]',
                    components: [
                      { name: 'key', internalType: 'string', type: 'string' },
                      { name: 'value', internalType: 'string', type: 'string' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            name: 'commonPrefixes',
            internalType: 'string[]',
            type: 'string[]',
          },
          { name: 'nextKey', internalType: 'string', type: 'string' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'bucket', internalType: 'address', type: 'address' },
      { name: 'prefix', internalType: 'string', type: 'string' },
    ],
    name: 'queryObjects',
    outputs: [
      {
        name: '',
        internalType: 'struct Query',
        type: 'tuple',
        components: [
          {
            name: 'objects',
            internalType: 'struct Object[]',
            type: 'tuple[]',
            components: [
              { name: 'key', internalType: 'string', type: 'string' },
              {
                name: 'state',
                internalType: 'struct ObjectState',
                type: 'tuple',
                components: [
                  { name: 'blobHash', internalType: 'string', type: 'string' },
                  { name: 'size', internalType: 'uint64', type: 'uint64' },
                  {
                    name: 'metadata',
                    internalType: 'struct KeyValue[]',
                    type: 'tuple[]',
                    components: [
                      { name: 'key', internalType: 'string', type: 'string' },
                      { name: 'value', internalType: 'string', type: 'string' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            name: 'commonPrefixes',
            internalType: 'string[]',
            type: 'string[]',
          },
          { name: 'nextKey', internalType: 'string', type: 'string' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'bucket',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'key', internalType: 'string', type: 'string', indexed: false },
    ],
    name: 'AddObject',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'data', internalType: 'bytes', type: 'bytes', indexed: false },
    ],
    name: 'CreateBucket',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'bucket',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'key', internalType: 'string', type: 'string', indexed: false },
    ],
    name: 'DeleteObject',
  },
] as const

/**
 *
 */
export const bucketManagerAddress = {
  2481632: '0x5aA5cb07469Cabe65c12137400FBC3b0aE265999',
} as const

/**
 *
 */
export const bucketManagerConfig = {
  address: bucketManagerAddress,
  abi: bucketManagerAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// CreditManager
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 *
 */
export const creditManagerAbi = [
  {
    type: 'function',
    inputs: [{ name: 'to', internalType: 'address', type: 'address' }],
    name: 'approveCredit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'caller', internalType: 'address[]', type: 'address[]' },
    ],
    name: 'approveCredit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'caller', internalType: 'address[]', type: 'address[]' },
      { name: 'creditLimit', internalType: 'uint256', type: 'uint256' },
      { name: 'gasFeeLimit', internalType: 'uint256', type: 'uint256' },
      { name: 'ttl', internalType: 'uint64', type: 'uint64' },
    ],
    name: 'approveCredit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
    ],
    name: 'approveCredit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'buyCredit',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [{ name: 'recipient', internalType: 'address', type: 'address' }],
    name: 'buyCredit',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [{ name: 'addr', internalType: 'address', type: 'address' }],
    name: 'getAccount',
    outputs: [
      {
        name: 'account',
        internalType: 'struct Account',
        type: 'tuple',
        components: [
          { name: 'capacityUsed', internalType: 'uint64', type: 'uint64' },
          { name: 'creditFree', internalType: 'uint256', type: 'uint256' },
          { name: 'creditCommitted', internalType: 'uint256', type: 'uint256' },
          { name: 'creditSponsor', internalType: 'address', type: 'address' },
          { name: 'lastDebitEpoch', internalType: 'uint64', type: 'uint64' },
          {
            name: 'approvals',
            internalType: 'struct Approval[]',
            type: 'tuple[]',
            components: [
              { name: 'to', internalType: 'address', type: 'address' },
              {
                name: 'approval',
                internalType: 'struct CreditApproval',
                type: 'tuple',
                components: [
                  {
                    name: 'creditLimit',
                    internalType: 'uint256',
                    type: 'uint256',
                  },
                  {
                    name: 'gasFeeLimit',
                    internalType: 'uint256',
                    type: 'uint256',
                  },
                  { name: 'expiry', internalType: 'uint64', type: 'uint64' },
                  {
                    name: 'creditUsed',
                    internalType: 'uint256',
                    type: 'uint256',
                  },
                  {
                    name: 'gasFeeUsed',
                    internalType: 'uint256',
                    type: 'uint256',
                  },
                ],
              },
            ],
          },
          { name: 'maxTtl', internalType: 'uint64', type: 'uint64' },
          { name: 'gasAllowance', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
    ],
    name: 'getCreditApproval',
    outputs: [
      {
        name: 'approval',
        internalType: 'struct CreditApproval',
        type: 'tuple',
        components: [
          { name: 'creditLimit', internalType: 'uint256', type: 'uint256' },
          { name: 'gasFeeLimit', internalType: 'uint256', type: 'uint256' },
          { name: 'expiry', internalType: 'uint64', type: 'uint64' },
          { name: 'creditUsed', internalType: 'uint256', type: 'uint256' },
          { name: 'gasFeeUsed', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'addr', internalType: 'address', type: 'address' }],
    name: 'getCreditBalance',
    outputs: [
      {
        name: 'balance',
        internalType: 'struct Balance',
        type: 'tuple',
        components: [
          { name: 'creditFree', internalType: 'uint256', type: 'uint256' },
          { name: 'creditCommitted', internalType: 'uint256', type: 'uint256' },
          { name: 'creditSponsor', internalType: 'address', type: 'address' },
          { name: 'lastDebitEpoch', internalType: 'uint64', type: 'uint64' },
          {
            name: 'approvals',
            internalType: 'struct Approval[]',
            type: 'tuple[]',
            components: [
              { name: 'to', internalType: 'address', type: 'address' },
              {
                name: 'approval',
                internalType: 'struct CreditApproval',
                type: 'tuple',
                components: [
                  {
                    name: 'creditLimit',
                    internalType: 'uint256',
                    type: 'uint256',
                  },
                  {
                    name: 'gasFeeLimit',
                    internalType: 'uint256',
                    type: 'uint256',
                  },
                  { name: 'expiry', internalType: 'uint64', type: 'uint64' },
                  {
                    name: 'creditUsed',
                    internalType: 'uint256',
                    type: 'uint256',
                  },
                  {
                    name: 'gasFeeUsed',
                    internalType: 'uint256',
                    type: 'uint256',
                  },
                ],
              },
            ],
          },
          { name: 'gasAllowance', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getCreditStats',
    outputs: [
      {
        name: 'stats',
        internalType: 'struct CreditStats',
        type: 'tuple',
        components: [
          { name: 'balance', internalType: 'uint256', type: 'uint256' },
          { name: 'creditSold', internalType: 'uint256', type: 'uint256' },
          { name: 'creditCommitted', internalType: 'uint256', type: 'uint256' },
          { name: 'creditDebited', internalType: 'uint256', type: 'uint256' },
          { name: 'tokenCreditRate', internalType: 'uint256', type: 'uint256' },
          { name: 'numAccounts', internalType: 'uint64', type: 'uint64' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
    ],
    name: 'revokeCredit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'to', internalType: 'address', type: 'address' }],
    name: 'revokeCredit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'caller', internalType: 'address', type: 'address' },
    ],
    name: 'revokeCredit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'sponsor', internalType: 'address', type: 'address' },
    ],
    name: 'setAccountSponsor',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'caller',
        internalType: 'address[]',
        type: 'address[]',
        indexed: false,
      },
      {
        name: 'creditLimit',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'gasFeeLimit',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      { name: 'ttl', internalType: 'uint64', type: 'uint64', indexed: false },
    ],
    name: 'ApproveCredit',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'addr', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'BuyCredit',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'caller',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'RevokeCredit',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'sponsor',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'SetAccountSponsor',
  },
] as const

/**
 *
 */
export const creditManagerAddress = {
  2481632: '0x2639f26Dabe0e98cd68eEA3A89917f925eA68c61',
} as const

/**
 *
 */
export const creditManagerConfig = {
  address: creditManagerAddress,
  abi: creditManagerAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// GatewayGetterFacetParent
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 *
 */
export const gatewayGetterFacetParentAbi = [
  {
    type: 'function',
    inputs: [],
    name: 'appliedTopDownNonce',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'bottomUpCheckPeriod',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'e', internalType: 'uint256', type: 'uint256' }],
    name: 'bottomUpCheckpoint',
    outputs: [
      {
        name: '',
        internalType: 'struct BottomUpCheckpoint',
        type: 'tuple',
        components: [
          {
            name: 'subnetID',
            internalType: 'struct SubnetID',
            type: 'tuple',
            components: [
              { name: 'root', internalType: 'uint64', type: 'uint64' },
              { name: 'route', internalType: 'address[]', type: 'address[]' },
            ],
          },
          { name: 'blockHeight', internalType: 'uint256', type: 'uint256' },
          { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'nextConfigurationNumber',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'msgs',
            internalType: 'struct IpcEnvelope[]',
            type: 'tuple[]',
            components: [
              { name: 'kind', internalType: 'enum IpcMsgKind', type: 'uint8' },
              {
                name: 'to',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              {
                name: 'from',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              { name: 'nonce', internalType: 'uint64', type: 'uint64' },
              { name: 'value', internalType: 'uint256', type: 'uint256' },
              { name: 'message', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'e', internalType: 'uint256', type: 'uint256' }],
    name: 'bottomUpMsgBatch',
    outputs: [
      {
        name: '',
        internalType: 'struct BottomUpMsgBatch',
        type: 'tuple',
        components: [
          {
            name: 'subnetID',
            internalType: 'struct SubnetID',
            type: 'tuple',
            components: [
              { name: 'root', internalType: 'uint64', type: 'uint64' },
              { name: 'route', internalType: 'address[]', type: 'address[]' },
            ],
          },
          { name: 'blockHeight', internalType: 'uint256', type: 'uint256' },
          {
            name: 'msgs',
            internalType: 'struct IpcEnvelope[]',
            type: 'tuple[]',
            components: [
              { name: 'kind', internalType: 'enum IpcMsgKind', type: 'uint8' },
              {
                name: 'to',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              {
                name: 'from',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              { name: 'nonce', internalType: 'uint64', type: 'uint64' },
              { name: 'value', internalType: 'uint256', type: 'uint256' },
              { name: 'message', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'bottomUpNonce',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'subnetId',
        internalType: 'struct SubnetID',
        type: 'tuple',
        components: [
          { name: 'root', internalType: 'uint64', type: 'uint64' },
          { name: 'route', internalType: 'address[]', type: 'address[]' },
        ],
      },
    ],
    name: 'getAppliedBottomUpNonce',
    outputs: [
      { name: '', internalType: 'bool', type: 'bool' },
      { name: '', internalType: 'uint64', type: 'uint64' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'h', internalType: 'uint256', type: 'uint256' }],
    name: 'getCheckpointCurrentWeight',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'h', internalType: 'uint256', type: 'uint256' }],
    name: 'getCheckpointInfo',
    outputs: [
      {
        name: '',
        internalType: 'struct QuorumInfo',
        type: 'tuple',
        components: [
          { name: 'hash', internalType: 'bytes32', type: 'bytes32' },
          { name: 'rootHash', internalType: 'bytes32', type: 'bytes32' },
          { name: 'threshold', internalType: 'uint256', type: 'uint256' },
          { name: 'currentWeight', internalType: 'uint256', type: 'uint256' },
          { name: 'reached', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getCheckpointRetentionHeight',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'h', internalType: 'uint256', type: 'uint256' }],
    name: 'getCheckpointSignatureBundle',
    outputs: [
      {
        name: 'ch',
        internalType: 'struct BottomUpCheckpoint',
        type: 'tuple',
        components: [
          {
            name: 'subnetID',
            internalType: 'struct SubnetID',
            type: 'tuple',
            components: [
              { name: 'root', internalType: 'uint64', type: 'uint64' },
              { name: 'route', internalType: 'address[]', type: 'address[]' },
            ],
          },
          { name: 'blockHeight', internalType: 'uint256', type: 'uint256' },
          { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'nextConfigurationNumber',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'msgs',
            internalType: 'struct IpcEnvelope[]',
            type: 'tuple[]',
            components: [
              { name: 'kind', internalType: 'enum IpcMsgKind', type: 'uint8' },
              {
                name: 'to',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              {
                name: 'from',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              { name: 'nonce', internalType: 'uint64', type: 'uint64' },
              { name: 'value', internalType: 'uint256', type: 'uint256' },
              { name: 'message', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
      {
        name: 'info',
        internalType: 'struct QuorumInfo',
        type: 'tuple',
        components: [
          { name: 'hash', internalType: 'bytes32', type: 'bytes32' },
          { name: 'rootHash', internalType: 'bytes32', type: 'bytes32' },
          { name: 'threshold', internalType: 'uint256', type: 'uint256' },
          { name: 'currentWeight', internalType: 'uint256', type: 'uint256' },
          { name: 'reached', internalType: 'bool', type: 'bool' },
        ],
      },
      { name: 'signatories', internalType: 'address[]', type: 'address[]' },
      { name: 'signatures', internalType: 'bytes[]', type: 'bytes[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getCommitSha',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getCurrentBottomUpCheckpoint',
    outputs: [
      { name: 'exists', internalType: 'bool', type: 'bool' },
      { name: 'epoch', internalType: 'uint256', type: 'uint256' },
      {
        name: 'checkpoint',
        internalType: 'struct BottomUpCheckpoint',
        type: 'tuple',
        components: [
          {
            name: 'subnetID',
            internalType: 'struct SubnetID',
            type: 'tuple',
            components: [
              { name: 'root', internalType: 'uint64', type: 'uint64' },
              { name: 'route', internalType: 'address[]', type: 'address[]' },
            ],
          },
          { name: 'blockHeight', internalType: 'uint256', type: 'uint256' },
          { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'nextConfigurationNumber',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'msgs',
            internalType: 'struct IpcEnvelope[]',
            type: 'tuple[]',
            components: [
              { name: 'kind', internalType: 'enum IpcMsgKind', type: 'uint8' },
              {
                name: 'to',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              {
                name: 'from',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              { name: 'nonce', internalType: 'uint64', type: 'uint64' },
              { name: 'value', internalType: 'uint256', type: 'uint256' },
              { name: 'message', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getCurrentConfigurationNumber',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getCurrentMembership',
    outputs: [
      {
        name: '',
        internalType: 'struct Membership',
        type: 'tuple',
        components: [
          {
            name: 'validators',
            internalType: 'struct Validator[]',
            type: 'tuple[]',
            components: [
              { name: 'weight', internalType: 'uint256', type: 'uint256' },
              { name: 'addr', internalType: 'address', type: 'address' },
              { name: 'metadata', internalType: 'bytes', type: 'bytes' },
            ],
          },
          {
            name: 'configurationNumber',
            internalType: 'uint64',
            type: 'uint64',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getIncompleteCheckpointHeights',
    outputs: [{ name: '', internalType: 'uint256[]', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getIncompleteCheckpoints',
    outputs: [
      {
        name: '',
        internalType: 'struct BottomUpCheckpoint[]',
        type: 'tuple[]',
        components: [
          {
            name: 'subnetID',
            internalType: 'struct SubnetID',
            type: 'tuple',
            components: [
              { name: 'root', internalType: 'uint64', type: 'uint64' },
              { name: 'route', internalType: 'address[]', type: 'address[]' },
            ],
          },
          { name: 'blockHeight', internalType: 'uint256', type: 'uint256' },
          { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'nextConfigurationNumber',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'msgs',
            internalType: 'struct IpcEnvelope[]',
            type: 'tuple[]',
            components: [
              { name: 'kind', internalType: 'enum IpcMsgKind', type: 'uint8' },
              {
                name: 'to',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              {
                name: 'from',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              { name: 'nonce', internalType: 'uint64', type: 'uint64' },
              { name: 'value', internalType: 'uint256', type: 'uint256' },
              { name: 'message', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getLastConfigurationNumber',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getLastMembership',
    outputs: [
      {
        name: '',
        internalType: 'struct Membership',
        type: 'tuple',
        components: [
          {
            name: 'validators',
            internalType: 'struct Validator[]',
            type: 'tuple[]',
            components: [
              { name: 'weight', internalType: 'uint256', type: 'uint256' },
              { name: 'addr', internalType: 'address', type: 'address' },
              { name: 'metadata', internalType: 'bytes', type: 'bytes' },
            ],
          },
          {
            name: 'configurationNumber',
            internalType: 'uint64',
            type: 'uint64',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getLatestParentFinality',
    outputs: [
      {
        name: '',
        internalType: 'struct ParentFinality',
        type: 'tuple',
        components: [
          { name: 'height', internalType: 'uint256', type: 'uint256' },
          { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getNetworkName',
    outputs: [
      {
        name: '',
        internalType: 'struct SubnetID',
        type: 'tuple',
        components: [
          { name: 'root', internalType: 'uint64', type: 'uint64' },
          { name: 'route', internalType: 'address[]', type: 'address[]' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'blockNumber', internalType: 'uint256', type: 'uint256' }],
    name: 'getParentFinality',
    outputs: [
      {
        name: '',
        internalType: 'struct ParentFinality',
        type: 'tuple',
        components: [
          { name: 'height', internalType: 'uint256', type: 'uint256' },
          { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'totalWeight', internalType: 'uint256', type: 'uint256' }],
    name: 'getQuorumThreshold',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'subnetId',
        internalType: 'struct SubnetID',
        type: 'tuple',
        components: [
          { name: 'root', internalType: 'uint64', type: 'uint64' },
          { name: 'route', internalType: 'address[]', type: 'address[]' },
        ],
      },
    ],
    name: 'getSubnet',
    outputs: [
      { name: '', internalType: 'bool', type: 'bool' },
      {
        name: '',
        internalType: 'struct Subnet',
        type: 'tuple',
        components: [
          { name: 'stake', internalType: 'uint256', type: 'uint256' },
          { name: 'genesisEpoch', internalType: 'uint256', type: 'uint256' },
          { name: 'circSupply', internalType: 'uint256', type: 'uint256' },
          { name: 'topDownNonce', internalType: 'uint64', type: 'uint64' },
          {
            name: 'appliedBottomUpNonce',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'id',
            internalType: 'struct SubnetID',
            type: 'tuple',
            components: [
              { name: 'root', internalType: 'uint64', type: 'uint64' },
              { name: 'route', internalType: 'address[]', type: 'address[]' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getSubnetKeys',
    outputs: [{ name: '', internalType: 'bytes32[]', type: 'bytes32[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'subnetId',
        internalType: 'struct SubnetID',
        type: 'tuple',
        components: [
          { name: 'root', internalType: 'uint64', type: 'uint64' },
          { name: 'route', internalType: 'address[]', type: 'address[]' },
        ],
      },
    ],
    name: 'getSubnetTopDownMsgsLength',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'subnetId',
        internalType: 'struct SubnetID',
        type: 'tuple',
        components: [
          { name: 'root', internalType: 'uint64', type: 'uint64' },
          { name: 'route', internalType: 'address[]', type: 'address[]' },
        ],
      },
    ],
    name: 'getTopDownNonce',
    outputs: [
      { name: '', internalType: 'bool', type: 'bool' },
      { name: '', internalType: 'uint64', type: 'uint64' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getValidatorConfigurationNumbers',
    outputs: [
      { name: '', internalType: 'uint64', type: 'uint64' },
      { name: '', internalType: 'uint64', type: 'uint64' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'listSubnets',
    outputs: [
      {
        name: '',
        internalType: 'struct Subnet[]',
        type: 'tuple[]',
        components: [
          { name: 'stake', internalType: 'uint256', type: 'uint256' },
          { name: 'genesisEpoch', internalType: 'uint256', type: 'uint256' },
          { name: 'circSupply', internalType: 'uint256', type: 'uint256' },
          { name: 'topDownNonce', internalType: 'uint64', type: 'uint64' },
          {
            name: 'appliedBottomUpNonce',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'id',
            internalType: 'struct SubnetID',
            type: 'tuple',
            components: [
              { name: 'root', internalType: 'uint64', type: 'uint64' },
              { name: 'route', internalType: 'address[]', type: 'address[]' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'majorityPercentage',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'maxMsgsPerBottomUpBatch',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'bytes32', type: 'bytes32' }],
    name: 'postbox',
    outputs: [
      {
        name: 'storableMsg',
        internalType: 'struct IpcEnvelope',
        type: 'tuple',
        components: [
          { name: 'kind', internalType: 'enum IpcMsgKind', type: 'uint8' },
          {
            name: 'to',
            internalType: 'struct IPCAddress',
            type: 'tuple',
            components: [
              {
                name: 'subnetId',
                internalType: 'struct SubnetID',
                type: 'tuple',
                components: [
                  { name: 'root', internalType: 'uint64', type: 'uint64' },
                  {
                    name: 'route',
                    internalType: 'address[]',
                    type: 'address[]',
                  },
                ],
              },
              {
                name: 'rawAddress',
                internalType: 'struct FvmAddress',
                type: 'tuple',
                components: [
                  { name: 'addrType', internalType: 'uint8', type: 'uint8' },
                  { name: 'payload', internalType: 'bytes', type: 'bytes' },
                ],
              },
            ],
          },
          {
            name: 'from',
            internalType: 'struct IPCAddress',
            type: 'tuple',
            components: [
              {
                name: 'subnetId',
                internalType: 'struct SubnetID',
                type: 'tuple',
                components: [
                  { name: 'root', internalType: 'uint64', type: 'uint64' },
                  {
                    name: 'route',
                    internalType: 'address[]',
                    type: 'address[]',
                  },
                ],
              },
              {
                name: 'rawAddress',
                internalType: 'struct FvmAddress',
                type: 'tuple',
                components: [
                  { name: 'addrType', internalType: 'uint8', type: 'uint8' },
                  { name: 'payload', internalType: 'bytes', type: 'bytes' },
                ],
              },
            ],
          },
          { name: 'nonce', internalType: 'uint64', type: 'uint64' },
          { name: 'value', internalType: 'uint256', type: 'uint256' },
          { name: 'message', internalType: 'bytes', type: 'bytes' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'h', internalType: 'bytes32', type: 'bytes32' }],
    name: 'subnets',
    outputs: [
      {
        name: 'subnet',
        internalType: 'struct Subnet',
        type: 'tuple',
        components: [
          { name: 'stake', internalType: 'uint256', type: 'uint256' },
          { name: 'genesisEpoch', internalType: 'uint256', type: 'uint256' },
          { name: 'circSupply', internalType: 'uint256', type: 'uint256' },
          { name: 'topDownNonce', internalType: 'uint64', type: 'uint64' },
          {
            name: 'appliedBottomUpNonce',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'id',
            internalType: 'struct SubnetID',
            type: 'tuple',
            components: [
              { name: 'root', internalType: 'uint64', type: 'uint64' },
              { name: 'route', internalType: 'address[]', type: 'address[]' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSubnets',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
] as const

/**
 *
 */
export const gatewayGetterFacetParentAddress = {
  2481632: '0xb4C4590A2E5Da56aA8310bFF343AFc0645121205',
} as const

/**
 *
 */
export const gatewayGetterFacetParentConfig = {
  address: gatewayGetterFacetParentAddress,
  abi: gatewayGetterFacetParentAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// GatewayGetterFacetSubnet
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 *
 */
export const gatewayGetterFacetSubnetAbi = [
  {
    type: 'function',
    inputs: [],
    name: 'appliedTopDownNonce',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'bottomUpCheckPeriod',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'e', internalType: 'uint256', type: 'uint256' }],
    name: 'bottomUpCheckpoint',
    outputs: [
      {
        name: '',
        internalType: 'struct BottomUpCheckpoint',
        type: 'tuple',
        components: [
          {
            name: 'subnetID',
            internalType: 'struct SubnetID',
            type: 'tuple',
            components: [
              { name: 'root', internalType: 'uint64', type: 'uint64' },
              { name: 'route', internalType: 'address[]', type: 'address[]' },
            ],
          },
          { name: 'blockHeight', internalType: 'uint256', type: 'uint256' },
          { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'nextConfigurationNumber',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'msgs',
            internalType: 'struct IpcEnvelope[]',
            type: 'tuple[]',
            components: [
              { name: 'kind', internalType: 'enum IpcMsgKind', type: 'uint8' },
              {
                name: 'to',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              {
                name: 'from',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              { name: 'nonce', internalType: 'uint64', type: 'uint64' },
              { name: 'value', internalType: 'uint256', type: 'uint256' },
              { name: 'message', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'e', internalType: 'uint256', type: 'uint256' }],
    name: 'bottomUpMsgBatch',
    outputs: [
      {
        name: '',
        internalType: 'struct BottomUpMsgBatch',
        type: 'tuple',
        components: [
          {
            name: 'subnetID',
            internalType: 'struct SubnetID',
            type: 'tuple',
            components: [
              { name: 'root', internalType: 'uint64', type: 'uint64' },
              { name: 'route', internalType: 'address[]', type: 'address[]' },
            ],
          },
          { name: 'blockHeight', internalType: 'uint256', type: 'uint256' },
          {
            name: 'msgs',
            internalType: 'struct IpcEnvelope[]',
            type: 'tuple[]',
            components: [
              { name: 'kind', internalType: 'enum IpcMsgKind', type: 'uint8' },
              {
                name: 'to',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              {
                name: 'from',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              { name: 'nonce', internalType: 'uint64', type: 'uint64' },
              { name: 'value', internalType: 'uint256', type: 'uint256' },
              { name: 'message', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'bottomUpNonce',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'subnetId',
        internalType: 'struct SubnetID',
        type: 'tuple',
        components: [
          { name: 'root', internalType: 'uint64', type: 'uint64' },
          { name: 'route', internalType: 'address[]', type: 'address[]' },
        ],
      },
    ],
    name: 'getAppliedBottomUpNonce',
    outputs: [
      { name: '', internalType: 'bool', type: 'bool' },
      { name: '', internalType: 'uint64', type: 'uint64' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'h', internalType: 'uint256', type: 'uint256' }],
    name: 'getCheckpointCurrentWeight',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'h', internalType: 'uint256', type: 'uint256' }],
    name: 'getCheckpointInfo',
    outputs: [
      {
        name: '',
        internalType: 'struct QuorumInfo',
        type: 'tuple',
        components: [
          { name: 'hash', internalType: 'bytes32', type: 'bytes32' },
          { name: 'rootHash', internalType: 'bytes32', type: 'bytes32' },
          { name: 'threshold', internalType: 'uint256', type: 'uint256' },
          { name: 'currentWeight', internalType: 'uint256', type: 'uint256' },
          { name: 'reached', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getCheckpointRetentionHeight',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'h', internalType: 'uint256', type: 'uint256' }],
    name: 'getCheckpointSignatureBundle',
    outputs: [
      {
        name: 'ch',
        internalType: 'struct BottomUpCheckpoint',
        type: 'tuple',
        components: [
          {
            name: 'subnetID',
            internalType: 'struct SubnetID',
            type: 'tuple',
            components: [
              { name: 'root', internalType: 'uint64', type: 'uint64' },
              { name: 'route', internalType: 'address[]', type: 'address[]' },
            ],
          },
          { name: 'blockHeight', internalType: 'uint256', type: 'uint256' },
          { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'nextConfigurationNumber',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'msgs',
            internalType: 'struct IpcEnvelope[]',
            type: 'tuple[]',
            components: [
              { name: 'kind', internalType: 'enum IpcMsgKind', type: 'uint8' },
              {
                name: 'to',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              {
                name: 'from',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              { name: 'nonce', internalType: 'uint64', type: 'uint64' },
              { name: 'value', internalType: 'uint256', type: 'uint256' },
              { name: 'message', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
      {
        name: 'info',
        internalType: 'struct QuorumInfo',
        type: 'tuple',
        components: [
          { name: 'hash', internalType: 'bytes32', type: 'bytes32' },
          { name: 'rootHash', internalType: 'bytes32', type: 'bytes32' },
          { name: 'threshold', internalType: 'uint256', type: 'uint256' },
          { name: 'currentWeight', internalType: 'uint256', type: 'uint256' },
          { name: 'reached', internalType: 'bool', type: 'bool' },
        ],
      },
      { name: 'signatories', internalType: 'address[]', type: 'address[]' },
      { name: 'signatures', internalType: 'bytes[]', type: 'bytes[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getCommitSha',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getCurrentBottomUpCheckpoint',
    outputs: [
      { name: 'exists', internalType: 'bool', type: 'bool' },
      { name: 'epoch', internalType: 'uint256', type: 'uint256' },
      {
        name: 'checkpoint',
        internalType: 'struct BottomUpCheckpoint',
        type: 'tuple',
        components: [
          {
            name: 'subnetID',
            internalType: 'struct SubnetID',
            type: 'tuple',
            components: [
              { name: 'root', internalType: 'uint64', type: 'uint64' },
              { name: 'route', internalType: 'address[]', type: 'address[]' },
            ],
          },
          { name: 'blockHeight', internalType: 'uint256', type: 'uint256' },
          { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'nextConfigurationNumber',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'msgs',
            internalType: 'struct IpcEnvelope[]',
            type: 'tuple[]',
            components: [
              { name: 'kind', internalType: 'enum IpcMsgKind', type: 'uint8' },
              {
                name: 'to',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              {
                name: 'from',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              { name: 'nonce', internalType: 'uint64', type: 'uint64' },
              { name: 'value', internalType: 'uint256', type: 'uint256' },
              { name: 'message', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getCurrentConfigurationNumber',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getCurrentMembership',
    outputs: [
      {
        name: '',
        internalType: 'struct Membership',
        type: 'tuple',
        components: [
          {
            name: 'validators',
            internalType: 'struct Validator[]',
            type: 'tuple[]',
            components: [
              { name: 'weight', internalType: 'uint256', type: 'uint256' },
              { name: 'addr', internalType: 'address', type: 'address' },
              { name: 'metadata', internalType: 'bytes', type: 'bytes' },
            ],
          },
          {
            name: 'configurationNumber',
            internalType: 'uint64',
            type: 'uint64',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getIncompleteCheckpointHeights',
    outputs: [{ name: '', internalType: 'uint256[]', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getIncompleteCheckpoints',
    outputs: [
      {
        name: '',
        internalType: 'struct BottomUpCheckpoint[]',
        type: 'tuple[]',
        components: [
          {
            name: 'subnetID',
            internalType: 'struct SubnetID',
            type: 'tuple',
            components: [
              { name: 'root', internalType: 'uint64', type: 'uint64' },
              { name: 'route', internalType: 'address[]', type: 'address[]' },
            ],
          },
          { name: 'blockHeight', internalType: 'uint256', type: 'uint256' },
          { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'nextConfigurationNumber',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'msgs',
            internalType: 'struct IpcEnvelope[]',
            type: 'tuple[]',
            components: [
              { name: 'kind', internalType: 'enum IpcMsgKind', type: 'uint8' },
              {
                name: 'to',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              {
                name: 'from',
                internalType: 'struct IPCAddress',
                type: 'tuple',
                components: [
                  {
                    name: 'subnetId',
                    internalType: 'struct SubnetID',
                    type: 'tuple',
                    components: [
                      { name: 'root', internalType: 'uint64', type: 'uint64' },
                      {
                        name: 'route',
                        internalType: 'address[]',
                        type: 'address[]',
                      },
                    ],
                  },
                  {
                    name: 'rawAddress',
                    internalType: 'struct FvmAddress',
                    type: 'tuple',
                    components: [
                      {
                        name: 'addrType',
                        internalType: 'uint8',
                        type: 'uint8',
                      },
                      { name: 'payload', internalType: 'bytes', type: 'bytes' },
                    ],
                  },
                ],
              },
              { name: 'nonce', internalType: 'uint64', type: 'uint64' },
              { name: 'value', internalType: 'uint256', type: 'uint256' },
              { name: 'message', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getLastConfigurationNumber',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getLastMembership',
    outputs: [
      {
        name: '',
        internalType: 'struct Membership',
        type: 'tuple',
        components: [
          {
            name: 'validators',
            internalType: 'struct Validator[]',
            type: 'tuple[]',
            components: [
              { name: 'weight', internalType: 'uint256', type: 'uint256' },
              { name: 'addr', internalType: 'address', type: 'address' },
              { name: 'metadata', internalType: 'bytes', type: 'bytes' },
            ],
          },
          {
            name: 'configurationNumber',
            internalType: 'uint64',
            type: 'uint64',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getLatestParentFinality',
    outputs: [
      {
        name: '',
        internalType: 'struct ParentFinality',
        type: 'tuple',
        components: [
          { name: 'height', internalType: 'uint256', type: 'uint256' },
          { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getNetworkName',
    outputs: [
      {
        name: '',
        internalType: 'struct SubnetID',
        type: 'tuple',
        components: [
          { name: 'root', internalType: 'uint64', type: 'uint64' },
          { name: 'route', internalType: 'address[]', type: 'address[]' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'blockNumber', internalType: 'uint256', type: 'uint256' }],
    name: 'getParentFinality',
    outputs: [
      {
        name: '',
        internalType: 'struct ParentFinality',
        type: 'tuple',
        components: [
          { name: 'height', internalType: 'uint256', type: 'uint256' },
          { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'totalWeight', internalType: 'uint256', type: 'uint256' }],
    name: 'getQuorumThreshold',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'subnetId',
        internalType: 'struct SubnetID',
        type: 'tuple',
        components: [
          { name: 'root', internalType: 'uint64', type: 'uint64' },
          { name: 'route', internalType: 'address[]', type: 'address[]' },
        ],
      },
    ],
    name: 'getSubnet',
    outputs: [
      { name: '', internalType: 'bool', type: 'bool' },
      {
        name: '',
        internalType: 'struct Subnet',
        type: 'tuple',
        components: [
          { name: 'stake', internalType: 'uint256', type: 'uint256' },
          { name: 'genesisEpoch', internalType: 'uint256', type: 'uint256' },
          { name: 'circSupply', internalType: 'uint256', type: 'uint256' },
          { name: 'topDownNonce', internalType: 'uint64', type: 'uint64' },
          {
            name: 'appliedBottomUpNonce',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'id',
            internalType: 'struct SubnetID',
            type: 'tuple',
            components: [
              { name: 'root', internalType: 'uint64', type: 'uint64' },
              { name: 'route', internalType: 'address[]', type: 'address[]' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getSubnetKeys',
    outputs: [{ name: '', internalType: 'bytes32[]', type: 'bytes32[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'subnetId',
        internalType: 'struct SubnetID',
        type: 'tuple',
        components: [
          { name: 'root', internalType: 'uint64', type: 'uint64' },
          { name: 'route', internalType: 'address[]', type: 'address[]' },
        ],
      },
    ],
    name: 'getSubnetTopDownMsgsLength',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'subnetId',
        internalType: 'struct SubnetID',
        type: 'tuple',
        components: [
          { name: 'root', internalType: 'uint64', type: 'uint64' },
          { name: 'route', internalType: 'address[]', type: 'address[]' },
        ],
      },
    ],
    name: 'getTopDownNonce',
    outputs: [
      { name: '', internalType: 'bool', type: 'bool' },
      { name: '', internalType: 'uint64', type: 'uint64' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getValidatorConfigurationNumbers',
    outputs: [
      { name: '', internalType: 'uint64', type: 'uint64' },
      { name: '', internalType: 'uint64', type: 'uint64' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'listSubnets',
    outputs: [
      {
        name: '',
        internalType: 'struct Subnet[]',
        type: 'tuple[]',
        components: [
          { name: 'stake', internalType: 'uint256', type: 'uint256' },
          { name: 'genesisEpoch', internalType: 'uint256', type: 'uint256' },
          { name: 'circSupply', internalType: 'uint256', type: 'uint256' },
          { name: 'topDownNonce', internalType: 'uint64', type: 'uint64' },
          {
            name: 'appliedBottomUpNonce',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'id',
            internalType: 'struct SubnetID',
            type: 'tuple',
            components: [
              { name: 'root', internalType: 'uint64', type: 'uint64' },
              { name: 'route', internalType: 'address[]', type: 'address[]' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'majorityPercentage',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'maxMsgsPerBottomUpBatch',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'bytes32', type: 'bytes32' }],
    name: 'postbox',
    outputs: [
      {
        name: 'storableMsg',
        internalType: 'struct IpcEnvelope',
        type: 'tuple',
        components: [
          { name: 'kind', internalType: 'enum IpcMsgKind', type: 'uint8' },
          {
            name: 'to',
            internalType: 'struct IPCAddress',
            type: 'tuple',
            components: [
              {
                name: 'subnetId',
                internalType: 'struct SubnetID',
                type: 'tuple',
                components: [
                  { name: 'root', internalType: 'uint64', type: 'uint64' },
                  {
                    name: 'route',
                    internalType: 'address[]',
                    type: 'address[]',
                  },
                ],
              },
              {
                name: 'rawAddress',
                internalType: 'struct FvmAddress',
                type: 'tuple',
                components: [
                  { name: 'addrType', internalType: 'uint8', type: 'uint8' },
                  { name: 'payload', internalType: 'bytes', type: 'bytes' },
                ],
              },
            ],
          },
          {
            name: 'from',
            internalType: 'struct IPCAddress',
            type: 'tuple',
            components: [
              {
                name: 'subnetId',
                internalType: 'struct SubnetID',
                type: 'tuple',
                components: [
                  { name: 'root', internalType: 'uint64', type: 'uint64' },
                  {
                    name: 'route',
                    internalType: 'address[]',
                    type: 'address[]',
                  },
                ],
              },
              {
                name: 'rawAddress',
                internalType: 'struct FvmAddress',
                type: 'tuple',
                components: [
                  { name: 'addrType', internalType: 'uint8', type: 'uint8' },
                  { name: 'payload', internalType: 'bytes', type: 'bytes' },
                ],
              },
            ],
          },
          { name: 'nonce', internalType: 'uint64', type: 'uint64' },
          { name: 'value', internalType: 'uint256', type: 'uint256' },
          { name: 'message', internalType: 'bytes', type: 'bytes' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'h', internalType: 'bytes32', type: 'bytes32' }],
    name: 'subnets',
    outputs: [
      {
        name: 'subnet',
        internalType: 'struct Subnet',
        type: 'tuple',
        components: [
          { name: 'stake', internalType: 'uint256', type: 'uint256' },
          { name: 'genesisEpoch', internalType: 'uint256', type: 'uint256' },
          { name: 'circSupply', internalType: 'uint256', type: 'uint256' },
          { name: 'topDownNonce', internalType: 'uint64', type: 'uint64' },
          {
            name: 'appliedBottomUpNonce',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'id',
            internalType: 'struct SubnetID',
            type: 'tuple',
            components: [
              { name: 'root', internalType: 'uint64', type: 'uint64' },
              { name: 'route', internalType: 'address[]', type: 'address[]' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSubnets',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
] as const

/**
 *
 */
export const gatewayGetterFacetSubnetAddress = {
  2481632: '0x77Aa40B105843728088c0132e43FC44348881DA8',
} as const

/**
 *
 */
export const gatewayGetterFacetSubnetConfig = {
  address: gatewayGetterFacetSubnetAddress,
  abi: gatewayGetterFacetSubnetAbi,
} as const
