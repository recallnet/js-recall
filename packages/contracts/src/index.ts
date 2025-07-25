//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// GatewayManagerFacet
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * -
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0x1e4c292a339B037ce9b5eCA4d69dBb8dC87390Ab)
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
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0x1e4c292a339B037ce9b5eCA4d69dBb8dC87390Ab)
 */
export const gatewayManagerFacetAddress = {
  31337: "0x9A676e781A523b5d0C0e43731313A708CB607508",
  314159: "0x1e4c292a339B037ce9b5eCA4d69dBb8dC87390Ab",
  2481632: "0x77Aa40B105843728088c0132e43FC44348881DA8",
  248163216: "0x77Aa40B105843728088c0132e43FC44348881DA8",
  1942764459484029: "0x77Aa40B105843728088c0132e43FC44348881DA8",
} as const;

/**
 * -
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0x1e4c292a339B037ce9b5eCA4d69dBb8dC87390Ab)
 */
export const gatewayManagerFacetConfig = {
  address: gatewayManagerFacetAddress,
  abi: gatewayManagerFacetAbi,
} as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IBlobsFacade
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**

*/
export const iBlobsFacadeAbi = [
  {
    type: "function",
    inputs: [
      { name: "sponsor", internalType: "address", type: "address" },
      { name: "source", internalType: "bytes32", type: "bytes32" },
      { name: "blobHash", internalType: "bytes32", type: "bytes32" },
      { name: "metadataHash", internalType: "bytes32", type: "bytes32" },
      { name: "subscriptionId", internalType: "string", type: "string" },
      { name: "size", internalType: "uint64", type: "uint64" },
      { name: "ttl", internalType: "uint64", type: "uint64" },
    ],
    name: "addBlob",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "subscriber", internalType: "address", type: "address" },
      { name: "blobHash", internalType: "bytes32", type: "bytes32" },
      { name: "subscriptionId", internalType: "string", type: "string" },
    ],
    name: "deleteBlob",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "blobHash", internalType: "bytes32", type: "bytes32" }],
    name: "getBlob",
    outputs: [
      {
        name: "blob",
        internalType: "struct Blob",
        type: "tuple",
        components: [
          { name: "size", internalType: "uint64", type: "uint64" },
          { name: "metadataHash", internalType: "bytes32", type: "bytes32" },
          {
            name: "subscriptions",
            internalType: "struct Subscription[]",
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
    inputs: [],
    name: "getStats",
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
      { name: "oldHash", internalType: "bytes32", type: "bytes32" },
      { name: "sponsor", internalType: "address", type: "address" },
      { name: "source", internalType: "bytes32", type: "bytes32" },
      { name: "blobHash", internalType: "bytes32", type: "bytes32" },
      { name: "metadataHash", internalType: "bytes32", type: "bytes32" },
      { name: "subscriptionId", internalType: "string", type: "string" },
      { name: "size", internalType: "uint64", type: "uint64" },
      { name: "ttl", internalType: "uint64", type: "uint64" },
    ],
    name: "overwriteBlob",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "subscriber", internalType: "address", type: "address" },
      { name: "startingHash", internalType: "bytes32", type: "bytes32" },
      { name: "limit", internalType: "uint32", type: "uint32" },
    ],
    name: "trimBlobExpiries",
    outputs: [
      {
        name: "",
        internalType: "struct TrimBlobExpiries",
        type: "tuple",
        components: [
          { name: "processed", internalType: "uint32", type: "uint32" },
          { name: "nextKey", internalType: "bytes32", type: "bytes32" },
        ],
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "subscriber",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "hash",
        internalType: "bytes32",
        type: "bytes32",
        indexed: false,
      },
      {
        name: "size",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
      {
        name: "expiry",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
      {
        name: "bytesUsed",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "BlobAdded",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "subscriber",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "hash",
        internalType: "bytes32",
        type: "bytes32",
        indexed: false,
      },
      {
        name: "size",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
      {
        name: "bytesReleased",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "BlobDeleted",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "subscriber",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "hash",
        internalType: "bytes32",
        type: "bytes32",
        indexed: false,
      },
      { name: "resolved", internalType: "bool", type: "bool", indexed: false },
    ],
    name: "BlobFinalized",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "subscriber",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "hash",
        internalType: "bytes32",
        type: "bytes32",
        indexed: false,
      },
      {
        name: "sourceId",
        internalType: "bytes32",
        type: "bytes32",
        indexed: false,
      },
    ],
    name: "BlobPending",
  },
] as const;

/**

*/
export const iBlobsFacadeAddress = {
  2481632: "0xFF00000000000000000000000000000000000042",
  248163216: "0xFF00000000000000000000000000000000000042",
} as const;

