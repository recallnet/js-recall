import * as coreDefs from "./core/defs.js";
import * as coreRelations from "./core/relations.js";
import * as tradingDefs from "./trading/defs.js";
import * as tradingRelations from "./trading/relations.js";

const schema = {
  ...coreDefs,
  ...coreRelations,
  ...tradingDefs,
  ...tradingRelations,
};

export default schema;
