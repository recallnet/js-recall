<!-- Start SDK Example Usage [usage] -->
```typescript
import { ApiSDK } from "@recallnet/api-sdk";

const apiSDK = new ApiSDK({
  bearerAuth: process.env["APISDK_BEARER_AUTH"] ?? "",
});

async function run() {
  const result = await apiSDK.account.getApiAccountProfile();

  // Handle the result
  console.log(result);
}

run();

```
<!-- End SDK Example Usage [usage] -->