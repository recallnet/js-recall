import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../common";
import type { OwnershipFacet, OwnershipFacetInterface } from "../../src/OwnershipFacet";
type OwnershipFacetConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class OwnershipFacet__factory extends ContractFactory {
    constructor(...args: OwnershipFacetConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<OwnershipFacet & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): OwnershipFacet__factory;
    static readonly bytecode = "0x6080806040523461001657610184908161001c8239f35b600080fdfe608080604052600436101561001357600080fd5b600090813560e01c9081638da5cb5b14610106575063f2fde38b1461003757600080fd5b34610103576020366003190112610103576004356001600160a01b03818116918290036100ff577f806e0cbb9fce296bbc336a48f42bf1dbc69722d18d90d6fe705b7582c2bb4bd5918254918216908133036100ed5780156100db577f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e093816040946bffffffffffffffffffffffff60a01b1617905582519182526020820152a180f35b60405163e6c4247b60e01b8152600490fd5b6040516330cd747160e01b8152600490fd5b8280fd5b80fd5b90503461014a578160031936011261014a577f806e0cbb9fce296bbc336a48f42bf1dbc69722d18d90d6fe705b7582c2bb4bd5546001600160a01b03168152602090f35b5080fdfea2646970667358221220ca5fd7e1ee790de893a65ce17fe792793b62a7f50d6a35fff8a8166c539fba4564736f6c63430008170033";
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "InvalidAddress";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "NotOwner";
        readonly type: "error";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "oldOwner";
            readonly type: "address";
        }, {
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "newOwner";
            readonly type: "address";
        }];
        readonly name: "OwnershipTransferred";
        readonly type: "event";
    }, {
        readonly inputs: readonly [];
        readonly name: "owner";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "owner_";
            readonly type: "address";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_newOwner";
            readonly type: "address";
        }];
        readonly name: "transferOwnership";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): OwnershipFacetInterface;
    static connect(address: string, runner?: ContractRunner | null): OwnershipFacet;
}
export {};
//# sourceMappingURL=OwnershipFacet__factory.d.ts.map