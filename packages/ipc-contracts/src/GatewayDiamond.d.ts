import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener } from "../common";
export type SubnetIDStruct = {
    root: BigNumberish;
    route: AddressLike[];
};
export type SubnetIDStructOutput = [root: bigint, route: string[]] & {
    root: bigint;
    route: string[];
};
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
export declare namespace GatewayDiamond {
    type ConstructorParamsStruct = {
        bottomUpCheckPeriod: BigNumberish;
        activeValidatorsLimit: BigNumberish;
        majorityPercentage: BigNumberish;
        networkName: SubnetIDStruct;
        genesisValidators: ValidatorStruct[];
        commitSha: BytesLike;
    };
    type ConstructorParamsStructOutput = [
        bottomUpCheckPeriod: bigint,
        activeValidatorsLimit: bigint,
        majorityPercentage: bigint,
        networkName: SubnetIDStructOutput,
        genesisValidators: ValidatorStructOutput[],
        commitSha: string
    ] & {
        bottomUpCheckPeriod: bigint;
        activeValidatorsLimit: bigint;
        majorityPercentage: bigint;
        networkName: SubnetIDStructOutput;
        genesisValidators: ValidatorStructOutput[];
        commitSha: string;
    };
}
export interface GatewayDiamondInterface extends Interface {
    getEvent(nameOrSignatureOrTopic: "DiamondCut" | "MembershipUpdated" | "OwnershipTransferred"): EventFragment;
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
export interface GatewayDiamond extends BaseContract {
    connect(runner?: ContractRunner | null): GatewayDiamond;
    waitForDeployment(): Promise<this>;
    interface: GatewayDiamondInterface;
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
    getEvent(key: "MembershipUpdated"): TypedContractEvent<MembershipUpdatedEvent.InputTuple, MembershipUpdatedEvent.OutputTuple, MembershipUpdatedEvent.OutputObject>;
    getEvent(key: "OwnershipTransferred"): TypedContractEvent<OwnershipTransferredEvent.InputTuple, OwnershipTransferredEvent.OutputTuple, OwnershipTransferredEvent.OutputObject>;
    filters: {
        "DiamondCut(tuple[],address,bytes)": TypedContractEvent<DiamondCutEvent.InputTuple, DiamondCutEvent.OutputTuple, DiamondCutEvent.OutputObject>;
        DiamondCut: TypedContractEvent<DiamondCutEvent.InputTuple, DiamondCutEvent.OutputTuple, DiamondCutEvent.OutputObject>;
        "MembershipUpdated(tuple)": TypedContractEvent<MembershipUpdatedEvent.InputTuple, MembershipUpdatedEvent.OutputTuple, MembershipUpdatedEvent.OutputObject>;
        MembershipUpdated: TypedContractEvent<MembershipUpdatedEvent.InputTuple, MembershipUpdatedEvent.OutputTuple, MembershipUpdatedEvent.OutputObject>;
        "OwnershipTransferred(address,address)": TypedContractEvent<OwnershipTransferredEvent.InputTuple, OwnershipTransferredEvent.OutputTuple, OwnershipTransferredEvent.OutputObject>;
        OwnershipTransferred: TypedContractEvent<OwnershipTransferredEvent.InputTuple, OwnershipTransferredEvent.OutputTuple, OwnershipTransferredEvent.OutputObject>;
    };
}
//# sourceMappingURL=GatewayDiamond.d.ts.map