<!-- Start SDK Example Usage [usage] -->
```typescript
import { ApiSDK } from "@recallnet/api-sdk";

const apiSDK = new ApiSDK({
  bearerAuth: process.env["APISDK_BEARER_AUTH"] ?? "",
});

async function run() {
  const result = await apiSDK.admin.postApiAdminSetup({
    username: "admin",
    password: "password123",
    email: "admin@example.com",
  });

  // Handle the result
  console.log(result);
}

run();

```
<!-- End SDK Example Usage [usage] -->