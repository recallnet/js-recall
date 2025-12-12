import axios from "axios";
import * as dotenv from "dotenv";
import { sql } from "drizzle-orm";
import * as path from "path";

import { dbManager, getBaseUrl } from "@recallnet/test-utils";

import { db } from "@/database/db.js";

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

// Admin credentials for testing
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";
const ADMIN_EMAIL = "admin@test.com";

async function setupAdminAccount() {
  console.log("Setting up admin account for testing...");

  try {
    // Initialize the database
    await dbManager.initialize();

    // Clean up existing users/agents/admin accounts
    console.log("Cleaning up existing users/agents/admin accounts...");
    await db.execute(sql.raw("TRUNCATE users CASCADE"));
    await db.execute(sql.raw("TRUNCATE agents CASCADE"));
    await db.execute(sql.raw("TRUNCATE admins CASCADE"));

    // Use the admin setup endpoint to create a new admin account
    const baseUrl = getBaseUrl();
    console.log(`Using API at ${baseUrl} to create admin account...`);

    const response = await axios.post(`${baseUrl}/admin/setup`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      email: ADMIN_EMAIL,
    });

    if (response.data.success) {
      console.log("Admin account created successfully via API");
      console.log(`Username: ${ADMIN_USERNAME}`);
      console.log(`Password: ${ADMIN_PASSWORD}`);
      console.log(`Admin ID: ${response.data.admin.id}`);
    } else {
      throw new Error(
        `Failed to create admin account: ${response.data.error || "Unknown error"}`,
      );
    }

    console.log("Admin setup completed successfully");
  } catch (error) {
    console.error("Error setting up admin account:", error);
    process.exit(1);
  } finally {
    // Close the database connection
    await dbManager.close();
  }
}

// Run the setup
setupAdminAccount()
  .then(() => {
    console.log("Admin account setup completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to set up admin account:", error);
    process.exit(1);
  });
