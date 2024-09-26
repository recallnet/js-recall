import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Result, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener, TypedContractMethod } from "../../common";
export type SubnetIDStruct = {
    root: BigNumberish;
    route: AddressLike[];
};
export type SubnetIDStructOutput = [root: bigint, route: string[]] & {
    root: bigint;
    route: string[];
};
export type FvmAddressStruct = {
    addrType: BigNumberish;
    payload: BytesLike;
};
export type FvmAddressStructOutput = [addrType: bigint, payload: string] & {
    addrType: bigint;
    payload: string;
};
export type IPCAddressStruct = {
    subnetId: SubnetIDStruct;
    rawAddress: FvmAddressStruct;
};
export type IPCAddressStructOutput = [
    subnetId: SubnetIDStructOutput,
    rawAddress: FvmAddressStructOutput
] & {
    subnetId: SubnetIDStructOutput;
    rawAddress: FvmAddressStructOutput;
};
export type IpcEnvelopeStruct = {
    kind: BigNumberish;
    to: IPCAddressStruct;
    from: IPCAddressStruct;
    nonce: BigNumberish;
    value: BigNumberish;
    message: BytesLike;
};
export type IpcEnvelopeStructOutput = [
    kind: bigint,
    to: IPCAddressStructOutput,
    from: IPCAddressStructOutput,
    nonce: bigint,
    value: bigint,
    message: string
] & {
    kind: bigint;
    to: IPCAddressStructOutput;
    from: IPCAddressStructOutput;
    nonce: bigint;
    value: bigint;
    message: string;
};
export interface GatewayMessengerFacetInterface extends Interface {
    getFunction(nameOrSignature: "propagate" | "sendContractXnetMessage"): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: "NewBottomUpMsgBatch" | "NewTopDownMessage"): EventFragment;
    encodeFunctionData(functionFragment: "propagate", values: [BytesLike]): string;
    encodeFunctionData(functionFragment: "sendContractXnetMessage", values: [IpcEnvelopeStruct]): string;
    decodeFunctionResult(functionFragment: "propagate", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "sendContractXnetMessage", data: BytesLike): Result;
}
export declare namespace NewBottomUpMsgBatchEvent {
    type InputTuple = [epoch: BigNumberish];
    type OutputTuple = [epoch: bigint];
    interface OutputObject {
        epoch: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace NewTopDownMessageEvent {
    type InputTuple = [subnet: AddressLike, message: IpcEnvelopeStruct];
    type OutputTuple = [subnet: string, message: IpcEnvelopeStructOutput];
    interface OutputObject {
        subnet: string;
        message: IpcEnvelopeStructOutput;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export interface GatewayMessengerFacet extends BaseContract {
    connect(runner?: ContractRunner | null): GatewayMessengerFacet;
    waitForDeployment(): Promise<this>;
    interface: GatewayMessengerFacetInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    propagate: TypedContractMethod<[msgCid: BytesLike], [void], "payable">;
    sendContractXnetMessage: TypedContractMethod<[
        envelope: IpcEnvelopeStruct
    ], [
        IpcEnvelopeStructOutput
    ], "payable">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "propagate"): TypedContractMethod<[msgCid: BytesLike], [void], "payable">;
    getFunction(nameOrSignature: "sendContractXnetMessage"): TypedContractMethod<[
        envelope: IpcEnvelopeStruct
    ], [
        IpcEnvelopeStructOutput
    ], "payable">;
    getEvent(key: "NewBottomUpMsgBatch"): TypedContractEvent<NewBottomUpMsgBatchEvent.InputTuple, NewBottomUpMsgBatchEvent.OutputTuple, NewBottomUpMsgBatchEvent.OutputObject>;
    getEvent(key: "NewTopDownMessage"): TypedContractEvent<NewTopDownMessageEvent.InputTuple, NewTopDownMessageEvent.OutputTuple, NewTopDownMessageEvent.OutputObject>;
    filters: {
        "NewBottomUpMsgBatch(uint256)": TypedContractEvent<NewBottomUpMsgBatchEvent.InputTuple, NewBottomUpMsgBatchEvent.OutputTuple, NewBottomUpMsgBatchEvent.OutputObject>;
        NewBottomUpMsgBatch: TypedContractEvent<NewBottomUpMsgBatchEvent.InputTuple, NewBottomUpMsgBatchEvent.OutputTuple, NewBottomUpMsgBatchEvent.OutputObject>;
        "NewTopDownMessage(address,tuple)": TypedContractEvent<NewTopDownMessageEvent.InputTuple, NewTopDownMessageEvent.OutputTuple, NewTopDownMessageEvent.OutputObject>;
        NewTopDownMessage: TypedContractEvent<NewTopDownMessageEvent.InputTuple, NewTopDownMessageEvent.OutputTuple, NewTopDownMessageEvent.OutputObject>;
    };
}
//# sourceMappingURL=GatewayMessengerFacet.d.ts.map