---
"@homebridge-plugins/homebridge-roomba": major
---

Add Homebridge Matter support for Homebridge v2.0

When running on Homebridge v2 with Matter enabled, Roomba devices are now
registered as Matter RoboticVacuumCleaner accessories in addition to the
existing HAP (HomeKit Accessory Protocol) support.

- If Matter is available and enabled, it is preferred by default
- Users can disable Matter per-plugin by setting `enableMatter: false`
- The existing HAP platform is used as a fallback when Matter is unavailable or Matter initialization fails
