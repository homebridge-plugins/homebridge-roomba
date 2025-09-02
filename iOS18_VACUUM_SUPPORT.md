# iOS 18 Vacuum Support Status

## Important Notice

**iOS 18 does NOT provide HomeKit vacuum support.** While iOS 18 introduced support for robot vacuums, this support is **Matter-only, not HomeKit HAP**.

## What This Means

- This plugin cannot present your Roomba as a native vacuum cleaner in the Home app
- iOS 18's vacuum-specific UI features are not accessible via HomeKit  
- The plugin will continue to appear as switches and sensors in HomeKit
- No "vacuum" accessory category exists in HomeKit's available categories

## Current Implementation

The plugin presents your Roomba using standard HomeKit services:

- **Switch Service**: Primary control for start/stop
- **Battery Service**: Power level and charging status
- **Contact Sensor Services**: Dock status, running status, bin full, docking status
- **Filter Maintenance Service**: Bin status indication
- **Accessory Category**: Configurable (Other, Switch, or Sensor)

## Alternative Solutions

If you need true vacuum support in iOS 18, consider these options:

### 1. Matter-Compatible Vacuum
Use a vacuum cleaner with native Matter 1.2 support for iOS 18's vacuum features.

### 2. Matterbridge
[Matterbridge](https://github.com/Luligu/matterbridge) is a Matter.js-based bridge that can provide vacuum services. Some users have successfully bridged their Homebridge accessories through Matterbridge to access Matter-specific features.

### 3. Wait for HomeKit Support
Monitor future iOS updates for potential HomeKit vacuum support (though this is unlikely given Apple's focus on Matter).

## Configuration Options

You can configure the accessory category in your device settings:

```json
{
  "accessoryCategory": "other"  // Options: "other", "switch", "sensor"
}
```

- **Other (default)**: Generic accessory icon
- **Switch**: Switch-like icon
- **Sensor**: Sensor-like icon

## Technical Background

Based on HAP-NodeJS issue [#1073](https://github.com/homebridge/HAP-NodeJS/issues/1073), the HomeKit Accessory Protocol (HAP) does not include vacuum cleaner services or characteristics. iOS 18.4 beta confirmed that vacuum support is implemented exclusively through Matter 1.2 clusters, with no parallel HomeKit services.

## Future Updates

This plugin will be updated if HomeKit vacuum support ever becomes available, but current indications suggest this is unlikely given Apple's strategic focus on Matter for new device categories.