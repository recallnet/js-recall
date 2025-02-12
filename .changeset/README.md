# Changesets

This folder is been automatically generated and used by the [`@changesets/cli`](https://github.com/changesets/changesets), a build tool for monorepo package versioning and publishing. It allows you to define changes to code and release packages automatically—while also keeping track of the changes in a changelog.

## Creating a new changeset

This will open the edits, let you select the packages that have been changed, and then add a commit message. The commit message will be used to generate the changelog and first written to the `.changeset` folder as new file.

```bash
pnpm changeset
```

## Adding a new version

When you run the `version` subcommand, it will generate a new version for all packages that have a changeset. That is, it will update the `package.json` files in all the packages that have been changed, and write a new changelog entry in each package's `CHANGELOG.md` file.

```bash
pnpm changeset version
```

## Setting prerelease versions

You can also [set prerelease](https://github.com/changesets/changesets/blob/main/docs/prereleases.md) versions. It's best to run this before the `changeset` or `version` commands, as it'll hold the pattern until you exit.

```bash
pnpm changeset pre enter <name>
```

For example, to create a prerelease version with the `alpha` tag:

```bash
pnpm changeset pre enter alpha
```

This will append the tag like `0.0.0-alpha.0` to the version in all the changed packages. It'll continue holding this pattern until you exit—and then you'll have full control again:

```bash
pnpm changeset pre exit
```

## Publishing packages

This will publish all the packages that have been changed to the configured registry. There is a `publish-packages` script that will do this for you, but a GitHub workflow should do this automatically when you create a release and merge it into the `main` branch.

```bash
pnpm publish-packages
```
