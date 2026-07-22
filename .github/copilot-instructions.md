# Copilot instructions

Guidance for AI coding agents working in this repository. The fuller version of this document is [CLAUDE.md](../CLAUDE.md) at the repo root — keep the two in sync.

## Commands

- Build: `npm run build` (`rimraf ./dist` → `tsc` → copy plugin UI html). All steps are required for a working package.
- Lint: `npm run lint` (`eslint . --max-warnings=0`, CI fails on warnings); `npm run lint:fix` to autofix.
- Test: `npm test` (vitest, colocated `src/**/*.test.ts`).
- Local dev loop: `npm run watch` (rebuild + restart on changes; see `nodemon.json`).
- `npm run roomba:getpassword` retrieves a robot's local BLID/password (dorita980's `get-roomba-password`).

## Key architecture facts

- Homebridge dynamic platform plugin (`platform: "Roomba"`) exposing iRobot Roomba vacuums over the robot's **local** network API (no cloud) via the `dorita980` library; each robot needs its BLID + local password.
- `src/index.ts` registers a runtime HAP/Matter proxy (`createPlatformProxy`); keep `api.matter?.…` / Matter calls optional-chained. Matter maps a robot to a `RoboticVacuumCleaner` (`src/matterAccessory.ts`).
- `src/roomba.ts` wraps a `dorita980` local client (TLS + state stream); connections open on demand and tear down after a read to free the robot's single local slot. `dorita980` types live in `src/types/dorita980.d.ts`.
- `RoombaAccessory` (`src/accessory.ts`) exposes a Switch (start/stop clean), Battery, ContactSensor (docked) and FilterMaintenance; timers use `ReturnType<typeof setTimeout>`.
- Log through the platform/accessory log helpers so user logging settings are respected.

## Conventions

- TypeScript ESM: relative imports need `.js` extensions.
- ESLint `@antfu/eslint-config`: single quotes, sorted imports, multi-line braces on guards; run `npm run lint:fix` before committing.
- `config.schema.json` must stay in sync with `RoombaPlatformConfig` in `src/settings.ts`.
- Licensed MIT — keep the LICENSE and upstream attribution intact.
