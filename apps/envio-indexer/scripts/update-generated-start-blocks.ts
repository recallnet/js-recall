#!/usr/bin/env tsx
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables from the envio-indexer directory
config({ path: path.join(__dirname, '..', '.env') });

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
 * Update the generated ConfigYAML.res file with latest block numbers
 */
async function updateGeneratedConfig() {
    const generatedConfigPath = path.join(__dirname, '..', 'generated', 'src', 'ConfigYAML.res');

    // Check if generated file exists
    if (!fs.existsSync(generatedConfigPath)) {
        console.log('Generated config not found. Run "pnpm codegen" first.');
        return;
    }

    // Skip if no API key (development mode without latest blocks)
    if (!process.env.ALCHEMY_API_KEY) {
        console.log('📦 Starting indexer with configured start blocks (ALCHEMY_API_KEY not set)');
        return;
    }

    console.log('🔄 Fetching latest block numbers...');

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

    // Read the generated config file
    let configContent = fs.readFileSync(generatedConfigPath, 'utf8');

    // Count successful fetches
    const successfulFetches = blocks.filter(b => b.blockNumber > 0);
    const failedFetches = blocks.filter(b => b.blockNumber === 0);

    if (failedFetches.length > 0) {
        console.log(`⚠️  Failed to fetch blocks for: ${failedFetches.map(b => b.name).join(', ')}`);
    }

    // Update each chain's startBlock
    let updatedCount = 0;
    for (const block of blocks) {
        if (block.blockNumber > 0) {
            // Find and replace the startBlock for this chain
            // The pattern looks like: let chain = ChainMap.Chain.makeUnsafe(~chainId=1)
            // followed by startBlock: 23246973,

            // First find the chain declaration
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
                    const oldBlockLine = `startBlock: ${oldBlock}`;

                    // Find the exact position of this startBlock in the full content
                    // to avoid replacing the wrong one
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

    if (updatedCount > 0) {
        // Write the updated config back
        fs.writeFileSync(generatedConfigPath, configContent);
        console.log(`✅ Updated ${updatedCount} chain(s) with latest block numbers`);
    } else if (successfulFetches.length === 0) {
        console.log('❌ Could not fetch any block numbers. Using existing configuration.');
    } else {
        console.log('⚠️  No blocks were updated in config');
    }
}

// Run the update
updateGeneratedConfig().catch(console.error);
