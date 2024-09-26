import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../common";
import type { LibStakingChangeLog, LibStakingChangeLogInterface } from "../../../src/lib/LibStakingChangeLog";
type LibStakingChangeLogConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class LibStakingChangeLog__factory extends ContractFactory {
    constructor(...args: LibStakingChangeLogConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<LibStakingChangeLog & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): LibStakingChangeLog__factory;
    static readonly bytecode = "0x60808060405234601757603a9081601d823930815050f35b600080fdfe600080fdfea2646970667358221220b87f87ffc786c37548730f0f16d9bd36eb863e96d3164dea0656c0bcbbd4438a64736f6c63430008170033";
    static readonly abi: readonly [{
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "enum StakingOperation";
            readonly name: "op";
            readonly type: "uint8";
        }, {
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "validator";
            readonly type: "address";
        }, {
            readonly indexed: false;
            readonly internalType: "bytes";
            readonly name: "payload";
            readonly type: "bytes";
        }, {
            readonly indexed: false;
            readonly internalType: "uint64";
            readonly name: "configurationNumber";
            readonly type: "uint64";
        }];
        readonly name: "NewStakingChangeRequest";
        readonly type: "event";
    }];
    static createInterface(): LibStakingChangeLogInterface;
    static connect(address: string, runner?: ContractRunner | null): LibStakingChangeLog;
}
export {};
//# sourceMappingURL=LibStakingChangeLog__factory.d.ts.map