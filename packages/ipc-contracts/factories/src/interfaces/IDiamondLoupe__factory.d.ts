import { type ContractRunner } from "ethers";
import type { IDiamondLoupe, IDiamondLoupeInterface } from "../../../src/interfaces/IDiamondLoupe";
export declare class IDiamondLoupe__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [{
            readonly internalType: "bytes4";
            readonly name: "_functionSelector";
            readonly type: "bytes4";
        }];
        readonly name: "facetAddress";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "facetAddress_";
            readonly type: "address";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "facetAddresses";
        readonly outputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "facetAddresses_";
            readonly type: "address[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_facet";
            readonly type: "address";
        }];
        readonly name: "facetFunctionSelectors";
        readonly outputs: readonly [{
            readonly internalType: "bytes4[]";
            readonly name: "facetFunctionSelectors_";
            readonly type: "bytes4[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "facets";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "address";
                readonly name: "facetAddress";
                readonly type: "address";
            }, {
                readonly internalType: "bytes4[]";
                readonly name: "functionSelectors";
                readonly type: "bytes4[]";
            }];
            readonly internalType: "struct IDiamondLoupe.Facet[]";
            readonly name: "facets_";
            readonly type: "tuple[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }];
    static createInterface(): IDiamondLoupeInterface;
    static connect(address: string, runner?: ContractRunner | null): IDiamondLoupe;
}
//# sourceMappingURL=IDiamondLoupe__factory.d.ts.map