FROM ghcr.io/foundry-rs/foundry:latest

COPY anvil-state.json /anvil-state.json

EXPOSE 8545

ENTRYPOINT ["anvil", "--host", "0.0.0.0", "--chain-id", "31337", "--block-time", "1", "--load-state", "/anvil-state.json"]