/**

*/
export const iBlobsFacadeConfig = {
  address: iBlobsFacadeAddress,
  abi: iBlobsFacadeAbi,
} as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IBucketFacade
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const iBucketFacadeAbi = [
  {
    type: "function",
    inputs: [
      { name: "source", internalType: "bytes32", type: "bytes32" },
      { name: "key", internalType: "string", type: "string" },
      { name: "hash", internalType: "bytes32", type: "bytes32" },
      { name: "recoveryHash", internalType: "bytes32", type: "bytes32" },
      { name: "size", internalType: "uint64", type: "uint64" },
    ],
    name: "addObject",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "source", internalType: "bytes32", type: "bytes32" },
      { name: "key", internalType: "string", type: "string" },
      { name: "hash", internalType: "bytes32", type: "bytes32" },
      { name: "recoveryHash", internalType: "bytes32", type: "bytes32" },
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
    ],
    name: "addObject",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "key", internalType: "string", type: "string" }],
    name: "deleteObject",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "key", internalType: "string", type: "string" }],
    name: "getObject",
    outputs: [
      {
        name: "",
        internalType: "struct ObjectValue",
        type: "tuple",
        components: [
          { name: "blobHash", internalType: "bytes32", type: "bytes32" },
          { name: "recoveryHash", internalType: "bytes32", type: "bytes32" },
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
    inputs: [
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
                  {
                    name: "blobHash",
                    internalType: "bytes32",
                    type: "bytes32",
                  },
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
                  {
                    name: "blobHash",
                    internalType: "bytes32",
                    type: "bytes32",
                  },
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
    inputs: [{ name: "prefix", internalType: "string", type: "string" }],
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
                  {
                    name: "blobHash",
                    internalType: "bytes32",
                    type: "bytes32",
                  },
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
    inputs: [],
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
                  {
                    name: "blobHash",
                    internalType: "bytes32",
                    type: "bytes32",
                  },
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
                  {
                    name: "blobHash",
                    internalType: "bytes32",
                    type: "bytes32",
                  },
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
    ],
    name: "updateObjectMetadata",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      { name: "key", internalType: "bytes", type: "bytes", indexed: false },
      {
        name: "blobHash",
        internalType: "bytes32",
        type: "bytes32",
        indexed: false,
      },
      {
        name: "metadata",
        internalType: "bytes",
        type: "bytes",
        indexed: false,
      },
    ],
    name: "ObjectAdded",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      { name: "key", internalType: "bytes", type: "bytes", indexed: false },
      {
        name: "blobHash",
        internalType: "bytes32",
        type: "bytes32",
        indexed: false,
      },
    ],
    name: "ObjectDeleted",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      { name: "key", internalType: "bytes", type: "bytes", indexed: false },
      {
        name: "metadata",
        internalType: "bytes",
        type: "bytes",
        indexed: false,
      },
    ],
    name: "ObjectMetadataUpdated",
  },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ICreditFacade
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**

*/
export const iCreditFacadeAbi = [
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
      { name: "to", internalType: "address", type: "address" },
      { name: "caller", internalType: "address[]", type: "address[]" },
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
    inputs: [
      { name: "to", internalType: "address", type: "address" },
      { name: "caller", internalType: "address", type: "address" },
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
    inputs: [{ name: "sponsor", internalType: "address", type: "address" }],
    name: "setAccountSponsor",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "subscriber", internalType: "address", type: "address" },
      { name: "ttlStatus", internalType: "enum TtlStatus", type: "uint8" },
    ],
    name: "setAccountStatus",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "from",
        internalType: "address",
        type: "address",
        indexed: false,
      },
      { name: "to", internalType: "address", type: "address", indexed: false },
      {
        name: "creditLimit",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
      {
        name: "gasFeeLimit",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
      {
        name: "expiry",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "CreditApproved",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
      {
        name: "numAccounts",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
      {
        name: "moreAccounts",
        internalType: "bool",
        type: "bool",
        indexed: false,
      },
    ],
    name: "CreditDebited",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "from",
        internalType: "address",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "CreditPurchased",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "from",
        internalType: "address",
        type: "address",
        indexed: false,
      },
      { name: "to", internalType: "address", type: "address", indexed: false },
    ],
    name: "CreditRevoked",
  },
] as const;

/**

*/
export const iCreditFacadeAddress = {
  2481632: "0xFF00000000000000000000000000000000000042",
  248163216: "0xFF00000000000000000000000000000000000042",
} as const;

/**

*/
export const iCreditFacadeConfig = {
  address: iCreditFacadeAddress,
  abi: iCreditFacadeAbi,
} as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IMachineFacade
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**

*/
export const iMachineFacadeAbi = [
  {
    type: "function",
    inputs: [],
    name: "createBucket",
    outputs: [{ name: "", internalType: "address", type: "address" }],
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
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "owner", internalType: "address", type: "address" }],
    name: "createBucket",
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "nonpayable",
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

/**

*/
export const iMachineFacadeAddress = {
  2481632: "0xfF00000000000000000000000000000000000011",
  248163216: "0xfF00000000000000000000000000000000000011",
} as const;

/**

*/
export const iMachineFacadeConfig = {
  address: iMachineFacadeAddress,
  abi: iMachineFacadeAbi,
} as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// RecallERC20
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * -
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0x3A4539d46C8998544E4D993D256C272F19E192bC)
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
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0x3A4539d46C8998544E4D993D256C272F19E192bC)
 */
export const recallErc20Address = {
  31337: "0x4A679253410272dd5232B3Ff7cF5dbB88f295319",
  314159: "0x3A4539d46C8998544E4D993D256C272F19E192bC",
} as const;

/**
 * -
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0x3A4539d46C8998544E4D993D256C272F19E192bC)
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
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0x4d1EdDBb490f05e4B859Ee2288265Daa510FDeFd)
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
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0x4d1EdDBb490f05e4B859Ee2288265Daa510FDeFd)
 */
export const subnetGetterFacetAddress = {
  31337: "0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44",
  314159: "0x4d1EdDBb490f05e4B859Ee2288265Daa510FDeFd",
  2481632: "0x74539671A1D2F1c8f200826bAbA665179F53a1b7",
  248163216: "0x74539671A1D2F1c8f200826bAbA665179F53a1b7",
  1942764459484029: "0x74539671A1D2F1c8f200826bAbA665179F53a1b7",
} as const;

/**
 * -
 * - [__View Contract on Filecoin Calibration Filscan__](https://calibration.filscan.io/address/0x4d1EdDBb490f05e4B859Ee2288265Daa510FDeFd)
 */
export const subnetGetterFacetConfig = {
  address: subnetGetterFacetAddress,
  abi: subnetGetterFacetAbi,
} as const;
