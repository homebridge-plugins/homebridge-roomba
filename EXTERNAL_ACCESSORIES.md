# External Accessories and Matter Support

This plugin now supports publishing each Roomba as an external accessory instead of platform accessories under a bridge. This feature is designed to prepare for and enhance compatibility with Matter support in Homebridge.

## What are External Accessories?

**Platform Accessories** (default behavior):
- All Roomba devices appear under a single "Roomba" bridge
- Devices are grouped together in the Home app
- Traditional Homebridge plugin behavior

**External Accessories** (new feature):
- Each Roomba appears as a separate, independent device in HomeKit
- Better compatibility with Matter bridging protocols
- Future-proof for advanced HomeKit/Matter features

## Configuration

Add the `externalAccessories` option to your platform configuration:

```json
{
  "platform": "Roomba",
  "name": "Roomba",
  "email": "your-email@example.com", 
  "password": "your-password",
  "externalAccessories": true
}
```

## Benefits of External Accessories

### Matter Compatibility
- Prepares your setup for Matter support in Homebridge alpha/beta versions
- Each device can be individually exposed to Matter networks
- Better integration with Thread/Matter ecosystems

### Individual Device Management
- Each Roomba appears as a separate tile in the Home app
- Independent device management and troubleshooting
- Cleaner organization in larger smart home setups

### Enhanced Reliability
- If one Roomba has connectivity issues, it doesn't affect others
- Individual device restarts and management
- Reduced dependency on the main bridge

## Migration Notes

### Switching from Platform to External Accessories
1. **Backup your current setup** - Export your Home app configuration
2. **Update plugin configuration** - Add `"externalAccessories": true`
3. **Restart Homebridge** - The devices will appear as new accessories
4. **Re-add to Home app** - You'll need to scan the new QR codes
5. **Reconfigure automations** - Update any scenes/automations using the old accessories

### Important Considerations
- External accessories require individual pairing in the Home app
- Each external accessory has its own HomeKit pairing code
- Switching modes will require re-pairing all devices
- Existing automations and scenes will need to be recreated

## Matter Support Preparation

This feature prepares your Roomba devices for future Matter support:

### Current Status
- **HomeKit HAP**: Full support with external accessories
- **Matter**: Ready for future Homebridge Matter implementation
- **iOS 18 Vacuum Features**: Matter-only (not available in HomeKit HAP)

### Future Roadmap
When Homebridge adds full Matter support:
- External accessories will be easier to bridge to Matter
- Individual device control via Matter controllers
- Enhanced iOS 18 vacuum features when bridged to Matter

## Troubleshooting

### Accessories Not Appearing
1. Check Homebridge logs for errors
2. Ensure `externalAccessories: true` is set
3. Restart Homebridge completely
4. Check QR codes in Homebridge UI

### Re-pairing Issues  
1. Reset HomeKit database if needed: `homebridge-config-ui-x > Settings > Reset Accessory Cache`
2. Clear iOS Home app cache: Remove and re-add the Home
3. Check Homebridge logs for pairing errors

### Performance Considerations
- External accessories may use slightly more system resources
- Each device maintains its own connection state
- Monitor Homebridge performance if you have many devices

## Advanced Configuration

You can combine external accessories with other plugin features:

```json
{
  "platform": "Roomba",
  "name": "Roomba", 
  "email": "your-email@example.com",
  "password": "your-password",
  "externalAccessories": true,
  "devices": [
    {
      "name": "Kitchen Roomba",
      "blid": "your-blid",
      "robotpwd": "your-password", 
      "ipaddress": "192.168.1.100",
      "accessoryCategory": "switch",
      "dockContactSensor": true,
      "runningContactSensor": true
    }
  ]
}
```

## Related Documentation

- [Main README](./README.md) - General plugin setup and configuration
- [iOS 18 Vacuum Support](./iOS18_VACUUM_SUPPORT.md) - Matter vs HomeKit vacuum limitations
- [Homebridge External Accessories Documentation](https://developers.homebridge.io/#/api/platform-accessories?id=external-accessories)