# @recallnet/fonts

This package provides font configurations for Recall Network applications. It supports both open-source and private font options.

## Installation

```bash
pnpm add @recallnet/fonts
```

## Usage

```typescript
import { fontSans, fontMono } from '@recallnet/fonts';

// Use in your app
function MyApp() {
  return (
    <div className={`${fontSans.variable} ${fontMono.variable}`}>
      <h1>My App</h1>
      <pre className="font-mono">// This will use the monospace font</pre>
    </div>
  );
}
```

## Features

- Support for both open-source and private fonts
- Configuration for Next.js applications
- CSS variables for easy use with Tailwind CSS

## Open-Source Fonts

By default, the package uses Geist and Geist Mono from Google Fonts.

## Private Fonts

When the `PRIVATE_FONTS` environment variable is set, the package will use private fonts from a private repository. The private fonts are:

- Replica LL Web (sans-serif)
- Trim Mono (monospace)

To use private fonts, set the following environment variables:

- `PRIVATE_FONTS=true`
- `FONTS_REPO_ACCESS_TOKEN=<your_github_token>` (optional, for CI environments)

## License

MIT AND Apache-2.0
