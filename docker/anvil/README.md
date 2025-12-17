# Pre-baked Anvil Image

This directory contains the Docker setup for an anvil node with pre-deployed staking contracts.

## Files

- `Dockerfile` - Builds the custom anvil image
- `anvil-state.json` - Pre-dumped blockchain state with deployed contracts
- `rebuild-state.sh` - Script to regenerate the state file

## When to rebuild

Rebuild the state if:

- Staking contracts change
- Deploy scripts change
- You need to reset to a clean state

## How to rebuild

```bash
# From repo root:
./docker/anvil/rebuild-state.sh

# Then rebuild the image:
docker-compose build anvil
```

## Contract Addresses

After deployment, contract addresses are saved in:
`packages/staking-contracts/contracts/deployments/docker/`
