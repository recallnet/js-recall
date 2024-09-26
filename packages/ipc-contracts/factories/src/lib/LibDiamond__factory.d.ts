import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../common";
import type { LibDiamond, LibDiamondInterface } from "../../../src/lib/LibDiamond";
type LibDiamondConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class LibDiamond__factory extends ContractFactory {
    constructor(...args: LibDiamondConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<LibDiamond & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): LibDiamond__factory;
    static readonly bytecode = "0x608080604052346018576094908161001e823930815050f35b600080fdfe6080806040526004361015601257600080fd5b60003560e01c63b2bebf5514602657600080fd5b6000366003190112605957807f806e0cbb9fce296bbc336a48f42bf1dbc69722d18d90d6fe705b7582c2bb4bd260209252f35b600080fdfea2646970667358221220bad3576de11574af321a6601c9c71aa22127037af84c3dfc7c8504f7fd936a7f64736f6c63430008170033";
    static readonly abi: readonly [{
        readonly inputs: readonly [{
            readonly internalType: "bytes4";
            readonly name: "_selector";
            readonly type: "bytes4";
        }];
        readonly name: "CannotAddFunctionToDiamondThatAlreadyExists";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes4[]";
            readonly name: "_selectors";
            readonly type: "bytes4[]";
        }];
        readonly name: "CannotAddSelectorsToZeroAddress";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes4";
            readonly name: "_selector";
            readonly type: "bytes4";
        }];
        readonly name: "CannotRemoveFunctionThatDoesNotExist";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes4";
            readonly name: "_selector";
            readonly type: "bytes4";
        }];
        readonly name: "CannotRemoveImmutableFunction";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes4";
            readonly name: "_selector";
            readonly type: "bytes4";
        }];
        readonly name: "CannotReplaceFunctionThatDoesNotExists";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes4";
            readonly name: "_selector";
            readonly type: "bytes4";
        }];
        readonly name: "CannotReplaceFunctionWithTheSameFunctionFromTheSameFacet";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes4[]";
            readonly name: "_selectors";
            readonly type: "bytes4[]";
        }];
        readonly name: "CannotReplaceFunctionsFromFacetWithZeroAddress";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes4";
            readonly name: "_selector";
            readonly type: "bytes4";
        }];
        readonly name: "CannotReplaceImmutableFunction";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "enum IDiamond.FacetCutAction";
            readonly name: "_action";
            readonly type: "uint8";
        }];
        readonly name: "IncorrectFacetCutAction";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_initializationContractAddress";
            readonly type: "address";
        }, {
            readonly internalType: "bytes";
            readonly name: "_calldata";
            readonly type: "bytes";
        }];
        readonly name: "InitializationFunctionReverted";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "InvalidAddress";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_contractAddress";
            readonly type: "address";
        }, {
            readonly internalType: "string";
            readonly name: "_message";
            readonly type: "string";
        }];
        readonly name: "NoBytecodeAtAddress";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "NoSelectorsGivenToAdd";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_facetAddress";
            readonly type: "address";
        }];
        readonly name: "NoSelectorsProvidedForFacetForCut";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_user";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "_contractOwner";
            readonly type: "address";
        }];
        readonly name: "NotContractOwner";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "NotOwner";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_facetAddress";
            readonly type: "address";
        }];
        readonly name: "RemoveFacetAddressMustBeZeroAddress";
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
        readonly name: "DIAMOND_STORAGE_POSITION";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }];
    static createInterface(): LibDiamondInterface;
    static connect(address: string, runner?: ContractRunner | null): LibDiamond;
}
export {};
//# sourceMappingURL=LibDiamond__factory.d.ts.map