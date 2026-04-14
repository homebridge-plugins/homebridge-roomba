# Homebridge Roomba Plugin

Homebridge plugin for iRobot Roomba vacuum cleaners. This is a TypeScript-based Homebridge plugin that provides HomeKit integration for Roomba devices, allowing control through Apple's Home app.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Matter and HomeKit Integration

### Matter Implementation
The plugin implements dual-mode device registration:
- **HAP mode** (HomeKit Accessory Protocol): Base implementation via `LutronCasetaLeap` class
- **Matter mode**: Extended via `LutronCasetaLeapMatterPlatform` class that overrides `processDevice()`

When Homebridge's Matter API is available, `LutronCasetaLeapMatterPlatform.processDevice()` registers accessories with both HAP and Matter simultaneously. If Matter API is not available, the plugin transparently falls back to HAP-only mode.

### Matter Device Type Mapping
All Matter device types use `api.matter.deviceTypes.*` objects from the homebridge-matter API:

| Device Type | HAP Service | Matter DeviceType | Matter Clusters |
|---|---|---|---|
| WallDimmer | Lightbulb | `DimmableLight` | onOff, levelControl |
| WallSwitch | Switch | `OnOffLight` | onOff |
| SerenaTiltOnlyWoodBlind | WindowCovering | `WindowCovering` | windowCovering |
| RPSOccupancySensor | OccupancySensor | `OccupancySensor` | occupancySensing |
| Pico Remotes | StatelessProgrammableSwitch | `GenericSwitch` | switch |

### Authoritative Matter References

