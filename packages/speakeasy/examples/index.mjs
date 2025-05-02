import { Recallcomp } from "../dist/esm/index.js";

const recallcomp = new Recallcomp({
  bearerAuth: "facd7c0d7f072977_b29f14e49d126ae2",
});

async function run() {
  const result = await recallcomp.account.getProfile();

  // Handle the result
  console.log(result);
}

run().catch(err => console.error("fatal:", err));