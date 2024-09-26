import type { BaseContract, BigNumberish, FunctionFragment, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener } from "../../../common";
export interface LibValidatorSetInterface extends Interface {
    getEvent(nameOrSignatureOrTopic: "ActiveValidatorCollateralUpdated" | "ActiveValidatorLeft" | "ActiveValidatorReplaced" | "NewActiveValidator" | "NewWaitingValidator" | "WaitingValidatorCollateralUpdated" | "WaitingValidatorLeft"): EventFragment;
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
export interface LibValidatorSet extends BaseContract {
    connect(runner?: ContractRunner | null): LibValidatorSet;
    waitForDeployment(): Promise<this>;
    interface: LibValidatorSetInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getEvent(key: "ActiveValidatorCollateralUpdated"): TypedContractEvent<ActiveValidatorCollateralUpdatedEvent.InputTuple, ActiveValidatorCollateralUpdatedEvent.OutputTuple, ActiveValidatorCollateralUpdatedEvent.OutputObject>;
    getEvent(key: "ActiveValidatorLeft"): TypedContractEvent<ActiveValidatorLeftEvent.InputTuple, ActiveValidatorLeftEvent.OutputTuple, ActiveValidatorLeftEvent.OutputObject>;
    getEvent(key: "ActiveValidatorReplaced"): TypedContractEvent<ActiveValidatorReplacedEvent.InputTuple, ActiveValidatorReplacedEvent.OutputTuple, ActiveValidatorReplacedEvent.OutputObject>;
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
//# sourceMappingURL=LibValidatorSet.d.ts.map