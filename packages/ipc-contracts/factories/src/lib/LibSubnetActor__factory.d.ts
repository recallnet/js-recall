import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../common";
import type { LibSubnetActor, LibSubnetActorInterface } from "../../../src/lib/LibSubnetActor";
type LibSubnetActorConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class LibSubnetActor__factory extends ContractFactory {
    constructor(...args: LibSubnetActorConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<LibSubnetActor & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): LibSubnetActor__factory;
    static readonly bytecode = "0x60808060405234601757603a9081601d823930815050f35b600080fdfe600080fdfea2646970667358221220d7712fa5b3be88d243b4651898787d135066f94062f7a9c1113f83ad35d2368064736f6c63430008170033";
    static readonly abi: readonly [{
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint256";
                readonly name: "weight";
                readonly type: "uint256";
            }, {
                readonly internalType: "address";
                readonly name: "addr";
                readonly type: "address";
            }, {
                readonly internalType: "bytes";
                readonly name: "metadata";
                readonly type: "bytes";
            }];
            readonly indexed: false;
            readonly internalType: "struct Validator[]";
            readonly name: "";
            readonly type: "tuple[]";
        }];
        readonly name: "SubnetBootstrapped";
        readonly type: "event";
    }];
    static createInterface(): LibSubnetActorInterface;
    static connect(address: string, runner?: ContractRunner | null): LibSubnetActor;
}
export {};
//# sourceMappingURL=LibSubnetActor__factory.d.ts.map