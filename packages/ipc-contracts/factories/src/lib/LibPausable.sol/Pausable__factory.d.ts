import { type ContractRunner } from "ethers";
import type { Pausable, PausableInterface } from "../../../../src/lib/LibPausable.sol/Pausable";
export declare class Pausable__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "EnforcedPause";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "ExpectedPause";
        readonly type: "error";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "account";
            readonly type: "address";
        }];
        readonly name: "Paused";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "address";
            readonly name: "account";
            readonly type: "address";
        }];
        readonly name: "Unpaused";
        readonly type: "event";
    }];
    static createInterface(): PausableInterface;
    static connect(address: string, runner?: ContractRunner | null): Pausable;
}
//# sourceMappingURL=Pausable__factory.d.ts.map