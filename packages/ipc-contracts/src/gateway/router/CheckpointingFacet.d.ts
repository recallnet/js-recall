import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Result, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener, TypedContractMethod } from "../../../common";
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
export type BottomUpCheckpointStruct = {
    subnetID: SubnetIDStruct;
    blockHeight: BigNumberish;
    blockHash: BytesLike;
    nextConfigurationNumber: BigNumberish;
    msgs: IpcEnvelopeStruct[];
};
export type BottomUpCheckpointStructOutput = [
    subnetID: SubnetIDStructOutput,
    blockHeight: bigint,
    blockHash: string,
    nextConfigurationNumber: bigint,
    msgs: IpcEnvelopeStructOutput[]
] & {
    subnetID: SubnetIDStructOutput;
    blockHeight: bigint;
    blockHash: string;
    nextConfigurationNumber: bigint;
    msgs: IpcEnvelopeStructOutput[];
};
export interface CheckpointingFacetInterface extends Interface {
    getFunction(nameOrSignature: "addCheckpointSignature" | "commitCheckpoint" | "createBottomUpCheckpoint" | "pruneBottomUpCheckpoints"): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: "NewBottomUpMsgBatch" | "NewTopDownMessage" | "QuorumReached" | "QuorumWeightUpdated"): EventFragment;
    encodeFunctionData(functionFragment: "addCheckpointSignature", values: [BigNumberish, BytesLike[], BigNumberish, BytesLike]): string;
    encodeFunctionData(functionFragment: "commitCheckpoint", values: [BottomUpCheckpointStruct]): string;
    encodeFunctionData(functionFragment: "createBottomUpCheckpoint", values: [BottomUpCheckpointStruct, BytesLike, BigNumberish]): string;
    encodeFunctionData(functionFragment: "pruneBottomUpCheckpoints", values: [BigNumberish]): string;
    decodeFunctionResult(functionFragment: "addCheckpointSignature", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "commitCheckpoint", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "createBottomUpCheckpoint", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "pruneBottomUpCheckpoints", data: BytesLike): Result;
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
export declare namespace QuorumReachedEvent {
    type InputTuple = [
        objKind: BigNumberish,
        height: BigNumberish,
        objHash: BytesLike,
        quorumWeight: BigNumberish
    ];
    type OutputTuple = [
        objKind: bigint,
        height: bigint,
        objHash: string,
        quorumWeight: bigint
    ];
    interface OutputObject {
        objKind: bigint;
        height: bigint;
        objHash: string;
        quorumWeight: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace QuorumWeightUpdatedEvent {
    type InputTuple = [
        objKind: BigNumberish,
        height: BigNumberish,
        objHash: BytesLike,
        newWeight: BigNumberish
    ];
    type OutputTuple = [
        objKind: bigint,
        height: bigint,
        objHash: string,
        newWeight: bigint
    ];
    interface OutputObject {
        objKind: bigint;
        height: bigint;
        objHash: string;
        newWeight: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export interface CheckpointingFacet extends BaseContract {
    connect(runner?: ContractRunner | null): CheckpointingFacet;
    waitForDeployment(): Promise<this>;
    interface: CheckpointingFacetInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    addCheckpointSignature: TypedContractMethod<[
        height: BigNumberish,
        membershipProof: BytesLike[],
        weight: BigNumberish,
        signature: BytesLike
    ], [
        void
    ], "nonpayable">;
    commitCheckpoint: TypedContractMethod<[
        checkpoint: BottomUpCheckpointStruct
    ], [
        void
    ], "nonpayable">;
    createBottomUpCheckpoint: TypedContractMethod<[
        checkpoint: BottomUpCheckpointStruct,
        membershipRootHash: BytesLike,
        membershipWeight: BigNumberish
    ], [
        void
    ], "nonpayable">;
    pruneBottomUpCheckpoints: TypedContractMethod<[
        newRetentionHeight: BigNumberish
    ], [
        void
    ], "nonpayable">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "addCheckpointSignature"): TypedContractMethod<[
        height: BigNumberish,
        membershipProof: BytesLike[],
        weight: BigNumberish,
        signature: BytesLike
    ], [
        void
    ], "nonpayable">;
    getFunction(nameOrSignature: "commitCheckpoint"): TypedContractMethod<[
        checkpoint: BottomUpCheckpointStruct
    ], [
        void
    ], "nonpayable">;
    getFunction(nameOrSignature: "createBottomUpCheckpoint"): TypedContractMethod<[
        checkpoint: BottomUpCheckpointStruct,
        membershipRootHash: BytesLike,
        membershipWeight: BigNumberish
    ], [
        void
    ], "nonpayable">;
    getFunction(nameOrSignature: "pruneBottomUpCheckpoints"): TypedContractMethod<[
        newRetentionHeight: BigNumberish
    ], [
        void
    ], "nonpayable">;
    getEvent(key: "NewBottomUpMsgBatch"): TypedContractEvent<NewBottomUpMsgBatchEvent.InputTuple, NewBottomUpMsgBatchEvent.OutputTuple, NewBottomUpMsgBatchEvent.OutputObject>;
    getEvent(key: "NewTopDownMessage"): TypedContractEvent<NewTopDownMessageEvent.InputTuple, NewTopDownMessageEvent.OutputTuple, NewTopDownMessageEvent.OutputObject>;
    getEvent(key: "QuorumReached"): TypedContractEvent<QuorumReachedEvent.InputTuple, QuorumReachedEvent.OutputTuple, QuorumReachedEvent.OutputObject>;
    getEvent(key: "QuorumWeightUpdated"): TypedContractEvent<QuorumWeightUpdatedEvent.InputTuple, QuorumWeightUpdatedEvent.OutputTuple, QuorumWeightUpdatedEvent.OutputObject>;
    filters: {
        "NewBottomUpMsgBatch(uint256)": TypedContractEvent<NewBottomUpMsgBatchEvent.InputTuple, NewBottomUpMsgBatchEvent.OutputTuple, NewBottomUpMsgBatchEvent.OutputObject>;
        NewBottomUpMsgBatch: TypedContractEvent<NewBottomUpMsgBatchEvent.InputTuple, NewBottomUpMsgBatchEvent.OutputTuple, NewBottomUpMsgBatchEvent.OutputObject>;
        "NewTopDownMessage(address,tuple)": TypedContractEvent<NewTopDownMessageEvent.InputTuple, NewTopDownMessageEvent.OutputTuple, NewTopDownMessageEvent.OutputObject>;
        NewTopDownMessage: TypedContractEvent<NewTopDownMessageEvent.InputTuple, NewTopDownMessageEvent.OutputTuple, NewTopDownMessageEvent.OutputObject>;
        "QuorumReached(uint8,uint256,bytes32,uint256)": TypedContractEvent<QuorumReachedEvent.InputTuple, QuorumReachedEvent.OutputTuple, QuorumReachedEvent.OutputObject>;
        QuorumReached: TypedContractEvent<QuorumReachedEvent.InputTuple, QuorumReachedEvent.OutputTuple, QuorumReachedEvent.OutputObject>;
        "QuorumWeightUpdated(uint8,uint256,bytes32,uint256)": TypedContractEvent<QuorumWeightUpdatedEvent.InputTuple, QuorumWeightUpdatedEvent.OutputTuple, QuorumWeightUpdatedEvent.OutputObject>;
        QuorumWeightUpdated: TypedContractEvent<QuorumWeightUpdatedEvent.InputTuple, QuorumWeightUpdatedEvent.OutputTuple, QuorumWeightUpdatedEvent.OutputObject>;
    };
}
//# sourceMappingURL=CheckpointingFacet.d.ts.map