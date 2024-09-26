import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Result, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener, TypedContractMethod } from "../../common";
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
export interface SubnetActorManagerFacetInterface extends Interface {
    getFunction(nameOrSignature: "addBootstrapNode" | "join" | "kill" | "leave" | "preFund" | "preRelease" | "setFederatedPower" | "stake" | "unstake"): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: "ActiveValidatorCollateralUpdated" | "ActiveValidatorLeft" | "ActiveValidatorReplaced" | "NewActiveValidator" | "NewStakingChangeRequest" | "NewWaitingValidator" | "Paused" | "SubnetBootstrapped" | "Unpaused" | "WaitingValidatorCollateralUpdated" | "WaitingValidatorLeft"): EventFragment;
    encodeFunctionData(functionFragment: "addBootstrapNode", values: [string]): string;
    encodeFunctionData(functionFragment: "join", values: [BytesLike]): string;
    encodeFunctionData(functionFragment: "kill", values?: undefined): string;
    encodeFunctionData(functionFragment: "leave", values?: undefined): string;
    encodeFunctionData(functionFragment: "preFund", values?: undefined): string;
    encodeFunctionData(functionFragment: "preRelease", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "setFederatedPower", values: [AddressLike[], BytesLike[], BigNumberish[]]): string;
    encodeFunctionData(functionFragment: "stake", values?: undefined): string;
    encodeFunctionData(functionFragment: "unstake", values: [BigNumberish]): string;
    decodeFunctionResult(functionFragment: "addBootstrapNode", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "join", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "kill", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "leave", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "preFund", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "preRelease", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "setFederatedPower", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "stake", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "unstake", data: BytesLike): Result;
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
export declare namespace NewStakingChangeRequestEvent {
    type InputTuple = [
        op: BigNumberish,
        validator: AddressLike,
        payload: BytesLike,
        configurationNumber: BigNumberish
    ];
    type OutputTuple = [
        op: bigint,
        validator: string,
        payload: string,
        configurationNumber: bigint
    ];
    interface OutputObject {
        op: bigint;
        validator: string;
        payload: string;
        configurationNumber: bigint;
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
export declare namespace SubnetBootstrappedEvent {
    type InputTuple = [arg0: ValidatorStruct[]];
    type OutputTuple = [arg0: ValidatorStructOutput[]];
    interface OutputObject {
        arg0: ValidatorStructOutput[];
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
export interface SubnetActorManagerFacet extends BaseContract {
    connect(runner?: ContractRunner | null): SubnetActorManagerFacet;
    waitForDeployment(): Promise<this>;
    interface: SubnetActorManagerFacetInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    addBootstrapNode: TypedContractMethod<[
        netAddress: string
    ], [
        void
    ], "nonpayable">;
    join: TypedContractMethod<[publicKey: BytesLike], [void], "payable">;
    kill: TypedContractMethod<[], [void], "nonpayable">;
    leave: TypedContractMethod<[], [void], "nonpayable">;
    preFund: TypedContractMethod<[], [void], "payable">;
    preRelease: TypedContractMethod<[amount: BigNumberish], [void], "nonpayable">;
    setFederatedPower: TypedContractMethod<[
        validators: AddressLike[],
        publicKeys: BytesLike[],
        powers: BigNumberish[]
    ], [
        void
    ], "nonpayable">;
    stake: TypedContractMethod<[], [void], "payable">;
    unstake: TypedContractMethod<[amount: BigNumberish], [void], "nonpayable">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "addBootstrapNode"): TypedContractMethod<[netAddress: string], [void], "nonpayable">;
    getFunction(nameOrSignature: "join"): TypedContractMethod<[publicKey: BytesLike], [void], "payable">;
    getFunction(nameOrSignature: "kill"): TypedContractMethod<[], [void], "nonpayable">;
    getFunction(nameOrSignature: "leave"): TypedContractMethod<[], [void], "nonpayable">;
    getFunction(nameOrSignature: "preFund"): TypedContractMethod<[], [void], "payable">;
    getFunction(nameOrSignature: "preRelease"): TypedContractMethod<[amount: BigNumberish], [void], "nonpayable">;
    getFunction(nameOrSignature: "setFederatedPower"): TypedContractMethod<[
        validators: AddressLike[],
        publicKeys: BytesLike[],
        powers: BigNumberish[]
    ], [
        void
    ], "nonpayable">;
    getFunction(nameOrSignature: "stake"): TypedContractMethod<[], [void], "payable">;
    getFunction(nameOrSignature: "unstake"): TypedContractMethod<[amount: BigNumberish], [void], "nonpayable">;
    getEvent(key: "ActiveValidatorCollateralUpdated"): TypedContractEvent<ActiveValidatorCollateralUpdatedEvent.InputTuple, ActiveValidatorCollateralUpdatedEvent.OutputTuple, ActiveValidatorCollateralUpdatedEvent.OutputObject>;
    getEvent(key: "ActiveValidatorLeft"): TypedContractEvent<ActiveValidatorLeftEvent.InputTuple, ActiveValidatorLeftEvent.OutputTuple, ActiveValidatorLeftEvent.OutputObject>;
    getEvent(key: "ActiveValidatorReplaced"): TypedContractEvent<ActiveValidatorReplacedEvent.InputTuple, ActiveValidatorReplacedEvent.OutputTuple, ActiveValidatorReplacedEvent.OutputObject>;
    getEvent(key: "NewActiveValidator"): TypedContractEvent<NewActiveValidatorEvent.InputTuple, NewActiveValidatorEvent.OutputTuple, NewActiveValidatorEvent.OutputObject>;
    getEvent(key: "NewStakingChangeRequest"): TypedContractEvent<NewStakingChangeRequestEvent.InputTuple, NewStakingChangeRequestEvent.OutputTuple, NewStakingChangeRequestEvent.OutputObject>;
    getEvent(key: "NewWaitingValidator"): TypedContractEvent<NewWaitingValidatorEvent.InputTuple, NewWaitingValidatorEvent.OutputTuple, NewWaitingValidatorEvent.OutputObject>;
    getEvent(key: "Paused"): TypedContractEvent<PausedEvent.InputTuple, PausedEvent.OutputTuple, PausedEvent.OutputObject>;
    getEvent(key: "SubnetBootstrapped"): TypedContractEvent<SubnetBootstrappedEvent.InputTuple, SubnetBootstrappedEvent.OutputTuple, SubnetBootstrappedEvent.OutputObject>;
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
        "NewActiveValidator(address,uint256)": TypedContractEvent<NewActiveValidatorEvent.InputTuple, NewActiveValidatorEvent.OutputTuple, NewActiveValidatorEvent.OutputObject>;
        NewActiveValidator: TypedContractEvent<NewActiveValidatorEvent.InputTuple, NewActiveValidatorEvent.OutputTuple, NewActiveValidatorEvent.OutputObject>;
        "NewStakingChangeRequest(uint8,address,bytes,uint64)": TypedContractEvent<NewStakingChangeRequestEvent.InputTuple, NewStakingChangeRequestEvent.OutputTuple, NewStakingChangeRequestEvent.OutputObject>;
        NewStakingChangeRequest: TypedContractEvent<NewStakingChangeRequestEvent.InputTuple, NewStakingChangeRequestEvent.OutputTuple, NewStakingChangeRequestEvent.OutputObject>;
        "NewWaitingValidator(address,uint256)": TypedContractEvent<NewWaitingValidatorEvent.InputTuple, NewWaitingValidatorEvent.OutputTuple, NewWaitingValidatorEvent.OutputObject>;
        NewWaitingValidator: TypedContractEvent<NewWaitingValidatorEvent.InputTuple, NewWaitingValidatorEvent.OutputTuple, NewWaitingValidatorEvent.OutputObject>;
        "Paused(address)": TypedContractEvent<PausedEvent.InputTuple, PausedEvent.OutputTuple, PausedEvent.OutputObject>;
        Paused: TypedContractEvent<PausedEvent.InputTuple, PausedEvent.OutputTuple, PausedEvent.OutputObject>;
        "SubnetBootstrapped(tuple[])": TypedContractEvent<SubnetBootstrappedEvent.InputTuple, SubnetBootstrappedEvent.OutputTuple, SubnetBootstrappedEvent.OutputObject>;
        SubnetBootstrapped: TypedContractEvent<SubnetBootstrappedEvent.InputTuple, SubnetBootstrappedEvent.OutputTuple, SubnetBootstrappedEvent.OutputObject>;
        "Unpaused(address)": TypedContractEvent<UnpausedEvent.InputTuple, UnpausedEvent.OutputTuple, UnpausedEvent.OutputObject>;
        Unpaused: TypedContractEvent<UnpausedEvent.InputTuple, UnpausedEvent.OutputTuple, UnpausedEvent.OutputObject>;
        "WaitingValidatorCollateralUpdated(address,uint256)": TypedContractEvent<WaitingValidatorCollateralUpdatedEvent.InputTuple, WaitingValidatorCollateralUpdatedEvent.OutputTuple, WaitingValidatorCollateralUpdatedEvent.OutputObject>;
        WaitingValidatorCollateralUpdated: TypedContractEvent<WaitingValidatorCollateralUpdatedEvent.InputTuple, WaitingValidatorCollateralUpdatedEvent.OutputTuple, WaitingValidatorCollateralUpdatedEvent.OutputObject>;
        "WaitingValidatorLeft(address)": TypedContractEvent<WaitingValidatorLeftEvent.InputTuple, WaitingValidatorLeftEvent.OutputTuple, WaitingValidatorLeftEvent.OutputObject>;
        WaitingValidatorLeft: TypedContractEvent<WaitingValidatorLeftEvent.InputTuple, WaitingValidatorLeftEvent.OutputTuple, WaitingValidatorLeftEvent.OutputObject>;
    };
}
//# sourceMappingURL=SubnetActorManagerFacet.d.ts.map