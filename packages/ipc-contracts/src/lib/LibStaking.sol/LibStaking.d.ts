import type { BaseContract, BigNumberish, FunctionFragment, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener } from "../../../common";
export interface LibStakingInterface extends Interface {
    getEvent(nameOrSignatureOrTopic: "CollateralClaimed" | "ConfigurationNumberConfirmed"): EventFragment;
}
export declare namespace CollateralClaimedEvent {
    type InputTuple = [validator: AddressLike, amount: BigNumberish];
    type OutputTuple = [validator: string, amount: bigint];
    interface OutputObject {
        validator: string;
        amount: bigint;
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
export interface LibStaking extends BaseContract {
    connect(runner?: ContractRunner | null): LibStaking;
    waitForDeployment(): Promise<this>;
    interface: LibStakingInterface;
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
    getEvent(key: "CollateralClaimed"): TypedContractEvent<CollateralClaimedEvent.InputTuple, CollateralClaimedEvent.OutputTuple, CollateralClaimedEvent.OutputObject>;
    getEvent(key: "ConfigurationNumberConfirmed"): TypedContractEvent<ConfigurationNumberConfirmedEvent.InputTuple, ConfigurationNumberConfirmedEvent.OutputTuple, ConfigurationNumberConfirmedEvent.OutputObject>;
    filters: {
        "CollateralClaimed(address,uint256)": TypedContractEvent<CollateralClaimedEvent.InputTuple, CollateralClaimedEvent.OutputTuple, CollateralClaimedEvent.OutputObject>;
        CollateralClaimed: TypedContractEvent<CollateralClaimedEvent.InputTuple, CollateralClaimedEvent.OutputTuple, CollateralClaimedEvent.OutputObject>;
        "ConfigurationNumberConfirmed(uint64)": TypedContractEvent<ConfigurationNumberConfirmedEvent.InputTuple, ConfigurationNumberConfirmedEvent.OutputTuple, ConfigurationNumberConfirmedEvent.OutputObject>;
        ConfigurationNumberConfirmed: TypedContractEvent<ConfigurationNumberConfirmedEvent.InputTuple, ConfigurationNumberConfirmedEvent.OutputTuple, ConfigurationNumberConfirmedEvent.OutputObject>;
    };
}
//# sourceMappingURL=LibStaking.d.ts.map