import AdmZip from "adm-zip";
import * as dotenv from "dotenv";
import cron from "node-cron";
import * as path from "path";
import * as xml2js from "xml2js";

import { SanctionedWalletRepository } from "@recallnet/db/repositories/sanctioned-wallet";
import { UserRepository } from "@recallnet/db/repositories/user";

import { db } from "@/database/db.js";
import { createLogger } from "@/lib/logger.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const logger = createLogger("SyncSanctionedWallets");

const OFAC_SDN_URL =
  "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_ADVANCED.ZIP";

// EVM-compatible chains with hex addresses (0x...)
const EVM_ASSETS = ["ETH", "USDC", "USDT", "ETC", "ARB", "BSC"];

const FEATURE_TYPE_PREFIX = "Digital Currency Address - ";

interface OFACIdentification {
  $: { ID: string; FeatureTypeID?: string };
  VersionDetail?: Array<{ _: string }>;
}

interface OFACFeatureType {
  $: { ID: string };
  _: string;
}

interface OFACParseResult {
  ReferenceData?: {
    ReferenceValueSets?: Array<{
      FeatureTypeValues?: Array<{
        FeatureType?: OFACFeatureType[];
      }>;
    }>;
    DistinctParties?: Array<{
      DistinctParty?: Array<{
        Feature?: OFACIdentification[];
      }>;
    }>;
  };
}

/**
 * Download and extract the OFAC SDN Advanced XML file
 * @returns Path to the extracted XML file
 */
