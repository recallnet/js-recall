import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener } from "../../common";
export interface LibStakingChangeLogInterface extends Interface {
    getEvent(nameOrSignatureOrTopic: "NewStakingChangeRequest"): EventFragment;
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
export interface LibStakingChangeLog extends BaseContract {
    connect(runner?: ContractRunner | null): LibStakingChangeLog;
    waitForDeployment(): Promise<this>;
    interface: LibStakingChangeLogInterface;
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
    getEvent(key: "NewStakingChangeRequest"): TypedContractEvent<NewStakingChangeRequestEvent.InputTuple, NewStakingChangeRequestEvent.OutputTuple, NewStakingChangeRequestEvent.OutputObject>;
    filters: {
        "NewStakingChangeRequest(uint8,address,bytes,uint64)": TypedContractEvent<NewStakingChangeRequestEvent.InputTuple, NewStakingChangeRequestEvent.OutputTuple, NewStakingChangeRequestEvent.OutputObject>;
        NewStakingChangeRequest: TypedContractEvent<NewStakingChangeRequestEvent.InputTuple, NewStakingChangeRequestEvent.OutputTuple, NewStakingChangeRequestEvent.OutputObject>;
    };
}
//# sourceMappingURL=LibStakingChangeLog.d.ts.map