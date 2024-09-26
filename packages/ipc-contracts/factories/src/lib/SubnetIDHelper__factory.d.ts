import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../common";
import type { SubnetIDHelper, SubnetIDHelperInterface } from "../../../src/lib/SubnetIDHelper";
type SubnetIDHelperConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class SubnetIDHelper__factory extends ContractFactory {
    constructor(...args: SubnetIDHelperConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<SubnetIDHelper & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): SubnetIDHelper__factory;
    static readonly bytecode = "0x6080806040523461001a57610f189081610020823930815050f35b600080fdfe6080604052600436101561001257600080fd5b60003560e01c8063089032d514610743578063118e84ee14610696578063138e13fc14610641578063399912661461062057806359feac42146105fb5780636099e898146105b5578063862a88f81461056d57806390ba52cf14610552578063aa5106cb14610454578063c836244d146104365763e4ebe92c1461009557600080fd5b61009e36610ab8565b6001600160401b036100af82610b26565b16806000917a184f03e93ff9f4daa797ed6e38ed64bf6a1f01000000000000000080831015610428575b506d04ee2d6d415b85acef81000000008082101561041b575b50662386f26fc100008082101561040e575b506305f5e10080821015610401575b50612710808210156103f4575b5060648110156103e6575b600a809110156103dc575b600183019181602161016061014a86610ec7565b956101586040519788610993565b808752610ec7565b602086019690601f19013688378501015b60001901916f181899199a1a9b1b9c1cb0b131b232b360811b8282061a83530490811561019f578290610171565b856101c76101d7602287896040519485926117b960f11b602085015251809285850190610ae9565b8101036002810184520182610993565b906101e56020820182610b3a565b90506000915b8183106102245783604080518092602082526102168151809281602086015260208686019101610ae9565b601f01601f19168101030190f35b90919261025e602160405183610244829551809260208086019101610ae9565b8101602f60f81b6020820152036001810184520182610993565b836102866102816102726020860186610b3a565b6001600160a01b039491610b6f565b610b7f565b169081604051928360608101106001600160401b036060860111176103c65760608401604052602a845260403660208601378351156103b057603060208501538351600110156103b0576078602185015360295b600181116103515750610332575090610329602060019360405193816103098693518092868087019101610ae9565b820161031d82518093868085019101610ae9565b01038084520182610993565b930191906101eb565b6044906040519063e22e27eb60e01b8252600482015260146024820152fd5b906010600f821610156103b05784518210156103b0576f181899199a1a9b1b9c1cb0b131b232b360811b600f82161a8583016020015360041c90801561039a57600019016102da565b634e487b7160e01b600052601160045260246000fd5b634e487b7160e01b600052603260045260246000fd5b634e487b7160e01b600052604160045260246000fd5b9160010191610136565b60646002910492019161012b565b6004910492019138610120565b6008910492019138610113565b6010910492019138610104565b60209104920191386100f2565b6040935082049050386100d9565b602061044a610444366108b1565b90610e6a565b6040519015158152f35b60031960403682011261054d57600435906001600160401b039081831161054d5760408360040191843603011261054d576001600160a01b03602435818116949085900361054d576024906104a7610b0c565b946104b185610b26565b16855201906104c08284610b3a565b9190506001926001830180841161039a576104da90610b93565b946020870195865260005b84811061051e578888885191825192600019840193841161039a5761051a9361050d91610bc5565b52604051918291826108fe565b0390f35b8061053761028188936105318787610b3a565b90610b6f565b85610543838b51610bc5565b91169052016104e5565b600080fd5b602061056561056036610ab8565b610dae565b604051908152f35b602061057836610ab8565b61058482820182610b3a565b9050159081610599575b506040519015158152f35b6001600160401b0391506105ac90610b26565b1615158261058e565b60206105c036610ab8565b6105cc82820182610b3a565b90501590816105e057506040519015158152f35b6001600160401b0391506105f390610b26565b16158261058e565b602061060e61060936610ab8565b610d5f565b6040516001600160a01b039091168152f35b61051a61063561062f366108b1565b90610bd9565b604051918291826108fe565b602061064c366109f3565b018051519081156106845751600019820191821161039a576020916001600160a01b039161067a9190610bc5565b5116604051908152f35b60405163142b83b360e31b8152600490fd5b61069f366109f3565b6106a7610b0c565b5060208101908151511561073157815151600019810190811161039a576106cd90610b93565b90815160005b81811061070a5761051a846001600160401b0385511690604051916106f78361095d565b82526020820152604051918291826108fe565b600190818060a01b0361071e828851610bc5565b511661072a8287610bc5565b52016106d3565b604051632f10c6c160e01b8152600490fd5b61074c366108b1565b610754610b0c565b5061075e82610b26565b6001600160401b0390818061077285610b26565b1691160361089f57602083016107888185610b3a565b6020850191506107988286610b3a565b919050111561088d576000936107ae8282610b3a565b9590505b8581108061084e575b156107c8576001016107b2565b84848892600019811461039a5760018091016107e381610b93565b9260005b82811061081e5761051a86866107fc8a610b26565b916040519261080a8461095d565b1682526020820152604051918291826108fe565b806108316102818693610531868c610b3a565b61083b8288610bc5565b6001600160a01b039091169052016107e7565b5061086061028182610531878b610b3a565b61086a8484610b3a565b6001600160a01b0391829161088491610281918791610b6f565b169116146107bb565b60405163427282e960e11b8152600490fd5b604051637185935560e01b8152600490fd5b600319919060408382011261054d576001600160401b039060043582811161054d57604085828403011261054d576004019360243592831161054d578260409203011261054d5760040190565b906020908183528160808160608601936001600160401b038151168288015201519460408082015285518094520193019160005b828110610940575050505090565b83516001600160a01b031685529381019392810192600101610932565b604081019081106001600160401b038211176103c657604052565b602081019081106001600160401b038211176103c657604052565b90601f801991011681019081106001600160401b038211176103c657604052565b35906001600160401b038216820361054d57565b6001600160401b0381116103c65760051b60200190565b35906001600160a01b038216820361054d57565b600319906020828201811361054d57600435926001600160401b039081851161054d57604090858503011261054d5760405193610a2f8561095d565b610a3b816004016109b4565b8552602481013591821161054d5701918060238401121561054d576004830135610a64816109c8565b93610a726040519586610993565b8185526024602086019260051b82010192831161054d57602401905b828210610aa15750505050602082015290565b838091610aad846109df565b815201910190610a8e565b6003199060208183011261054d57600435916001600160401b03831161054d578260409203011261054d5760040190565b60005b838110610afc5750506000910152565b8181015183820152602001610aec565b60405190610b198261095d565b6060602083600081520152565b356001600160401b038116810361054d5790565b903590601e198136030182121561054d57018035906001600160401b03821161054d57602001918160051b3603831361054d57565b91908110156103b05760051b0190565b356001600160a01b038116810361054d5790565b90610b9d826109c8565b610baa6040519182610993565b8281528092610bbb601f19916109c8565b0190602036910137565b80518210156103b05760209160051b010190565b90610be2610b0c565b50610bec82610b26565b906001600160401b03918280610c0184610b26565b16911603610d33579160208101906000610c1b8383610b3a565b95905060208101610c2c8183610b3a565b9390505b87811080610d2a575b80610ceb575b15610c4c57600101610c30565b93949596505050508015610cc157610c6381610b93565b9260005b828110610c9357505050610c7a90610b26565b9160405192610c888461095d565b168252602082015290565b80610ca76102816001936105318689610b3a565b610cb18288610bc5565b90838060a01b0316905201610c67565b50610ccc9150610b26565b9060405190610cda82610978565b6000825260405192610c888461095d565b50610cfd610281826105318989610b3a565b610d078385610b3a565b6001600160a01b03918291610d2191610281918791610b6f565b16911614610c3f565b50838110610c39565b505050604051610d4281610978565b6000815260405190610d538261095d565b60008252602082015290565b6020810190610d6e8282610b3a565b905015610da757610d8a610d828383610b3a565b939092610b3a565b60001981019150811161039a57610da49261028192610b6f565b90565b5050600090565b6040516020808201818152926001600160401b0391608084019183610dd2826109b4565b16604086015281810135601e198236030181121561054d570191818335930193831161054d578260051b3603841361054d5760406060860152829052839160a083019160005b828110610e3b57505050610e35925003601f198101835282610993565b51902090565b91935091600190839081906001600160a01b03610e57896109df565b1681520195019101918593919492610e18565b610e7381610b26565b6001600160401b0380610e8585610b26565b16911603610da757610e9a6020820182610b3a565b9050610ea96020840184610b3a565b91905003610da757610ebd610ec391610dae565b91610dae565b1490565b6001600160401b0381116103c657601f01601f19166020019056fea2646970667358221220898213cc0aa37f29e58a188a33b6ff93c1fc8e0cb849cde90c09548bf833972864736f6c63430008170033";
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "DifferentRootNetwork";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "EmptySubnet";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "InvalidRoute";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "NoAddressForRoot";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "NoParentForSubnet";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "length";
            readonly type: "uint256";
        }];
        readonly name: "StringsInsufficientHexLength";
        readonly type: "error";
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
            readonly name: "subnet1";
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
            readonly name: "subnet2";
            readonly type: "tuple";
        }];
        readonly name: "commonParent";
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
            readonly name: "actor";
            readonly type: "address";
        }];
        readonly name: "createSubnetId";
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
            readonly name: "newSubnet";
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
            readonly name: "subnet1";
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
            readonly name: "subnet2";
            readonly type: "tuple";
        }];
        readonly name: "down";
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
            readonly name: "subnet1";
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
            readonly name: "subnet2";
            readonly type: "tuple";
        }];
        readonly name: "equals";
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
        }];
        readonly name: "getActor";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
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
        }];
        readonly name: "getAddress";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
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
        }];
        readonly name: "getParentSubnet";
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
            readonly name: "subnetId";
            readonly type: "tuple";
        }];
        readonly name: "isEmpty";
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
        }];
        readonly name: "isRoot";
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
        }];
        readonly name: "toHash";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "";
            readonly type: "bytes32";
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
        }];
        readonly name: "toString";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }];
    static createInterface(): SubnetIDHelperInterface;
    static connect(address: string, runner?: ContractRunner | null): SubnetIDHelper;
}
export {};
//# sourceMappingURL=SubnetIDHelper__factory.d.ts.map