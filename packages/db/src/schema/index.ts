import * as airdropDefs from "./airdrop/defs.js";
import * as boostDefs from "./boost/defs.js";
import * as convictionClaimsDefs from "./conviction-claims/defs.js";
import * as coreDefs from "./core/defs.js";
import * as coreRelations from "./core/relations.js";
import * as indexingDefs from "./indexing/defs.js";
import * as rankingDefs from "./ranking/defs.js";
import * as rankingRelations from "./ranking/relations.js";
import * as rewardsDefs from "./rewards/defs.js";
import * as rewardsRelations from "./rewards/relations.js";
import * as sportsDefs from "./sports/defs.js";
import * as tradingDefs from "./trading/defs.js";
import * as tradingRelations from "./trading/relations.js";

const schema = {
  ...coreDefs,
  ...coreRelations,
  ...rankingDefs,
  ...rankingRelations,
  ...tradingDefs,
  ...tradingRelations,
  ...boostDefs,
  ...convictionClaimsDefs,
  ...indexingDefs,
  ...rewardsDefs,
  ...rewardsRelations,
  ...airdropDefs,
  ...sportsDefs,
};

export default schema;
