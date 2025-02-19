import { Config, defineConfig } from "@wagmi/cli";
import { foundry } from "@wagmi/cli/plugins";
import { Abi } from "viem";

import {
  DEVNET_CHAIN_ID,
  DEVNET_GATEWAY_MANAGER_FACET_ADDRESS,
  DEVNET_SUBNET_GETTER_FACET_ADDRESS,
  LOCALNET_BLOB_MANAGER_ADDRESS,
  LOCALNET_BUCKET_MANAGER_ADDRESS,
  LOCALNET_CHAIN_ID,
  LOCALNET_CREDIT_MANAGER_ADDRESS,
  LOCALNET_GATEWAY_MANAGER_FACET_ADDRESS,
  LOCALNET_PARENT_CHAIN_ID,
  LOCALNET_PARENT_ERC20_ADDRESS,
  LOCALNET_PARENT_GATEWAY_MANAGER_FACET_ADDRESS,
  LOCALNET_PARENT_SUBNET_GETTER_FACET_ADDRESS,
  LOCALNET_SUBNET_GETTER_FACET_ADDRESS,
  TESTNET_BLOB_MANAGER_ADDRESS,
  TESTNET_BUCKET_MANAGER_ADDRESS,
  TESTNET_CHAIN_ID,
  TESTNET_CREDIT_MANAGER_ADDRESS,
  TESTNET_GATEWAY_MANAGER_FACET_ADDRESS,
  TESTNET_PARENT_CHAIN_ID,
  TESTNET_PARENT_ERC20_ADDRESS,
  TESTNET_PARENT_GATEWAY_MANAGER_FACET_ADDRESS,
  TESTNET_PARENT_SUBNET_GETTER_FACET_ADDRESS,
  TESTNET_SUBNET_GETTER_FACET_ADDRESS,
} from "@recallnet/network-constants";

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

export const iErc20Abi: Abi = [
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
  out: "src/index.ts",
  contracts: [
    {
      name: "GatewayManagerFacet",
      abi: gatewayManagerFacetAbi,
      address: {
        [TESTNET_PARENT_CHAIN_ID]: TESTNET_PARENT_GATEWAY_MANAGER_FACET_ADDRESS,
        [TESTNET_CHAIN_ID]: TESTNET_GATEWAY_MANAGER_FACET_ADDRESS,
        [LOCALNET_PARENT_CHAIN_ID]:
          LOCALNET_PARENT_GATEWAY_MANAGER_FACET_ADDRESS,
        [LOCALNET_CHAIN_ID]: LOCALNET_GATEWAY_MANAGER_FACET_ADDRESS,
        [DEVNET_CHAIN_ID]: DEVNET_GATEWAY_MANAGER_FACET_ADDRESS,
      },
    },
    {
      name: "SubnetGetterFacet",
      abi: subnetGetterFacetAbi,
      address: {
        [TESTNET_PARENT_CHAIN_ID]: TESTNET_PARENT_SUBNET_GETTER_FACET_ADDRESS,
        [LOCALNET_PARENT_CHAIN_ID]: LOCALNET_PARENT_SUBNET_GETTER_FACET_ADDRESS,
        [TESTNET_CHAIN_ID]: TESTNET_SUBNET_GETTER_FACET_ADDRESS,
        [LOCALNET_CHAIN_ID]: LOCALNET_SUBNET_GETTER_FACET_ADDRESS,
        [DEVNET_CHAIN_ID]: DEVNET_SUBNET_GETTER_FACET_ADDRESS,
      },
    },
    {
      name: "RecallERC20",
      abi: iErc20Abi,
      address: {
        [TESTNET_PARENT_CHAIN_ID]: TESTNET_PARENT_ERC20_ADDRESS,
        [LOCALNET_PARENT_CHAIN_ID]: LOCALNET_PARENT_ERC20_ADDRESS,
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
        "IMachineFacade.sol/IMachineFacade.json",
      ],
      deployments: {
        BlobManager: {
          [TESTNET_CHAIN_ID]: TESTNET_BLOB_MANAGER_ADDRESS,
          [LOCALNET_CHAIN_ID]: LOCALNET_BLOB_MANAGER_ADDRESS,
        },
        BucketManager: {
          [TESTNET_CHAIN_ID]: TESTNET_BUCKET_MANAGER_ADDRESS,
          [LOCALNET_CHAIN_ID]: LOCALNET_BUCKET_MANAGER_ADDRESS,
        },
        CreditManager: {
          [TESTNET_CHAIN_ID]: TESTNET_CREDIT_MANAGER_ADDRESS,
          [LOCALNET_CHAIN_ID]: LOCALNET_CREDIT_MANAGER_ADDRESS,
        },
      },
    }),
  ],
}) as Config;
