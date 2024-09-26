import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, AddressLike, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../common";
import type { SubnetActorDiamond, SubnetActorDiamondInterface, IDiamond } from "../../src/SubnetActorDiamond";
type SubnetActorDiamondConstructorParams = [linkLibraryAddresses: SubnetActorDiamondLibraryAddresses, signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class SubnetActorDiamond__factory extends ContractFactory {
    constructor(...args: SubnetActorDiamondConstructorParams);
    static linkBytecode(linkLibraryAddresses: SubnetActorDiamondLibraryAddresses): string;
    getDeployTransaction(_diamondCut: IDiamond.FacetCutStruct[], params: SubnetActorDiamond.ConstructorParamsStruct, owner: AddressLike, overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(_diamondCut: IDiamond.FacetCutStruct[], params: SubnetActorDiamond.ConstructorParamsStruct, owner: AddressLike, overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<SubnetActorDiamond & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): SubnetActorDiamond__factory;
    static readonly bytecode = "0x60806040523461074b576114bf803803809161001c8260806110f6565b6080396060811261074b576080516001600160401b03811161074b5760808201609f8201121561074b5780608001519061005582611119565b9161006360405193846110f6565b8083526020830180928560800160208460051b8360800101011161074b5760a08101915b60a0600585901b8301018310610f9957505060a051949150506001600160401b03841161074b576101808482031261074b576040519361016085016001600160401b0381118682101761082157604052608081015185526100ea60a08201611144565b60208601526100fb60c08201611144565b604086015261010c60e08201611130565b606086015261010081015161ffff8116810361074b57608086015261012081015160ff8116810361074b5760a0860152610140810151600181101561074b5760c0860152610160810151600081900b810361074b5760e0860152610180810151600381101561074b57610100860152604081830361011f19011261074b57604051610196816110c0565b6101a0820151600281101561074b5781526101b46101c08301611130565b60208201526101208601526101e08101516001600160401b03811161074b576101e4926080019160800101611158565b6101408401526101f460c0611130565b60608401516001600160a01b031615610f875760408401516001600160401b031615610f7557600161010085015161022b816111fb565b610234816111fb565b141580610f6c575b610f5a5760ff60a08501511660338110908115610f4f575b50610f3d57601260e085015160000b13610f2b576101208401518051600281101561070957600114610ea2575b507f806e0cbb9fce296bbc336a48f42bf1dbc69722d18d90d6fe705b7582c2bb4bd580546001600160a01b039283166001600160a01b0319821681179092556040805193909116835260208301919091527f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e091a16040516001600160401b036020820190811190821117610821576020810160405260008152825160005b8181106108965750506040519260608401906060855251809152608084019060808160051b86010193916000905b82821061084057877f8faa70878671ccd212d20771b795c50af8fd3ff6cf27f4bde57e5d4de0aeb67388806103918a8a6000602085015283820360408501526112c4565b0390a17f806e0cbb9fce296bbc336a48f42bf1dbc69722d18d90d6fe705b7582c2bb4bd46020527f7dfd48dd9def002fa9b4a05bd6b726a6c313c362d3f3e8413d7a7520f0090d258054600160ff1991821681179092557f4d7f4c8a2fb5b35ca3c277c93888b47f0f2229bdcccf66504d1ba48e88b8816480548216831790556348e2b09360e01b6000527f59ba4db4a213e8161de597b8c10db0e7e7ba5ace5c268e36379e249a6d2d42c9805490911682179055610100820151610455816111fb565b61045e816111fb565b14610837575b6101408101518051600880546001600160401b0319166001600160401b039283161790556020919091015180519182116108215768010000000000000000821161082157600954826009558083106107ec575b506020016009600052602060002060005b8381106107cf57606085015160055460c087015187926001600160a01b031690600181101561070957835160025560018060401b0360208501511660018060401b0319600654161760065560018060401b0360408501511660035560ff60e01b60a085015160e01b169160e085015160e81b60ff60e81b1693600160a01b63ff00000160e01b0316179060ff60f01b9060f01b161717176005556040519061056f826110c0565b6008546001600160401b0316825260405160098054808352600091825260008051602061145f83398151915291839160208301915b8181106107ad5750506105b9925003826110f6565b60208301526105fb600073__$a0fe38a9a81205afccc10810b09a4d3f45$__936040518093819263aa5106cb60e01b8352604060048401526044830190611205565b3060248301520381865af490811561075857600091610764575b5060209061063f9360405180809681946390ba52cf60e01b83528660048401526024830190611205565b03915af480156107585760009061071f575b6101209250600455610100810151610668816111fb565b610671816111fb565b600a54600560a11b600160a01b600160e01b0319600554161760055560ff62ffff00608085015160081b1692169062ffffff19161717600a556801000000000000000160018060801b03196013541617601355015180519060028210156107095760ff600754916020610100600160a81b0391015160081b1692169060018060a81b031916171760075560405160eb90816113748239f35b634e487b7160e01b600052602160045260246000fd5b506020823d602011610750575b81610739602093836110f6565b8101031261074b576101209151610651565b600080fd5b3d915061072c565b6040513d6000823e3d90fd5b90503d806000833e61077681836110f6565b81019260208285031261074b578151916001600160401b03831161074b5761063f946020936107a59201611158565b915092610615565b84546001600160a01b03168352600194850194869450602090930192016105a4565b82516001600160a01b0316818301556020909201916001016104c8565b600960005260008051602061145f833981519152908382015b81830181106108155750506104b7565b60008155600101610805565b634e487b7160e01b600052604160045260246000fd5b60008152610464565b90919294602080610888600193607f198b8203018652606060408b51878060a01b03815116845285810151610874816111fb565b868501520151918160408201520190611286565b97019201920190929161034d565b60406108a2828761125c565b5101516001600160a01b036108b7838861125c565b51511690805115610e895760206108ce848961125c565b5101516108da816111fb565b6108e3816111fb565b80610ae557508115610abc5761ffff60008051602061147f83398151915254169161094d604051610913816110db565b602181527f6469616d6f6e644375743a2041646420666163657420686173206e6f20636f646020820152606560f81b604082015282611334565b8151916000935b83851061096a5750505050506001905b0161031f565b6001600160e01b031961097d868461125c565b5116600081815260008051602061149f83398151915260205260409020546001600160a01b0316610aa457610a136040516109b7816110c0565b85815261ffff84166020808301918252600085815260008051602061149f833981519152909152604090209151825491516001600160b01b03199092166001600160a01b03919091161760a09190911b61ffff60a01b16179055565b60008051602061147f83398151915254906801000000000000000082101561082157610a55826001610a72940160008051602061147f83398151915255611304565b90919063ffffffff83549160031b9260e01c831b921b1916179055565b61ffff80821614610a8e57600161ffff81921601940193610954565b634e487b7160e01b600052601160045260246000fd5b6024906040519063ebbf5d0760e01b82526004820152fd5b6040516302b8da0760e21b815260206004820152908190610ae1906024830190611286565b0390fd5b610aee816111fb565b60018103610c5557508115610c3057610b4d604051610b0c816110db565b602881527f4c69624469616d6f6e644375743a205265706c61636520666163657420686173602082015267206e6f20636f646560c01b604082015283611334565b80519060005b828110610b665750505050600190610964565b6001600160e01b0319610b79828461125c565b5116600081815260008051602061149f83398151915260205260409020546001600160a01b0316308114610c1757858114610bfe5715610be657600090815260008051602061149f8339815191526020526040902080546001600160a01b03191685179055600101610b53565b60249060405190637479f93960e01b82526004820152fd5b604051631ac6ce8d60e11b815260048101839052602490fd5b604051632901806d60e11b815260048101839052602490fd5b60405163cd98a96f60e01b815260206004820152908190610ae1906024830190611286565b610c5e816111fb565b60028103610e69575060008051602061147f833981519152549180610e51575080519060005b828110610c975750505050600190610964565b6001600160e01b0319610caa828461125c565b5116908160005260008051602061149f83398151915260205260406000209460405195610cd6876110c0565b546001600160a01b03811680885260a09190911c61ffff16602088015215610e385785516001600160a01b03163014610e1f578015610a8e5760001901948561ffff60208301511603610da4575b5060008051602061147f83398151915254918215610d8e5760019260001901610d4c81611304565b63ffffffff82549160031b1b1916905560008051602061147f8339815191525560005260008051602061149f8339815191526020526000604081205501610c84565b634e487b7160e01b600052603160045260246000fd5b610e199061ffff6020610db689611304565b90549060031b1c60e01b92610dd384610a55858585015116611304565b01516001600160e01b0319909216600090815260008051602061149f83398151915260205260409020805461ffff60a01b19169190921660a01b61ffff60a01b16179055565b38610d24565b604051630df5fd6160e31b815260048101849052602490fd5b604051637a08a22d60e01b815260048101849052602490fd5b6024906040519063d091bc8160e01b82526004820152fd5b604051633ff4d20f60e11b8152602491610e82816111fb565b6004820152fd5b60405163e767f91f60e01b815260048101839052602490fd5b60208101516001600160a01b031615610f19576020908101516040516370a0823160e01b8152600060048201529190829060249082906001600160a01b03165afa8015610758571561028157602090813d8311610f12575b610f0481836110f6565b8101031261074b5738610281565b503d610efa565b6040516376fe282b60e11b8152600490fd5b6040516378b177e560e11b8152600490fd5b6040516375c3b42760e01b8152600490fd5b606491501138610254565b6040516368f7a67560e11b8152600490fd5b5083511561023c565b60405163312f8e0560e01b8152600490fd5b604051638b3ddc3360e01b8152600490fd5b82516001600160401b03811161074b57820160808101906060908903601f19011261074b5760405190606082016001600160401b038111838210176110ab57604052610fe760208201611130565b82526040810151600381101561074b57602083015260608101516001600160401b03811161074b5789608001603f82840101121561074b576020818301015161102f81611119565b9261103d60405194856110f6565b81845260208401908c60800160408460051b86840101011161074b57604084820101915b60408460051b8684010101831061108a5750505050506040820152815260209283019201610087565b82516001600160e01b03198116810361074b57815260209283019201611061565b60246000634e487b7160e01b81526041600452fd5b604081019081106001600160401b0382111761082157604052565b606081019081106001600160401b0382111761082157604052565b601f909101601f19168101906001600160401b0382119082101761082157604052565b6001600160401b0381116108215760051b60200190565b51906001600160a01b038216820361074b57565b51906001600160401b038216820361074b57565b919060408382031261074b5760405192611171846110c0565b8361117b82611144565b815260208281015190926001600160401b03821161074b57019280601f8501121561074b5783516111ab81611119565b946111b960405196876110f6565b818652848087019260051b82010192831161074b5784809101915b8383106111e357505050500152565b81906111ee84611130565b81520191019084906111d4565b6003111561070957565b6040820160018060401b0382511683526020606081809401519460408382015285518094520193019160005b82811061123f575050505090565b83516001600160a01b031685529381019392810192600101611231565b80518210156112705760209160051b010190565b634e487b7160e01b600052603260045260246000fd5b90815180825260208080930193019160005b8281106112a6575050505090565b83516001600160e01b03191685529381019392810192600101611298565b919082519283825260005b8481106112f0575050826000602080949584010152601f8019910116010190565b6020818301810151848301820152016112cf565b9060008051602061147f833981519152805483101561127057600052601c60206000208360031c019260021b1690565b803b1561133f575050565b6040805163919834b960e01b81526001600160a01b0390921660048301526024820152908190610ae19060448301906112c456fe60806040523615609157600080356001600160e01b0319168082527f806e0cbb9fce296bbc336a48f42bf1dbc69722d18d90d6fe705b7582c2bb4bd260205260408220546001600160a01b0316908115606f5750818091368280378136915af43d82803e15606b573d90f35b3d90fd5b630a82dd7360e31b6080526001600160e01b031916608452607f1960a4016080fd5b6005546001600160a01b0316330360a457005b63e7e601db60e01b60805260046080fdfea264697066735822122094f81fe232db95f27ca1a25d4333b51b304028373940fc13fc9ccd15b671bf0f64736f6c634300081700336e1540171b6c0c960b71a7020d9f60077f6af931a8bbf590da0223dacf75c7af806e0cbb9fce296bbc336a48f42bf1dbc69722d18d90d6fe705b7582c2bb4bd3806e0cbb9fce296bbc336a48f42bf1dbc69722d18d90d6fe705b7582c2bb4bd2";
    static readonly abi: readonly [{
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "address";
                readonly name: "facetAddress";
                readonly type: "address";
            }, {
                readonly internalType: "enum IDiamond.FacetCutAction";
                readonly name: "action";
                readonly type: "uint8";
            }, {
                readonly internalType: "bytes4[]";
                readonly name: "functionSelectors";
                readonly type: "bytes4[]";
            }];
            readonly internalType: "struct IDiamond.FacetCut[]";
            readonly name: "_diamondCut";
            readonly type: "tuple[]";
        }, {
            readonly components: readonly [{
                readonly internalType: "uint256";
                readonly name: "minActivationCollateral";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint64";
                readonly name: "minValidators";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint64";
                readonly name: "bottomUpCheckPeriod";
                readonly type: "uint64";
            }, {
                readonly internalType: "address";
                readonly name: "ipcGatewayAddr";
                readonly type: "address";
            }, {
                readonly internalType: "uint16";
                readonly name: "activeValidatorsLimit";
                readonly type: "uint16";
            }, {
                readonly internalType: "uint8";
                readonly name: "majorityPercentage";
                readonly type: "uint8";
            }, {
                readonly internalType: "enum ConsensusType";
                readonly name: "consensus";
                readonly type: "uint8";
            }, {
                readonly internalType: "int8";
                readonly name: "powerScale";
                readonly type: "int8";
            }, {
                readonly internalType: "enum PermissionMode";
                readonly name: "permissionMode";
                readonly type: "uint8";
            }, {
                readonly components: readonly [{
                    readonly internalType: "enum SupplyKind";
                    readonly name: "kind";
                    readonly type: "uint8";
                }, {
                    readonly internalType: "address";
                    readonly name: "tokenAddress";
                    readonly type: "address";
                }];
                readonly internalType: "struct SupplySource";
                readonly name: "supplySource";
                readonly type: "tuple";
            }, {
                readonly components: readonly [{
                    readonly internalType: "uint64";
                    readonly name: "root";
                    readonly type: "uint64";
                }, {
                    readonly internalType: "address[]";
                    readonly name: "route";
                    readonly type: "address[]";
                }];
                readonly internalType: "struct SubnetID";
                readonly name: "parentId";
                readonly type: "tuple";
            }];
            readonly internalType: "struct SubnetActorDiamond.ConstructorParams";
            readonly name: "params";
            readonly type: "tuple";
        }, {
            readonly internalType: "address";
            readonly name: "owner";
            readonly type: "address";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "constructor";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes4";
            readonly name: "_selector";
            readonly type: "bytes4";
        }];
        readonly name: "CannotAddFunctionToDiamondThatAlreadyExists";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes4[]";
            readonly name: "_selectors";
            readonly type: "bytes4[]";
        }];
        readonly name: "CannotAddSelectorsToZeroAddress";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes4";
            readonly name: "_selector";
            readonly type: "bytes4";
        }];
        readonly name: "CannotRemoveFunctionThatDoesNotExist";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes4";
            readonly name: "_selector";
            readonly type: "bytes4";
        }];
        readonly name: "CannotRemoveImmutableFunction";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes4";
            readonly name: "_selector";
            readonly type: "bytes4";
        }];
        readonly name: "CannotReplaceFunctionThatDoesNotExists";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes4";
            readonly name: "_selector";
            readonly type: "bytes4";
        }];
        readonly name: "CannotReplaceFunctionWithTheSameFunctionFromTheSameFacet";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes4[]";
            readonly name: "_selectors";
            readonly type: "bytes4[]";
        }];
        readonly name: "CannotReplaceFunctionsFromFacetWithZeroAddress";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes4";
            readonly name: "_selector";
            readonly type: "bytes4";
        }];
        readonly name: "CannotReplaceImmutableFunction";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes4";
            readonly name: "_functionSelector";
            readonly type: "bytes4";
        }];
        readonly name: "FunctionNotFound";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "GatewayCannotBeZero";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "enum IDiamond.FacetCutAction";
            readonly name: "_action";
            readonly type: "uint8";
        }];
        readonly name: "IncorrectFacetCutAction";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_initializationContractAddress";
            readonly type: "address";
        }, {
            readonly internalType: "bytes";
            readonly name: "_calldata";
            readonly type: "bytes";
        }];
        readonly name: "InitializationFunctionReverted";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "InvalidCollateral";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "InvalidERC20Address";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "InvalidMajorityPercentage";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "InvalidPowerScale";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "InvalidSubmissionPeriod";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_contractAddress";
            readonly type: "address";
        }, {
            readonly internalType: "string";
            readonly name: "_message";
            readonly type: "string";
        }];
        readonly name: "NoBytecodeAtAddress";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_facetAddress";
            readonly type: "address";
        }];
        readonly name: "NoSelectorsProvidedForFacetForCut";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "NotGateway";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_facetAddress";
            readonly type: "address";
        }];
        readonly name: "RemoveFacetAddressMustBeZeroAddress";
        readonly type: "error";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "address";
                readonly name: "facetAddress";
                readonly type: "address";
            }, {
                readonly internalType: "enum IDiamond.FacetCutAction";
                readonly name: "action";
                readonly type: "uint8";
            }, {
                readonly internalType: "bytes4[]";
                readonly name: "functionSelectors";
                readonly type: "bytes4[]";
            }];
            readonly indexed: false;
            readonly internalType: "struct IDiamond.FacetCut[]";
            readonly name: "_diamondCut";
            readonly type: "tuple[]";
        }, {
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "_init";
            readonly type: "address";
        }, {
            readonly indexed: false;
            readonly internalType: "bytes";
            readonly name: "_calldata";
            readonly type: "bytes";
        }];
        readonly name: "DiamondCut";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "oldOwner";
            readonly type: "address";
        }, {
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "newOwner";
            readonly type: "address";
        }];
        readonly name: "OwnershipTransferred";
        readonly type: "event";
    }, {
        readonly stateMutability: "payable";
        readonly type: "fallback";
    }, {
        readonly stateMutability: "payable";
        readonly type: "receive";
    }];
    static createInterface(): SubnetActorDiamondInterface;
    static connect(address: string, runner?: ContractRunner | null): SubnetActorDiamond;
}
export interface SubnetActorDiamondLibraryAddresses {
    ["src/lib/SubnetIDHelper.sol:SubnetIDHelper"]: string;
}
export {};
//# sourceMappingURL=SubnetActorDiamond__factory.d.ts.map