import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../common";
import type { Strings, StringsInterface } from "../../../openzeppelin-contracts/utils/Strings";
type StringsConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class Strings__factory extends ContractFactory {
    constructor(...args: StringsConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<Strings & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): Strings__factory;
    static readonly bytecode = "0x60808060405234601757603a9081601d823930815050f35b600080fdfe600080fdfea264697066735822122038ec650228dd3dcb24f501a150f21256512a272f3999c6e11cbed8715265f5c964736f6c63430008170033";
    static readonly abi: readonly [{
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "length";
            readonly type: "uint256";
        }];
        readonly name: "StringsInsufficientHexLength";
        readonly type: "error";
    }];
    static createInterface(): StringsInterface;
    static connect(address: string, runner?: ContractRunner | null): Strings;
}
export {};
//# sourceMappingURL=Strings__factory.d.ts.map