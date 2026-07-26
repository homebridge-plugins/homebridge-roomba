<p align="center">
   <a href="https://github.com/homebridge-plugins/homebridge-roomba"><img alt="homebridge-roomba" src="https://raw.githubusercontent.com/homebridge-plugins/homebridge-roomba/latest/branding/Homebridge_x_Roomba.png" width="600px"></a>
</p>
<span align="center">

## homebridge-roomba

Homebridge plugin to integrate iRobot Roomba vacuums into HomeKit

[![npm](https://img.shields.io/npm/v/@homebridge-plugins/homebridge-roomba/latest?label=latest)](https://www.npmjs.com/package/@homebridge-plugins/homebridge-roomba)
[![npm](https://img.shields.io/npm/v/@homebridge-plugins/homebridge-roomba/beta?label=beta)](https://github.com/homebridge/homebridge/wiki/How-to-Install-Alternate-Plugin-Versions)<br>
[![npm](https://img.shields.io/npm/dt/@homebridge-plugins/homebridge-roomba)](https://www.npmjs.com/package/@homebridge-plugins/homebridge-roomba)
[![Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=hb-discord)](https://discord.gg/bHjKNkN)

</span>

### Plugin Information

- This plugin allows you to view and control your iRobot Roomba vacuums within HomeKit. The plugin:
  - connects to each Roomba directly over your local network
  - needs the robot's BLID and local password:
    - run `npx get-roomba-password` (this works however you installed the plugin - `npm run roomba:getpassword` only works from a manual checkout, not a Homebridge UI install)
    - newer robots, including the j series, no longer hand the password out over the network. If that command ends with `Error getting password`, use `npx get-roomba-password-cloud <iRobot email> <iRobot password>` instead, which fetches it from your iRobot account
  - can optionally expose robots over Matter as well as HomeKit

### Prerequisites

- To use this plugin, you will need to already have:
  - [Node](https://nodejs.org): latest version of `v22` or `v24` - any other major version is not supported.
  - [Homebridge](https://homebridge.io): `v2` - refer to link for more information and installation instructions.
  - A Wi-Fi connected Roomba on the same network as Homebridge.

### Setup

- [Installation](https://github.com/homebridge-plugins/homebridge-roomba/wiki/Installation)
- [Configuration](https://github.com/homebridge-plugins/homebridge-roomba/wiki/Configuration)
- [Beta Version](https://github.com/homebridge-plugins/homebridge-roomba/wiki/Beta-Version)
- [Node Version](https://github.com/homebridge-plugins/homebridge-roomba/wiki/Node-Version)

### Features

- A switch to start and stop a clean
- Battery level and charging state
- A contact sensor that reports when the Roomba is docked
- Filter maintenance status

### Help/About

- [Common Errors](https://github.com/homebridge-plugins/homebridge-roomba/wiki/Common-Errors)
- [Support Request](https://github.com/homebridge-plugins/homebridge-roomba/issues/new/choose)
- [Changelog](https://github.com/homebridge-plugins/homebridge-roomba/blob/latest/CHANGELOG.md)
- [About Me](https://github.com/sponsors/bwp91)

### Credits

- To Rayan Khan: the original creator of this plugin.
- To the [`dorita980`](https://www.npmjs.com/package/dorita980) library, which provides the local Roomba API.
- To the creators/contributors of [Homebridge](https://homebridge.io) who make this plugin possible.

### Disclaimer

- I am in no way affiliated with iRobot and this plugin is a personal project that I maintain in my free time.
- Use this plugin entirely at your own risk - please see licence for more information.
