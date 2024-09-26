import { type ContractRunner } from "ethers";
import type { IIpcHandler, IIpcHandlerInterface } from "../../../sdk/interfaces/IIpcHandler";
export declare class IIpcHandler__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "CallerIsNotGateway";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "UnrecognizedResult";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "UnsupportedMsgKind";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
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
            readonly internalType: "struct IpcEnvelope";
            readonly name: "envelope";
            readonly type: "tuple";
        }];
        readonly name: "handleIpcMessage";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "ret";
            readonly type: "bytes";
        }];
        readonly stateMutability: "payable";
        readonly type: "function";
    }];
    static createInterface(): IIpcHandlerInterface;
    static connect(address: string, runner?: ContractRunner | null): IIpcHandler;
}
//# sourceMappingURL=IIpcHandler__factory.d.ts.map