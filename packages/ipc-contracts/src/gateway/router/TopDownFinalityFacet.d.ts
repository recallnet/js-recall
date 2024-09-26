import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Result, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener, TypedContractMethod } from "../../../common";
export type ValidatorStruct = {
    weight: BigNumberish;
    addr: AddressLike;
    metadata: BytesLike;
};
export type ValidatorStructOutput = [
    weight: bigint,
    addr: string,
    metadata: string
] & {
    weight: bigint;
    addr: string;
    metadata: string;
};
export type MembershipStruct = {
    validators: ValidatorStruct[];
    configurationNumber: BigNumberish;
};
export type MembershipStructOutput = [
    validators: ValidatorStructOutput[],
    configurationNumber: bigint
] & {
    validators: ValidatorStructOutput[];
    configurationNumber: bigint;
};
export type ParentFinalityStruct = {
    height: BigNumberish;
    blockHash: BytesLike;
};
export type ParentFinalityStructOutput = [height: bigint, blockHash: string] & {
    height: bigint;
    blockHash: string;
};
export type StakingChangeStruct = {
    op: BigNumberish;
    payload: BytesLike;
    validator: AddressLike;
};
export type StakingChangeStructOutput = [
    op: bigint,
    payload: string,
    validator: string
] & {
    op: bigint;
    payload: string;
    validator: string;
};
export type StakingChangeRequestStruct = {
    change: StakingChangeStruct;
    configurationNumber: BigNumberish;
};
export type StakingChangeRequestStructOutput = [
    change: StakingChangeStructOutput,
    configurationNumber: bigint
] & {
    change: StakingChangeStructOutput;
    configurationNumber: bigint;
};
export interface TopDownFinalityFacetInterface extends Interface {
    getFunction(nameOrSignature: "applyFinalityChanges" | "commitParentFinality" | "getTrackerConfigurationNumbers" | "storeValidatorChanges"): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: "ActiveValidatorCollateralUpdated" | "ActiveValidatorLeft" | "ActiveValidatorReplaced" | "MembershipUpdated" | "NewActiveValidator" | "NewWaitingValidator" | "WaitingValidatorCollateralUpdated" | "WaitingValidatorLeft"): EventFragment;
    encodeFunctionData(functionFragment: "applyFinalityChanges", values?: undefined): string;
    encodeFunctionData(functionFragment: "commitParentFinality", values: [ParentFinalityStruct]): string;
    encodeFunctionData(functionFragment: "getTrackerConfigurationNumbers", values?: undefined): string;
    encodeFunctionData(functionFragment: "storeValidatorChanges", values: [StakingChangeRequestStruct[]]): string;
    decodeFunctionResult(functionFragment: "applyFinalityChanges", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "commitParentFinality", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getTrackerConfigurationNumbers", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "storeValidatorChanges", data: BytesLike): Result;
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
export declare namespace MembershipUpdatedEvent {
    type InputTuple = [arg0: MembershipStruct];
    type OutputTuple = [arg0: MembershipStructOutput];
    interface OutputObject {
        arg0: MembershipStructOutput;
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
export interface TopDownFinalityFacet extends BaseContract {
    connect(runner?: ContractRunner | null): TopDownFinalityFacet;
    waitForDeployment(): Promise<this>;
    interface: TopDownFinalityFacetInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    applyFinalityChanges: TypedContractMethod<[], [bigint], "nonpayable">;
    commitParentFinality: TypedContractMethod<[
        finality: ParentFinalityStruct
    ], [
        [
            boolean,
            ParentFinalityStructOutput
        ] & {
            hasCommittedBefore: boolean;
            previousFinality: ParentFinalityStructOutput;
        }
    ], "nonpayable">;
    getTrackerConfigurationNumbers: TypedContractMethod<[
    ], [
        [bigint, bigint]
    ], "view">;
    storeValidatorChanges: TypedContractMethod<[
        changeRequests: StakingChangeRequestStruct[]
    ], [
        void
    ], "nonpayable">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "applyFinalityChanges"): TypedContractMethod<[], [bigint], "nonpayable">;
    getFunction(nameOrSignature: "commitParentFinality"): TypedContractMethod<[
        finality: ParentFinalityStruct
    ], [
        [
            boolean,
            ParentFinalityStructOutput
        ] & {
            hasCommittedBefore: boolean;
            previousFinality: ParentFinalityStructOutput;
        }
    ], "nonpayable">;
    getFunction(nameOrSignature: "getTrackerConfigurationNumbers"): TypedContractMethod<[], [[bigint, bigint]], "view">;
    getFunction(nameOrSignature: "storeValidatorChanges"): TypedContractMethod<[
        changeRequests: StakingChangeRequestStruct[]
    ], [
        void
    ], "nonpayable">;
    getEvent(key: "ActiveValidatorCollateralUpdated"): TypedContractEvent<ActiveValidatorCollateralUpdatedEvent.InputTuple, ActiveValidatorCollateralUpdatedEvent.OutputTuple, ActiveValidatorCollateralUpdatedEvent.OutputObject>;
    getEvent(key: "ActiveValidatorLeft"): TypedContractEvent<ActiveValidatorLeftEvent.InputTuple, ActiveValidatorLeftEvent.OutputTuple, ActiveValidatorLeftEvent.OutputObject>;
    getEvent(key: "ActiveValidatorReplaced"): TypedContractEvent<ActiveValidatorReplacedEvent.InputTuple, ActiveValidatorReplacedEvent.OutputTuple, ActiveValidatorReplacedEvent.OutputObject>;
    getEvent(key: "MembershipUpdated"): TypedContractEvent<MembershipUpdatedEvent.InputTuple, MembershipUpdatedEvent.OutputTuple, MembershipUpdatedEvent.OutputObject>;
    getEvent(key: "NewActiveValidator"): TypedContractEvent<NewActiveValidatorEvent.InputTuple, NewActiveValidatorEvent.OutputTuple, NewActiveValidatorEvent.OutputObject>;
    getEvent(key: "NewWaitingValidator"): TypedContractEvent<NewWaitingValidatorEvent.InputTuple, NewWaitingValidatorEvent.OutputTuple, NewWaitingValidatorEvent.OutputObject>;
    getEvent(key: "WaitingValidatorCollateralUpdated"): TypedContractEvent<WaitingValidatorCollateralUpdatedEvent.InputTuple, WaitingValidatorCollateralUpdatedEvent.OutputTuple, WaitingValidatorCollateralUpdatedEvent.OutputObject>;
    getEvent(key: "WaitingValidatorLeft"): TypedContractEvent<WaitingValidatorLeftEvent.InputTuple, WaitingValidatorLeftEvent.OutputTuple, WaitingValidatorLeftEvent.OutputObject>;
    filters: {
        "ActiveValidatorCollateralUpdated(address,uint256)": TypedContractEvent<ActiveValidatorCollateralUpdatedEvent.InputTuple, ActiveValidatorCollateralUpdatedEvent.OutputTuple, ActiveValidatorCollateralUpdatedEvent.OutputObject>;
        ActiveValidatorCollateralUpdated: TypedContractEvent<ActiveValidatorCollateralUpdatedEvent.InputTuple, ActiveValidatorCollateralUpdatedEvent.OutputTuple, ActiveValidatorCollateralUpdatedEvent.OutputObject>;
        "ActiveValidatorLeft(address)": TypedContractEvent<ActiveValidatorLeftEvent.InputTuple, ActiveValidatorLeftEvent.OutputTuple, ActiveValidatorLeftEvent.OutputObject>;
        ActiveValidatorLeft: TypedContractEvent<ActiveValidatorLeftEvent.InputTuple, ActiveValidatorLeftEvent.OutputTuple, ActiveValidatorLeftEvent.OutputObject>;
        "ActiveValidatorReplaced(address,address)": TypedContractEvent<ActiveValidatorReplacedEvent.InputTuple, ActiveValidatorReplacedEvent.OutputTuple, ActiveValidatorReplacedEvent.OutputObject>;
        ActiveValidatorReplaced: TypedContractEvent<ActiveValidatorReplacedEvent.InputTuple, ActiveValidatorReplacedEvent.OutputTuple, ActiveValidatorReplacedEvent.OutputObject>;
        "MembershipUpdated(tuple)": TypedContractEvent<MembershipUpdatedEvent.InputTuple, MembershipUpdatedEvent.OutputTuple, MembershipUpdatedEvent.OutputObject>;
        MembershipUpdated: TypedContractEvent<MembershipUpdatedEvent.InputTuple, MembershipUpdatedEvent.OutputTuple, MembershipUpdatedEvent.OutputObject>;
        "NewActiveValidator(address,uint256)": TypedContractEvent<NewActiveValidatorEvent.InputTuple, NewActiveValidatorEvent.OutputTuple, NewActiveValidatorEvent.OutputObject>;
        NewActiveValidator: TypedContractEvent<NewActiveValidatorEvent.InputTuple, NewActiveValidatorEvent.OutputTuple, NewActiveValidatorEvent.OutputObject>;
        "NewWaitingValidator(address,uint256)": TypedContractEvent<NewWaitingValidatorEvent.InputTuple, NewWaitingValidatorEvent.OutputTuple, NewWaitingValidatorEvent.OutputObject>;
        NewWaitingValidator: TypedContractEvent<NewWaitingValidatorEvent.InputTuple, NewWaitingValidatorEvent.OutputTuple, NewWaitingValidatorEvent.OutputObject>;
        "WaitingValidatorCollateralUpdated(address,uint256)": TypedContractEvent<WaitingValidatorCollateralUpdatedEvent.InputTuple, WaitingValidatorCollateralUpdatedEvent.OutputTuple, WaitingValidatorCollateralUpdatedEvent.OutputObject>;
        WaitingValidatorCollateralUpdated: TypedContractEvent<WaitingValidatorCollateralUpdatedEvent.InputTuple, WaitingValidatorCollateralUpdatedEvent.OutputTuple, WaitingValidatorCollateralUpdatedEvent.OutputObject>;
        "WaitingValidatorLeft(address)": TypedContractEvent<WaitingValidatorLeftEvent.InputTuple, WaitingValidatorLeftEvent.OutputTuple, WaitingValidatorLeftEvent.OutputObject>;
        WaitingValidatorLeft: TypedContractEvent<WaitingValidatorLeftEvent.InputTuple, WaitingValidatorLeftEvent.OutputTuple, WaitingValidatorLeftEvent.OutputObject>;
    };
}
//# sourceMappingURL=TopDownFinalityFacet.d.ts.map