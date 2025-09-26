import * as coreDefs from "./core/defs.js";
import * as coreRelations from "./core/relations.js";
import * as indexingDefs from "./indexing/defs.js";
import * as rankingDefs from "./ranking/defs.js";
import * as rankingRelations from "./ranking/relations.js";
import * as tradingDefs from "./trading/defs.js";
import * as tradingRelations from "./trading/relations.js";
import * as votingDefs from "./voting/defs.js";
import * as votingRelations from "./voting/relations.js";

const schema = {
  ...coreDefs,
  ...coreRelations,
  ...rankingDefs,
  ...rankingRelations,
  ...tradingDefs,
  ...tradingRelations,
  ...votingDefs,
  ...votingRelations,
  ...indexingDefs,
};

export default schema;
