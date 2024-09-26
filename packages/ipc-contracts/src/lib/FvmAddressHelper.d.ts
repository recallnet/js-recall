import type { BaseContract, BytesLike, FunctionFragment, Result, Interface, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedListener, TypedContractMethod } from "../../common";
export interface FvmAddressHelperInterface extends Interface {
    getFunction(nameOrSignature: "DELEGATED" | "EAM_ACTOR" | "PAYLOAD_HASH_LEN" | "SECP256K1"): FunctionFragment;
    encodeFunctionData(functionFragment: "DELEGATED", values?: undefined): string;
    encodeFunctionData(functionFragment: "EAM_ACTOR", values?: undefined): string;
    encodeFunctionData(functionFragment: "PAYLOAD_HASH_LEN", values?: undefined): string;
    encodeFunctionData(functionFragment: "SECP256K1", values?: undefined): string;
    decodeFunctionResult(functionFragment: "DELEGATED", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "EAM_ACTOR", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "PAYLOAD_HASH_LEN", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "SECP256K1", data: BytesLike): Result;
}
export interface FvmAddressHelper extends BaseContract {
    connect(runner?: ContractRunner | null): FvmAddressHelper;
    waitForDeployment(): Promise<this>;
    interface: FvmAddressHelperInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    DELEGATED: TypedContractMethod<[], [bigint], "view">;
    EAM_ACTOR: TypedContractMethod<[], [bigint], "view">;
    PAYLOAD_HASH_LEN: TypedContractMethod<[], [bigint], "view">;
    SECP256K1: TypedContractMethod<[], [bigint], "view">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "DELEGATED"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "EAM_ACTOR"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "PAYLOAD_HASH_LEN"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "SECP256K1"): TypedContractMethod<[], [bigint], "view">;
    filters: {};
}
//# sourceMappingURL=FvmAddressHelper.d.ts.map