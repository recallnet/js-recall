import { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { AdminRepository } from "@recallnet/db/repositories/admin";
import { SelectAdmin } from "@recallnet/db/schema/core/types";

import { AdminService } from "../admin.service.js";
import { AgentService } from "../agent.service.js";
import { UserService } from "../user.service.js";

const encryptionKey = "0123456789abcdef0123456789abcdef";

function adminFixture(): SelectAdmin {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    username: "operator",
    email: "operator@example.com",
    passwordHash: "unused-password-hash",
    apiKey: null,
    name: null,
    imageUrl: null,
    metadata: null,
    status: "active",
    lastLoginAt: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  };
}

describe("Admin authentication", () => {
  let repository: MockProxy<AdminRepository>;
  let service: AdminService;
  let persistedAdmin: SelectAdmin;

  function createService(): AdminService {
    return new AdminService(
      repository,
      mock<UserService>(),
      mock<AgentService>(),
      { security: { rootEncryptionKey: encryptionKey } },
      mock<Logger>(),
    );
  }

  beforeEach((): void => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ROOT_ENCRYPTION_KEY", encryptionKey);
    repository = mock<AdminRepository>();
    persistedAdmin = adminFixture();
    repository.findAll.mockImplementation(
      async (): Promise<SelectAdmin[]> => [persistedAdmin],
    );
    repository.findById.mockImplementation(
      async (): Promise<SelectAdmin> => persistedAdmin,
    );
    repository.setApiKey.mockImplementation(
      async (_id: string, apiKey: string): Promise<SelectAdmin> => {
        persistedAdmin = { ...persistedAdmin, apiKey };
        return persistedAdmin;
      },
    );
    repository.updateLastLogin.mockImplementation(
      async (): Promise<SelectAdmin> => persistedAdmin,
    );
    repository.create.mockResolvedValue(persistedAdmin);
    service = createService();
  });

  afterEach((): void => {
    vi.unstubAllEnvs();
  });

  it("rejects initial setup when the admin lookup times out", async (): Promise<void> => {
    const failure = new Error(
      "Connection terminated due to connection timeout",
    );
    repository.findAll.mockRejectedValue(failure);

    await expect(
      service.setupInitialAdmin(
        "candidate",
        "test-password",
        "test@example.com",
      ),
    ).rejects.toBe(failure);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects initial setup when an admin exists", async (): Promise<void> => {
    await expect(
      service.setupInitialAdmin(
        "candidate",
        "test-password",
        "test@example.com",
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("allows initial setup after a successful empty lookup", async (): Promise<void> => {
    repository.findAll.mockResolvedValue([]);

    const admin = await service.setupInitialAdmin(
      "candidate",
      "test-password",
      "test@example.com",
    );

    expect(repository.create).toHaveBeenCalledOnce();
    expect(admin.apiKey).toEqual(expect.any(String));
  });

  it("rejects a cached key after another instance rotates it", async (): Promise<void> => {
    const key = await service.generateApiKeyForAdmin(persistedAdmin.id);
    expect(await service.validateApiKey(key)).toBe(persistedAdmin.id);

    await createService().resetApiKey(persistedAdmin.id);

    expect(await service.validateApiKey(key)).toBeNull();
  });

  it("rejects a cached key after the account is deactivated", async (): Promise<void> => {
    const key = await service.generateApiKeyForAdmin(persistedAdmin.id);
    expect(await service.validateApiKey(key)).toBe(persistedAdmin.id);
    persistedAdmin = { ...persistedAdmin, status: "inactive" };

    expect(await service.validateApiKey(key)).toBeNull();
  });

  it("rejects a cached key when the account lookup fails", async (): Promise<void> => {
    const key = await service.generateApiKeyForAdmin(persistedAdmin.id);
    expect(await service.validateApiKey(key)).toBe(persistedAdmin.id);
    repository.findById.mockRejectedValue(new Error("Database unavailable"));

    expect(await service.validateApiKey(key)).toBeNull();
  });
});
