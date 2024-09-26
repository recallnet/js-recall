import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../common";
import type { LibGateway, LibGatewayInterface } from "../../../src/lib/LibGateway";
type LibGatewayConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class LibGateway__factory extends ContractFactory {
    constructor(...args: LibGatewayConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<LibGateway & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): LibGateway__factory;
    static readonly bytecode = "0x60808060405234601757603a9081601d823930815050f35b600080fdfe600080fdfea2646970667358221220f899466af62f64f06fd7c40653bba012bc5400b38b4d1493c00ee033dcc67ce264736f6c63430008170033";
    static readonly abi: readonly [{
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly components: readonly [{
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
                readonly internalType: "struct Validator[]";
                readonly name: "validators";
                readonly type: "tuple[]";
            }, {
                readonly internalType: "uint64";
                readonly name: "configurationNumber";
                readonly type: "uint64";
            }];
            readonly indexed: false;
            readonly internalType: "struct Membership";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly name: "MembershipUpdated";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "epoch";
            readonly type: "uint256";
        }];
        readonly name: "NewBottomUpMsgBatch";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "address";
            readonly name: "subnet";
            readonly type: "address";
        }, {
            readonly components: readonly [{
                readonly internalType: "enum IpcMsgKind";
                readonly name: "kind";
                readonly type: "uint8";
            }, {
                readonly components: readonly [{
                    readonly components: readonly [{
                        readonly internalType: "uint64";
                        readonly name: "root";
                        readonly type: "uint64";
                    }, {
                        readonly internalType: "address[]";
                        readonly name: "route";
                        readonly type: "address[]";
                    }];
                    readonly internalType: "struct SubnetID";
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "to";
                readonly type: "tuple";
            }, {
                readonly components: readonly [{
                    readonly components: readonly [{
                        readonly internalType: "uint64";
                        readonly name: "root";
                        readonly type: "uint64";
                    }, {
                        readonly internalType: "address[]";
                        readonly name: "route";
                        readonly type: "address[]";
                    }];
                    readonly internalType: "struct SubnetID";
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "from";
                readonly type: "tuple";
            }, {
                readonly internalType: "uint64";
                readonly name: "nonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint256";
                readonly name: "value";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes";
                readonly name: "message";
                readonly type: "bytes";
            }];
            readonly indexed: false;
            readonly internalType: "struct IpcEnvelope";
            readonly name: "message";
            readonly type: "tuple";
        }];
        readonly name: "NewTopDownMessage";
        readonly type: "event";
    }];
    static createInterface(): LibGatewayInterface;
    static connect(address: string, runner?: ContractRunner | null): LibGateway;
}
export {};
//# sourceMappingURL=LibGateway__factory.d.ts.map