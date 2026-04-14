---
"@homebridge-plugins/homebridge-roomba": major
---

Convert platform registration to dynamic platform by including PLUGIN_NAME in the registerPlatform call. This enables multiple platform instances (e.g., for multiple homes/locations) by using `api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, RoombaPlatform)` instead of the 2-argument form.
