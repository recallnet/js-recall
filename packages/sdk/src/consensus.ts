import {
  AbciInfoResponse,
  AbciQueryParams,
  AbciQueryResponse,
  BlockchainResponse,
  BlockResponse,
  BlockResultsResponse,
  BroadcastTxAsyncResponse,
  BroadcastTxCommitResponse,
  BroadcastTxParams,
  BroadcastTxSyncResponse,
  CommitResponse,
  GenesisResponse,
  HealthResponse,
  NumUnconfirmedTxsResponse,
  StatusResponse,
  Tendermint37Client,
  TxParams,
  TxResponse,
  TxSearchParams,
  TxSearchResponse,
  ValidatorsParams,
  ValidatorsResponse,
} from "@cosmjs/tendermint-rpc";
import { BlockSearchParams } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";
import { BlockSearchResponse } from "@cosmjs/tendermint-rpc/build/tendermint37/responses";

/**
 * `Consensus` is a CometBFT HTTP client to make calls to a Hoku node's CometBFT
 * RPC consensus methods.
 *
 * A few callouts:
 * - This wraps `@cosmos/tendermint-rpc`'s `Tendermint37Client` client to
 *   provide a more convenient interface for interacting with consensus calls.
 * - It does not include the following methods that are available on a Hoku
 *   node's CometBFT RPC calls: `check_tx`.
 * - It hides methods that are not available on a Hoku CometBFT HTTP client.
 *   This primarily includes subscription methods for blocks and transactions.
 */
export class ConsensusClient {
  private readonly client: Tendermint37Client;

  private constructor(client: Tendermint37Client) {
    this.client = client;
  }

  // Connect to the CometBFT node
  static async connect(providerUrl: string): Promise<ConsensusClient> {
    const client = await Tendermint37Client.connect(providerUrl);
    return new ConsensusClient(client);
  }

  // Disconnect from the CometBFT node
  disconnect() {
    this.client.disconnect();
  }

  // Get ABCI info
  async abciInfo(): Promise<AbciInfoResponse> {
    return this.client.abciInfo();
  }

  // Query ABCI
  async abciQuery(params: AbciQueryParams): Promise<AbciQueryResponse> {
    return this.client.abciQuery(params);
  }

  // Get block
  async block(height: number): Promise<BlockResponse> {
    return this.client.block(height);
  }

  // Get block results
  async blockResults(height: number): Promise<BlockResultsResponse> {
    return this.client.blockResults(height);
  }

  // Search block
  async blockSearch(params: BlockSearchParams): Promise<BlockSearchResponse> {
    return this.client.blockSearch(params);
  }

  // Search all blocks
  async blockSearchAll(
    params: BlockSearchParams
  ): Promise<BlockSearchResponse> {
    return this.client.blockSearchAll(params);
  }

  // Get blockchain
  async blockchain(
    minHeight?: number,
    maxHeight?: number
  ): Promise<BlockchainResponse> {
    return this.client.blockchain(minHeight, maxHeight);
  }

  // Broadcast transaction async
  async broadcastTxAsync(
    params: BroadcastTxParams
  ): Promise<BroadcastTxAsyncResponse> {
    return this.client.broadcastTxAsync(params);
  }

  // Broadcast transaction commit
  async broadcastTxCommit(
    params: BroadcastTxParams
  ): Promise<BroadcastTxCommitResponse> {
    return this.client.broadcastTxCommit(params);
  }

  // Broadcast transaction sync
  async broadcastTxSync(
    params: BroadcastTxParams
  ): Promise<BroadcastTxSyncResponse> {
    return this.client.broadcastTxSync(params);
  }

  // Get commit
  async commit(height?: number): Promise<CommitResponse> {
    return this.client.commit(height);
  }

  // Get genesis
  async genesis(): Promise<GenesisResponse> {
    return this.client.genesis();
  }

  // Get health
  async health(): Promise<HealthResponse> {
    return this.client.health();
  }

  // Get num unconfirmed txs
  async numUnconfirmedTxs(): Promise<NumUnconfirmedTxsResponse> {
    return this.client.numUnconfirmedTxs();
  }

  // Get status
  async status(): Promise<StatusResponse> {
    return this.client.status();
  }

  // Get tx
  async tx(params: TxParams): Promise<TxResponse> {
    return this.client.tx(params);
  }

  // Search tx
  async txSearch(params: TxSearchParams): Promise<TxSearchResponse> {
    return this.client.txSearch(params);
  }

  // Search all tx
  async txSearchAll(params: TxSearchParams): Promise<TxSearchResponse> {
    return this.client.txSearchAll(params);
  }

  // Get validators
  async validators(params: ValidatorsParams): Promise<ValidatorsResponse> {
    return this.client.validators(params);
  }

  // Get validators all
  async validatorsAll(height?: number): Promise<ValidatorsResponse> {
    return this.client.validatorsAll(height);
  }
}
