import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../common";
import type { GatewayGetterFacet, GatewayGetterFacetInterface } from "../../../src/gateway/GatewayGetterFacet";
type GatewayGetterFacetConstructorParams = [linkLibraryAddresses: GatewayGetterFacetLibraryAddresses, signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class GatewayGetterFacet__factory extends ContractFactory {
    constructor(...args: GatewayGetterFacetConstructorParams);
    static linkBytecode(linkLibraryAddresses: GatewayGetterFacetLibraryAddresses): string;
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<GatewayGetterFacet & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): GatewayGetterFacet__factory;
    static readonly bytecode = "0x6080806040523461001657611e25908161001c8239f35b600080fdfe6080604052600436101561001257600080fd5b60003560e01c806302e30f9a146112ca5780630338150f1461128157806305aff0b31461126057806306572c1a1461123157806306c46853146112135780632da5794a146111835780633594c3c1146110cd57806338d66932146110b757806341b6a2e81461109057806342398a9a1461105d578063444ead511461103f5780634aa8f8a514611021578063544dddff14610ffa578063599c7bd114610fd95780635d02968514610eb55780636ad21bb014610dd65780637edeac9214610d855780638789f83b14610d5b5780638cfd78e714610cde57806394074b0314610c1c5780639704276614610abf5780639d3070b514610a7a578063a2b6715814610a50578063a517218f146109f2578063ac12d76314610950578063b1ba49b014610929578063b3ab3f74146108fa578063c66c66a1146108a7578063ca41d5ce146104d1578063d6c5c39714610351578063dd81b5cf1461029f578063f3229131146101bc5763fa34a4001461018757600080fd5b346101b75760003660031901126101b75760406013546001600160401b038251918181168352831c166020820152f35b600080fd5b346101b75760003660031901126101b7576101d5611b5c565b506040516101e28161169c565b600954906101ef826116d8565b916101fd60405193846116b7565b8083526009600090815260207f6e1540171b6c0c960b71a7020d9f60077f6af931a8bbf590da0223dacf75c7af8186015b84841061025b57868652600a546001600160401b031660208701526040518061025788826115a8565b0390f35b60038360019260405161026d81611681565b85548152848060a01b0385870154168382015261028c600287016118f7565b604082015281520192019301929061022e565b346101b7576020806003193601126101b75760609081604080516102c281611681565b6102ca611798565b81526000848201520152600435600052602381526102576040600020604051926102f384611681565b6102fc826117ef565b8452610338610318600360028501549484880195865201611a7e565b916040860192835260405196879682885251918701526080860190611313565b9151604085015251838203601f190160608501526114c9565b346101b75760003660031901126101b75761036a6118c3565b506103736118c3565b506001546001600160401b039080156104bb57808243160490600182018092116104a5576103a091611bd0565b80600052610416602092602284526103f460056040600020604051936103c58561164b565b6103ce826117ef565b855260028201548886015260038201546040860152600482015416606085015201611a7e565b608082015283815160405180948192630c133d1360e31b835260048301611be3565b038173__$a0fe38a9a81205afccc10810b09a4d3f45$__5af491821561049957600092610461575b506102579192604051948594158552840152606060408401526060830190611526565b91508382813d8311610492575b61047881836116b7565b810103126101b75761048c61025792611bc3565b9161043e565b503d61046e565b6040513d6000823e3d90fd5b634e487b7160e01b600052601160045260246000fd5b634e487b7160e01b600052601260045260246000fd5b346101b75760203660031901126101b7576004356104ed6118c3565b506104f6611b98565b508060005260226020526040600020906105506005604051936105188561164b565b610521816117ef565b855260028101546020860152600381015460408601526001600160401b03600482015416606086015201611a7e565b6080830152604051906308a6ad2560e01b8252600b6004830152602482015260008160448173__$dd40c2ca5826d197ed7e2b6aae8146ec7b$__5af49081156104995760008091600093610698575b50906105be9392916105f3604051958695610100808852870190611526565b916020860190608080918051845260208101516020850152604081015160408501526060810151606085015201511515910152565b83810360c08501526020808351928381520192019060005b8181106106765750505082810360e0840152815180825260208201916020808360051b8301019401926000915b8383106106455786860387f35b919395509193602080610664600193601f1986820301875289516113e2565b97019301930190928695949293610638565b82516001600160a01b031684528695506020938401939092019160010161060b565b925050503d806000833e6106ac81836116b7565b818181010360e081126101b75760a0136101b7576040516106cc8161164b565b825181526020830151602082015260408301516040820152606083015160608201526106fa60808401611bc3565b608082015260a08301516001600160401b0381116101b757830192828101601f850112156101b757835161072d816116d8565b9461073b60405196876116b7565b81865260208087019260051b8201019085840182116101b757602001915b8183106108875750505060c08101516001600160401b0381116101b757838201601f8284010112156101b7578082015190610793826116d8565b946107a160405196876116b7565b828652602086019080850160208560051b8588010101116101b757602083860101915b60208560051b858801010183106107e4575050505050509190918461059f565b82516001600160401b0381116101b757828701603f82878a01010112156101b7576020818689010101516001600160401b0381116108715760405192610834601f8301601f1916602001856116b7565b818452848901604083858a8d01010101116101b75783610864602095938b604088978c89809901930101016113bf565b81520193019290506107c4565b634e487b7160e01b600052604160045260246000fd5b82516001600160a01b03811681036101b757815260209283019201610759565b346101b7576108db6108d36108ce6108be36611577565b6108c66117b2565b5036906116ef565b611c42565b919091611870565b906102576040519283921515835260406020840152604083019061136b565b346101b75760203660031901126101b757600435600052600d6020526020600360406000200154604051908152f35b346101b75760003660031901126101b75760206001600160401b03600a5416604051908152f35b346101b75760203660031901126101b757610969611b98565b50600435600052600d60205260a0604060002060ff60046040519261098d8461164b565b80548452600181015460208501526002810154604085015260038101546060850152015416151560808201526109f06040518092608080918051845260208101516020850152604081015160408501526060810151606085015201511515910152565bf35b346101b75760003660031901126101b757610a0b611d81565b6040518091602080830160208452825180915260206040850193019160005b828110610a3957505050500390f35b835185528695509381019392810192600101610a2a565b346101b75760003660031901126101b75760206001600160401b0360035460801c16604051908152f35b346101b75760203660031901126101b7576004356001600160401b038082116101b7576003610ab26108ce60209436906004016116ef565b9050015416604051908152f35b346101b75760003660031901126101b757610ad8611d81565b805190610ae4826116d8565b610af160405191826116b7565b828152610afd836116d8565b60209390601f19018460005b828110610c065750505060005b6001600160401b039081811683811015610ba85790610ba082610b3b60019489611b32565b51600052602289526040600020610b8a600560405192610b5a8461164b565b610b63816117ef565b845260028101548d8501526003810154604085015288600482015416606085015201611a7e565b6080820152610b998289611b32565b5286611b32565b500116610b16565b604080518881528651818a01819052600092600582901b8301810191898c01918c9085015b828710610bda5785850386f35b909192938280610bf6600193603f198a82030186528851611526565b9601920196019592919092610bcd565b610c0e6118c3565b828287010152018590610b09565b346101b75760003660031901126101b757610c35611798565b50604051610c428161169c565b6001600160401b0360125416815260405190816013549283815260208091019360136000527f66de8ffda797e3de9c05e8fc57b3bf0ec28a930d40b0d285d93c06501cf6a090916000905b828210610cbe576102578686610ca5818b03826116b7565b6020820152604051918291602083526020830190611313565b83546001600160a01b031687529586019560019384019390910190610c8d565b346101b75760203660031901126101b757606060a0604051610cff81611666565b60008152610d0b611b76565b6020820152610d18611b76565b60408201526000838201526000608082015201526004356000526021602052610257610d476040600020611a10565b604051918291602083526020830190611443565b346101b75760003660031901126101b75760206001600160401b0360035460401c16604051908152f35b346101b75760203660031901126101b75760006020604051610da68161169c565b8281520152610257610db9600435611d43565b604051918291829190916020806040830194805184520151910152565b346101b75760003660031901126101b757610def611b5c565b50604051610dfc8161169c565b60075490610e09826116d8565b91610e1760405193846116b7565b8083526007600090815260207fa66cc928b5edb82af9bd49922954155ab7b0942694bea4ce44661d9a8736c6888186015b848410610e71578686526008546001600160401b031660208701526040518061025788826115a8565b600383600192604051610e8381611681565b85548152848060a01b03858701541683820152610ea2600287016118f7565b6040820152815201920193019290610e48565b346101b75760003660031901126101b757602454610ed2816116d8565b610edf60405191826116b7565b818152610eeb826116d8565b60209290601f19018360005b828110610fc35750505060005b818110610f6c5750506040519082820192808352815180945260408301938160408260051b8601019301916000955b828710610f405785850386f35b909192938280610f5c600193603f198a8203018652885161136b565b9601920196019592919092610f33565b806001917f7cd332d19b93bcabe3cce7ca0c18a052f57e5fd03b4758a09f30f5ddc4b22ec40154600052601f8552610fa76040600020611870565b610fb18286611b32565b52610fbc8185611b32565b5001610f04565b610fcb6117b2565b828287010152018490610ef7565b346101b75760003660031901126101b757602060ff60045416604051908152f35b346101b75760003660031901126101b75760206001600160401b0360085416604051908152f35b346101b75760003660031901126101b7576020600c54604051908152f35b346101b75760003660031901126101b7576020600554604051908152f35b346101b75761107361106e36611577565b611b09565b6040805192151583526001600160401b0391909116602083015290f35b346101b75760003660031901126101b75760206001600160401b0360035416604051908152f35b346101b7576110736110c836611577565b611ad4565b346101b75760003660031901126101b757604051806024548083526020809301809160246000527f7cd332d19b93bcabe3cce7ca0c18a052f57e5fd03b4758a09f30f5ddc4b22ec49060005b8682821061116f57868661112f828803836116b7565b604051928392818401908285525180915260408401929160005b82811061115857505050500390f35b835185528695509381019392810192600101611149565b835485529093019260019283019201611119565b346101b75760203660031901126101b75761119c6118c3565b50600435600052602260205261025760406000206111fa6005604051926111c28461164b565b6111cb816117ef565b845260028101546020850152600381015460408501526001600160401b03600482015416606085015201611a7e565b6080820152604051918291602083526020830190611526565b346101b75760003660031901126101b7576020600154604051908152f35b346101b75760203660031901126101b7576020606461125760ff60045416600435611bd0565b04604051908152f35b346101b75760003660031901126101b757602060035460c01c604051908152f35b346101b75760003660031901126101b757600060206040516112a28161169c565b8281520152600060206040516112b78161169c565b8281520152610257610db9600054611d43565b346101b75760203660031901126101b7576112e36117b2565b50600435600052601f6020526102576112ff6040600020611870565b60405191829160208352602083019061136b565b604082016001600160401b0382511683526020606081809401519460408382015285518094520193019160005b82811061134e575050505090565b83516001600160a01b031685529381019392810192600101611340565b9060c060a06113bc9380518452602081015160208501526040810151604085015260608101516001600160401b03809116606086015260808201511660808501520151918160a08201520190611313565b90565b60005b8381106113d25750506000910152565b81810151838201526020016113c2565b906020916113fb815180928185528580860191016113bf565b601f01601f1916010190565b604060206113bc9381611421855185845285840190611313565b940151908281860391015260ff815116845201519181602082015201906113e2565b80519160038310156114b3576113bc92815260a0611485611473602085015160c0602086015260c0850190611407565b60408501518482036040860152611407565b926001600160401b0360608201511660608401526080810151608084015201519060a08184039101526113e2565b634e487b7160e01b600052602160045260246000fd5b90808251908181526020809101926020808460051b8301019501936000915b8483106114f85750505050505090565b9091929394958480611516600193601f198682030187528a51611443565b98019301930191949392906114e8565b6113bc91608061153f835160a0845260a0840190611313565b9260208101516020840152604081015160408401526001600160401b03606082015116606084015201519060808184039101526114c9565b600319906020818301126101b757600435916001600160401b0383116101b757826040920301126101b75760040190565b602080825260609260608301938151946040916040858701528651809252608086018560808460051b8901019801936000925b8484106115fd575050505050506040916001600160401b039101511691015290565b909192939498878061163b60019385878f8f607f19908503018b525180518452878060a01b03868201511686850152015191818982015201906113e2565b9b019401940192949391906115db565b60a081019081106001600160401b0382111761087157604052565b60c081019081106001600160401b0382111761087157604052565b606081019081106001600160401b0382111761087157604052565b604081019081106001600160401b0382111761087157604052565b90601f801991011681019081106001600160401b0382111761087157604052565b6001600160401b0381116108715760051b60200190565b91906040838203126101b757604051926117088461169c565b836001600160401b03823581811681036101b7578252602092838101359182116101b757019280601f850112156101b7578335611744816116d8565b9461175260405196876116b7565b818652848087019260051b8201019283116101b7578401905b828210611779575050500152565b81356001600160a01b03811681036101b757815290840190840161176b565b604051906117a58261169c565b6060602083600081520152565b604051906117bf82611666565b81600081526000602082015260006040820152600060608201526000608082015260a06117ea611798565b910152565b90604051916117fd8361169c565b826001600160401b0382541681526001809201916040519283849282548083526020809301936000526020600020926000905b82821061184f5750505050506020929161184b9103846116b7565b0152565b84546001600160a01b03168652889650948501949383019390830190611830565b9060405161187d81611666565b60a06117ea6004839580548552600181015460208601526002810154604086015260038101546001600160401b0390818116606088015260401c166080860152016117ef565b604051906118d08261164b565b60606080836118dd611798565b815260006020820152600060408201526000838201520152565b9060405190600083549060018260011c90600184169687156119c0575b60209485841089146119ac578798848997989952908160001461198a575060011461194b575b505050611949925003836116b7565b565b600090815285812095935091905b818310611972575050611949935082010138808061193a565b85548884018501529485019487945091830191611959565b9250505061194994925060ff191682840152151560051b82010138808061193a565b634e487b7160e01b85526022600452602485fd5b91607f1691611914565b90604051916119d88361169c565b6020836119e4836117ef565b8152611a086003604051946119f88661169c565b60ff6002820154168652016118f7565b828401520152565b90604051611a1d81611666565b809260ff8154169060038210156114b357600b6117ea9160a0938552611a45600182016119ca565b6020860152611a56600582016119ca565b60408601526001600160401b036009820154166060860152600a8101546080860152016118f7565b908154611a8a816116d8565b92611a9860405194856116b7565b818452600090815260208082208186015b848410611ab7575050505050565b600c83600192611ac685611a10565b815201920193019290611aa9565b6108ce611ae29136906116ef565b9015611b005760036001600160401b0391015460401c169060019190565b50600090600090565b6108ce611b179136906116ef565b9015611b005760036001600160401b03910154169060019190565b8051821015611b465760209160051b010190565b634e487b7160e01b600052603260045260246000fd5b60405190611b698261169c565b6000602083606081520152565b60405190611b838261169c565b81611b8c611798565b815260206117ea611798565b60405190611ba58261164b565b60006080838281528260208201528260408201528260608201520152565b519081151582036101b757565b818102929181159184041417156104a557565b906020908183528160808160608601936001600160401b038151168288015201519460408082015285518094520193019160005b828110611c25575050505090565b83516001600160a01b031685529381019392810192600101611c17565b611c7973__$a0fe38a9a81205afccc10810b09a4d3f45$__91604051906390ba52cf60e01b82528180602094859360048301611be3565b0381865af490811561049957600091611d16575b50600052601f8152611cc781604060002093611cab600486016117ef565b906040518080958194630c133d1360e31b835260048301611be3565b03915af491821561049957600092611ce0575b50501591565b90809250813d8311611d0f575b611cf781836116b7565b810103126101b757611d0890611bc3565b3880611cda565b503d611ced565b90508181813d8311611d3c575b611d2d81836116b7565b810103126101b7575138611c8d565b503d611d23565b60006020604051611d538161169c565b8281520152600052602080526040600020600160405191611d738361169c565b805483520154602082015290565b60405190600e54808352826020916020820190600e6000527fbb7b4a454dc3493923482f07822329ed19e8244eff582cc204f8554c3620c3fd936000905b828210611dd557505050611949925003836116b7565b855484526001958601958895509381019390910190611dbf56fea26469706673582212204e6d940593f73e7f58dd0bcc2c241f5396b4e2444b17949b80c06687960e1b0b64736f6c63430008170033";
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "appliedTopDownNonce";
        readonly outputs: readonly [{
            readonly internalType: "uint64";
            readonly name: "";
            readonly type: "uint64";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "bottomUpCheckPeriod";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "e";
            readonly type: "uint256";
        }];
        readonly name: "bottomUpCheckpoint";
        readonly outputs: readonly [{
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
                readonly name: "subnetID";
                readonly type: "tuple";
            }, {
                readonly internalType: "uint256";
                readonly name: "blockHeight";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes32";
                readonly name: "blockHash";
                readonly type: "bytes32";
            }, {
                readonly internalType: "uint64";
                readonly name: "nextConfigurationNumber";
                readonly type: "uint64";
            }, {
                readonly components: readonly [{
                    readonly internalType: "enum IpcMsgKind";
                    readonly name: "kind";
                    readonly type: "uint8";
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
                readonly name: "msgs";
                readonly type: "tuple[]";
            }];
            readonly internalType: "struct BottomUpCheckpoint";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "e";
            readonly type: "uint256";
        }];
        readonly name: "bottomUpMsgBatch";
        readonly outputs: readonly [{
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
                readonly name: "subnetID";
                readonly type: "tuple";
            }, {
                readonly internalType: "uint256";
                readonly name: "blockHeight";
                readonly type: "uint256";
            }, {
                readonly components: readonly [{
                    readonly internalType: "enum IpcMsgKind";
                    readonly name: "kind";
                    readonly type: "uint8";
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
                readonly name: "msgs";
                readonly type: "tuple[]";
            }];
            readonly internalType: "struct BottomUpMsgBatch";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "bottomUpNonce";
        readonly outputs: readonly [{
            readonly internalType: "uint64";
            readonly name: "";
            readonly type: "uint64";
        }];
        readonly stateMutability: "view";
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
            readonly name: "subnetId";
            readonly type: "tuple";
        }];
        readonly name: "getAppliedBottomUpNonce";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }, {
            readonly internalType: "uint64";
            readonly name: "";
            readonly type: "uint64";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "h";
            readonly type: "uint256";
        }];
        readonly name: "getCheckpointCurrentWeight";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "h";
            readonly type: "uint256";
        }];
        readonly name: "getCheckpointInfo";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "bytes32";
                readonly name: "hash";
                readonly type: "bytes32";
            }, {
                readonly internalType: "bytes32";
                readonly name: "rootHash";
                readonly type: "bytes32";
            }, {
                readonly internalType: "uint256";
                readonly name: "threshold";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "currentWeight";
                readonly type: "uint256";
            }, {
                readonly internalType: "bool";
                readonly name: "reached";
                readonly type: "bool";
            }];
            readonly internalType: "struct QuorumInfo";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getCheckpointRetentionHeight";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "h";
            readonly type: "uint256";
        }];
        readonly name: "getCheckpointSignatureBundle";
        readonly outputs: readonly [{
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
                readonly name: "subnetID";
                readonly type: "tuple";
            }, {
                readonly internalType: "uint256";
                readonly name: "blockHeight";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes32";
                readonly name: "blockHash";
                readonly type: "bytes32";
            }, {
                readonly internalType: "uint64";
                readonly name: "nextConfigurationNumber";
                readonly type: "uint64";
            }, {
                readonly components: readonly [{
                    readonly internalType: "enum IpcMsgKind";
                    readonly name: "kind";
                    readonly type: "uint8";
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
                readonly name: "msgs";
                readonly type: "tuple[]";
            }];
            readonly internalType: "struct BottomUpCheckpoint";
            readonly name: "ch";
            readonly type: "tuple";
        }, {
            readonly components: readonly [{
                readonly internalType: "bytes32";
                readonly name: "hash";
                readonly type: "bytes32";
            }, {
                readonly internalType: "bytes32";
                readonly name: "rootHash";
                readonly type: "bytes32";
            }, {
                readonly internalType: "uint256";
                readonly name: "threshold";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "currentWeight";
                readonly type: "uint256";
            }, {
                readonly internalType: "bool";
                readonly name: "reached";
                readonly type: "bool";
            }];
            readonly internalType: "struct QuorumInfo";
            readonly name: "info";
            readonly type: "tuple";
        }, {
            readonly internalType: "address[]";
            readonly name: "signatories";
            readonly type: "address[]";
        }, {
            readonly internalType: "bytes[]";
            readonly name: "signatures";
            readonly type: "bytes[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getCommitSha";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getCurrentBottomUpCheckpoint";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "exists";
            readonly type: "bool";
        }, {
            readonly internalType: "uint256";
            readonly name: "epoch";
            readonly type: "uint256";
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
                readonly name: "subnetID";
                readonly type: "tuple";
            }, {
                readonly internalType: "uint256";
                readonly name: "blockHeight";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes32";
                readonly name: "blockHash";
                readonly type: "bytes32";
            }, {
                readonly internalType: "uint64";
                readonly name: "nextConfigurationNumber";
                readonly type: "uint64";
            }, {
                readonly components: readonly [{
                    readonly internalType: "enum IpcMsgKind";
                    readonly name: "kind";
                    readonly type: "uint8";
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
                readonly name: "msgs";
                readonly type: "tuple[]";
            }];
            readonly internalType: "struct BottomUpCheckpoint";
            readonly name: "checkpoint";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getCurrentConfigurationNumber";
        readonly outputs: readonly [{
            readonly internalType: "uint64";
            readonly name: "";
            readonly type: "uint64";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getCurrentMembership";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly components: readonly [{
                    readonly internalType: "uint256";
                    readonly name: "weight";
                    readonly type: "uint256";
                }, {
                    readonly internalType: "address";
                    readonly name: "addr";
                    readonly type: "address";
                }, {
                    readonly internalType: "bytes";
                    readonly name: "metadata";
                    readonly type: "bytes";
                }];
                readonly internalType: "struct Validator[]";
                readonly name: "validators";
                readonly type: "tuple[]";
            }, {
                readonly internalType: "uint64";
                readonly name: "configurationNumber";
                readonly type: "uint64";
            }];
            readonly internalType: "struct Membership";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getIncompleteCheckpointHeights";
        readonly outputs: readonly [{
            readonly internalType: "uint256[]";
            readonly name: "";
            readonly type: "uint256[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getIncompleteCheckpoints";
        readonly outputs: readonly [{
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
                readonly name: "subnetID";
                readonly type: "tuple";
            }, {
                readonly internalType: "uint256";
                readonly name: "blockHeight";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes32";
                readonly name: "blockHash";
                readonly type: "bytes32";
            }, {
                readonly internalType: "uint64";
                readonly name: "nextConfigurationNumber";
                readonly type: "uint64";
            }, {
                readonly components: readonly [{
                    readonly internalType: "enum IpcMsgKind";
                    readonly name: "kind";
                    readonly type: "uint8";
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
                readonly name: "msgs";
                readonly type: "tuple[]";
            }];
            readonly internalType: "struct BottomUpCheckpoint[]";
            readonly name: "";
            readonly type: "tuple[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getLastConfigurationNumber";
        readonly outputs: readonly [{
            readonly internalType: "uint64";
            readonly name: "";
            readonly type: "uint64";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getLastMembership";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly components: readonly [{
                    readonly internalType: "uint256";
                    readonly name: "weight";
                    readonly type: "uint256";
                }, {
                    readonly internalType: "address";
                    readonly name: "addr";
                    readonly type: "address";
                }, {
                    readonly internalType: "bytes";
                    readonly name: "metadata";
                    readonly type: "bytes";
                }];
                readonly internalType: "struct Validator[]";
                readonly name: "validators";
                readonly type: "tuple[]";
            }, {
                readonly internalType: "uint64";
                readonly name: "configurationNumber";
                readonly type: "uint64";
            }];
            readonly internalType: "struct Membership";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getLatestParentFinality";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint256";
                readonly name: "height";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes32";
                readonly name: "blockHash";
                readonly type: "bytes32";
            }];
            readonly internalType: "struct ParentFinality";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getNetworkName";
        readonly outputs: readonly [{
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
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "blockNumber";
            readonly type: "uint256";
        }];
        readonly name: "getParentFinality";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint256";
                readonly name: "height";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes32";
                readonly name: "blockHash";
                readonly type: "bytes32";
            }];
            readonly internalType: "struct ParentFinality";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "totalWeight";
            readonly type: "uint256";
        }];
        readonly name: "getQuorumThreshold";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
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
            readonly name: "subnetId";
            readonly type: "tuple";
        }];
        readonly name: "getSubnet";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }, {
            readonly components: readonly [{
                readonly internalType: "uint256";
                readonly name: "stake";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "genesisEpoch";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "circSupply";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint64";
                readonly name: "topDownNonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint64";
                readonly name: "appliedBottomUpNonce";
                readonly type: "uint64";
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
                readonly name: "id";
                readonly type: "tuple";
            }];
            readonly internalType: "struct Subnet";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getSubnetKeys";
        readonly outputs: readonly [{
            readonly internalType: "bytes32[]";
            readonly name: "";
            readonly type: "bytes32[]";
        }];
        readonly stateMutability: "view";
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
            readonly name: "subnetId";
            readonly type: "tuple";
        }];
        readonly name: "getSubnetTopDownMsgsLength";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
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
            readonly name: "subnetId";
            readonly type: "tuple";
        }];
        readonly name: "getTopDownNonce";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }, {
            readonly internalType: "uint64";
            readonly name: "";
            readonly type: "uint64";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getValidatorConfigurationNumbers";
        readonly outputs: readonly [{
            readonly internalType: "uint64";
            readonly name: "";
            readonly type: "uint64";
        }, {
            readonly internalType: "uint64";
            readonly name: "";
            readonly type: "uint64";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "listSubnets";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint256";
                readonly name: "stake";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "genesisEpoch";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "circSupply";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint64";
                readonly name: "topDownNonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint64";
                readonly name: "appliedBottomUpNonce";
                readonly type: "uint64";
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
                readonly name: "id";
                readonly type: "tuple";
            }];
            readonly internalType: "struct Subnet[]";
            readonly name: "";
            readonly type: "tuple[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "majorityPercentage";
        readonly outputs: readonly [{
            readonly internalType: "uint64";
            readonly name: "";
            readonly type: "uint64";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "maxMsgsPerBottomUpBatch";
        readonly outputs: readonly [{
            readonly internalType: "uint64";
            readonly name: "";
            readonly type: "uint64";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "id";
            readonly type: "bytes32";
        }];
        readonly name: "postbox";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "enum IpcMsgKind";
                readonly name: "kind";
                readonly type: "uint8";
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
            readonly name: "storableMsg";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "h";
            readonly type: "bytes32";
        }];
        readonly name: "subnets";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint256";
                readonly name: "stake";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "genesisEpoch";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "circSupply";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint64";
                readonly name: "topDownNonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint64";
                readonly name: "appliedBottomUpNonce";
                readonly type: "uint64";
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
                readonly name: "id";
                readonly type: "tuple";
            }];
            readonly internalType: "struct Subnet";
            readonly name: "subnet";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "totalSubnets";
        readonly outputs: readonly [{
            readonly internalType: "uint64";
            readonly name: "";
            readonly type: "uint64";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }];
    static createInterface(): GatewayGetterFacetInterface;
    static connect(address: string, runner?: ContractRunner | null): GatewayGetterFacet;
}
export interface GatewayGetterFacetLibraryAddresses {
    ["src/lib/SubnetIDHelper.sol:SubnetIDHelper"]: string;
    ["src/lib/LibQuorum.sol:LibQuorum"]: string;
}
export {};
//# sourceMappingURL=GatewayGetterFacet__factory.d.ts.map