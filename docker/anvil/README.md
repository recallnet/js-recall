# Pre-baked Anvil Image

This directory contains the Docker setup for a local dev anvil node with pre-deployed staking contracts.

## Files

- `Dockerfile` - Builds the custom anvil image
- `anvil-state.json` - Pre-dumped blockchain state with deployed contracts and funded accounts
- `rebuild-state.sh` - Script uses docker to build, start anvil, deploy contracts, fund accounts, etc... When finished it will clean up the docker artifacts, and copy the resulting blockchain state file into this repo.
- `generate-state.sh` - Used inside a docker container to deploy contracts, etc...

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
