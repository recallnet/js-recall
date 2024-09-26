import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../common";
import type { SubnetActorPauseFacet, SubnetActorPauseFacetInterface } from "../../../src/subnet/SubnetActorPauseFacet";
type SubnetActorPauseFacetConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class SubnetActorPauseFacet__factory extends ContractFactory {
    constructor(...args: SubnetActorPauseFacetConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<SubnetActorPauseFacet & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): SubnetActorPauseFacet__factory;
    static readonly bytecode = "0x6080806040523461001657610214908161001c8239f35b600080fdfe604060808152600436101561001357600080fd5b600090813560e01c80633f4ba83a146101105780635c975abb146100ce57638456cb591461004057600080fd5b346100ca57816003193601126100ca57610058610199565b7fc451c9429c27db68f286ab8a68f311f1dccab703ba9423aed29cd397ae63f863805460ff81166100b95760ff19166001179055513381527f62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a25890602090a180f35b825163d93c066560e01b8152600490fd5b5080fd5b50346100ca57816003193601126100ca5760209060ff7fc451c9429c27db68f286ab8a68f311f1dccab703ba9423aed29cd397ae63f863541690519015158152f35b50346100ca57816003193601126100ca57610129610199565b7fc451c9429c27db68f286ab8a68f311f1dccab703ba9423aed29cd397ae63f863805460ff8116156101885760ff19169055513381527f5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa90602090a180f35b8251638dfc202b60e01b8152600490fd5b7f806e0cbb9fce296bbc336a48f42bf1dbc69722d18d90d6fe705b7582c2bb4bd5546001600160a01b031633036101cc57565b6040516330cd747160e01b8152600490fdfea26469706673582212203c915022ddd6641af8779b756446bf964ee919acb5cd9b0747446ac53e08382164736f6c63430008170033";
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "EnforcedPause";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "ExpectedPause";
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
            readonly name: "account";
            readonly type: "address";
        }];
        readonly name: "Paused";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "account";
            readonly type: "address";
        }];
        readonly name: "Unpaused";
        readonly type: "event";
    }, {
        readonly inputs: readonly [];
        readonly name: "pause";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "paused";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "unpause";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): SubnetActorPauseFacetInterface;
    static connect(address: string, runner?: ContractRunner | null): SubnetActorPauseFacet;
}
export {};
//# sourceMappingURL=SubnetActorPauseFacet__factory.d.ts.map