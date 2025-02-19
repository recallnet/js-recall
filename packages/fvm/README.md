# `@recallnet/fvm`

> FVM/Wasm interactions for the Recall network

## Table of Contents

- [Background](#background)
- [Usage](#usage)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Background

This package contains the FVM/Wasm interactions for the Recall network. It is a fork of certain packages from the [Zondax](https://github.com/Zondax/izari-filecoin) FVM library, altered to support web environments.

## Usage

There entrypoints are exported:

- `@recallnet/fvm/address`: Wasm/FVM-specific address utilities
- `@recallnet/fvm/artifacts`: Related low-level address components
- `@recallnet/fvm/utils`: Utility functions like CBOR or LEB128 encoding/decoding

Most often, you won't need to interact with this package directly.

## Development

Install dependencies:

```bash
pnpm install
```

Run the tests:

```bash
pnpm run test
```

Build the package:

```bash
pnpm run build
```

## Contributing

PRs accepted.

Small note: If editing the README, please conform to
the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

MIT OR Apache-2.0, © 2025 Recall Network Corporation
