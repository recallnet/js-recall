import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener } from "../common";
export declare namespace IDiamond {
    type FacetCutStruct = {
        facetAddress: AddressLike;
        action: BigNumberish;
        functionSelectors: BytesLike[];
    };
    type FacetCutStructOutput = [
        facetAddress: string,
        action: bigint,
        functionSelectors: string[]
    ] & {
        facetAddress: string;
        action: bigint;
        functionSelectors: string[];
    };
}
export declare namespace SubnetRegistryDiamond {
    type ConstructorParamsStruct = {
        gateway: AddressLike;
        getterFacet: AddressLike;
        managerFacet: AddressLike;
        rewarderFacet: AddressLike;
        checkpointerFacet: AddressLike;
        pauserFacet: AddressLike;
        diamondCutFacet: AddressLike;
        diamondLoupeFacet: AddressLike;
        ownershipFacet: AddressLike;
        subnetActorGetterSelectors: BytesLike[];
        subnetActorManagerSelectors: BytesLike[];
        subnetActorRewarderSelectors: BytesLike[];
        subnetActorCheckpointerSelectors: BytesLike[];
        subnetActorPauserSelectors: BytesLike[];
        subnetActorDiamondCutSelectors: BytesLike[];
        subnetActorDiamondLoupeSelectors: BytesLike[];
        subnetActorOwnershipSelectors: BytesLike[];
        creationPrivileges: BigNumberish;
    };
    type ConstructorParamsStructOutput = [
        gateway: string,
        getterFacet: string,
        managerFacet: string,
        rewarderFacet: string,
        checkpointerFacet: string,
        pauserFacet: string,
        diamondCutFacet: string,
        diamondLoupeFacet: string,
        ownershipFacet: string,
        subnetActorGetterSelectors: string[],
        subnetActorManagerSelectors: string[],
        subnetActorRewarderSelectors: string[],
        subnetActorCheckpointerSelectors: string[],
        subnetActorPauserSelectors: string[],
        subnetActorDiamondCutSelectors: string[],
        subnetActorDiamondLoupeSelectors: string[],
        subnetActorOwnershipSelectors: string[],
        creationPrivileges: bigint
    ] & {
        gateway: string;
        getterFacet: string;
        managerFacet: string;
        rewarderFacet: string;
        checkpointerFacet: string;
        pauserFacet: string;
        diamondCutFacet: string;
        diamondLoupeFacet: string;
        ownershipFacet: string;
        subnetActorGetterSelectors: string[];
        subnetActorManagerSelectors: string[];
        subnetActorRewarderSelectors: string[];
        subnetActorCheckpointerSelectors: string[];
        subnetActorPauserSelectors: string[];
        subnetActorDiamondCutSelectors: string[];
        subnetActorDiamondLoupeSelectors: string[];
        subnetActorOwnershipSelectors: string[];
        creationPrivileges: bigint;
    };
}
export interface SubnetRegistryDiamondInterface extends Interface {
    getEvent(nameOrSignatureOrTopic: "DiamondCut" | "OwnershipTransferred"): EventFragment;
}
export declare namespace DiamondCutEvent {
    type InputTuple = [
        _diamondCut: IDiamond.FacetCutStruct[],
        _init: AddressLike,
        _calldata: BytesLike
    ];
    type OutputTuple = [
        _diamondCut: IDiamond.FacetCutStructOutput[],
        _init: string,
        _calldata: string
    ];
    interface OutputObject {
        _diamondCut: IDiamond.FacetCutStructOutput[];
        _init: string;
        _calldata: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace OwnershipTransferredEvent {
    type InputTuple = [oldOwner: AddressLike, newOwner: AddressLike];
    type OutputTuple = [oldOwner: string, newOwner: string];
    interface OutputObject {
        oldOwner: string;
        newOwner: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export interface SubnetRegistryDiamond extends BaseContract {
    connect(runner?: ContractRunner | null): SubnetRegistryDiamond;
    waitForDeployment(): Promise<this>;
    interface: SubnetRegistryDiamondInterface;
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
    getEvent(key: "DiamondCut"): TypedContractEvent<DiamondCutEvent.InputTuple, DiamondCutEvent.OutputTuple, DiamondCutEvent.OutputObject>;
    getEvent(key: "OwnershipTransferred"): TypedContractEvent<OwnershipTransferredEvent.InputTuple, OwnershipTransferredEvent.OutputTuple, OwnershipTransferredEvent.OutputObject>;
    filters: {
        "DiamondCut(tuple[],address,bytes)": TypedContractEvent<DiamondCutEvent.InputTuple, DiamondCutEvent.OutputTuple, DiamondCutEvent.OutputObject>;
        DiamondCut: TypedContractEvent<DiamondCutEvent.InputTuple, DiamondCutEvent.OutputTuple, DiamondCutEvent.OutputObject>;
        "OwnershipTransferred(address,address)": TypedContractEvent<OwnershipTransferredEvent.InputTuple, OwnershipTransferredEvent.OutputTuple, OwnershipTransferredEvent.OutputObject>;
        OwnershipTransferred: TypedContractEvent<OwnershipTransferredEvent.InputTuple, OwnershipTransferredEvent.OutputTuple, OwnershipTransferredEvent.OutputObject>;
    };
}
//# sourceMappingURL=SubnetRegistryDiamond.d.ts.map