import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../common";
import type { LibQuorum, LibQuorumInterface } from "../../../src/lib/LibQuorum";
type LibQuorumConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class LibQuorum__factory extends ContractFactory {
    constructor(...args: LibQuorumConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<LibQuorum & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): LibQuorum__factory;
    static readonly bytecode = "0x6080806040523461001a576104529081610020823930815050f35b600080fdfe608080604052600436101561001357600080fd5b60003560e01c6308a6ad251461002857600080fd5b6040366003190112610381576000608060249261004481610386565b8281528260208201528260408201528260608201520152602435600052600260043501602052604060002060ff60046040519261008084610386565b8054845260018101546020850152600281015460408501526003810154606085015201541615156080820152602435600052600560043501602052604060002091604051918283602086549283815201809660005260206000209260005b8181106103685750506100f3925003846103b8565b82516100fe816103da565b9261010c60405194856103b8565b818452610118826103da565b60005b601f198201811061035757505060005b8281106102385750505060405192608060e08501928051865260208101516020870152604081015160408701526060810151606087015201511515608085015260e060a0850152518091526101008301939060005b8181106102195750505081830360c0830152805180845260208401906020808260051b8701019301916000955b8287106101ba5785850386f35b90919293601f19828203018352845180519081835260005b82811061020457505060208083836000838096600198010152601f8019910116010196019301960195909291926101ad565b806020809284010151828287010152016101d2565b82516001600160a01b0316865260209586019590920191600101610180565b6024356000908152600435600601602052604090206001600160a01b0361025f83896103f2565b51166000526020526040600020604051906000908054908160011c91600181161561034d575b602083106001821614610338578285526001811690811561031157506001146102d7575b5050906102bb816001949303826103b8565b6102c582886103f2565b526102d081876103f2565b500161012b565b6000908152602081209092505b8183106102fb57505081016020016102bb826102a9565b60018160209254838688010152019201916102e4565b60ff191660208087019190915292151560051b850190920192506102bb91508390506102a9565b86634e487b7160e01b60005260226004526000fd5b91607f1691610285565b80606060208093890101520161011b565b84548352600194850194889450602090930192016100de565b600080fd5b60a0810190811067ffffffffffffffff8211176103a257604052565b634e487b7160e01b600052604160045260246000fd5b90601f8019910116810190811067ffffffffffffffff8211176103a257604052565b67ffffffffffffffff81116103a25760051b60200190565b80518210156104065760209160051b010190565b634e487b7160e01b600052603260045260246000fdfea26469706673582212205864c6a082af3e2d9970bd84fd5e4bc809488aa1f987339d59f910dfcf5328d364736f6c63430008170033";
    static readonly abi: readonly [{
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "enum QuorumObjKind";
            readonly name: "objKind";
            readonly type: "uint8";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "height";
            readonly type: "uint256";
        }, {
            readonly indexed: false;
            readonly internalType: "bytes32";
            readonly name: "objHash";
            readonly type: "bytes32";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "quorumWeight";
            readonly type: "uint256";
        }];
        readonly name: "QuorumReached";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "enum QuorumObjKind";
            readonly name: "objKind";
            readonly type: "uint8";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "height";
            readonly type: "uint256";
        }, {
            readonly indexed: false;
            readonly internalType: "bytes32";
            readonly name: "objHash";
            readonly type: "bytes32";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "newWeight";
            readonly type: "uint256";
        }];
        readonly name: "QuorumWeightUpdated";
        readonly type: "event";
    }];
    static createInterface(): LibQuorumInterface;
    static connect(address: string, runner?: ContractRunner | null): LibQuorum;
}
export {};
//# sourceMappingURL=LibQuorum__factory.d.ts.map