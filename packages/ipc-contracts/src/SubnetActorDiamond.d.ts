import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener } from "../common";
export type SupplySourceStruct = {
    kind: BigNumberish;
    tokenAddress: AddressLike;
};
export type SupplySourceStructOutput = [kind: bigint, tokenAddress: string] & {
    kind: bigint;
    tokenAddress: string;
};
export type SubnetIDStruct = {
    root: BigNumberish;
    route: AddressLike[];
};
export type SubnetIDStructOutput = [root: bigint, route: string[]] & {
    root: bigint;
    route: string[];
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
export declare namespace SubnetActorDiamond {
    type ConstructorParamsStruct = {
        minActivationCollateral: BigNumberish;
        minValidators: BigNumberish;
        bottomUpCheckPeriod: BigNumberish;
        ipcGatewayAddr: AddressLike;
        activeValidatorsLimit: BigNumberish;
        majorityPercentage: BigNumberish;
        consensus: BigNumberish;
        powerScale: BigNumberish;
        permissionMode: BigNumberish;
        supplySource: SupplySourceStruct;
        parentId: SubnetIDStruct;
    };
    type ConstructorParamsStructOutput = [
        minActivationCollateral: bigint,
        minValidators: bigint,
        bottomUpCheckPeriod: bigint,
        ipcGatewayAddr: string,
        activeValidatorsLimit: bigint,
        majorityPercentage: bigint,
        consensus: bigint,
        powerScale: bigint,
        permissionMode: bigint,
        supplySource: SupplySourceStructOutput,
        parentId: SubnetIDStructOutput
    ] & {
        minActivationCollateral: bigint;
        minValidators: bigint;
        bottomUpCheckPeriod: bigint;
        ipcGatewayAddr: string;
        activeValidatorsLimit: bigint;
        majorityPercentage: bigint;
        consensus: bigint;
        powerScale: bigint;
        permissionMode: bigint;
        supplySource: SupplySourceStructOutput;
        parentId: SubnetIDStructOutput;
    };
}
export interface SubnetActorDiamondInterface extends Interface {
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
export interface SubnetActorDiamond extends BaseContract {
    connect(runner?: ContractRunner | null): SubnetActorDiamond;
    waitForDeployment(): Promise<this>;
    interface: SubnetActorDiamondInterface;
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
//# sourceMappingURL=SubnetActorDiamond.d.ts.map