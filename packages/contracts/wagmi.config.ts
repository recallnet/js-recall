import { Config, defineConfig } from "@wagmi/cli";
import { foundry } from "@wagmi/cli/plugins";
import { Abi } from "viem";

const chainId = 2481632;
const gatewayGetterFacetAbi: Abi = [
  {
    type: "function",
    name: "appliedTopDownNonce",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bottomUpCheckPeriod",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bottomUpCheckpoint",
    inputs: [
      {
        name: "e",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct BottomUpCheckpoint",
        components: [
          {
            name: "subnetID",
            type: "tuple",
            internalType: "struct SubnetID",
            components: [
              {
                name: "root",
                type: "uint64",
                internalType: "uint64",
              },
              {
                name: "route",
                type: "address[]",
                internalType: "address[]",
              },
            ],
          },
          {
            name: "blockHeight",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "blockHash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "nextConfigurationNumber",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "msgs",
            type: "tuple[]",
            internalType: "struct IpcEnvelope[]",
            components: [
              {
                name: "kind",
                type: "uint8",
                internalType: "enum IpcMsgKind",
              },
              {
                name: "to",
                type: "tuple",
                internalType: "struct IPCAddress",
                components: [
                  {
                    name: "subnetId",
                    type: "tuple",
                    internalType: "struct SubnetID",
                    components: [
                      {
                        name: "root",
                        type: "uint64",
                        internalType: "uint64",
                      },
                      {
                        name: "route",
                        type: "address[]",
                        internalType: "address[]",
                      },
                    ],
                  },
                  {
                    name: "rawAddress",
                    type: "tuple",
                    internalType: "struct FvmAddress",
                    components: [
                      {
                        name: "addrType",
                        type: "uint8",
                        internalType: "uint8",
                      },
                      {
                        name: "payload",
                        type: "bytes",
                        internalType: "bytes",
                      },
                    ],
                  },
                ],
              },
              {
                name: "from",
                type: "tuple",
                internalType: "struct IPCAddress",
                components: [
                  {
                    name: "subnetId",
                    type: "tuple",
                    internalType: "struct SubnetID",
                    components: [
                      {
                        name: "root",
                        type: "uint64",
                        internalType: "uint64",
                      },
                      {
                        name: "route",
                        type: "address[]",
                        internalType: "address[]",
                      },
                    ],
                  },
                  {
                    name: "rawAddress",
                    type: "tuple",
                    internalType: "struct FvmAddress",
                    components: [
                      {
                        name: "addrType",
                        type: "uint8",
                        internalType: "uint8",
                      },
                      {
                        name: "payload",
                        type: "bytes",
                        internalType: "bytes",
                      },
                    ],
                  },
                ],
              },
              {
                name: "nonce",
                type: "uint64",
                internalType: "uint64",
              },
              {
                name: "value",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "message",
                type: "bytes",
                internalType: "bytes",
              },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bottomUpMsgBatch",
    inputs: [
      {
        name: "e",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct BottomUpMsgBatch",
        components: [
          {
            name: "subnetID",
            type: "tuple",
            internalType: "struct SubnetID",
            components: [
              {
                name: "root",
                type: "uint64",
                internalType: "uint64",
              },
              {
                name: "route",
                type: "address[]",
                internalType: "address[]",
              },
            ],
          },
          {
            name: "blockHeight",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "msgs",
            type: "tuple[]",
            internalType: "struct IpcEnvelope[]",
            components: [
              {
                name: "kind",
                type: "uint8",
                internalType: "enum IpcMsgKind",
              },
              {
                name: "to",
                type: "tuple",
                internalType: "struct IPCAddress",
                components: [
                  {
                    name: "subnetId",
                    type: "tuple",
                    internalType: "struct SubnetID",
                    components: [
                      {
                        name: "root",
                        type: "uint64",
                        internalType: "uint64",
                      },
                      {
                        name: "route",
                        type: "address[]",
                        internalType: "address[]",
                      },
                    ],
                  },
                  {
                    name: "rawAddress",
                    type: "tuple",
                    internalType: "struct FvmAddress",
                    components: [
                      {
                        name: "addrType",
                        type: "uint8",
                        internalType: "uint8",
                      },
                      {
                        name: "payload",
                        type: "bytes",
                        internalType: "bytes",
                      },
                    ],
                  },
                ],
              },
              {
                name: "from",
                type: "tuple",
                internalType: "struct IPCAddress",
                components: [
                  {
                    name: "subnetId",
                    type: "tuple",
                    internalType: "struct SubnetID",
                    components: [
                      {
                        name: "root",
                        type: "uint64",
                        internalType: "uint64",
                      },
                      {
                        name: "route",
                        type: "address[]",
                        internalType: "address[]",
                      },
                    ],
                  },
                  {
                    name: "rawAddress",
                    type: "tuple",
                    internalType: "struct FvmAddress",
                    components: [
                      {
                        name: "addrType",
                        type: "uint8",
                        internalType: "uint8",
                      },
                      {
                        name: "payload",
                        type: "bytes",
                        internalType: "bytes",
                      },
                    ],
                  },
                ],
              },
              {
                name: "nonce",
                type: "uint64",
                internalType: "uint64",
              },
              {
                name: "value",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "message",
                type: "bytes",
                internalType: "bytes",
              },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bottomUpNonce",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAppliedBottomUpNonce",
    inputs: [
      {
        name: "subnetId",
        type: "tuple",
        internalType: "struct SubnetID",
        components: [
          {
            name: "root",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "route",
            type: "address[]",
            internalType: "address[]",
          },
        ],
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
      {
        name: "",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCheckpointCurrentWeight",
    inputs: [
      {
        name: "h",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCheckpointInfo",
    inputs: [
      {
        name: "h",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct QuorumInfo",
        components: [
          {
            name: "hash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "rootHash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "threshold",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "currentWeight",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "reached",
            type: "bool",
            internalType: "bool",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCheckpointRetentionHeight",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCheckpointSignatureBundle",
    inputs: [
      {
        name: "h",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "ch",
        type: "tuple",
        internalType: "struct BottomUpCheckpoint",
        components: [
          {
            name: "subnetID",
            type: "tuple",
            internalType: "struct SubnetID",
            components: [
              {
                name: "root",
                type: "uint64",
                internalType: "uint64",
              },
              {
                name: "route",
                type: "address[]",
                internalType: "address[]",
              },
            ],
          },
          {
            name: "blockHeight",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "blockHash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "nextConfigurationNumber",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "msgs",
            type: "tuple[]",
            internalType: "struct IpcEnvelope[]",
            components: [
              {
                name: "kind",
                type: "uint8",
                internalType: "enum IpcMsgKind",
              },
              {
                name: "to",
                type: "tuple",
                internalType: "struct IPCAddress",
                components: [
                  {
                    name: "subnetId",
                    type: "tuple",
                    internalType: "struct SubnetID",
                    components: [
                      {
                        name: "root",
                        type: "uint64",
                        internalType: "uint64",
                      },
                      {
                        name: "route",
                        type: "address[]",
                        internalType: "address[]",
                      },
                    ],
                  },
                  {
                    name: "rawAddress",
                    type: "tuple",
                    internalType: "struct FvmAddress",
                    components: [
                      {
                        name: "addrType",
                        type: "uint8",
                        internalType: "uint8",
                      },
                      {
                        name: "payload",
                        type: "bytes",
                        internalType: "bytes",
                      },
                    ],
                  },
                ],
              },
              {
                name: "from",
                type: "tuple",
                internalType: "struct IPCAddress",
                components: [
                  {
                    name: "subnetId",
                    type: "tuple",
                    internalType: "struct SubnetID",
                    components: [
                      {
                        name: "root",
                        type: "uint64",
                        internalType: "uint64",
                      },
                      {
                        name: "route",
                        type: "address[]",
                        internalType: "address[]",
                      },
                    ],
                  },
                  {
                    name: "rawAddress",
                    type: "tuple",
                    internalType: "struct FvmAddress",
                    components: [
                      {
                        name: "addrType",
                        type: "uint8",
                        internalType: "uint8",
                      },
                      {
                        name: "payload",
                        type: "bytes",
                        internalType: "bytes",
                      },
                    ],
                  },
                ],
              },
              {
                name: "nonce",
                type: "uint64",
                internalType: "uint64",
              },
              {
                name: "value",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "message",
                type: "bytes",
                internalType: "bytes",
              },
            ],
          },
        ],
      },
      {
        name: "info",
        type: "tuple",
        internalType: "struct QuorumInfo",
        components: [
          {
            name: "hash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "rootHash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "threshold",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "currentWeight",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "reached",
            type: "bool",
            internalType: "bool",
          },
        ],
      },
      {
        name: "signatories",
        type: "address[]",
        internalType: "address[]",
      },
      {
        name: "signatures",
        type: "bytes[]",
        internalType: "bytes[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCommitSha",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCurrentBottomUpCheckpoint",
    inputs: [],
    outputs: [
      {
        name: "exists",
        type: "bool",
        internalType: "bool",
      },
      {
        name: "epoch",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "checkpoint",
        type: "tuple",
        internalType: "struct BottomUpCheckpoint",
        components: [
          {
            name: "subnetID",
            type: "tuple",
            internalType: "struct SubnetID",
            components: [
              {
                name: "root",
                type: "uint64",
                internalType: "uint64",
              },
              {
                name: "route",
                type: "address[]",
                internalType: "address[]",
              },
            ],
          },
          {
            name: "blockHeight",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "blockHash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "nextConfigurationNumber",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "msgs",
            type: "tuple[]",
            internalType: "struct IpcEnvelope[]",
            components: [
              {
                name: "kind",
                type: "uint8",
                internalType: "enum IpcMsgKind",
              },
              {
                name: "to",
                type: "tuple",
                internalType: "struct IPCAddress",
                components: [
                  {
                    name: "subnetId",
                    type: "tuple",
                    internalType: "struct SubnetID",
                    components: [
                      {
                        name: "root",
                        type: "uint64",
                        internalType: "uint64",
                      },
                      {
                        name: "route",
                        type: "address[]",
                        internalType: "address[]",
                      },
                    ],
                  },
                  {
                    name: "rawAddress",
                    type: "tuple",
                    internalType: "struct FvmAddress",
                    components: [
                      {
                        name: "addrType",
                        type: "uint8",
                        internalType: "uint8",
                      },
                      {
                        name: "payload",
                        type: "bytes",
                        internalType: "bytes",
                      },
                    ],
                  },
                ],
              },
              {
                name: "from",
                type: "tuple",
                internalType: "struct IPCAddress",
                components: [
                  {
                    name: "subnetId",
                    type: "tuple",
                    internalType: "struct SubnetID",
                    components: [
                      {
                        name: "root",
                        type: "uint64",
                        internalType: "uint64",
                      },
                      {
                        name: "route",
                        type: "address[]",
                        internalType: "address[]",
                      },
                    ],
                  },
                  {
                    name: "rawAddress",
                    type: "tuple",
                    internalType: "struct FvmAddress",
                    components: [
                      {
                        name: "addrType",
                        type: "uint8",
                        internalType: "uint8",
                      },
                      {
                        name: "payload",
                        type: "bytes",
                        internalType: "bytes",
                      },
                    ],
                  },
                ],
              },
              {
                name: "nonce",
                type: "uint64",
                internalType: "uint64",
              },
              {
                name: "value",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "message",
                type: "bytes",
                internalType: "bytes",
              },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCurrentConfigurationNumber",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCurrentMembership",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct Membership",
        components: [
          {
            name: "validators",
            type: "tuple[]",
            internalType: "struct Validator[]",
            components: [
              {
                name: "weight",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "addr",
                type: "address",
                internalType: "address",
              },
              {
                name: "metadata",
                type: "bytes",
                internalType: "bytes",
              },
            ],
          },
          {
            name: "configurationNumber",
            type: "uint64",
            internalType: "uint64",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getIncompleteCheckpointHeights",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256[]",
        internalType: "uint256[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getIncompleteCheckpoints",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct BottomUpCheckpoint[]",
        components: [
          {
            name: "subnetID",
            type: "tuple",
            internalType: "struct SubnetID",
            components: [
              {
                name: "root",
                type: "uint64",
                internalType: "uint64",
              },
              {
                name: "route",
                type: "address[]",
                internalType: "address[]",
              },
            ],
          },
          {
            name: "blockHeight",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "blockHash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "nextConfigurationNumber",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "msgs",
            type: "tuple[]",
            internalType: "struct IpcEnvelope[]",
            components: [
              {
                name: "kind",
                type: "uint8",
                internalType: "enum IpcMsgKind",
              },
              {
                name: "to",
                type: "tuple",
                internalType: "struct IPCAddress",
                components: [
                  {
                    name: "subnetId",
                    type: "tuple",
                    internalType: "struct SubnetID",
                    components: [
                      {
                        name: "root",
                        type: "uint64",
                        internalType: "uint64",
                      },
                      {
                        name: "route",
                        type: "address[]",
                        internalType: "address[]",
                      },
                    ],
                  },
                  {
                    name: "rawAddress",
                    type: "tuple",
                    internalType: "struct FvmAddress",
                    components: [
                      {
                        name: "addrType",
                        type: "uint8",
                        internalType: "uint8",
                      },
                      {
                        name: "payload",
                        type: "bytes",
                        internalType: "bytes",
                      },
                    ],
                  },
                ],
              },
              {
                name: "from",
                type: "tuple",
                internalType: "struct IPCAddress",
                components: [
                  {
                    name: "subnetId",
                    type: "tuple",
                    internalType: "struct SubnetID",
                    components: [
                      {
                        name: "root",
                        type: "uint64",
                        internalType: "uint64",
                      },
                      {
                        name: "route",
                        type: "address[]",
                        internalType: "address[]",
                      },
                    ],
                  },
                  {
                    name: "rawAddress",
                    type: "tuple",
                    internalType: "struct FvmAddress",
                    components: [
                      {
                        name: "addrType",
                        type: "uint8",
                        internalType: "uint8",
                      },
                      {
                        name: "payload",
                        type: "bytes",
                        internalType: "bytes",
                      },
                    ],
                  },
                ],
              },
              {
                name: "nonce",
                type: "uint64",
                internalType: "uint64",
              },
              {
                name: "value",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "message",
                type: "bytes",
                internalType: "bytes",
              },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLastConfigurationNumber",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLastMembership",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct Membership",
        components: [
          {
            name: "validators",
            type: "tuple[]",
            internalType: "struct Validator[]",
            components: [
              {
                name: "weight",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "addr",
                type: "address",
                internalType: "address",
              },
              {
                name: "metadata",
                type: "bytes",
                internalType: "bytes",
              },
            ],
          },
          {
            name: "configurationNumber",
            type: "uint64",
            internalType: "uint64",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLatestParentFinality",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct ParentFinality",
        components: [
          {
            name: "height",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "blockHash",
            type: "bytes32",
            internalType: "bytes32",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getNetworkName",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct SubnetID",
        components: [
          {
            name: "root",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "route",
            type: "address[]",
            internalType: "address[]",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getParentFinality",
    inputs: [
      {
        name: "blockNumber",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct ParentFinality",
        components: [
          {
            name: "height",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "blockHash",
            type: "bytes32",
            internalType: "bytes32",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getQuorumThreshold",
    inputs: [
      {
        name: "totalWeight",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubnet",
    inputs: [
      {
        name: "subnetId",
        type: "tuple",
        internalType: "struct SubnetID",
        components: [
          {
            name: "root",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "route",
            type: "address[]",
            internalType: "address[]",
          },
        ],
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
      {
        name: "",
        type: "tuple",
        internalType: "struct Subnet",
        components: [
          {
            name: "stake",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "genesisEpoch",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "circSupply",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "topDownNonce",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "appliedBottomUpNonce",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "id",
            type: "tuple",
            internalType: "struct SubnetID",
            components: [
              {
                name: "root",
                type: "uint64",
                internalType: "uint64",
              },
              {
                name: "route",
                type: "address[]",
                internalType: "address[]",
              },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubnetKeys",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bytes32[]",
        internalType: "bytes32[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubnetTopDownMsgsLength",
    inputs: [
      {
        name: "subnetId",
        type: "tuple",
        internalType: "struct SubnetID",
        components: [
          {
            name: "root",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "route",
            type: "address[]",
            internalType: "address[]",
          },
        ],
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTopDownNonce",
    inputs: [
      {
        name: "subnetId",
        type: "tuple",
        internalType: "struct SubnetID",
        components: [
          {
            name: "root",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "route",
            type: "address[]",
            internalType: "address[]",
          },
        ],
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
      {
        name: "",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getValidatorConfigurationNumbers",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint64",
        internalType: "uint64",
      },
      {
        name: "",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "listSubnets",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct Subnet[]",
        components: [
          {
            name: "stake",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "genesisEpoch",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "circSupply",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "topDownNonce",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "appliedBottomUpNonce",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "id",
            type: "tuple",
            internalType: "struct SubnetID",
            components: [
              {
                name: "root",
                type: "uint64",
                internalType: "uint64",
              },
              {
                name: "route",
                type: "address[]",
                internalType: "address[]",
              },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "majorityPercentage",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxMsgsPerBottomUpBatch",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "postbox",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "storableMsg",
        type: "tuple",
        internalType: "struct IpcEnvelope",
        components: [
          {
            name: "kind",
            type: "uint8",
            internalType: "enum IpcMsgKind",
          },
          {
            name: "to",
            type: "tuple",
            internalType: "struct IPCAddress",
            components: [
              {
                name: "subnetId",
                type: "tuple",
                internalType: "struct SubnetID",
                components: [
                  {
                    name: "root",
                    type: "uint64",
                    internalType: "uint64",
                  },
                  {
                    name: "route",
                    type: "address[]",
                    internalType: "address[]",
                  },
                ],
              },
              {
                name: "rawAddress",
                type: "tuple",
                internalType: "struct FvmAddress",
                components: [
                  {
                    name: "addrType",
                    type: "uint8",
                    internalType: "uint8",
                  },
                  {
                    name: "payload",
                    type: "bytes",
                    internalType: "bytes",
                  },
                ],
              },
            ],
          },
          {
            name: "from",
            type: "tuple",
            internalType: "struct IPCAddress",
            components: [
              {
                name: "subnetId",
                type: "tuple",
                internalType: "struct SubnetID",
                components: [
                  {
                    name: "root",
                    type: "uint64",
                    internalType: "uint64",
                  },
                  {
                    name: "route",
                    type: "address[]",
                    internalType: "address[]",
                  },
                ],
              },
              {
                name: "rawAddress",
                type: "tuple",
                internalType: "struct FvmAddress",
                components: [
                  {
                    name: "addrType",
                    type: "uint8",
                    internalType: "uint8",
                  },
                  {
                    name: "payload",
                    type: "bytes",
                    internalType: "bytes",
                  },
                ],
              },
            ],
          },
          {
            name: "nonce",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "value",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "message",
            type: "bytes",
            internalType: "bytes",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "subnets",
    inputs: [
      {
        name: "h",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "subnet",
        type: "tuple",
        internalType: "struct Subnet",
        components: [
          {
            name: "stake",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "genesisEpoch",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "circSupply",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "topDownNonce",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "appliedBottomUpNonce",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "id",
            type: "tuple",
            internalType: "struct SubnetID",
            components: [
              {
                name: "root",
                type: "uint64",
                internalType: "uint64",
              },
              {
                name: "route",
                type: "address[]",
                internalType: "address[]",
              },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSubnets",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    stateMutability: "view",
  },
];

export default defineConfig({
  out: "src/generated.ts",
  contracts: [
    {
      name: "GatewayGetterFacetParent",
      abi: gatewayGetterFacetAbi,
      address: { [chainId]: "0xb4C4590A2E5Da56aA8310bFF343AFc0645121205" },
    },
    {
      name: "GatewayGetterFacetSubnet",
      abi: gatewayGetterFacetAbi,
      address: { [chainId]: "0x77aa40b105843728088c0132e43fc44348881da8" },
    },
  ],
  plugins: [
    foundry({
      project: "./contracts",
      include: [
        "BlobManager.sol/BlobManager.json",
        "BucketManager.sol/BucketManager.json",
        "CreditManager.sol/CreditManager.json",
      ],
      deployments: {
        BlobManager: {
          [chainId]: "0x8c2e3e8ba0d6084786d60A6600e832E8df84846C",
        },
        BucketManager: {
          [chainId]: "0x5aA5cb07469Cabe65c12137400FBC3b0aE265999",
        },
        CreditManager: {
          [chainId]: "0x3537C0437792B326fa0747b4A95a8667873e916F",
        },
      },
    }),
  ],
}) as Config;
