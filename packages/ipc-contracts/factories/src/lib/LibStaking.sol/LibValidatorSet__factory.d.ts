import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../../common";
import type { LibValidatorSet, LibValidatorSetInterface } from "../../../../src/lib/LibStaking.sol/LibValidatorSet";
type LibValidatorSetConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class LibValidatorSet__factory extends ContractFactory {
    constructor(...args: LibValidatorSetConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<LibValidatorSet & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): LibValidatorSet__factory;
    static readonly bytecode = "0x60808060405234601757603a9081601d823930815050f35b600080fdfe600080fdfea26469706673582212204c21fbdbd4248197426c18d09b29f814a4737a2a2a7acb493eee9330e0c2aee264736f6c63430008170033";
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
            readonly name: "newPower";
            readonly type: "uint256";
        }];
        readonly name: "ActiveValidatorCollateralUpdated";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "validator";
            readonly type: "address";
        }];
        readonly name: "ActiveValidatorLeft";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "oldValidator";
            readonly type: "address";
        }, {
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "newValidator";
            readonly type: "address";
        }];
        readonly name: "ActiveValidatorReplaced";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "validator";
            readonly type: "address";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "power";
            readonly type: "uint256";
        }];
        readonly name: "NewActiveValidator";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "validator";
            readonly type: "address";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "power";
            readonly type: "uint256";
        }];
        readonly name: "NewWaitingValidator";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "validator";
            readonly type: "address";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "newPower";
            readonly type: "uint256";
        }];
        readonly name: "WaitingValidatorCollateralUpdated";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "validator";
            readonly type: "address";
        }];
        readonly name: "WaitingValidatorLeft";
        readonly type: "event";
    }];
    static createInterface(): LibValidatorSetInterface;
    static connect(address: string, runner?: ContractRunner | null): LibValidatorSet;
}
export {};
//# sourceMappingURL=LibValidatorSet__factory.d.ts.map