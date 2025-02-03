import { Config, defineConfig } from "@wagmi/cli";
import { foundry } from "@wagmi/cli/plugins";
import { Abi } from "viem";

const testnetSubnetChainId = 2481632;
const testnetParentChainId = 314159;
const localnetSubnetChainId = 248163216;
const localnetParentChainId = 31337;

const gatewayManagerFacetAbi: Abi = [
  {
    type: "function",
    name: "addStake",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "fund",
    inputs: [
      {
        name: "subnetId",
        type: "tuple",
        internalType: "struct SubnetID",
        components: [
          { name: "root", type: "uint64", internalType: "uint64" },
          { name: "route", type: "address[]", internalType: "address[]" },
        ],
      },
      {
        name: "to",
        type: "tuple",
        internalType: "struct FvmAddress",
        components: [
          { name: "addrType", type: "uint8", internalType: "uint8" },
          { name: "payload", type: "bytes", internalType: "bytes" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "fundWithToken",
    inputs: [
      {
        name: "subnetId",
        type: "tuple",
        internalType: "struct SubnetID",
        components: [
          { name: "root", type: "uint64", internalType: "uint64" },
          { name: "route", type: "address[]", internalType: "address[]" },
        ],
      },
      {
        name: "to",
        type: "tuple",
        internalType: "struct FvmAddress",
        components: [
          { name: "addrType", type: "uint8", internalType: "uint8" },
          { name: "payload", type: "bytes", internalType: "bytes" },
        ],
      },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "kill",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "register",
    inputs: [
      { name: "genesisCircSupply", type: "uint256", internalType: "uint256" },
      { name: "collateral", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "release",
    inputs: [
      {
        name: "to",
        type: "tuple",
        internalType: "struct FvmAddress",
        components: [
          { name: "addrType", type: "uint8", internalType: "uint8" },
          { name: "payload", type: "bytes", internalType: "bytes" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "releaseStake",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "NewBottomUpMsgBatch",
    inputs: [
      {
        name: "epoch",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "NewTopDownMessage",
    inputs: [
      {
        name: "subnet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "message",
        type: "tuple",
        indexed: false,
        internalType: "struct IpcEnvelope",
        components: [
          { name: "kind", type: "uint8", internalType: "enum IpcMsgKind" },
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
                  { name: "root", type: "uint64", internalType: "uint64" },
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
                  { name: "addrType", type: "uint8", internalType: "uint8" },
                  { name: "payload", type: "bytes", internalType: "bytes" },
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
                  { name: "root", type: "uint64", internalType: "uint64" },
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
                  { name: "addrType", type: "uint8", internalType: "uint8" },
                  { name: "payload", type: "bytes", internalType: "bytes" },
                ],
              },
            ],
          },
          { name: "nonce", type: "uint64", internalType: "uint64" },
          { name: "value", type: "uint256", internalType: "uint256" },
          { name: "message", type: "bytes", internalType: "bytes" },
        ],
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "AddressEmptyCode",
    inputs: [{ name: "target", type: "address", internalType: "address" }],
  },
  {
    type: "error",
    name: "AddressInsufficientBalance",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
  },
  { type: "error", name: "AlreadyRegisteredSubnet", inputs: [] },
  { type: "error", name: "CallFailed", inputs: [] },
  { type: "error", name: "CannotReleaseZero", inputs: [] },
  { type: "error", name: "FailedInnerCall", inputs: [] },
  { type: "error", name: "InsufficientFunds", inputs: [] },
  { type: "error", name: "InvalidActorAddress", inputs: [] },
  {
    type: "error",
    name: "InvalidXnetMessage",
    inputs: [
      {
        name: "reason",
        type: "uint8",
        internalType: "enum InvalidXnetMessageReason",
      },
    ],
  },
  {
    type: "error",
    name: "MethodNotAllowed",
    inputs: [{ name: "reason", type: "string", internalType: "string" }],
  },
  { type: "error", name: "NotEmptySubnetCircSupply", inputs: [] },
  { type: "error", name: "NotEnoughBalance", inputs: [] },
  { type: "error", name: "NotEnoughFunds", inputs: [] },
  { type: "error", name: "NotEnoughFundsToRelease", inputs: [] },
  { type: "error", name: "NotRegisteredSubnet", inputs: [] },
  { type: "error", name: "ReentrancyError", inputs: [] },
  {
    type: "error",
    name: "SafeERC20FailedOperation",
    inputs: [{ name: "token", type: "address", internalType: "address" }],
  },
];

export const ierc20Abi: Abi = [
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferFrom",
    inputs: [
      { name: "from", type: "address", internalType: "address" },
      { name: "to", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Approval",
    inputs: [
      {
        name: "owner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "spender",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "value",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      {
        name: "from",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "value",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
];

export default defineConfig({
  out: "src/generated.ts",
  contracts: [
    {
      name: "GatewayManagerFacet",
      abi: gatewayManagerFacetAbi,
      address: {
        [testnetParentChainId]: "0xb4C4590A2E5Da56aA8310bFF343AFc0645121205",
        [testnetSubnetChainId]: "0x77aa40b105843728088c0132e43fc44348881da8",
        [localnetParentChainId]: "0x9A676e781A523b5d0C0e43731313A708CB607508",
        [localnetSubnetChainId]: "0x77aa40b105843728088c0132e43fc44348881da8",
      },
    },
    {
      name: "RecallERC20",
      abi: ierc20Abi,
      address: {
        [testnetParentChainId]: "0x63DEDA399100Dc536CD4d98FC564ea4Eaf88479F",
        [localnetParentChainId]: "0x4A679253410272dd5232B3Ff7cF5dbB88f295319",
      },
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
          [testnetSubnetChainId]: "0x8c2e3e8ba0d6084786d60A6600e832E8df84846C",
          [localnetSubnetChainId]: "0xe1Aa25618fA0c7A1CFDab5d6B456af611873b629",
        },
        BucketManager: {
          [testnetSubnetChainId]: "0x5aA5cb07469Cabe65c12137400FBC3b0aE265999",
          [localnetSubnetChainId]: "0xf7Cd8fa9b94DB2Aa972023b379c7f72c65E4De9D",
        },
        CreditManager: {
          [testnetSubnetChainId]: "0x3537C0437792B326fa0747b4A95a8667873e916F",
          [localnetSubnetChainId]: "0x82C6D3ed4cD33d8EC1E51d0B5Cc1d822Eaa0c3dC",
        },
      },
    }),
  ],
}) as Config;