1. https://matter-js.github.io/docs/index.html
2. https://github.com/homebridge-plugins/homebridge-matter: Official Homebridge Matter plugin repository with extensive documentation and examples
  - For all Matter cluster, attribute, and device type specifications, use the official homebridge-matter wiki:
    - [Introduction](https://github.com/homebridge-plugins/homebridge-matter/wiki/Introduction)
    - [Core Concepts](https://github.com/homebridge-plugins/homebridge-matter/wiki/Core-Concepts)
    - [Getting Started](https://github.com/homebridge-plugins/homebridge-matter/wiki/Getting-Started)
    - [State Management](https://github.com/homebridge-plugins/homebridge-matter/wiki/State-Management)
    - [Monitoring External Changes](https://github.com/homebridge-plugins/homebridge-matter/wiki/Monitoring-External-Changes)
    - [Best Practices](https://github.com/homebridge-plugins/homebridge-matter/wiki/Best-Practices)
    - [Advanced Patterns](https://github.com/homebridge-plugins/homebridge-matter/wiki/Advanced-Patterns)
    - [API Reference](https://github.com/homebridge-plugins/homebridge-matter/wiki/API-Reference)
    - [Matter Types](https://github.com/homebridge-plugins/homebridge-matter/wiki/Matter-Types)
    - [Value Conversions](https://github.com/homebridge-plugins/homebridge-matter/wiki/Value-Conversions)

  - **Device References:**
    - [Lighting Devices (§4)](https://github.com/homebridge-plugins/homebridge-matter/wiki/Section-4-Lighting) — DimmableLight, OnOffLight
    - [Switches (§6)](https://github.com/homebridge-plugins/homebridge-matter/wiki/Section-6-Switches) — OnOffSwitch
    - [Sensors (§7)](https://github.com/homebridge-plugins/homebridge-matter/wiki/Section-7-Sensors) — OccupancySensor
    - [Closure Devices (§8)](https://github.com/homebridge-plugins/homebridge-matter/wiki/Section-8-Closure) — WindowCovering

## Changelog Format Requirements

When generating a changelog release entry, always use this exact structure:

1. Release header with compare URL using `compare/tag/vX.Y.Z`:

```md
## [X.Y.Z](https://github.com/homebridge-plugins/homebridge-updater/compare/tag/vX.Y.Z) (YYYY-MM-DD)
```

2. Standard sections as needed (`### Bug Fixes`, `### Enhancements`, `### Documentation`, etc.).

3. End each release entry with a full changelog comparison URL to the previous version:

```md
**Full Changelog**: https://github.com/homebridge-plugins/homebridge-updater/compare/vX.Y.(Z-1)...vX.Y.Z
```

Do not omit either URL line when creating a new release entry.

## PR Workflow and Beta Branch Requirements

### Branch Targeting Strategy
**ALL PULL REQUESTS MUST TARGET A BETA BRANCH FIRST** - never target the `latest` branch directly.

1. **Check for existing beta branch**: Look for branches starting with `beta-` (e.g., `beta-2.1.1`, `beta-2.2.0`)
2. **If no beta branch exists**: Create one based on the next possible version according to semantic versioning
3. **Target the beta branch**: Always target your PR to the appropriate beta branch

### Version Label Requirements
**CRITICAL**: Before assigning any issue to Copilot, one of these labels MUST be set to determine the version increment:

- **`patch`** - For bug fixes (2.1.0 → 2.1.1)
- **`minor`** - For new features (2.1.0 → 2.2.0) 
- **`major`** - For breaking changes (2.1.0 → 3.0.0)

**No work should begin without the appropriate version label being assigned first.**

### Beta Branch Creation Process
If no appropriate beta branch exists:

1. **For patch changes**: Create `beta-X.Y.Z+1` (e.g., if current is 2.1.0, create `beta-2.1.1`)
2. **For minor changes**: Create `beta-X.Y+1.0` (e.g., if current is 2.1.0, create `beta-2.2.0`)  
3. **For major changes**: Create `beta-X+1.0.0` (e.g., if current is 2.1.0, create `beta-3.0.0`)

```bash
# Example: Creating a beta branch for a minor feature
git checkout latest
git pull origin latest
git checkout -b beta-2.2.0
git push origin beta-2.2.0
```

**Current State**: As of this writing, the current release is 2.1.0 and there is an existing `beta-2.1.1` branch for patch releases.

### Examples of Branch Targeting
- **Bug fix (patch label)** → Target `beta-2.1.1` (if exists) or create it
- **New feature (minor label)** → Target `beta-2.2.0` (create if needed)
- **Breaking change (major label)** → Target `beta-3.0.0` (create if needed)

### Workflow Summary
1. ✅ Check issue has `patch`, `minor`, or `major` label assigned
2. ✅ Identify or create appropriate beta branch
3. ✅ Target PR to beta branch (not `latest`)
4. ✅ Follow normal development workflow below
5. ✅ Use changesets to document your changes (see Publishing Workflow section)

### Integration with Changesets
This project uses [Changesets](https://github.com/changesets/changesets) for version management. When making changes:

1. **Create a changeset** describing your change:
   ```bash
   npm exec changeset
   ```
2. **Select the change type** that matches your issue label:
   - Patch → patch (bug fixes)
   - Minor → minor (new features) 
   - Major → major (breaking changes)
3. **Commit the changeset file** as part of your PR

The changeset type should align with the issue label that was set before assignment.

## Working Effectively

### Bootstrap and Build Process
Always run these commands in sequence for a fresh setup:

```bash
cd /path/to/homebridge-roomba
npm ci  # Install exact dependencies - takes ~40 seconds
npm run build  # Build TypeScript and plugin UI - takes ~5 seconds, NEVER CANCEL
```

Key build commands with validated timings:
- `npm ci` - Install dependencies. Takes ~40 seconds. NEVER CANCEL. Set timeout to 120+ seconds.
- `npm run build` - Clean, compile TypeScript, copy plugin UI. Takes ~5 seconds. NEVER CANCEL. Set timeout to 30+ seconds.
- `npm run clean` - Remove dist folder
- `npm run watch` - Development mode with auto-rebuild and Homebridge restart

### Testing and Quality Assurance
- `npm run test` - Run vitest tests. Takes ~1 second. NEVER CANCEL. Set timeout to 30+ seconds.
- `npm run test-coverage` - Run tests with coverage report. Takes ~2 seconds. NEVER CANCEL. Set timeout to 30+ seconds.
- `npm run test:watch` - Run tests in watch mode for development
- `npm run lint` - Run ESLint validation. Takes ~2.5 seconds. NEVER CANCEL. Set timeout to 30+ seconds.
- `npm run lint:fix` - Auto-fix ESLint issues

### Documentation
- `npm run docs` - Generate TypeDoc documentation in ./docs folder
- `npm run docs:lint` - Validate documentation without generating files
- `npm run docs:theme` - Generate docs with default-modern theme

### Publishing Workflow
This project uses Changesets for version management and release automation:

- `npm exec changeset` - Create a changeset describing your changes (do this for each PR)
- `npm exec changeset version` - Update package.json and CHANGELOG.md (maintainer only)
- `npm exec changeset publish` - Publish to npm (maintainer only)
- `npm run prepublishOnly` - Complete CI workflow: lint + build + docs. Takes ~15 seconds. NEVER CANCEL. Set timeout to 60+ seconds.

**For Contributors**: Always create a changeset when making changes. The type (patch/minor/major) should match the issue label.

**Beta Release Process**: Beta versions are automatically published from beta branches. When a beta branch is ready, it gets merged to `latest` for stable release.

## Validation

### Manual Testing Requirements
After making any code changes, ALWAYS validate:

1. **Build Validation**: Run `npm run build` and ensure no TypeScript compilation errors
2. **Test Validation**: Run `npm run test` and ensure all 3 tests pass
3. **Lint Validation**: Run `npm run lint` to ensure code style compliance
4. **Plugin Structure**: Verify `dist/` folder contains compiled JS files and plugin UI
5. **Roomba Tooling**: Test that `npm run roomba:getpassword` and `npm run roomba:getlastcommand` show proper usage messages

### Integration Testing Scenarios
When testing Roomba functionality (requires actual Roomba device):

1. **Credential Retrieval**: 
   ```bash
   npm run roomba:getpassword <ROOMBA_IP_ADDRESS>
   # Follow on-screen instructions to press Roomba HOME button
   ```

2. **Command History**: 
   ```bash
   npm run roomba:getlastcommand <BLID> <PASSWORD> <IP_ADDRESS>
   # Should return lastCommand with region details
   ```

3. **Homebridge Integration** (in development environment):
   ```bash
   npm run watch
   # Starts Homebridge in development mode with plugin
   # Monitor logs for successful Roomba connection
   ```

Always run `npm run lint` and `npm run test` before committing changes or the CI build (.github/workflows/build.yml) will fail.

## Project Structure and Navigation

### Key Directories
- `src/` - TypeScript source code
  - `index.ts` - Main plugin entry point
  - `platform.ts` - Homebridge platform implementation  
  - `accessory.ts` - Roomba accessory implementation (~1000 lines, core logic)
  - `roomba.ts` - Roomba device communication (~300 lines)
  - `settings.ts` - Plugin configuration constants
  - `lastcommand.ts` - Utility for retrieving Roomba command history
  - `homebridge-ui/` - Plugin configuration UI for Homebridge
- `dist/` - Compiled JavaScript output (auto-generated)
- `docs/` - Generated TypeDoc documentation
- `config.schema.json` - Homebridge plugin configuration schema

### Important Files to Check After Changes
- Always check `src/accessory.ts` after modifying device communication logic
- Always check `config.schema.json` after changing plugin configuration options  
- Always check `src/settings.ts` after modifying plugin constants
- Check generated `dist/` files to ensure proper compilation

## Development Environment

### Node.js Requirements
- **Required**: Node.js v20 or v22 (see .nvmrc)
- **Package Manager**: npm (tested with v10.8.2)
- **Module System**: ES modules (type: "module" in package.json)

### VS Code Configuration
Project includes .vscode/settings.json with workspace settings. Use VS Code for optimal development experience.

### Development Workflow
1. Make changes in `src/` directory
2. Run `npm run build` to compile
3. Run `npm run test` to validate
4. Use `npm run watch` for live development with Homebridge
5. Run `npm run lint:fix` to auto-fix style issues

## Specialized Roomba Functionality

### Getting Roomba Credentials
The plugin requires Roomba BLID and password for local communication:

```bash
# Find Roomba IP address first (check router, use network scanner, etc.)
npm run roomba:getpassword <ROOMBA_IP_ADDRESS>
```

This uses the `get-roomba-password` tool from the dorita980 dependency. Follow the interactive prompts to press the HOME button on your Roomba.

### Testing Roomba Commands
```bash
# Get last cleaning command details
npm run roomba:getlastcommand <BLID> <PASSWORD> <IP_ADDRESS>
```

### Plugin Configuration
- Plugin uses `config.schema.json` for Homebridge UI configuration
- Sample configuration in `sample-config.json`
- Plugin UI component in `src/homebridge-ui/` for advanced configuration

## Common Tasks and Timing Expectations

### Build Times (All are fast - under 30 seconds)
- `npm ci`: ~40 seconds - dependency installation
- `npm run build`: ~5 seconds - TypeScript compilation
- `npm run test`: ~1 second - test execution  
- `npm run lint`: ~2.5 seconds - linting
- `npm run docs`: ~3 seconds - documentation generation
- `npm run prepublishOnly`: ~15 seconds - full CI workflow

### Development Commands
```bash
# Quick validation after changes
npm run build && npm run test && npm run lint

# Full CI-like validation  
npm run prepublishOnly

# Development with auto-restart
npm run watch

# Check for outdated dependencies
npm run check
```

## Common Gotchas

### TypeScript Configuration
- Project uses ES2022 target with ES modules
- Source maps enabled for debugging
- Strict TypeScript checking enabled

### Testing Framework
- Uses Vitest (not Jest)
- Tests in `src/*.test.ts` files
- Coverage reporting available with v8 provider

### Plugin Development
- Uses Homebridge plugin architecture
- Requires specific export structure in `index.ts`
- Plugin UI must be copied to `dist/homebridge-ui/` during build

### Dependencies
- Uses `@karlvr/dorita980` fork for Roomba communication
- Some deprecated dependencies (uuid@3.4.0, request@2.88.2) - these are from dependencies, not our code
- 22 npm audit vulnerabilities present (from dependencies) - this is expected

Remember: Always validate ALL commands work before committing changes. The project has fast build/test cycles, so there's no excuse for skipping validation steps.