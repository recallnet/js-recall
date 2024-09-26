import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../../common";
import type { LibStaking, LibStakingInterface } from "../../../../src/lib/LibStaking.sol/LibStaking";
type LibStakingConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class LibStaking__factory extends ContractFactory {
    constructor(...args: LibStakingConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<LibStaking & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): LibStaking__factory;
    static readonly bytecode = "0x60808060405234601757603a9081601d823930815050f35b600080fdfe600080fdfea2646970667358221220672972dc2c3722fb6f02486eba5eddf4e86d40a063f772b9d6725d293e05bb9f64736f6c63430008170033";
    static readonly abi: readonly [{
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "validator";
            readonly type: "address";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "amount";
            readonly type: "uint256";
        }];
        readonly name: "CollateralClaimed";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "uint64";
            readonly name: "number";
            readonly type: "uint64";
        }];
        readonly name: "ConfigurationNumberConfirmed";
        readonly type: "event";
    }];
    static createInterface(): LibStakingInterface;
    static connect(address: string, runner?: ContractRunner | null): LibStaking;
}
export {};
//# sourceMappingURL=LibStaking__factory.d.ts.map