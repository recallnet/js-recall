import { ServiceRegistry } from "@/services/index.js";
import { SYNC_DATA_TYPE, SyncDataType } from "@/types/index.js";

interface PopulateOptions {
  dataTypes?: SyncDataType[];
  competitionId?: string;
  batchSize?: number;
}

async function populateObjectIndex(options: PopulateOptions) {
  const { dataTypes = [SYNC_DATA_TYPE.TRADE], competitionId, batchSize = 1000 } = options;
  const services = ServiceRegistry.getInstance();

  console.log('Starting object_index population...');
  console.log('Options:', { dataTypes, competitionId, batchSize });

  for (const dataType of dataTypes) {
    console.log(`\nPopulating ${dataType} data...`);
    
    try {
      switch (dataType) {
        case SYNC_DATA_TYPE.TRADE:
          await services.objectIndexService.populateTrades(competitionId);
          break;
        case SYNC_DATA_TYPE.AGENT_RANK_HISTORY:
          await services.objectIndexService.populateAgentRankHistory(competitionId);
          break;
        case SYNC_DATA_TYPE.COMPETITIONS_LEADERBOARD:
          await services.objectIndexService.populateCompetitionsLeaderboard(competitionId);
          break;
        case SYNC_DATA_TYPE.PORTFOLIO_SNAPSHOT:
          await services.objectIndexService.populatePortfolioSnapshots(competitionId);
          break;
        case SYNC_DATA_TYPE.AGENT_RANK:
          await services.objectIndexService.populateAgentRank(); // No competitionId
          break;
        default:
          console.warn(`Unknown data type: ${dataType}`);
      }
    } catch (error) {
      console.error(`Error populating ${dataType}:`, error);
      throw error;
    }
  }

  console.log('\nPopulation complete!');
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: PopulateOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--data-types' && args[i + 1]) {
      options.dataTypes = args[i + 1]!.split(',') as SyncDataType[];
      i++;
    } else if (arg === '--competition-id' && args[i + 1]) {
      options.competitionId = args[i + 1];
      i++;
    } else if (arg === '--batch-size' && args[i + 1]) {
      options.batchSize = parseInt(args[i + 1]!, 10);
      i++;
    }
  }

  return options;
}

// Execute the script if run directly
const defaultOptions: PopulateOptions = {
  dataTypes: [SYNC_DATA_TYPE.TRADE, SYNC_DATA_TYPE.AGENT_RANK_HISTORY, SYNC_DATA_TYPE.COMPETITIONS_LEADERBOARD],
  batchSize: 1000
};

const cliOptions = parseArgs();
const options = { ...defaultOptions, ...cliOptions };

populateObjectIndex(options)
  .then(() => {
    console.log('✅ Population complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Population failed:', error);
    process.exit(1);
  });

export { populateObjectIndex };