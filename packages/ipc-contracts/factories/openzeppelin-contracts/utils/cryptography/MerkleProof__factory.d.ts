import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../../common";
import type { MerkleProof, MerkleProofInterface } from "../../../../openzeppelin-contracts/utils/cryptography/MerkleProof";
type MerkleProofConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class MerkleProof__factory extends ContractFactory {
    constructor(...args: MerkleProofConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<MerkleProof & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): MerkleProof__factory;
    static readonly bytecode = "0x60808060405234601757603a9081601d823930815050f35b600080fdfe600080fdfea2646970667358221220fcdf6e88ada9ffff17eba75e9f940dd59976394b7630c31d0b5897e2411a021264736f6c63430008170033";
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "MerkleProofInvalidMultiproof";
        readonly type: "error";
    }];
    static createInterface(): MerkleProofInterface;
    static connect(address: string, runner?: ContractRunner | null): MerkleProof;
}
export {};
//# sourceMappingURL=MerkleProof__factory.d.ts.map