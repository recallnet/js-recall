import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../common";
import type { SubnetActorRewardFacet, SubnetActorRewardFacetInterface } from "../../../src/subnet/SubnetActorRewardFacet";
type SubnetActorRewardFacetConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class SubnetActorRewardFacet__factory extends ContractFactory {
    constructor(...args: SubnetActorRewardFacetConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<SubnetActorRewardFacet & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): SubnetActorRewardFacet__factory;
    static readonly bytecode = "0x6080806040523461001657610308908161001c8239f35b600080fdfe60806040908082526004908136101561001757600080fd5b6000803560e01c634e71d92d1461002d57600080fd5b346102cf57806003193601126102cf577f691bb03ffc16c56fc96b82fd16cd1b3715f0bc3cdc6407005f49bb62058600959160018354146102c157506001825560ff7fc451c9429c27db68f286ab8a68f311f1dccab703ba9423aed29cd397ae63f86354166102b1573360009081526016602052604090209384549461ffff958681169081156102a15787906010979693971c16918195859160018901945b8a8116938585101561028b5784895286602052878920885189810181811067ffffffffffffffff8211176102785790602092918b5260018254928383520154928391015243106101575781018091116101445760018c928392968b52886020528a828b822082815501550116986000190116976100cc565b634e487b7160e01b895260118452602489fd5b509799945092509690949863ffff000094505b8354911693849260101b169063ffffffff19161717905515610261575b81471061024a578380808085335af13d156102455767ffffffffffffffff3d81811161023257875191601f8201601f19908116603f011683019081118382101761021f57885281528560203d92013e5b156102115750837f197c586353eaed0a1c53e6e540445b94befab8f932c8115d112115ecbeeed51491849551903382526020820152a15580f35b8451630a12f52160e11b8152fd5b634e487b7160e01b885260418552602488fd5b634e487b7160e01b875260418452602487fd5b6101d7565b60249085519063cd78605960e01b82523090820152fd5b336000908152601660205260409020849055610187565b634e487b7160e01b8c526041875260248cfd5b9799945092509690949863ffff0000945061016a565b83516364b0557f60e01b81528790fd5b835163d93c066560e01b81528390fd5b6329f745a760e01b81528390fd5b80fdfea264697066735822122088ce95221b440b3304b0d82d72b1a3cf7384f18246070e3c94705b3b60e8e68d64736f6c63430008170033";
    static readonly abi: readonly [{
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "account";
            readonly type: "address";
        }];
        readonly name: "AddressInsufficientBalance";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "EnforcedPause";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "ExpectedPause";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "FailedInnerCall";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "NoCollateralToWithdraw";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "ReentrancyError";
        readonly type: "error";
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
            readonly name: "amount";
            readonly type: "uint256";
        }];
        readonly name: "CollateralClaimed";
        readonly type: "event";
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
        readonly name: "claim";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): SubnetActorRewardFacetInterface;
    static connect(address: string, runner?: ContractRunner | null): SubnetActorRewardFacet;
}
export {};
//# sourceMappingURL=SubnetActorRewardFacet__factory.d.ts.map