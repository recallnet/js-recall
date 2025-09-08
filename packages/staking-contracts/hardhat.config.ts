import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import type { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin],
  paths: {
    sources: "./contracts/contracts",
  },
  solidity: {
    profiles: {
      default: {
        version: "0.8.30",
      },
    },
  },
  networks: {
    hardhat: {
      type: "http",
      url: "http://127.0.0.1:8545",
    },
  },
};

export default config;
