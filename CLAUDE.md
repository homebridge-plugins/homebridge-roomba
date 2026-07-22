# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run build` — `rimraf ./dist && tsc && npm run plugin-ui`. The `plugin-ui` step rsyncs `src/homebridge-ui/public/index.html` into `dist/` (the custom settings UI). Skipping it produces a broken published package.
- `npm run lint` — ESLint over the whole repo with `--max-warnings=0`. CI fails on any warning. `npm run lint:fix` to autofix.
- `npm test` — vitest, colocated `src/**/*.test.ts` files. `npm run test:watch` and `npm run test-coverage` also available.
- `npm run watch` — build, `npm link`, then `nodemon`: recompiles and restarts on `src/**/*.ts` changes (see `nodemon.json`).
- `npm run roomba:getpassword` — runs dorita980's `get-roomba-password` helper to retrieve a robot's local BLID/password (needed for the config).
- `npm run roomba:getlastcommand` — `node ./dist/lastcommand.js`, a debugging helper that prints the last command sent to a robot.
- `npm run docs` — typedoc into `docs/` (gitignored — generated output is never committed).
- `npm run prepublishOnly` — lint then build; runs automatically on publish.

CI (`.github/workflows/build.yml`) runs install + lint on Node 22.x/24.x. Releases publish via `.github/workflows/release.yml`: a GitHub release (tag `vX.Y.Z`) publishes to npm's `latest` tag; pushes to `beta-X.Y.Z` / `alpha-X.Y.Z` branches publish incrementing prerelease versions to the `beta` / `alpha` tags.

Supported Node: `^22.12.0 || ^24.0.0`. Homebridge: `^1.11.4 || ^2.0.0`.

## Architecture

Homebridge dynamic platform plugin (`platform: "Roomba"`, package `@homebridge-plugins/homebridge-roomba`) exposing iRobot Roomba vacuums to HomeKit over the robot's **local** network API (no cloud), via the [`dorita980`](https://www.npmjs.com/package/dorita980) library. Each robot needs its BLID and local password, which the user obtains with `npm run roomba:getpassword`.

### HAP/Matter platform selection

`src/index.ts` registers a runtime proxy (`createPlatformProxy`) that instantiates `RoombaMatterPlatform` (`src/Platform.Matter.ts`) when Homebridge reports Matter available+enabled, otherwise the HAP `RoombaPlatform` (`src/Platform.HAP.ts`). Matter API calls must stay optional-chained. The Matter side maps a robot to a `RoboticVacuumCleaner` (`src/matterAccessory.ts`).

### Robot connection (`src/roomba.ts`)

Wraps a `dorita980` local client: connects over TLS to the robot, subscribes to its state stream, and issues clean/dock/pause commands. Connections are opened on demand and torn down after a status read to avoid holding the robot's single local slot. `dorita980` has no bundled types — the local shims live in `src/types/dorita980.d.ts`.

### Accessory (`src/accessory.ts`)

`RoombaAccessory` exposes a **Switch** (start/stop a clean), a **Battery** service, a **ContactSensor** for the dock ("docked"), and **FilterMaintenance**, polling the robot's state on an interval. Timers use `ReturnType<typeof setTimeout>`.

### Logging

Use the platform/accessory log helpers so the user's Homebridge logging settings are respected.

## Conventions

- TypeScript ESM (`"type": "module"`): relative imports use `.js` extensions even from `.ts` source.
- ESLint is `@antfu/eslint-config` (flat config in `eslint.config.js`): single quotes, 1tbs braces, `curly` multi-line only (single-line guards must use full multi-line braces), sorted imports. Run `npm run lint:fix` before committing.
- `config.schema.json` defines the Homebridge UI form and must stay in sync with `RoombaPlatformConfig` in `src/settings.ts`.
- Licensed MIT — keep the LICENSE and upstream attribution intact.
