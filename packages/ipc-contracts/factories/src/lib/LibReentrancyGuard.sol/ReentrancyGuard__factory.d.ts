import { type ContractRunner } from "ethers";
import type { ReentrancyGuard, ReentrancyGuardInterface } from "../../../../src/lib/LibReentrancyGuard.sol/ReentrancyGuard";
export declare class ReentrancyGuard__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "ReentrancyError";
        readonly type: "error";
    }];
    static createInterface(): ReentrancyGuardInterface;
    static connect(address: string, runner?: ContractRunner | null): ReentrancyGuard;
}
//# sourceMappingURL=ReentrancyGuard__factory.d.ts.map