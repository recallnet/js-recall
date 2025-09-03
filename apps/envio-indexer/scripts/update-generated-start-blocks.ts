#!/usr/bin/env tsx
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables from the envio-indexer directory
// In CI, the ALCHEMY_API_KEY is already in process.env, so we only load .env if it exists
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    config({ path: envPath });
}

/**
 * Chain configurations with Alchemy RPC endpoints
 */
const CHAINS = [
    { id: 1, name: 'ethereum', alchemyNetwork: 'eth-mainnet' },
    { id: 137, name: 'polygon', alchemyNetwork: 'polygon-mainnet' },
    { id: 42161, name: 'arbitrum', alchemyNetwork: 'arb-mainnet' },
    { id: 10, name: 'optimism', alchemyNetwork: 'opt-mainnet' },
    { id: 8453, name: 'base', alchemyNetwork: 'base-mainnet' }
];

/**
 * Fetch the latest block number for a chain using Alchemy
 */
async function getLatestBlock(alchemyNetwork: string): Promise<number> {
    const alchemyKey = process.env.ALCHEMY_API_KEY;
    if (!alchemyKey) {
        console.error('Warning: ALCHEMY_API_KEY not set, skipping start block updates');
        console.error('To enable automatic latest block fetching, set ALCHEMY_API_KEY in apps/envio-indexer/.env');
        return 0;
    }

    const url = `https://${alchemyNetwork}.g.alchemy.com/v2/${alchemyKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_blockNumber',
                params: [],
                id: 1
            })
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(`Error fetching block for ${alchemyNetwork}: ${data.error.message}`);
        }

        // Convert hex to decimal
        return parseInt(data.result, 16);
    } catch (error) {
        console.error(`Failed to fetch block for ${alchemyNetwork}:`, error);
        return 0;
    }
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Update block numbers in either source config or generated files
 */
async function updateGeneratedConfig() {
    // In CI, update the source config.yaml
    // Locally, update the generated files to avoid git changes
    const isCI = !!process.env.CI;

    const configPath = isCI
        ? path.join(__dirname, '..', 'config.yaml')
        : path.join(__dirname, '..', 'generated', 'src', 'ConfigYAML.res');

    // Check if target file exists
    if (!fs.existsSync(configPath)) {
        if (isCI) {
            console.log('❌ config.yaml not found');
        } else {
            console.log('❌ Generated config not found. Run "pnpm codegen" first.');
        }
        return;
    }

    // Skip if no API key (development mode without latest blocks)
    if (!process.env.ALCHEMY_API_KEY) {
        console.log('📦 Starting indexer with configured start blocks (ALCHEMY_API_KEY not set)');
        console.log('   Debug info:', {
            hasAlchemyKey: !!process.env.ALCHEMY_API_KEY,
            isCI: !!process.env.CI,
            nodeEnv: process.env.NODE_ENV,
            cwd: process.cwd()
        });
        return;
    }

    console.log(`🔄 Fetching latest block numbers... (API key: ${process.env.ALCHEMY_API_KEY?.substring(0, 5)}...)`);
    console.log('   Running in CI:', !!process.env.CI);

    // Fetch latest blocks for all chains SEQUENTIALLY with delays to avoid rate limits
    const blocks = [];
    for (const chain of CHAINS) {
        const blockNumber = await getLatestBlock(chain.alchemyNetwork);
        blocks.push({ chainId: chain.id, blockNumber, name: chain.name });

        // Add a small delay between requests to avoid rate limiting
        if (chain !== CHAINS[CHAINS.length - 1]) {
            await sleep(200); // 200ms delay between requests
        }
    }

    // Count successful fetches
    const successfulFetches = blocks.filter(b => b.blockNumber > 0);
    const failedFetches = blocks.filter(b => b.blockNumber === 0);

    if (failedFetches.length > 0) {
        console.log(`⚠️  Failed to fetch blocks for: ${failedFetches.map(b => b.name).join(', ')}`);
    }

    // Read the config file
    let configContent = fs.readFileSync(configPath, 'utf8');

    // Update each chain's start_block
    let updatedCount = 0;

    for (const block of blocks) {
        if (block.blockNumber > 0) {
            if (isCI) {
                // Update YAML format for CI (source config.yaml)
                // Pattern matches: - id: 1\n    start_block: 12345678
                const networkPattern = new RegExp(
                    `(- id: ${block.chainId}\\s*\\n\\s*start_block: )(\\d+)`,
                    'g'
                );

                const matches = Array.from(configContent.matchAll(networkPattern));
                for (const match of matches) {
                    const oldBlock = match[2];
                    const prefix = match[1];

                    if (oldBlock && prefix && parseInt(oldBlock) < block.blockNumber) {
                        const fullMatch = match[0];
                        const newMatch = prefix + block.blockNumber;

                        configContent = configContent.replace(fullMatch, newMatch);

                        console.log(`  ✓ ${block.name}: ${oldBlock} → ${block.blockNumber}`);
                        updatedCount++;
                    }
                }
            } else {
                // Update ReScript format for local development (generated ConfigYAML.res)
                // Pattern looks like: startBlock: 23246973,
                const chainPattern = new RegExp(`ChainMap\\.Chain\\.makeUnsafe\\(~chainId=${block.chainId}\\)`);
                const chainMatch = configContent.match(chainPattern);

                if (chainMatch) {
                    // Find the startBlock within the next few lines after the chain declaration
                    const chainIndex = configContent.indexOf(chainMatch[0]);
                    const searchStart = chainIndex;
                    const searchEnd = Math.min(chainIndex + 500, configContent.length);
                    const searchSection = configContent.slice(searchStart, searchEnd);

                    // Look for startBlock in this section
                    const startBlockPattern = /startBlock:\s*(\d+)/;
                    const startBlockMatch = searchSection.match(startBlockPattern);

                    if (startBlockMatch) {
                        const oldBlock = startBlockMatch[1];
                        const newBlockLine = `startBlock: ${block.blockNumber}`;

                        // Find the exact position of this startBlock in the full content
                        const fullOldBlockLine = searchSection.substring(
                            searchSection.indexOf(startBlockMatch[0]),
                            searchSection.indexOf(startBlockMatch[0]) + startBlockMatch[0].length
                        );

                        // Replace only this specific occurrence
                        const beforeBlock = configContent.substring(0, searchStart);
                        const afterBlock = configContent.substring(searchStart);
                        const updatedAfter = afterBlock.replace(fullOldBlockLine, newBlockLine);
                        configContent = beforeBlock + updatedAfter;

                        console.log(`  ✓ ${block.name}: ${oldBlock} → ${block.blockNumber}`);
                        updatedCount++;
                    }
                }
            }
        }
    }

    if (updatedCount > 0) {
        // Write the updated config back
        fs.writeFileSync(configPath, configContent);
        if (isCI) {
            console.log(`✅ Updated ${updatedCount} chain(s) in config.yaml with latest block numbers`);
            console.log('🎯 CI Mode: Starting indexer from recent blocks for live data');
        } else {
            console.log(`✅ Updated ${updatedCount} chain(s) in generated config with latest block numbers`);
            console.log('🏠 Local Mode: Updated generated files (config.yaml unchanged)');
        }
    } else if (successfulFetches.length === 0) {
        console.log('❌ Could not fetch any block numbers. Using existing configuration.');
    } else {
        console.log('⚠️  No blocks were updated in config');
    }
}

// Run the update
updateGeneratedConfig().catch(console.error);
