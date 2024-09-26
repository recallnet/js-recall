import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../../common";
import type { LibStakingReleaseQueue, LibStakingReleaseQueueInterface } from "../../../../src/lib/LibStaking.sol/LibStakingReleaseQueue";
type LibStakingReleaseQueueConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class LibStakingReleaseQueue__factory extends ContractFactory {
    constructor(...args: LibStakingReleaseQueueConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<LibStakingReleaseQueue & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): LibStakingReleaseQueue__factory;
    static readonly bytecode = "0x60808060405234601757603a9081601d823930815050f35b600080fdfe600080fdfea26469706673582212202d7a5cb2dbc309084f5efa31c02e39ab7cfbf3c080746f24061c641baa53818264736f6c63430008170033";
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
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "releaseBlock";
            readonly type: "uint256";
        }];
        readonly name: "NewCollateralRelease";
        readonly type: "event";
    }];
    static createInterface(): LibStakingReleaseQueueInterface;
    static connect(address: string, runner?: ContractRunner | null): LibStakingReleaseQueue;
}
export {};
//# sourceMappingURL=LibStakingReleaseQueue__factory.d.ts.map