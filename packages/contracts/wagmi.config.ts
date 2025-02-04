import { Config, defineConfig } from "@wagmi/cli";
import { foundry } from "@wagmi/cli/plugins";
import { Abi } from "viem";

const testnetSubnetChainId = 2481632;
const testnetParentChainId = 314159;
const localnetSubnetChainId = 248163216;
const localnetParentChainId = 31337;
const devnetChainId = 1942764459484029;

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

export const subnetGetterFacetAbi: Abi = [
  {
    type: "function",
    name: "getGateway",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubnetActorCheckpointerFacet",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubnetActorCheckpointerSelectors",
    inputs: [],
    outputs: [{ name: "", type: "bytes4[]", internalType: "bytes4[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubnetActorGetterFacet",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubnetActorGetterSelectors",
    inputs: [],
    outputs: [{ name: "", type: "bytes4[]", internalType: "bytes4[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubnetActorManagerFacet",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubnetActorManagerSelectors",
    inputs: [],
    outputs: [{ name: "", type: "bytes4[]", internalType: "bytes4[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubnetActorPauserFacet",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubnetActorPauserSelectors",
    inputs: [],
    outputs: [{ name: "", type: "bytes4[]", internalType: "bytes4[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubnetActorRewarderFacet",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubnetActorRewarderSelectors",
    inputs: [],
    outputs: [{ name: "", type: "bytes4[]", internalType: "bytes4[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubnetDeployedByNonce",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "nonce", type: "uint64", internalType: "uint64" },
    ],
    outputs: [{ name: "subnet", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserLastNonce",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "nonce", type: "uint64", internalType: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "latestSubnetDeployed",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    outputs: [{ name: "subnet", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "updateReferenceSubnetContract",
    inputs: [
      { name: "newGetterFacet", type: "address", internalType: "address" },
      { name: "newManagerFacet", type: "address", internalType: "address" },
      {
        name: "newSubnetGetterSelectors",
        type: "bytes4[]",
        internalType: "bytes4[]",
      },
      {
        name: "newSubnetManagerSelectors",
        type: "bytes4[]",
        internalType: "bytes4[]",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  { type: "error", name: "CannotFindSubnet", inputs: [] },
  { type: "error", name: "FacetCannotBeZero", inputs: [] },
  { type: "error", name: "NotOwner", inputs: [] },
];

export default defineConfig({
  out: "src/generated.ts",
  contracts: [
    {
      name: "GatewayManagerFacet",
      abi: gatewayManagerFacetAbi,
      address: {
        [testnetParentChainId]: "0x45da97E918183cA1f2891E277F600fC0B2dDD9dC",
        [testnetSubnetChainId]: "0x77aa40b105843728088c0132e43fc44348881da8",
        [localnetParentChainId]: "0x9A676e781A523b5d0C0e43731313A708CB607508",
        [localnetSubnetChainId]: "0x77aa40b105843728088c0132e43fc44348881da8",
        [devnetChainId]: "0x77aa40b105843728088c0132e43fc44348881da8",
      },
    },
    {
      name: "SubnetGetterFacet",
      abi: subnetGetterFacetAbi,
      address: {
        [testnetParentChainId]: "0xd7719695eE7042cDCFF4065ef93346bF33222d78",
        [localnetParentChainId]: "0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44",
        [testnetSubnetChainId]: "0x74539671a1d2f1c8f200826baba665179f53a1b7",
        [localnetSubnetChainId]: "0x74539671a1d2f1c8f200826baba665179f53a1b7",
        [devnetChainId]: "0x74539671a1d2f1c8f200826baba665179f53a1b7",
      },
    },
    {
      name: "RecallERC20",
      abi: ierc20Abi,
      address: {
        [testnetParentChainId]: "0x2e6453107b4417eC2fB58ABDcc2968955Bd005Df",
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
          [testnetSubnetChainId]: "0x7180B1e71814A3cdC62A414Ae02e3f6E1314B209",
          [localnetSubnetChainId]: "0xe1Aa25618fA0c7A1CFDab5d6B456af611873b629",
        },
        BucketManager: {
          [testnetSubnetChainId]: "0xfbCF213040240BA86Fed92961BB60625233641a1",
          [localnetSubnetChainId]: "0xf7Cd8fa9b94DB2Aa972023b379c7f72c65E4De9D",
        },
        CreditManager: {
          [testnetSubnetChainId]: "0xDB85431B6a016e1652c7E898918d787B6aef7185",
          [localnetSubnetChainId]: "0x82C6D3ed4cD33d8EC1E51d0B5Cc1d822Eaa0c3dC",
        },
      },
    }),
  ],
}) as Config;