async function downloadOFACData(): Promise<string> {
  logger.info({ url: OFAC_SDN_URL }, "Downloading OFAC SDN data");

  const response = await fetch(OFAC_SDN_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to download OFAC data: ${response.status} ${response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  logger.info("Extracting ZIP file");
  const zip = new AdmZip(buffer);
  const zipEntries = zip.getEntries();

  const xmlEntry = zipEntries.find((entry) =>
    entry.entryName.match(/sdn_advanced\.xml$/i),
  );

  if (!xmlEntry) {
    throw new Error("SDN_ADVANCED.XML not found in downloaded ZIP file");
  }

  const xmlContent = xmlEntry.getData().toString("utf8");
  logger.info(
    { sizeKb: Math.round(xmlContent.length / 1024) },
    "XML file extracted",
  );

  return xmlContent;
}

/**
 * Parse XML and extract sanctioned addresses for EVM chains
 * @param xmlContent The XML content as string
 * @returns Array of normalized sanctioned addresses
 */
async function parseOFACAddresses(xmlContent: string): Promise<string[]> {
  logger.info("Parsing OFAC XML");

  const parser = new xml2js.Parser({
    explicitArray: true,
    mergeAttrs: false,
    xmlns: true,
  });

  const result: OFACParseResult = await parser.parseStringPromise(xmlContent);

  // Get feature type IDs for EVM assets
  const featureTypeIds = new Set<string>();
  const referenceValueSets =
    result.ReferenceData?.ReferenceValueSets?.[0]?.FeatureTypeValues?.[0]
      ?.FeatureType || [];

  for (const asset of EVM_ASSETS) {
    const featureTypeName = FEATURE_TYPE_PREFIX + asset;
    const featureType = referenceValueSets.find(
      (ft) => ft._ === featureTypeName,
    );

    if (featureType) {
      featureTypeIds.add(featureType.$.ID);
      logger.debug({ asset, id: featureType.$.ID }, "Found feature type");
    } else {
      logger.warn({ asset, featureTypeName }, "Feature type not found");
    }
  }

  logger.info(
    { count: featureTypeIds.size, assets: EVM_ASSETS },
    "Feature types identified",
  );

  // Extract addresses for identified feature types
  const addresses = new Set<string>();
  const distinctParties =
    result.ReferenceData?.DistinctParties?.[0]?.DistinctParty || [];

  for (const party of distinctParties) {
    const features = party.Feature || [];

    for (const feature of features) {
      if (
        feature.$.FeatureTypeID &&
        featureTypeIds.has(feature.$.FeatureTypeID)
      ) {
        const versionDetails = feature.VersionDetail || [];

        for (const detail of versionDetails) {
          const address = detail._;
          if (address && isValidEvmAddress(address)) {
            addresses.add(address.toLowerCase());
          }
        }
      }
    }
  }

  const addressArray = Array.from(addresses).sort();
  logger.info(
    { totalAddresses: addressArray.length },
    "Extracted sanctioned addresses",
  );

  return addressArray;
}

/**
 * Check if an address is a valid EVM hex address
 * @param address The address to validate
 * @returns True if valid EVM address format
 */
function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Find new sanctioned addresses not in database
 * @param ofacAddresses All addresses from OFAC
 * @param dbAddresses All addresses currently in database
 * @returns Array of new addresses to add
 */
function findNewAddresses(
  ofacAddresses: string[],
  dbAddresses: string[],
): string[] {
  const dbSet = new Set(dbAddresses);
  return ofacAddresses.filter((addr) => !dbSet.has(addr));
}

/**
 * Check if any users have sanctioned wallet addresses and suspend them
 * @param newAddresses New sanctioned addresses found
 * @param userRepository User repository instance
 * @returns Number of users suspended
 */
async function checkAndSuspendUsers(
  newAddresses: string[],
  userRepository: UserRepository,
): Promise<number> {
  if (newAddresses.length === 0) {
    return 0;
  }

  logger.info(
    { count: newAddresses.length, addresses: newAddresses },
    "Checking for users with newly sanctioned addresses",
  );

  // Check both walletAddress and embeddedWalletAddress
  const sanctionedUsers =
    await userRepository.findUsersWithAddresses(newAddresses);

  if (sanctionedUsers.length === 0) {
    logger.info("No users found with newly sanctioned addresses");
    return 0;
  }

  logger.warn(
    {
      count: sanctionedUsers.length,
      userIds: sanctionedUsers.map((u) => u.id),
    },
    "SANCTIONED USERS DETECTED - suspending accounts",
  );

  // Suspend each sanctioned user
  let suspendedCount = 0;
  for (const user of sanctionedUsers) {
    try {
      await userRepository.update({
        id: user.id,
        status: "suspended",
      });
      logger.warn(
        {
          userId: user.id,
          walletAddress: user.walletAddress,
          embeddedWalletAddress: user.embeddedWalletAddress,
        },
        "User suspended due to sanctioned wallet",
      );
      suspendedCount++;
    } catch (error) {
      logger.error(
        {
          userId: user.id,
          error,
        },
        "Failed to suspend user",
      );
    }
  }

  return suspendedCount;
}

/**
 * Sync sanctioned wallet addresses from OFAC
 */
async function syncSanctionedWallets(): Promise<void> {
  const startTime = Date.now();
  logger.info("Starting sanctioned wallets sync task");

  try {
    // Step 1: Download and parse OFAC data
    const xmlContent = await downloadOFACData();
    const ofacAddresses = await parseOFACAddresses(xmlContent);

    logger.info(
      { totalOFACAddresses: ofacAddresses.length },
      "OFAC addresses retrieved",
    );

    // Step 2: Get current database addresses
    const sanctionedWalletRepo = new SanctionedWalletRepository(
      db,
      logger.child({ component: "SanctionedWalletRepository" }),
    );
    const dbWallets = await sanctionedWalletRepo.getAll();
    const dbAddresses = dbWallets.map((w) => w.address);

    logger.info(
      { totalDBAddresses: dbAddresses.length },
      "Current database addresses",
    );
    // Step 3: Find new addresses

    const newAddresses = findNewAddresses(ofacAddresses, dbAddresses);

    if (newAddresses.length === 0) {
      logger.info("No new sanctioned addresses found - database is up to date");
      const duration = Date.now() - startTime;
      logger.info({ duration }, "Sync completed");
      return;
    }

    logger.info(
      { count: newAddresses.length, addresses: newAddresses },
      "New sanctioned addresses found",
    );

    // Step 4: Add new addresses to database
    let addedCount = 0;
    for (const address of newAddresses) {
      try {
        await sanctionedWalletRepo.add(address);
        addedCount++;
      } catch (error) {
        logger.error(
          {
            address,
            error,
          },
          "Failed to add sanctioned address",
        );
      }
    }

    logger.info({ addedCount }, "New addresses added to database");

    // Step 5: Check for users with newly sanctioned addresses
    const userRepository = new UserRepository(
      db,
      logger.child({ component: "UserRepository" }),
    );
    const suspendedCount = await checkAndSuspendUsers(
      newAddresses,
      userRepository,
    );

    const duration = Date.now() - startTime;
    logger.info(
      {
        duration,
        ofacTotal: ofacAddresses.length,
        newAddresses: addedCount,
        usersSuspended: suspendedCount,
      },
      "Sanctioned wallets sync completed successfully",
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Error syncing sanctioned wallets",
    );
    throw error;
  }
}

// Run daily at 00:00 AM UTC
cron.schedule("0 0 * * *", async () => {
  logger.info("Running scheduled sanctioned wallets sync");
  await syncSanctionedWallets();
});

// Also run immediately if called directly with --run-once flag
if (process.argv.includes("--run-once")) {
  logger.info("Running sanctioned wallets sync once");
  syncSanctionedWallets()
    .then(() => {
      logger.info("Sync completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, "Sync failed");
      process.exit(1);
    });
} else {
  logger.info(
    "Sanctioned wallets sync scheduler started (runs daily at 00:00 AM UTC)",
  );
}
