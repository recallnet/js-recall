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
export interface SubnetActorCheckpointingFacetInterface extends Interface {
    getFunction(nameOrSignature: "submitCheckpoint" | "validateActiveQuorumSignatures"): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: "ActiveValidatorCollateralUpdated" | "ActiveValidatorLeft" | "ActiveValidatorReplaced" | "ConfigurationNumberConfirmed" | "NewActiveValidator" | "NewCollateralRelease" | "NewWaitingValidator" | "Paused" | "Unpaused" | "WaitingValidatorCollateralUpdated" | "WaitingValidatorLeft"): EventFragment;
    encodeFunctionData(functionFragment: "submitCheckpoint", values: [BottomUpCheckpointStruct, AddressLike[], BytesLike[]]): string;
    encodeFunctionData(functionFragment: "validateActiveQuorumSignatures", values: [AddressLike[], BytesLike, BytesLike[]]): string;
    decodeFunctionResult(functionFragment: "submitCheckpoint", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "validateActiveQuorumSignatures", data: BytesLike): Result;
}
export declare namespace ActiveValidatorCollateralUpdatedEvent {
    type InputTuple = [validator: AddressLike, newPower: BigNumberish];
    type OutputTuple = [validator: string, newPower: bigint];
    interface OutputObject {
        validator: string;
        newPower: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace ActiveValidatorLeftEvent {
    type InputTuple = [validator: AddressLike];
    type OutputTuple = [validator: string];
    interface OutputObject {
        validator: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace ActiveValidatorReplacedEvent {
    type InputTuple = [
        oldValidator: AddressLike,
        newValidator: AddressLike
    ];
    type OutputTuple = [oldValidator: string, newValidator: string];
    interface OutputObject {
        oldValidator: string;
        newValidator: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace ConfigurationNumberConfirmedEvent {
    type InputTuple = [number: BigNumberish];
    type OutputTuple = [number: bigint];
    interface OutputObject {
        number: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace NewActiveValidatorEvent {
    type InputTuple = [validator: AddressLike, power: BigNumberish];
    type OutputTuple = [validator: string, power: bigint];
    interface OutputObject {
        validator: string;
        power: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace NewCollateralReleaseEvent {
    type InputTuple = [
        validator: AddressLike,
        amount: BigNumberish,
        releaseBlock: BigNumberish
    ];
    type OutputTuple = [
        validator: string,
        amount: bigint,
        releaseBlock: bigint
    ];
    interface OutputObject {
        validator: string;
        amount: bigint;
        releaseBlock: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace NewWaitingValidatorEvent {
    type InputTuple = [validator: AddressLike, power: BigNumberish];
    type OutputTuple = [validator: string, power: bigint];
    interface OutputObject {
        validator: string;
        power: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace PausedEvent {
    type InputTuple = [account: AddressLike];
    type OutputTuple = [account: string];
    interface OutputObject {
        account: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace UnpausedEvent {
    type InputTuple = [account: AddressLike];
    type OutputTuple = [account: string];
    interface OutputObject {
        account: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace WaitingValidatorCollateralUpdatedEvent {
    type InputTuple = [validator: AddressLike, newPower: BigNumberish];
    type OutputTuple = [validator: string, newPower: bigint];
    interface OutputObject {
        validator: string;
        newPower: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace WaitingValidatorLeftEvent {
    type InputTuple = [validator: AddressLike];
    type OutputTuple = [validator: string];
    interface OutputObject {
        validator: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export interface SubnetActorCheckpointingFacet extends BaseContract {
    connect(runner?: ContractRunner | null): SubnetActorCheckpointingFacet;
    waitForDeployment(): Promise<this>;
    interface: SubnetActorCheckpointingFacetInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    submitCheckpoint: TypedContractMethod<[
        checkpoint: BottomUpCheckpointStruct,
        signatories: AddressLike[],
        signatures: BytesLike[]
    ], [
        void
    ], "nonpayable">;
    validateActiveQuorumSignatures: TypedContractMethod<[
        signatories: AddressLike[],
        hash: BytesLike,
        signatures: BytesLike[]
    ], [
        void
    ], "view">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "submitCheckpoint"): TypedContractMethod<[
        checkpoint: BottomUpCheckpointStruct,
        signatories: AddressLike[],
        signatures: BytesLike[]
    ], [
        void
    ], "nonpayable">;
    getFunction(nameOrSignature: "validateActiveQuorumSignatures"): TypedContractMethod<[
        signatories: AddressLike[],
        hash: BytesLike,
        signatures: BytesLike[]
    ], [
        void
    ], "view">;
    getEvent(key: "ActiveValidatorCollateralUpdated"): TypedContractEvent<ActiveValidatorCollateralUpdatedEvent.InputTuple, ActiveValidatorCollateralUpdatedEvent.OutputTuple, ActiveValidatorCollateralUpdatedEvent.OutputObject>;
    getEvent(key: "ActiveValidatorLeft"): TypedContractEvent<ActiveValidatorLeftEvent.InputTuple, ActiveValidatorLeftEvent.OutputTuple, ActiveValidatorLeftEvent.OutputObject>;
    getEvent(key: "ActiveValidatorReplaced"): TypedContractEvent<ActiveValidatorReplacedEvent.InputTuple, ActiveValidatorReplacedEvent.OutputTuple, ActiveValidatorReplacedEvent.OutputObject>;
    getEvent(key: "ConfigurationNumberConfirmed"): TypedContractEvent<ConfigurationNumberConfirmedEvent.InputTuple, ConfigurationNumberConfirmedEvent.OutputTuple, ConfigurationNumberConfirmedEvent.OutputObject>;
    getEvent(key: "NewActiveValidator"): TypedContractEvent<NewActiveValidatorEvent.InputTuple, NewActiveValidatorEvent.OutputTuple, NewActiveValidatorEvent.OutputObject>;
    getEvent(key: "NewCollateralRelease"): TypedContractEvent<NewCollateralReleaseEvent.InputTuple, NewCollateralReleaseEvent.OutputTuple, NewCollateralReleaseEvent.OutputObject>;
    getEvent(key: "NewWaitingValidator"): TypedContractEvent<NewWaitingValidatorEvent.InputTuple, NewWaitingValidatorEvent.OutputTuple, NewWaitingValidatorEvent.OutputObject>;
    getEvent(key: "Paused"): TypedContractEvent<PausedEvent.InputTuple, PausedEvent.OutputTuple, PausedEvent.OutputObject>;
    getEvent(key: "Unpaused"): TypedContractEvent<UnpausedEvent.InputTuple, UnpausedEvent.OutputTuple, UnpausedEvent.OutputObject>;
    getEvent(key: "WaitingValidatorCollateralUpdated"): TypedContractEvent<WaitingValidatorCollateralUpdatedEvent.InputTuple, WaitingValidatorCollateralUpdatedEvent.OutputTuple, WaitingValidatorCollateralUpdatedEvent.OutputObject>;
    getEvent(key: "WaitingValidatorLeft"): TypedContractEvent<WaitingValidatorLeftEvent.InputTuple, WaitingValidatorLeftEvent.OutputTuple, WaitingValidatorLeftEvent.OutputObject>;
    filters: {
        "ActiveValidatorCollateralUpdated(address,uint256)": TypedContractEvent<ActiveValidatorCollateralUpdatedEvent.InputTuple, ActiveValidatorCollateralUpdatedEvent.OutputTuple, ActiveValidatorCollateralUpdatedEvent.OutputObject>;
        ActiveValidatorCollateralUpdated: TypedContractEvent<ActiveValidatorCollateralUpdatedEvent.InputTuple, ActiveValidatorCollateralUpdatedEvent.OutputTuple, ActiveValidatorCollateralUpdatedEvent.OutputObject>;
        "ActiveValidatorLeft(address)": TypedContractEvent<ActiveValidatorLeftEvent.InputTuple, ActiveValidatorLeftEvent.OutputTuple, ActiveValidatorLeftEvent.OutputObject>;
        ActiveValidatorLeft: TypedContractEvent<ActiveValidatorLeftEvent.InputTuple, ActiveValidatorLeftEvent.OutputTuple, ActiveValidatorLeftEvent.OutputObject>;
        "ActiveValidatorReplaced(address,address)": TypedContractEvent<ActiveValidatorReplacedEvent.InputTuple, ActiveValidatorReplacedEvent.OutputTuple, ActiveValidatorReplacedEvent.OutputObject>;
        ActiveValidatorReplaced: TypedContractEvent<ActiveValidatorReplacedEvent.InputTuple, ActiveValidatorReplacedEvent.OutputTuple, ActiveValidatorReplacedEvent.OutputObject>;
        "ConfigurationNumberConfirmed(uint64)": TypedContractEvent<ConfigurationNumberConfirmedEvent.InputTuple, ConfigurationNumberConfirmedEvent.OutputTuple, ConfigurationNumberConfirmedEvent.OutputObject>;
        ConfigurationNumberConfirmed: TypedContractEvent<ConfigurationNumberConfirmedEvent.InputTuple, ConfigurationNumberConfirmedEvent.OutputTuple, ConfigurationNumberConfirmedEvent.OutputObject>;
        "NewActiveValidator(address,uint256)": TypedContractEvent<NewActiveValidatorEvent.InputTuple, NewActiveValidatorEvent.OutputTuple, NewActiveValidatorEvent.OutputObject>;
        NewActiveValidator: TypedContractEvent<NewActiveValidatorEvent.InputTuple, NewActiveValidatorEvent.OutputTuple, NewActiveValidatorEvent.OutputObject>;
        "NewCollateralRelease(address,uint256,uint256)": TypedContractEvent<NewCollateralReleaseEvent.InputTuple, NewCollateralReleaseEvent.OutputTuple, NewCollateralReleaseEvent.OutputObject>;
        NewCollateralRelease: TypedContractEvent<NewCollateralReleaseEvent.InputTuple, NewCollateralReleaseEvent.OutputTuple, NewCollateralReleaseEvent.OutputObject>;
        "NewWaitingValidator(address,uint256)": TypedContractEvent<NewWaitingValidatorEvent.InputTuple, NewWaitingValidatorEvent.OutputTuple, NewWaitingValidatorEvent.OutputObject>;
        NewWaitingValidator: TypedContractEvent<NewWaitingValidatorEvent.InputTuple, NewWaitingValidatorEvent.OutputTuple, NewWaitingValidatorEvent.OutputObject>;
        "Paused(address)": TypedContractEvent<PausedEvent.InputTuple, PausedEvent.OutputTuple, PausedEvent.OutputObject>;
        Paused: TypedContractEvent<PausedEvent.InputTuple, PausedEvent.OutputTuple, PausedEvent.OutputObject>;
        "Unpaused(address)": TypedContractEvent<UnpausedEvent.InputTuple, UnpausedEvent.OutputTuple, UnpausedEvent.OutputObject>;
        Unpaused: TypedContractEvent<UnpausedEvent.InputTuple, UnpausedEvent.OutputTuple, UnpausedEvent.OutputObject>;
        "WaitingValidatorCollateralUpdated(address,uint256)": TypedContractEvent<WaitingValidatorCollateralUpdatedEvent.InputTuple, WaitingValidatorCollateralUpdatedEvent.OutputTuple, WaitingValidatorCollateralUpdatedEvent.OutputObject>;
        WaitingValidatorCollateralUpdated: TypedContractEvent<WaitingValidatorCollateralUpdatedEvent.InputTuple, WaitingValidatorCollateralUpdatedEvent.OutputTuple, WaitingValidatorCollateralUpdatedEvent.OutputObject>;
        "WaitingValidatorLeft(address)": TypedContractEvent<WaitingValidatorLeftEvent.InputTuple, WaitingValidatorLeftEvent.OutputTuple, WaitingValidatorLeftEvent.OutputObject>;
        WaitingValidatorLeft: TypedContractEvent<WaitingValidatorLeftEvent.InputTuple, WaitingValidatorLeftEvent.OutputTuple, WaitingValidatorLeftEvent.OutputObject>;
    };
}
//# sourceMappingURL=SubnetActorCheckpointingFacet.d.ts.map