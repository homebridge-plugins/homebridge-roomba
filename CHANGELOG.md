## v3.0.2 (Pending Release)

### Changed

- chore(github): release on a published github release, not every push to latest
- chore(github): align workflows, funding and issue templates with the other org plugins
- chore: standardise the eslint setup and apply the org lint rules
- chore: align the npm publishing files with the other org plugins
- chore: standardise the package manifest with the other org plugins
- docs: add claude and copilot instructions files
- docs: use the standard org readme banner

# [3.0.0](https://github.com/homebridge-plugins/homebridge-roomba/compare/v2.1.1...v3.0.0) (2026-05-04)


### Bug Fixes

* address review feedback - listener leak, unused vars, import order, configureAccessory no-op ([f917d06](https://github.com/homebridge-plugins/homebridge-roomba/commit/f917d0618ca7ebb48a1793b4c6958b42bd5e9175))
* American English spelling and JSON indentation in config.schema.json ([6966b56](https://github.com/homebridge-plugins/homebridge-roomba/commit/6966b563d5d467bb8bd873bf2ec3b7388f2d084c))


### Features

* add externalAccessory option for HAP and Matter platforms ([bfcbd56](https://github.com/homebridge-plugins/homebridge-roomba/commit/bfcbd5622a39d4028f0502642746e7a3b5212e61))
* add Homebridge Matter support for Homebridge v2.0 ([1af0013](https://github.com/homebridge-plugins/homebridge-roomba/commit/1af001366b3b73d2fbc15a00f45ddbd107a584ae))



# Changelog

## [3.0.0](https://github.com/homebridge-plugins/homebridge-roomba/compare/tag/v3.0.0) (2026-05-04)

### Breaking Changes

- Homebridge Matter support is now the default when running on Homebridge v2 with Matter enabled. Roomba devices are registered as `RoboticVacuumCleaner` Matter accessories. Set `enableMatter: false` to keep the existing HAP-only behaviour.
- Platform files renamed: `platform.ts` → `Platform.HAP.ts`, `matterPlatform.ts` → `Platform.Matter.ts`. Affects contributors and any tooling referencing these paths directly.
- `preferMatter` config option removed; use `enableMatter` instead.

### Enhancements

- Add Homebridge Matter support for Homebridge v2.0 — Roomba devices are registered as `RoboticVacuumCleaner` Matter accessories when running on Homebridge v2 with Matter enabled. Falls back to HAP automatically when Matter is unavailable or fails to initialize.
- Add `externalAccessory` config option (platform-level and per-device) to publish Roomba as an independent HomeKit bridge with its own QR code.
- Add Braava m6 water tank status as a filter maintenance indicator.

### Bug Fixes

- Fix UDP socket leak in Roomba auto-discovery (`getIP`): each retry attempt now properly closes its socket before opening the next one, preventing socket and timer accumulation across failed attempts.
- Fix Matter cached accessory re-registration on every Homebridge restart: cached (restored) accessories are no longer passed to `registerPlatformAccessories`, which was causing duplicate registration errors.
- Fix RVC operational state mapping: `charging` now correctly maps to `Charging (65)` instead of `Docked (66)`.

### Dependencies

- Updated all dependencies to latest versions.
- Migrated from `@karlvr/dorita980` to `dorita980 v4`.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-roomba/compare/v2.1.0...v3.0.0

## [2.1.0](https://github.com/homebridge-plugins/homebridge-roomba/releases/tag/v2.1.0) (2025-03-04)

### What's Changes
- *BETA* Added option to use iRobot credentials to get devices info.
- Set default idleWatchInterval for plugin, but allow for override per device or overall plugin.
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-roomba/compare/v2.0.0...v2.1.0

## [2.0.0](https://github.com/homebridge-plugins/homebridge-roomba/releases/tag/v2.0.0) (2025-03-04)

### What's Changes
#### Major Changes
- Change from `Accessory` base to `Platform` based Plugin
  - ***You will need to re-setup your vacuum***
    - You can reuse your config by taking your `serialnum`, `blid`, `robotpwd`, `ipaddress` from the Accessory config and input it in the Homebridge UI when adding a new device.
- Pluging has been renamed from `homebridge-roomba2` to `homebridge-roomba` now that it is a scoped plugin.
- Compaitable with Homebridge `v2.0.0`

#### Other Changes
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-roomba/compare/v1.5.3...v2.0.0

## [1.5.3](https://github.com/homebridge-plugins/homebridge-roomba/releases/tag/v1.5.3) (2025-01-24)

### What's Changes
- Fixed `require is not defined` [#148](https://github.com/homebridge-plugins/homebridge-roomba/issues/148)

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-roomba/compare/v1.5.2...v1.5.3

## [1.5.2](https://github.com/homebridge-plugins/homebridge-roomba/releases/tag/v1.5.2) (2025-01-24)

### What's Changes
- Fixed `Cannot find module` Issue [#148](https://github.com/homebridge-plugins/homebridge-roomba/issues/148)

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-roomba/compare/v1.5.1...v1.5.2

## [1.5.1](https://github.com/homebridge-plugins/homebridge-roomba/releases/tag/v1.5.1) (2025-01-23)

### What's Changes
- Fixed Cannot find module Issue [#148](https://github.com/homebridge-plugins/homebridge-roomba/issues/148)
- Housekeeping and updated dependencies.

**Full Changelog**: https://github.com/homebridge-plugins/homebridge-roomba/compare/v1.5.0...v1.5.1

## 1.5.0

### Minor Changes

- Add clean specific rooms behaviour from @boomseklecki
- 695324d: Add more help and restructure the configuration schema
- 8220909: Attempt multiple ciphers when connecting to Roomba to support newer Roomba models

### Patch Changes

- d1ea23f: Make retrying connection log a debug log
- 7a98203: `getlastcommand` script doesn't require `npm install`
- f70fe7f: Fix build issue
- 70ed087: Attempt different ciphers based on error message seen from i1+

## 1.5.0-beta.4

### Patch Changes

- 7a98203: `getlastcommand` script doesn't require `npm install`

## 1.5.0-beta.3

### Minor Changes

- Add clean specific rooms behaviour from @boomseklecki

## 1.5.0-beta.2

### Patch Changes

- d1ea23f: Make retrying connection log a debug log
- 70ed087: Attempt different ciphers based on error message seen from i1+

## 1.5.0-beta.1

### Patch Changes

- f70fe7f: Fix build issue

## 1.5.0-beta.0

### Minor Changes

- 695324d: Add more help and restructure the configuration schema
- 8220909: Attempt multiple ciphers when connecting to Roomba to support newer Roomba models

## 1.4.0

### Minor Changes

- 8edc43f: Change terminology from "watch" to "poll"
- 1bfd4d1: Keep checking Roomba's status frequently for two minutes after it has been active [#112]
- aa07d0e: Fix upstream dorita980 to fix node 18 TLS fault when connecting to Roomba
- eb29f42: Upgrade dorita980 to resolve Node 18 connection issues [#126]
- bd7c6c1: Add cipher to dorita980 to support J7 [#106]
- 5e9a0f2: Make the idle watch interval configurable
- 64a137b: Support evac phase [#114]
- 931ba0d: Make starting Roomba more reliable by tacking whether a clean cycle is paused
- 63a3a40: Decrease the frequency of Roomba status queries when Roomba is idle [#112]

  Based on work by @Write. Also tidied up the handling of async in the connect method
  and re-wrote the status watching approach.

### Patch Changes

- 09ef460: Don't use state from cache if we want to force a refresh
- c438513: Change max cache age to reflect current polling rate
- 342a814: Fix custom dorita980 dependency
- 80c790b: Simplify robot password script running
- b646681: Fix too many close listeners warning when refreshing state
- 6f697d0: Don't double-log connect timeouts
- 7cc3440: Fix Homebridge crash due to ECONNREFUSED is dorita980 cannot connect to Roomba
- 27dc29b: Refactor watch loop to ensure no double-ups
- 404bb02: Fix "Releasing an unexpected Roomba instance" logging after a timeout
- e1989e4: Update to node 18 and upgrade dependencies

## 1.3.2-beta.5

### Patch Changes

- c438513: Change max cache age to reflect current polling rate
- 8edc43f: Change terminology from "watch" to "poll"
- 27dc29b: Refactor watch loop to ensure no double-ups

## 1.3.2-beta.4

### Patch Changes

- 1bfd4d1: Keep checking Roomba's status frequently for two minutes after it has been active [#112]
- 931ba0d: Make starting Roomba more reliable by tacking whether a clean cycle is paused

## 1.3.2-beta.3

### Patch Changes

- b646681: Fix too many close listeners warning when refreshing state
- 7cc3440: Fix Homebridge crash due to ECONNREFUSED is dorita980 cannot connect to Roomba
- 5e9a0f2: Make the idle watch interval configurable
- 63a3a40: Decrease the frequency of Roomba status queries when Roomba is idle [#112]

  Based on work by @Write. Also tidied up the handling of async in the connect method
  and re-wrote the status watching approach.

## 1.3.2-beta.2

### Patch Changes

- 64a137b: Support evac phase [#114]

## 1.3.2-beta.1

### Patch Changes

- 342a814: Fix custom dorita980 dependency

## 1.3.2-beta.0

### Patch Changes

- 09ef460: Don't use state from cache if we want to force a refresh
- 80c790b: Simplify robot password script running
- aa07d0e: Fix upstream dorita980 to fix node 18 TLS fault when connecting to Roomba
- eb29f42: Upgrade dorita980 to resolve Node 18 connection issues [#126]
- bd7c6c1: Add cipher to dorita980 to support J7 [#106]
- 6f697d0: Don't double-log connect timeouts
- 404bb02: Fix "Releasing an unexpected Roomba instance" logging after a timeout
- e1989e4: Update to node 18 and upgrade dependencies

## 1.3.1

### Patch Changes

- d69dcf0: Reduce info logging so the plugin is a lot quieter when not in debug logging mode
- 438e99c: Add debug option to config schema

## 1.3.0

### Minor Changes

- ae578c0: Refactor Roomba connection handling to improve reporting of issues connecting to Roomba and to reuse
  existing Roomba connections to avoid conflicts [#66]
- e7f574c: Organise config schema into sections and rename options
- 5ab1507: Increase the frequency of Roomba status checks in order to support automations
- 2863a49: Rename noDockOnStop to dockOnStop [#73 #74] (thanks @rcoletti116, @khad)
- f15404e: Added support for Identify method (supported in 3rd party HomeKit apps)
- 3e9e48b: Include a resume command when starting cleaning so we can cope with a paused Roomba
- 44c6f8a: Actively watch Roomba's status and update HomeKit for a short period of time after being inspected

  HomeKit inspects Roomba when you open the Home app, but it doesn't continously poll for changes
  so the plugin now watches Roomba for changes and pushes them to the Home app.

- b7322c0: Add docking contact sensor
- 721c3a6: Add a setting to control whether Roomba is sent home when stopped [#63] (thanks @rcoletti116)
- 0e87755: Add Home switch as separate to docking contact sensor
- 28eeeec: Report current plugin version as the firmware version
- 8ab5243: Change docking sensor to a switch so you can trigger docking
- e32d078: Add a long-term slow watching of Roomba's status so we always have a status
- 44c026c: Stop behaviour now checks what state Roomba is in and no longer triggers a docking if Roomba is already docked
- aac6159: Change state refresh approach to be on demand rather than constant polling
  or keeping a permanent connection.
- 6dbb668: Convert to using TypeScript and pnpm for development
- 853b39e: Overhauled Roomba connections and status again, status gathering is now more passive

### Patch Changes

- Enable serial number to be specified in the configuration
- Change the manufacturer reported to HomeKit to iRobot
- f71c085: Add source code linting
- 05ca4e6: Improve handling around connections to Roomba that timeout
- b3a25b0: Debug logging improvements and re-including the raw status in debug logs
- 58cba16: Improve Roomba connection handling
- 032098a: Improve the log message when Roomba fails to complete a docking manoeuvre
- e623a28: Rename Docked contact sensor to Dock
- 1f02665: Improve the default name of the Bin Full sensor
- b9daed9: Recognise more Roomba phases, including more docking phases and stuck
- 73b02d3: Add a timeout when waiting for the full status from Roomba so we release our connection to Roomba
- c8ce152: Only update characteristics with changes
- e79b7a3: Update dependencies
- 477f571: Upgrade dependencies including dorita980 to address #81
- f100e9f: Refresh Roomba's status after every action so we update our version of Roomba's state ASAP.

  The previous approach of updating the state directly had a race condition with pre-existing updates of Roomba's state.

- 5399dbb: Fix delay when trying to dock
- 1346008: Logging more efficient and added a switch to enable easier debug logging

## 1.3.0-beta.11

### Patch Changes

- 477f571: Upgrade dependencies including dorita980 to address #81

## 1.3.0-beta.10

### Minor Changes

- e7f574c: Organise config schema into sections and rename options
- 0e87755: Add Home switch as separate to docking contact sensor

## 1.3.0-beta.9

### Minor Changes

- 8ab5243: Change docking sensor to a switch so you can trigger docking

## 1.3.0-beta.8

### Minor Changes

- 5ab1507: Increase the frequency of Roomba status checks in order to support automations

### Patch Changes

- 05ca4e6: Improve handling around connections to Roomba that timeout
- f100e9f: Refresh Roomba's status after every action so we update our version of Roomba's state ASAP.

  The previous approach of updating the state directly had a race condition with pre-existing updates of Roomba's state.

## 1.3.0-beta.7

### Minor Changes

- 2863a49: Rename noDockOnStop to dockOnStop [#73 #74] (thanks @rcoletti116, @khad)

## 1.3.0-beta.6

### Minor Changes

- e32d078: Add a long-term slow watching of Roomba's status so we always have a status

## 1.3.0-beta.5

### Patch Changes

- 73b02d3: Add a timeout when waiting for the full status from Roomba so we release our connection to Roomba
- c8ce152: Only update characteristics with changes

## 1.3.0-beta.4

### Patch Changes

- b3a25b0: Debug logging improvements and re-including the raw status in debug logs

## 1.3.0-beta.3

### Minor Changes

- 853b39e: Overhauled Roomba connections and status again, status gathering is now more passive

### Patch Changes

- 5399dbb: Fix delay when trying to dock

## 1.3.0-beta.2

### Minor Changes

- 721c3a6: Add a setting to control whether Roomba is sent home when stopped [#63] (thanks @rcoletti116)
- 44c026c: Stop behaviour now checks what state Roomba is in and no longer triggers a docking if Roomba is already docked

### Patch Changes

- b9daed9: Recognise more Roomba phases, including more docking phases and stuck

## 1.3.0-beta.1

### Patch Changes

- 58cba16: Improve Roomba connection handling

## 1.3.0-beta.0

### Minor Changes

- ae578c0: Refactor Roomba connection handling to improve reporting of issues connecting to Roomba and to reuse
  existing Roomba connections to avoid conflicts [#66]
- 3e9e48b: Include a resume command when starting cleaning so we can cope with a paused Roomba
- 44c6f8a: Actively watch Roomba's status and update HomeKit for a short period of time after being inspected

  HomeKit inspects Roomba when you open the Home app, but it doesn't continously poll for changes
  so the plugin now watches Roomba for changes and pushes them to the Home app.

- b7322c0: Add docking contact sensor
- 28eeeec: Report current plugin version as the firmware version
- aac6159: Change state refresh approach to be on demand rather than constant polling
  or keeping a permanent connection.
- 6dbb668: Convert to using TypeScript and pnpm for development

### Patch Changes

- Enable serial number to be specified in the configuration
- Change the manufacturer reported to HomeKit to iRobot
- f71c085: Add source code linting
- 032098a: Improve the log message when Roomba fails to complete a docking manoeuvre
- e623a28: Rename Docked contact sensor to Dock
- 1f02665: Improve the default name of the Bin Full sensor
- e79b7a3: Update dependencies
- 1346008: Logging more efficient and added a switch to enable easier debug logging

## 1.2.2

### Patch Changes

- 50a3640: Updated sample-config.json with accurate plugins section [#47]
- 450333e: Change the logging of each status request to debug level to reduce log noise [#50]
- 20d74fc: Fix double calling of the callback when using an expired status [#49]

## 1.2.1 (2021-02-01)

- Fix filterMaintenance service not being published properly, thanks @m-ruhl [#24]

## 1.2.0 (2020-05-12)

- Fixes #10 (Thank you @dvcrn) [PR: #16]

## 1.1.0 (2020-10-29)

- Added support for bin full notifications.

## 1.0.0 (2020-10-28)

- Plugin verified

## 0.0.2 (2020-10-28)

- Fixed (#1)

- Fied a typo in config.schema.json line 34, thanks @benasher44

## 0.0.1 (2020-10-20)

- Base plugin

- Added Contact sensor for running/docked notifications in home app, thanks @ncovercash
