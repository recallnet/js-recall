import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../common";
import type { AccountHelper, AccountHelperInterface } from "../../../src/lib/AccountHelper";
type AccountHelperConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class AccountHelper__factory extends ContractFactory {
    constructor(...args: AccountHelperConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<AccountHelper & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): AccountHelper__factory;
    static readonly bytecode = "0x60808060405234601857608e908161001e823930815050f35b600080fdfe6080806040526004361015601257600080fd5b60003560e01c635d3f8a6914602657600080fd5b60203660031901126053576004356001600160a01b038116919082900360535760209160ff60981b148152f35b600080fdfea264697066735822122068e6076db22212d48c4927c574a1ba66e190658e90913bfc989d5a9d2124c94f64736f6c63430008170033";
    static readonly abi: readonly [{
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_address";
            readonly type: "address";
        }];
        readonly name: "isSystemActor";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }];
    static createInterface(): AccountHelperInterface;
    static connect(address: string, runner?: ContractRunner | null): AccountHelper;
}
export {};
//# sourceMappingURL=AccountHelper__factory.d.ts.map