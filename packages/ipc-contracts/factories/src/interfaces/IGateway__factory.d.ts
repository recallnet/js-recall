import { type ContractRunner } from "ethers";
import type { IGateway, IGatewayInterface } from "../../../src/interfaces/IGateway";
export declare class IGateway__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "addStake";
        readonly outputs: readonly [];
        readonly stateMutability: "payable";
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
            readonly name: "bottomUpCheckpoint";
            readonly type: "tuple";
        }];
        readonly name: "commitCheckpoint";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
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
            readonly name: "finality";
            readonly type: "tuple";
        }];
        readonly name: "commitParentFinality";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
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
        }, {
            readonly internalType: "bytes32";
            readonly name: "membershipRootHash";
            readonly type: "bytes32";
        }, {
            readonly internalType: "uint256";
            readonly name: "membershipWeight";
            readonly type: "uint256";
        }];
        readonly name: "createBottomUpCheckpoint";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
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
        }];
        readonly name: "fund";
        readonly outputs: readonly [];
        readonly stateMutability: "payable";
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
            readonly name: "amount";
            readonly type: "uint256";
        }];
        readonly name: "fundWithToken";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "kill";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "msgCid";
            readonly type: "bytes32";
        }];
        readonly name: "propagate";
        readonly outputs: readonly [];
        readonly stateMutability: "payable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "genesisCircSupply";
            readonly type: "uint256";
        }];
        readonly name: "register";
        readonly outputs: readonly [];
        readonly stateMutability: "payable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
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
        }];
        readonly name: "release";
        readonly outputs: readonly [];
        readonly stateMutability: "payable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "amount";
            readonly type: "uint256";
        }];
        readonly name: "releaseStake";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
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
            readonly name: "envelope";
            readonly type: "tuple";
        }];
        readonly name: "sendContractXnetMessage";
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
            readonly name: "committed";
            readonly type: "tuple";
        }];
        readonly stateMutability: "payable";
        readonly type: "function";
    }];
    static createInterface(): IGatewayInterface;
    static connect(address: string, runner?: ContractRunner | null): IGateway;
}
//# sourceMappingURL=IGateway__factory.d.ts.map