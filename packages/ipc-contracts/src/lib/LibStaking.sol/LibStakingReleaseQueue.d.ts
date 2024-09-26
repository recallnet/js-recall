import type { BaseContract, BigNumberish, FunctionFragment, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener } from "../../../common";
export interface LibStakingReleaseQueueInterface extends Interface {
    getEvent(nameOrSignatureOrTopic: "NewCollateralRelease"): EventFragment;
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
export interface LibStakingReleaseQueue extends BaseContract {
    connect(runner?: ContractRunner | null): LibStakingReleaseQueue;
    waitForDeployment(): Promise<this>;
    interface: LibStakingReleaseQueueInterface;
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
    getEvent(key: "NewCollateralRelease"): TypedContractEvent<NewCollateralReleaseEvent.InputTuple, NewCollateralReleaseEvent.OutputTuple, NewCollateralReleaseEvent.OutputObject>;
    filters: {
        "NewCollateralRelease(address,uint256,uint256)": TypedContractEvent<NewCollateralReleaseEvent.InputTuple, NewCollateralReleaseEvent.OutputTuple, NewCollateralReleaseEvent.OutputObject>;
        NewCollateralRelease: TypedContractEvent<NewCollateralReleaseEvent.InputTuple, NewCollateralReleaseEvent.OutputTuple, NewCollateralReleaseEvent.OutputObject>;
    };
}
//# sourceMappingURL=LibStakingReleaseQueue.d.ts.map