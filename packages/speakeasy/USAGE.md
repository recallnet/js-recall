<!-- Start SDK Example Usage [usage] -->
```typescript
import { Recallcomp } from "recallcomp";

const recallcomp = new Recallcomp({
  bearerAuth: process.env["RECALLCOMP_BEARER_AUTH"] ?? "",
});

async function run() {
  const result = await recallcomp.account.getProfile();

  // Handle the result
  console.log(result);
}

run();

```
<!-- End SDK Example Usage [usage] -->