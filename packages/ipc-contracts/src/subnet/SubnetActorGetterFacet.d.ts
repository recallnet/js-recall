import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Result, Interface, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedListener, TypedContractMethod } from "../../common";
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
export type ValidatorInfoStruct = {
    federatedPower: BigNumberish;
    confirmedCollateral: BigNumberish;
    totalCollateral: BigNumberish;
    metadata: BytesLike;
};
export type ValidatorInfoStructOutput = [
    federatedPower: bigint,
    confirmedCollateral: bigint,
    totalCollateral: bigint,
    metadata: string
] & {
    federatedPower: bigint;
    confirmedCollateral: bigint;
    totalCollateral: bigint;
    metadata: string;
};
export type SupplySourceStruct = {
    kind: BigNumberish;
    tokenAddress: AddressLike;
};
export type SupplySourceStructOutput = [kind: bigint, tokenAddress: string] & {
    kind: bigint;
    tokenAddress: string;
};
export interface SubnetActorGetterFacetInterface extends Interface {
    getFunction(nameOrSignature: "activeValidatorsLimit" | "bootstrapped" | "bottomUpCheckPeriod" | "bottomUpCheckpointAtEpoch" | "bottomUpCheckpointHashAtEpoch" | "consensus" | "crossMsgsHash" | "genesisBalances" | "genesisCircSupply" | "genesisValidators" | "getActiveValidatorsNumber" | "getBootstrapNodes" | "getConfigurationNumbers" | "getParent" | "getPower" | "getTotalCollateral" | "getTotalConfirmedCollateral" | "getTotalValidatorCollateral" | "getTotalValidatorsNumber" | "getValidator" | "ipcGatewayAddr" | "isActiveValidator" | "isWaitingValidator" | "killed" | "lastBottomUpCheckpointHeight" | "majorityPercentage" | "minActivationCollateral" | "minValidators" | "permissionMode" | "powerScale" | "supplySource"): FunctionFragment;
    encodeFunctionData(functionFragment: "activeValidatorsLimit", values?: undefined): string;
    encodeFunctionData(functionFragment: "bootstrapped", values?: undefined): string;
    encodeFunctionData(functionFragment: "bottomUpCheckPeriod", values?: undefined): string;
    encodeFunctionData(functionFragment: "bottomUpCheckpointAtEpoch", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "bottomUpCheckpointHashAtEpoch", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "consensus", values?: undefined): string;
    encodeFunctionData(functionFragment: "crossMsgsHash", values: [IpcEnvelopeStruct[]]): string;
    encodeFunctionData(functionFragment: "genesisBalances", values?: undefined): string;
    encodeFunctionData(functionFragment: "genesisCircSupply", values?: undefined): string;
    encodeFunctionData(functionFragment: "genesisValidators", values?: undefined): string;
    encodeFunctionData(functionFragment: "getActiveValidatorsNumber", values?: undefined): string;
    encodeFunctionData(functionFragment: "getBootstrapNodes", values?: undefined): string;
    encodeFunctionData(functionFragment: "getConfigurationNumbers", values?: undefined): string;
    encodeFunctionData(functionFragment: "getParent", values?: undefined): string;
    encodeFunctionData(functionFragment: "getPower", values: [AddressLike]): string;
    encodeFunctionData(functionFragment: "getTotalCollateral", values?: undefined): string;
    encodeFunctionData(functionFragment: "getTotalConfirmedCollateral", values?: undefined): string;
    encodeFunctionData(functionFragment: "getTotalValidatorCollateral", values: [AddressLike]): string;
    encodeFunctionData(functionFragment: "getTotalValidatorsNumber", values?: undefined): string;
    encodeFunctionData(functionFragment: "getValidator", values: [AddressLike]): string;
    encodeFunctionData(functionFragment: "ipcGatewayAddr", values?: undefined): string;
    encodeFunctionData(functionFragment: "isActiveValidator", values: [AddressLike]): string;
    encodeFunctionData(functionFragment: "isWaitingValidator", values: [AddressLike]): string;
    encodeFunctionData(functionFragment: "killed", values?: undefined): string;
    encodeFunctionData(functionFragment: "lastBottomUpCheckpointHeight", values?: undefined): string;
    encodeFunctionData(functionFragment: "majorityPercentage", values?: undefined): string;
    encodeFunctionData(functionFragment: "minActivationCollateral", values?: undefined): string;
    encodeFunctionData(functionFragment: "minValidators", values?: undefined): string;
    encodeFunctionData(functionFragment: "permissionMode", values?: undefined): string;
    encodeFunctionData(functionFragment: "powerScale", values?: undefined): string;
    encodeFunctionData(functionFragment: "supplySource", values?: undefined): string;
    decodeFunctionResult(functionFragment: "activeValidatorsLimit", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bootstrapped", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bottomUpCheckPeriod", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bottomUpCheckpointAtEpoch", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bottomUpCheckpointHashAtEpoch", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "consensus", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "crossMsgsHash", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "genesisBalances", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "genesisCircSupply", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "genesisValidators", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getActiveValidatorsNumber", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getBootstrapNodes", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getConfigurationNumbers", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getParent", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getPower", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getTotalCollateral", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getTotalConfirmedCollateral", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getTotalValidatorCollateral", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getTotalValidatorsNumber", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getValidator", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "ipcGatewayAddr", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "isActiveValidator", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "isWaitingValidator", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "killed", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "lastBottomUpCheckpointHeight", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "majorityPercentage", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "minActivationCollateral", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "minValidators", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "permissionMode", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "powerScale", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "supplySource", data: BytesLike): Result;
}
export interface SubnetActorGetterFacet extends BaseContract {
    connect(runner?: ContractRunner | null): SubnetActorGetterFacet;
    waitForDeployment(): Promise<this>;
    interface: SubnetActorGetterFacetInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    activeValidatorsLimit: TypedContractMethod<[], [bigint], "view">;
    bootstrapped: TypedContractMethod<[], [boolean], "view">;
    bottomUpCheckPeriod: TypedContractMethod<[], [bigint], "view">;
    bottomUpCheckpointAtEpoch: TypedContractMethod<[
        epoch: BigNumberish
    ], [
        [
            boolean,
            BottomUpCheckpointStructOutput
        ] & {
            exists: boolean;
            checkpoint: BottomUpCheckpointStructOutput;
        }
    ], "view">;
    bottomUpCheckpointHashAtEpoch: TypedContractMethod<[
        epoch: BigNumberish
    ], [
        [boolean, string]
    ], "view">;
    consensus: TypedContractMethod<[], [bigint], "view">;
    crossMsgsHash: TypedContractMethod<[
        messages: IpcEnvelopeStruct[]
    ], [
        string
    ], "view">;
    genesisBalances: TypedContractMethod<[], [[string[], bigint[]]], "view">;
    genesisCircSupply: TypedContractMethod<[], [bigint], "view">;
    genesisValidators: TypedContractMethod<[], [ValidatorStructOutput[]], "view">;
    getActiveValidatorsNumber: TypedContractMethod<[], [bigint], "view">;
    getBootstrapNodes: TypedContractMethod<[], [string[]], "view">;
    getConfigurationNumbers: TypedContractMethod<[], [[bigint, bigint]], "view">;
    getParent: TypedContractMethod<[], [SubnetIDStructOutput], "view">;
    getPower: TypedContractMethod<[validator: AddressLike], [bigint], "view">;
    getTotalCollateral: TypedContractMethod<[], [bigint], "view">;
    getTotalConfirmedCollateral: TypedContractMethod<[], [bigint], "view">;
    getTotalValidatorCollateral: TypedContractMethod<[
        validator: AddressLike
    ], [
        bigint
    ], "view">;
    getTotalValidatorsNumber: TypedContractMethod<[], [bigint], "view">;
    getValidator: TypedContractMethod<[
        validatorAddress: AddressLike
    ], [
        ValidatorInfoStructOutput
    ], "view">;
    ipcGatewayAddr: TypedContractMethod<[], [string], "view">;
    isActiveValidator: TypedContractMethod<[
        validator: AddressLike
    ], [
        boolean
    ], "view">;
    isWaitingValidator: TypedContractMethod<[
        validator: AddressLike
    ], [
        boolean
    ], "view">;
    killed: TypedContractMethod<[], [boolean], "view">;
    lastBottomUpCheckpointHeight: TypedContractMethod<[], [bigint], "view">;
    majorityPercentage: TypedContractMethod<[], [bigint], "view">;
    minActivationCollateral: TypedContractMethod<[], [bigint], "view">;
    minValidators: TypedContractMethod<[], [bigint], "view">;
    permissionMode: TypedContractMethod<[], [bigint], "view">;
    powerScale: TypedContractMethod<[], [bigint], "view">;
    supplySource: TypedContractMethod<[], [SupplySourceStructOutput], "view">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "activeValidatorsLimit"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "bootstrapped"): TypedContractMethod<[], [boolean], "view">;
    getFunction(nameOrSignature: "bottomUpCheckPeriod"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "bottomUpCheckpointAtEpoch"): TypedContractMethod<[
        epoch: BigNumberish
    ], [
        [
            boolean,
            BottomUpCheckpointStructOutput
        ] & {
            exists: boolean;
            checkpoint: BottomUpCheckpointStructOutput;
        }
    ], "view">;
    getFunction(nameOrSignature: "bottomUpCheckpointHashAtEpoch"): TypedContractMethod<[epoch: BigNumberish], [[boolean, string]], "view">;
    getFunction(nameOrSignature: "consensus"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "crossMsgsHash"): TypedContractMethod<[messages: IpcEnvelopeStruct[]], [string], "view">;
    getFunction(nameOrSignature: "genesisBalances"): TypedContractMethod<[], [[string[], bigint[]]], "view">;
    getFunction(nameOrSignature: "genesisCircSupply"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "genesisValidators"): TypedContractMethod<[], [ValidatorStructOutput[]], "view">;
    getFunction(nameOrSignature: "getActiveValidatorsNumber"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "getBootstrapNodes"): TypedContractMethod<[], [string[]], "view">;
    getFunction(nameOrSignature: "getConfigurationNumbers"): TypedContractMethod<[], [[bigint, bigint]], "view">;
    getFunction(nameOrSignature: "getParent"): TypedContractMethod<[], [SubnetIDStructOutput], "view">;
    getFunction(nameOrSignature: "getPower"): TypedContractMethod<[validator: AddressLike], [bigint], "view">;
    getFunction(nameOrSignature: "getTotalCollateral"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "getTotalConfirmedCollateral"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "getTotalValidatorCollateral"): TypedContractMethod<[validator: AddressLike], [bigint], "view">;
    getFunction(nameOrSignature: "getTotalValidatorsNumber"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "getValidator"): TypedContractMethod<[
        validatorAddress: AddressLike
    ], [
        ValidatorInfoStructOutput
    ], "view">;
    getFunction(nameOrSignature: "ipcGatewayAddr"): TypedContractMethod<[], [string], "view">;
    getFunction(nameOrSignature: "isActiveValidator"): TypedContractMethod<[validator: AddressLike], [boolean], "view">;
    getFunction(nameOrSignature: "isWaitingValidator"): TypedContractMethod<[validator: AddressLike], [boolean], "view">;
    getFunction(nameOrSignature: "killed"): TypedContractMethod<[], [boolean], "view">;
    getFunction(nameOrSignature: "lastBottomUpCheckpointHeight"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "majorityPercentage"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "minActivationCollateral"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "minValidators"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "permissionMode"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "powerScale"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "supplySource"): TypedContractMethod<[], [SupplySourceStructOutput], "view">;
    filters: {};
}
//# sourceMappingURL=SubnetActorGetterFacet.d.ts.map