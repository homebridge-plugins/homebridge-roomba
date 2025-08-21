# Homebridge Roomba Plugin

Homebridge plugin for iRobot Roomba vacuum cleaners. This is a TypeScript-based Homebridge plugin that provides HomeKit integration for Roomba devices, allowing control through Apple's Home app.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

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
- `npm run prepublishOnly` - Complete CI workflow: lint + build + docs. Takes ~15 seconds. NEVER CANCEL. Set timeout to 60+ seconds.

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