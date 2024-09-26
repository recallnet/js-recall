import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../common";
import type { FvmAddressHelper, FvmAddressHelperInterface } from "../../../src/lib/FvmAddressHelper";
type FvmAddressHelperConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class FvmAddressHelper__factory extends ContractFactory {
    constructor(...args: FvmAddressHelperConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<FvmAddressHelper & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): FvmAddressHelper__factory;
    static readonly bytecode = "0x608080604052346100195760db908161001f823930815050f35b600080fdfe6080806040526004361015601257600080fd5b600090813560e01c9081635279ff9914608c575080639c6e06c0146076578063ab528f211460605763cf8e4a6e14604857600080fd5b80600319360112605d57602060405160148152f35b80fd5b5080600319360112605d57602060405160018152f35b5080600319360112605d57602060405160048152f35b90508160031936011260a15780600a60209252f35b5080fdfea264697066735822122062a14d85125aa6e11491619a7ad7aaf8e7f4f5ffcc7da6b553a1e1457a5342ed64736f6c63430008170033";
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "NotDelegatedEvmAddress";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "DELEGATED";
        readonly outputs: readonly [{
            readonly internalType: "uint8";
            readonly name: "";
            readonly type: "uint8";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "EAM_ACTOR";
        readonly outputs: readonly [{
            readonly internalType: "uint64";
            readonly name: "";
            readonly type: "uint64";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "PAYLOAD_HASH_LEN";
        readonly outputs: readonly [{
            readonly internalType: "uint8";
            readonly name: "";
            readonly type: "uint8";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "SECP256K1";
        readonly outputs: readonly [{
            readonly internalType: "uint8";
            readonly name: "";
            readonly type: "uint8";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }];
    static createInterface(): FvmAddressHelperInterface;
    static connect(address: string, runner?: ContractRunner | null): FvmAddressHelper;
}
export {};
//# sourceMappingURL=FvmAddressHelper__factory.d.ts.map