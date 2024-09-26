import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../common";
import type { CrossMsgHelper, CrossMsgHelperInterface } from "../../../src/lib/CrossMsgHelper";
type CrossMsgHelperConstructorParams = [linkLibraryAddresses: CrossMsgHelperLibraryAddresses, signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class CrossMsgHelper__factory extends ContractFactory {
    constructor(...args: CrossMsgHelperConstructorParams);
    static linkBytecode(linkLibraryAddresses: CrossMsgHelperLibraryAddresses): string;
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<CrossMsgHelper & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): CrossMsgHelper__factory;
    static readonly bytecode = "0x6080806040523461001c57611b5a90816100228239308160aa0152f35b600080fdfe6080604052600436101561001257600080fd5b60003560e01c80630cb89862146100a75780631860845e146100a25780635404605f1461009d578063855f7e451461009857806399aa0eb4146100935780639b7df85a1461008e5780639b814ea014610089578063dd1fcec7146100845763f43cec671461007f57600080fd5b610b78565b610a80565b6109fe565b6108c9565b6107e9565b610787565b610728565b610445565b307f000000000000000000000000000000000000000000000000000000000000000003610228575b600080fd5b908160c09103126100cf5790565b634e487b7160e01b600052604160045260246000fd5b604081019081106001600160401b0382111761011357604052565b6100e2565b60c081019081106001600160401b0382111761011357604052565b606081019081106001600160401b0382111761011357604052565b602081019081106001600160401b0382111761011357604052565b90601f801991011681019081106001600160401b0382111761011357604052565b6040519061019782610133565b565b6040519061019782610118565b60405190610197826100f8565b6001600160a01b038116036100cf57565b60005b8381106101d75750506000910152565b81810151838201526020016101c7565b90602091610200815180928185528580860191016101c4565b601f01601f1916010190565b60409061022593921515815281602082015201906101e7565b90565b60603660031901126100cf576004356001600160401b0381116100cf576102539036906004016100d4565b60403660231901126100cf5760405161026b816100f8565b6024359160028310156100cf5761029492825260443561028a816101b3565b6020830152610e6c565b906102a46040519283928361020c565b0390f35b908160409103126100cf5790565b60806003198201126100cf576001600160401b03916004358381116100cf57826102e2916004016102a8565b926024356102ef816101b3565b926044359182116100cf57610306916004016102a8565b9060643590565b634e487b7160e01b600052602160045260246000fd5b6003111561032d57565b61030d565b604082016001600160401b0382511683526020606081809401519460408382015285518094520193019160005b82811061036d575050505090565b83516001600160a01b03168552938101939281019260010161035f565b6040602061022593816103a4855185845285840190610332565b940151908281860391015260ff815116845201519181602082015201906101e7565b90610225916020815281516103da81610323565b60208201526103f8602083015160c0604084015260e083019061038a565b9060c060a0610419604086015194601f19958686830301606087015261038a565b946001600160401b036060820151166080850152608081015182850152015192828503019101526101e7565b61046e6104ae6000610494610459366102b6565b94929391610468979197610fbc565b5061190a565b926040519361047c856100f8565b6104863683610570565b855260208501523690610570565b604051809581926308c7427760e11b8352600483016110c3565b038173__$a0fe38a9a81205afccc10810b09a4d3f45$__5af4908115610538576102a4946105039460009361050f575b506104f990604051936104f0856100f8565b84523690610687565b60208301526110e0565b604051918291826103c6565b6104f9919350610531903d806000833e6105298183610169565b810190611008565b92906104de565b6110d4565b6001600160401b038116036100cf57565b35906101978261053d565b6001600160401b0381116101135760051b60200190565b91906040838203126100cf5760405192610589846100f8565b8381356105958161053d565b815260209182810135906001600160401b0382116100cf57019280601f850112156100cf5783356105c581610559565b946105d36040519687610169565b818652848087019260051b8201019283116100cf5784809101915b8383106105fd57505050500152565b8190833561060a816101b3565b81520191019084906105ee565b359060ff821682036100cf57565b6001600160401b03811161011357601f01601f191660200190565b81601f820112156100cf5780359061065782610625565b926106656040519485610169565b828452602083830101116100cf57816000926020809301838601378301015290565b91906040838203126100cf57604051906106a0826100f8565b81936106ab81610617565b83526020810135916001600160401b0383116100cf576020926106ce9201610640565b910152565b91906040838203126100cf57604051906106ec826100f8565b81938035916001600160401b03928381116100cf578161070d918401610570565b845260208201359283116100cf576020926106ce9201610687565b60603660031901126100cf576001600160401b036004358181116100cf576107549036906004016106d3565b906024359081116100cf576102a4916107746105039236906004016106d3565b604435916110e0565b6002111561032d57565b60403660031901126100cf576001600160401b036004358181116100cf576107b39036906004016100d4565b906024359081116100cf576020916107d26107d89236906004016102a8565b90611168565b604051906107e58161077d565b8152f35b6108296107f5366102b6565b9161080294939194610fbc565b50600061080f3684610570565b604051809681926308c7427760e11b8352600483016110c3565b038173__$a0fe38a9a81205afccc10810b09a4d3f45$__5af48015610538576102a49561050395600092610891575b506108666104f9929361190a565b60405193610873856100f8565b845260208401526104f06040519461088a866100f8565b3690610570565b6104f992506108ad610866913d806000833e6105298183610169565b9250610858565b600311156100cf57565b3590610197826108b4565b60603660031901126100cf576001600160401b036004358181116100cf576108f59036906004016100d4565b60243591610902836108b4565b6044359081116100cf576102a4926109216109a2923690600401610640565b9261092a610fbc565b5061093d6109383683610add565b6119c2565b9361094661018a565b94855261095683602087016112eb565b604085015260808101359161096a81610323565b156109f5575b806109b061099261098760206109d3950184610c28565b926040810190610c28565b95604051958691602083016112f7565b03601f198101865285610169565b6109c76109bb610199565b600281529536906106d3565b602086015236906106d3565b604084015260006060840152608083015260a0820152604051918291826103c6565b60009150610970565b60a03660031901126100cf576001600160401b036004358181116100cf57610a2a9036906004016106d3565b906024358181116100cf57610a439036906004016106d3565b6064356001600160e01b0319811681036100cf576084359283116100cf576102a493610a76610503943690600401610640565b926044359161132c565b60203660031901126100cf576001600160401b036004358181116100cf57366023820112156100cf5780600401359182116100cf573660248360051b830101116100cf576020916024610ad392016113ce565b6040519015158152f35b91909160c0818403126100cf57610af2610199565b92610afc826108be565b84526001600160401b0360208301358181116100cf5782610b1e9185016106d3565b602086015260408301358181116100cf5782610b3b9185016106d3565b6040860152610b4c6060840161054e565b60608601526080830135608086015260a08301359081116100cf57610b719201610640565b60a0830152565b6020806003193601126100cf576001600160401b03906004358281116100cf57366023820112156100cf5760246004820135610bb381610559565b94610bc16040519687610169565b8186526024602087019260051b850101933685116100cf5760248101925b858410610c02576102a4610bf289611530565b6040519081529081906020820190565b83358381116100cf578791610c1d8392883691870101610add565b815201930192610bdf565b903590603e19813603018212156100cf570190565b610225903690610687565b35610225816108b4565b9035603e19823603018112156100cf570190565b9035601e19823603018112156100cf5701602081359101916001600160401b0382116100cf5781360383136100cf57565b908060209392818452848401376000828201840152601f01601f1916010190565b906040610cda6102259360ff610ccd82610617565b1684526020810190610c66565b9190928160208201520191610c97565b919091610cf78180610c52565b604084526080840193813592610d0c8461053d565b6001600160401b03809416604083015260209283810135601e19823603018112156100cf57019583873597019487116100cf578660051b360385136100cf578690604060608501525260a08201936000965b808810610d865750506102259495508083610d7a920190610c52565b91818403910152610cb8565b909484806001928835610d98816101b3565b848060a01b0316815201960197019690610d5e565b9060c061022592602081528235610dc3816108b4565b610dcc81610323565b6020820152610df1610de16020850185610c52565b83604084015260e0830190610cea565b90610e4a610e19610e056040870187610c52565b93601f199485858303016060860152610cea565b946001600160401b036060820135610e308161053d565b166080840152608081013560a084015260a0810190610c66565b93909282860301910152610c97565b60405190610e668261014e565b60008252565b610e7e610e793683610add565b6115b2565b610f6e57610eb4610eaf610eaa610ea5610e9b6020860186610c28565b6020810190610c28565b610c3d565b61168d565b611725565b90610ebe81610c48565b610ec781610323565b610ee957610ee592608090910135916001600160a01b03169061185f565b9091565b6001610ef482610c48565b610efd81610323565b148015610f53575b610f1957505050610f14610e59565b600091565b610ee592608060405192632a52428160e21b6020850152610f41846109a28360248301610dad565b0135926001600160a01b03169061177d565b506002610f5f82610c48565b610f6881610323565b14610f05565b604051630c2f41e760e41b8152600490fd5b60405190610f8d826100f8565b6060602083600081520152565b60405190610fa7826100f8565b81610fb0610f80565b815260206106ce610f80565b60405190610fc982610118565b606060a08360008152610fda610f9a565b6020820152610fe7610f9a565b6040820152600083820152600060808201520152565b610225903690610570565b90602080838303126100cf5782516001600160401b03938482116100cf5701926040848403126100cf576040519361103f856100f8565b805161104a8161053d565b8552828101519182116100cf57019180601f840112156100cf57825161106f81610559565b9361107d6040519586610169565b818552838086019260051b8201019283116100cf5783809101915b8383106110a9575050505082015290565b819083516110b6816101b3565b8152019101908390611098565b906020610225928181520190610332565b6040513d6000823e3d90fd5b90916110ea610fbc565b50604051916110f88361014e565b600083526040519361110985610118565b600085526020850152604084015260006060840152608083015260a082015290565b909161114261022593604084526040840190610332565b916020818403910152610332565b908160209103126100cf575180151581036100cf5790565b9060206111a761119f61118f61118961119461118f611189878a018a610c28565b80610c28565b610ffd565b966040810190610c28565b923690610570565b9173__$a0fe38a9a81205afccc10810b09a4d3f45$__84604051631ccc893360e11b9586825281806111e060009a8b946004840161112b565b0381865af49182156105385761120e96889283946112cf575b5060405197889283928352876004840161112b565b0381855af49485156105385786956112ab575b508461124592859260405180958194829363c836244d60e01b84526004840161112b565b03915af490811561053857859161127e575b50611263575b50505090565b8101515191015151106112785738808061125d565b50600190565b61129e9150833d85116112a4575b6112968183610169565b810190611150565b38611257565b503d61128c565b611245929550906112c685923d808a833e6105298183610169565b95925090611221565b6112e49194503d8085833e6105298183610169565b92386111f9565b6112f482610323565b52565b60806040610225936020845280516020850152602081015161131881610323565b8285015201519160608082015201906101e7565b90936113a56113929461133d610fbc565b506109a260409384519263ffffffff60e01b16602084015260048352611362836100f8565b84519261136e846100f8565b835260208301908152845197889360208086015251868086015260808501906101e7565b9051838203603f190160608501526101e7565b6113ad610199565b6001815294602086015284015260006060840152608083015260a082015290565b600090815b8383106113e35750505050600190565b8260051b82013560be19833603018112156100cf5760606001600160401b0391840101356114108161053d565b1680911015611425575b6001909201916113d3565b821561141a5750505050600090565b91908251906040815260808101936001600160401b038351166040830152602080930151946040606084015285518091528360a0840196019060005b8181106114a4575050509360408381938161022597980151908281860391015260ff815116845201519382015201906101e7565b82516001600160a01b031688529685019691850191600101611470565b6102259181516114d081610323565b815260a06115026114f0602085015160c0602086015260c0850190611434565b60408501518482036040860152611434565b926001600160401b0360608201511660608401526080810151608084015201519060a08184039101526101e7565b6040516020816020810193604082016020865281518091526060830193602060608360051b8601019301946000905b838210611583575050505061157d925003601f198101835282610169565b51902090565b91600191939550806115a08196605f198b820301865289516114c1565b9701920192018694929593919561155f565b80516115bd81610323565b6115c681610323565b156115d45760a00151511590565b608001511590565b90602080838303126100cf5782516001600160401b03938482116100cf5701926060848403126100cf576040519361161385610133565b805161161e8161053d565b8552828101516001600160801b03811681036100cf578386015260408101519182116100cf570182601f820112156100cf5780519061165c82610625565b9361166a6040519586610169565b8285528383830101116100cf578261168593850191016101c4565b604082015290565b600460ff61169c835160ff1690565b16036117135760206116b9910151602080825183010191016115dc565b600a6001600160401b036116d483516001600160401b031690565b16036117135760146001600160801b036116f860208401516001600160801b031690565b16036117135760400160148151510361171357516014015190565b60405163c5f8961f60e01b8152600490fd5b60008073ffffffffffffffffffffffff0000000000000000831660ff60981b1461176a575b1561176657611758906119df565b90611761575090565b905090565b5090565b50506001600160401b038116600161174a565b93929190600060609584156118455780516117978161077d565b6117a08161077d565b6117bb5750939450610ee593506001600160a01b0316611a89565b91600183959295516117cc8161077d565b6117d58161077d565b146117e3575b505050509190565b9295506001600160a01b0390921692506117ff91908390611aa9565b939093918461182d575b5050821561181b5791388080806117db565b8051908161182857600080fd5b602001fd5b90915061183b929350611a71565b9190913880611809565b50939450610ee593509091506001600160a01b0316611a71565b60009060609080516118708161077d565b6118798161077d565b6118cc575050508147106118ba576000918291829182916001600160a01b03165af1906118a4611a41565b50604051916118b28361014e565b600083529190565b60405163569d45cf60e11b8152600490fd5b9093919492600182516118de8161077d565b6118e78161077d565b146118f157505050565b929450610ee5935090916001600160a01b031690611aa9565b6119ad6001600160401b039161191e610f80565b50604051906bffffffffffffffffffffffff199060601b16602082015260148152611948816100f8565b61199f6040519161195883610133565b600a83526001600160801b036020840160148152604085019283526040519687956020808801525116604086015251166060840152516060608084015260a08301906101e7565b03601f198101835282610169565b6119b56101a6565b6004815290602082015290565b60405161157d8161199f60208201946020865260408301906114c1565b60009081526016600a6020836002607f60991b015afa9181519161040a8360018060a01b03169360a01c61ffff1603611a35575b83158015611a2a575b611a235750565b9250829150565b5060163d1415611a1c565b60009350915081611a13565b3d15611a6c573d90611a5282610625565b91611a606040519384610169565b82523d6000602084013e565b606090565b600091829182602083519301915af190610225611a41565b91908147106118ba576000928392602083519301915af190610225611a41565b9160206000809493819460018060a01b0393849101511693604051936020850192168252604084015260408352611adf83610133565b611b1760246040518093611b07602083019763a9059cbb60e01b8952518092858501906101c4565b8101036004810184520182610169565b51925af190610225611a4156fea2646970667358221220ebcc1e9c399d4218719408e054e1ca1e6714ab8ac6b34b7f4643ae2a848e144f64736f6c63430008170033";
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "CannotExecuteEmptyEnvelope";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "NotDelegatedEvmAddress";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "NotEnoughBalance";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "enum IpcMsgKind";
                readonly name: "kind";
                readonly type: "IpcMsgKind";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "to";
                readonly type: "tuple";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "from";
                readonly type: "tuple";
            }, {
                readonly internalType: "uint64";
                readonly name: "nonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint256";
                readonly name: "value";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes";
                readonly name: "message";
                readonly type: "bytes";
            }];
            readonly internalType: "struct IpcEnvelope";
            readonly name: "message";
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
            readonly name: "currentSubnet";
            readonly type: "tuple";
        }];
        readonly name: "applyType";
        readonly outputs: readonly [{
            readonly internalType: "enum IPCMsgType";
            readonly name: "";
            readonly type: "IPCMsgType";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly components: readonly [{
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
                readonly name: "subnetId";
                readonly type: "tuple";
            }, {
                readonly components: readonly [{
                    readonly internalType: "uint8";
                    readonly name: "addrType";
                    readonly type: "uint8";
                }, {
                    readonly internalType: "bytes";
                    readonly name: "payload";
                    readonly type: "bytes";
                }];
                readonly internalType: "struct FvmAddress";
                readonly name: "rawAddress";
                readonly type: "tuple";
            }];
            readonly internalType: "struct IPCAddress";
            readonly name: "from";
            readonly type: "tuple";
        }, {
            readonly components: readonly [{
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
                readonly name: "subnetId";
                readonly type: "tuple";
            }, {
                readonly components: readonly [{
                    readonly internalType: "uint8";
                    readonly name: "addrType";
                    readonly type: "uint8";
                }, {
                    readonly internalType: "bytes";
                    readonly name: "payload";
                    readonly type: "bytes";
                }];
                readonly internalType: "struct FvmAddress";
                readonly name: "rawAddress";
                readonly type: "tuple";
            }];
            readonly internalType: "struct IPCAddress";
            readonly name: "to";
            readonly type: "tuple";
        }, {
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }, {
            readonly internalType: "bytes4";
            readonly name: "method";
            readonly type: "bytes4";
        }, {
            readonly internalType: "bytes";
            readonly name: "params";
            readonly type: "bytes";
        }];
        readonly name: "createCallMsg";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "enum IpcMsgKind";
                readonly name: "kind";
                readonly type: "IpcMsgKind";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "to";
                readonly type: "tuple";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "from";
                readonly type: "tuple";
            }, {
                readonly internalType: "uint64";
                readonly name: "nonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint256";
                readonly name: "value";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes";
                readonly name: "message";
                readonly type: "bytes";
            }];
            readonly internalType: "struct IpcEnvelope";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
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
            readonly name: "subnet";
            readonly type: "tuple";
        }, {
            readonly internalType: "address";
            readonly name: "signer";
            readonly type: "address";
        }, {
            readonly components: readonly [{
                readonly internalType: "uint8";
                readonly name: "addrType";
                readonly type: "uint8";
            }, {
                readonly internalType: "bytes";
                readonly name: "payload";
                readonly type: "bytes";
            }];
            readonly internalType: "struct FvmAddress";
            readonly name: "to";
            readonly type: "tuple";
        }, {
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }];
        readonly name: "createFundMsg";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "enum IpcMsgKind";
                readonly name: "kind";
                readonly type: "IpcMsgKind";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "to";
                readonly type: "tuple";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "from";
                readonly type: "tuple";
            }, {
                readonly internalType: "uint64";
                readonly name: "nonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint256";
                readonly name: "value";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes";
                readonly name: "message";
                readonly type: "bytes";
            }];
            readonly internalType: "struct IpcEnvelope";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
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
            readonly name: "subnet";
            readonly type: "tuple";
        }, {
            readonly internalType: "address";
            readonly name: "signer";
            readonly type: "address";
        }, {
            readonly components: readonly [{
                readonly internalType: "uint8";
                readonly name: "addrType";
                readonly type: "uint8";
            }, {
                readonly internalType: "bytes";
                readonly name: "payload";
                readonly type: "bytes";
            }];
            readonly internalType: "struct FvmAddress";
            readonly name: "to";
            readonly type: "tuple";
        }, {
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }];
        readonly name: "createReleaseMsg";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "enum IpcMsgKind";
                readonly name: "kind";
                readonly type: "IpcMsgKind";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "to";
                readonly type: "tuple";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "from";
                readonly type: "tuple";
            }, {
                readonly internalType: "uint64";
                readonly name: "nonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint256";
                readonly name: "value";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes";
                readonly name: "message";
                readonly type: "bytes";
            }];
            readonly internalType: "struct IpcEnvelope";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "enum IpcMsgKind";
                readonly name: "kind";
                readonly type: "IpcMsgKind";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "to";
                readonly type: "tuple";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "from";
                readonly type: "tuple";
            }, {
                readonly internalType: "uint64";
                readonly name: "nonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint256";
                readonly name: "value";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes";
                readonly name: "message";
                readonly type: "bytes";
            }];
            readonly internalType: "struct IpcEnvelope";
            readonly name: "crossMsg";
            readonly type: "tuple";
        }, {
            readonly internalType: "enum OutcomeType";
            readonly name: "outcome";
            readonly type: "OutcomeType";
        }, {
            readonly internalType: "bytes";
            readonly name: "ret";
            readonly type: "bytes";
        }];
        readonly name: "createResultMsg";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "enum IpcMsgKind";
                readonly name: "kind";
                readonly type: "IpcMsgKind";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "to";
                readonly type: "tuple";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "from";
                readonly type: "tuple";
            }, {
                readonly internalType: "uint64";
                readonly name: "nonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint256";
                readonly name: "value";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes";
                readonly name: "message";
                readonly type: "bytes";
            }];
            readonly internalType: "struct IpcEnvelope";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly components: readonly [{
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
                readonly name: "subnetId";
                readonly type: "tuple";
            }, {
                readonly components: readonly [{
                    readonly internalType: "uint8";
                    readonly name: "addrType";
                    readonly type: "uint8";
                }, {
                    readonly internalType: "bytes";
                    readonly name: "payload";
                    readonly type: "bytes";
                }];
                readonly internalType: "struct FvmAddress";
                readonly name: "rawAddress";
                readonly type: "tuple";
            }];
            readonly internalType: "struct IPCAddress";
            readonly name: "from";
            readonly type: "tuple";
        }, {
            readonly components: readonly [{
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
                readonly name: "subnetId";
                readonly type: "tuple";
            }, {
                readonly components: readonly [{
                    readonly internalType: "uint8";
                    readonly name: "addrType";
                    readonly type: "uint8";
                }, {
                    readonly internalType: "bytes";
                    readonly name: "payload";
                    readonly type: "bytes";
                }];
                readonly internalType: "struct FvmAddress";
                readonly name: "rawAddress";
                readonly type: "tuple";
            }];
            readonly internalType: "struct IPCAddress";
            readonly name: "to";
            readonly type: "tuple";
        }, {
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }];
        readonly name: "createTransferMsg";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "enum IpcMsgKind";
                readonly name: "kind";
                readonly type: "IpcMsgKind";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "to";
                readonly type: "tuple";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "from";
                readonly type: "tuple";
            }, {
                readonly internalType: "uint64";
                readonly name: "nonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint256";
                readonly name: "value";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes";
                readonly name: "message";
                readonly type: "bytes";
            }];
            readonly internalType: "struct IpcEnvelope";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "enum IpcMsgKind";
                readonly name: "kind";
                readonly type: "IpcMsgKind";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "to";
                readonly type: "tuple";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "from";
                readonly type: "tuple";
            }, {
                readonly internalType: "uint64";
                readonly name: "nonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint256";
                readonly name: "value";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes";
                readonly name: "message";
                readonly type: "bytes";
            }];
            readonly internalType: "struct IpcEnvelope[]";
            readonly name: "crossMsgs";
            readonly type: "tuple[]";
        }];
        readonly name: "isSorted";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "enum IpcMsgKind";
                readonly name: "kind";
                readonly type: "IpcMsgKind";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "to";
                readonly type: "tuple";
            }, {
                readonly components: readonly [{
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
                    readonly name: "subnetId";
                    readonly type: "tuple";
                }, {
                    readonly components: readonly [{
                        readonly internalType: "uint8";
                        readonly name: "addrType";
                        readonly type: "uint8";
                    }, {
                        readonly internalType: "bytes";
                        readonly name: "payload";
                        readonly type: "bytes";
                    }];
                    readonly internalType: "struct FvmAddress";
                    readonly name: "rawAddress";
                    readonly type: "tuple";
                }];
                readonly internalType: "struct IPCAddress";
                readonly name: "from";
                readonly type: "tuple";
            }, {
                readonly internalType: "uint64";
                readonly name: "nonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint256";
                readonly name: "value";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes";
                readonly name: "message";
                readonly type: "bytes";
            }];
            readonly internalType: "struct IpcEnvelope[]";
            readonly name: "crossMsgs";
            readonly type: "tuple[]";
        }];
        readonly name: "toHash";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }];
    static createInterface(): CrossMsgHelperInterface;
    static connect(address: string, runner?: ContractRunner | null): CrossMsgHelper;
}
export interface CrossMsgHelperLibraryAddresses {
    ["src/lib/SubnetIDHelper.sol:SubnetIDHelper"]: string;
}
export {};
//# sourceMappingURL=CrossMsgHelper__factory.d.ts.map