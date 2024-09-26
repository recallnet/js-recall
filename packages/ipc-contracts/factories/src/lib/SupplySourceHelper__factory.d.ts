import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../common";
import type { SupplySourceHelper, SupplySourceHelperInterface } from "../../../src/lib/SupplySourceHelper";
type SupplySourceHelperConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class SupplySourceHelper__factory extends ContractFactory {
    constructor(...args: SupplySourceHelperConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<SupplySourceHelper & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): SupplySourceHelper__factory;
    static readonly bytecode = "0x60808060405234601757603a9081601d823930815050f35b600080fdfe600080fdfea2646970667358221220de6f67a4ecb5ebf100165f34283162f3cae3989e75a14d6dcb592f9f1475eff964736f6c63430008170033";
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "InvalidERC20Address";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "NoBalanceIncrease";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "UnexpectedSupplySource";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "UnknownSupplySource";
        readonly type: "error";
    }];
    static createInterface(): SupplySourceHelperInterface;
    static connect(address: string, runner?: ContractRunner | null): SupplySourceHelper;
}
export {};
//# sourceMappingURL=SupplySourceHelper__factory.d.ts.map