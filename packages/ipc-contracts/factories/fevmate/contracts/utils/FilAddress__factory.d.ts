import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../../common";
import type { FilAddress, FilAddressInterface } from "../../../../fevmate/contracts/utils/FilAddress";
type FilAddressConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class FilAddress__factory extends ContractFactory {
    constructor(...args: FilAddressConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<FilAddress & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): FilAddress__factory;
    static readonly bytecode = "0x60808060405234601757603a9081601d823930815050f35b600080fdfe600080fdfea26469706673582212208fe863a63a936a47c12b0768b21e71724ff40817e41b05a3c4b88090ada5066b64736f6c63430008170033";
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "CallFailed";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "InsufficientFunds";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "InvalidAddress";
        readonly type: "error";
    }];
    static createInterface(): FilAddressInterface;
    static connect(address: string, runner?: ContractRunner | null): FilAddress;
}
export {};
//# sourceMappingURL=FilAddress__factory.d.ts.map