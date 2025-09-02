<span align="center">

# homebridge-roomba

<a href="https://www.npmjs.com/package/@homebridge-plugins/homebridge-roomba"><img title="npm version" src="https://badgen.net/npm/v/@homebridge-plugins/homebridge-roomba" ></a>
<a href="https://www.npmjs.com/package/@homebridge-plugins/homebridge-roomba"><img title="npm downloads" src="https://badgen.net/npm/dt/@homebridge-plugins/homebridge-roomba?label=downloads" ></a>

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

</span>

## Features

- Roomba start on demand
- Roomba stop and dock on demand
- Roomba charging status
- Roomba battery level (with low battery warning)
- Roomba docked notification
- Roomba running notification
- Roomba bin full notification
- Find Roomba (Identify Function, supported in 3rd Party HomeKit apps)

The homebridge-roomba plugin polls Roomba for its status when requested by HomeKit, so when you first open
the Home app you may see an old status, or no status, until Roomba has had time to respond (which may take
a few seconds).

## Installation

1. Use the [Homebridge UI](https://github.com/homebridge/homebridge-config-ui-x)’s Plugins screen to search for and install "homebridge-roomba"
2. Follow [Setup](#setup) to get Roomba credentials and to configure your Roomba
3. Restart Homebridge

### Manual Installation

1. Install Homebridge: `sudo npm i -g homebridge --unsafe-perm`
2. Download this plugin: `sudo npm i -g @homebridge-plugins/homebridge-roomba`
3. Follow [Setup](#setup) to get Roomba credentials
4. Enter Roomba's credentials in your `config.json` file.
5. Restart Homebridge

## Setup

1. Find your Roomba's IP address (for help see the [troubleshooting](#troubleshooting) section); it will look like `192.168.X.XXX` or `10.X.X.XXX`, or similar.
2. Open a terminal on your Homebridge system, either using `ssh` or by using the Homebridge Terminal located in the &vellip; menu, top-right in the Homebridge UI.
3. Change into the directory where the plugin is installed: `cd $(npm root -g)/homebridge-roomba`
4. Type `npm run roomba:getpassword <IP ADDRESS>` (replacing `<IP ADDRESS>` with the IP address you discovered above).
5. Follow the instructions on screen to obtain your Roomba's `blid` and password. NB: Read the instructions carefully and ensure that you're pressing and holding the correct button on your Roomba.
6. Proceed to _Configuration_.

## Configuration

This plugin supports GUI-based configuration using [Homebridge UI](https://github.com/homebridge/homebridge-config-ui-x), which is the recommended
approach for configuring your Roomba.

### Manual configuration

Here is example JSON for configuring a Roomba accessory:

```json
{
  "accessory": "Roomba",
  "name": "Roomba",
  "model": "960",
  "blid": "1234567890",
  "robotpwd": "aPassword",
  "ipaddress": "192.168.x.xxx",
  "dockContactSensor": true,
  "runningContactSensor": true,
  "binContactSensor": true,
  "cleanBehaviour": "rooms",
  "mission": {
    "ordered": 1,
    "pmap_id": "ab1cd_eFGhiJklMN2PqRsT",
    "regions": [
      {
        "region_id": "1",
        "type": "rid",
        "params": {
          "noAutoPasses": true,
          "twoPasses": true
        }
      }
    ],
    "user_pmapv_id": "220101T120101"
  },
  "stopBehaviour": "home"
}
```

| Key                    | Description                                                                         | Default Value |
| ---------------------- | ----------------------------------------------------------------------------------- | ------------- |
| `accessory`            | Loads this plugin. Must be set to `Roomba`                                         |               |
| `name`                 | The name of your Roomba as it should appear in Homebridge and HomeKit               |               |
| `model`                | The model of your Roomba as you'd like it to appear in HomeKit                      |               |
| `serialnum`            | The serial number as you'd like it to appear in HomeKit                             |               |
| `blid`                 | The `blid` of your Roomba, obtained during setup                                    |               |
| `robotpwd`             | The password for your Roomba, obtained during setup                                 |               |
| `ipaddress`            | The [IP address](#troubleshooting) of your Roomba on your network                   |               |
| `dockContactSensor`    | Add a contact sensor to HomeKit that's _closed_ when Roomba is docked               | `true`        |
| `runningContactSensor` | Add a contact sensor to HomeKit that's _open_ when Roomba is running                | `false`       |
| `binContactSensor`     | Add a contact sensor to HomeKit that's _open_ when Roomba's bin is full             | `false`       |
| `dockingContactSensor` | Add a contact sensor to HomeKit that's _open_ when Roomba is docking                | `false`       |
| `tankContactSensor`    | Add a contact sensor to HomeKit that's _open_ when Braava's water tank is empty     | `false`       |
| `cleanBehaviour`       | Roomba can clean everywhere or go on a specific cleaning mission when started       | `everywhere`  |
| `mission`              | Instructions passed to your Roomba for a specific cleaning mission                  |               |
| `ordered`              | Clean rooms in order specified                                                      | `1`           |
| `pmap_id`              | The id of your map in the iRobot app                                                |               |
| `regions`              | One or more rooms to be cleaned during mission                                      |               |
| `region_id`            | The region id of the room to be cleaned                                             |               |
| `type`                 | The type of region id specified                                                     | `rid`         |
| `params`               | Additional parameters for the room to be cleaned                                    |               |
| `noAutoPasses`         | Specify the number of cleaning passes for the room to be cleaned                    | `false`       |
| `twoPass`              | Specify two cleaning passes for the room                                            | `false`       |
| `user_pmapv_id`        | The version id of your map in the iRobot app (contains Date and Time last modified) |               |
| `stopBehaviour`        | Roomba can go home or pause when stopped                                            | `home`        |

### External Accessories & Matter Support

This plugin supports **External Accessories** mode, which publishes each Roomba as a separate HomeKit device instead of grouping them under a bridge. This feature provides:

- **Automatic Matter Support**: Uses `publishMatterAccessories` API when available (Homebridge 2.0.0-alpha.28+)
- **Individual Device Management**: Each Roomba appears as a separate tile in the Home app  
- **Enhanced Reliability**: Independent device management and troubleshooting
- **Future-Proof**: Ready for Matter protocol expansion

To enable external accessories, add `"externalAccessories": true` to your platform configuration:

```json
{
  "platform": "Roomba",
  "name": "Roomba",
  "email": "your-email@example.com",
  "password": "your-password", 
  "externalAccessories": true
}
```

**Important**: Switching to external accessories requires re-pairing all devices and recreating scenes/automations.

📖 For detailed information, see [External Accessories Documentation](./EXTERNAL_ACCESSORIES.md)

### Cleaning Mission configuration

This plugin can instruct the Roomba to clean everywhere or go on a specific cleaning job when started. Follow these steps to get the mission configuration values from the iRobot app.

1. Select the rooms you want to clean in the iRobot app, start the cleaning job, then **close the iRobot app**.
2. Open a terminal on your Homebridge system, either using `ssh` or by using the Homebridge Terminal located in the &vellip; menu, top-right in the Homebridge UI.
3. Change into the directory where the plugin is installed: `cd $(npm root -g)/homebridge-roomba`
4. Type `npm run roomba:getlastcommand <BLID> <PASSWORD> <IP ADDRESS>` (replacing `<BLID> <PASSWORD> <IP ADDRESS>` with the values for your robot).

**Note:** _Modifying the map (Room Dividers, Names or Zones) in the iRobot app will result in a new `user_pmapv_id` value and may result in new `region_id` values that will cause an error if not updated in mission configuration._

### Deprecated configuration

The homebridge-roomba plugin used to support keep-alive and auto refresh modes for obtaining Roomba's status.
Both of these modes required more resources from Homebridge and Roomba than were necessary.

Now the plugin efficiently queries Roomba's status on demand so as not to slow down Homebridge and so
as to provide HomeKit with Roomba's status only when it requests it.

## Troubleshooting

Click on any of the items below to expand the corresponding answer.

<details>
  <summary>Finding my Roomba's IP address</summary>

> You can find your Roomba's IP Address in the iRobot app. Open the app and choose your Robot. Scroll down to the bottom and find Robot Settings. Click Wi-Fi Settings and then Robot Wi-FI Details. You will find your IP address and various other network goodies here.

![Alt Text](https://github.com/rcoletti116/homebridge-roomba/blob/rcoletti116-docsfiles/trim.1BD89A46-80F9-4FCB-A04B-4A610D403D4F.gif)

> Alternatively you can open up your Router Admin Panel and look for a list of devices. Once you identify the Roomba, you should see an associated IP address, however, this process will be different for each type of router.

> While identifying your Roomba's IP address, we strongly recommend assigning your Roomba a Static IP Address (See _Roomba cannot be found after router restart OR Roomba's IP Address changed_ below).

</details>

<details>
  <summary>Roomba cannot be found after router restart OR Roomba's IP Address changed</summary>

> If you experience issues with connecting to your Roomba, you might want to assign a **Static IP Address** to your Roomba. In order to do this, you'll need to navigate to your Router's Admin Portal and modify the configuration; because this process is different for each type of router, you will need to research this process on your own.
>
> **NOTE**: If you choose to set an IP address that is different than the IP address your Roomba was previously assigned, you'll need to restart your router before the Roomba will begin responding on the new IP address.

</details>

## Building

The homebridge-roomba plugin uses [TypeScript](https://www.typescriptlang.org) and
[`nvm`](https://github.com/nvm-sh/nvm).

`nvm` is used to control the version of node used. You can skip the `nvm` step if you manage your own
node versions.

Use `nvm` to select the required node version:

```shell
nvm use
```

or, if you don't have the required node version installed:

```shell
nvm install
```

Prepare the project:

```shell
npm install
```

Build the project:

```shell
npm run build
```

or

```shell
npm run watch
```

### Testing

The fastest way to test changes is to copy the built product directly to your Homebridge, and then to restart Homebridge.

If your Homebridge is running on your local machine, you can build (as above) and then copy the `config.schema.json` file and `dist`
folder to the `homebridge-roomba` folder in your Homebridge's `node_modules` folder.

If your Homebridge is running on another machine, you can use a remote copy tool such as `scp` to copy the files:

```shell
npm run build && scp -r config.schema.json package.json dist user@host.local:/usr/lib/node_modules/homebridge-roomba/
```

Note: the destination path above is an example of what the path to `node_modules` on your Homebridge server _might be_.

If you see "Permission denied" errors from `scp` you will need to adjust the permissions on the files in that folder
on your Homebridge machine.

## Contributing

The homebridge-roomba plugin uses [Changesets](https://github.com/atlassian/changesets) to maintain the [CHANGELOG.md](./CHANGELOG.md) and to bump the package's version number according to [semver](https://semver.org).

If you are preparing a PR, please consider using Changesets to include a summary of your change for the [CHANGELOG.md](./CHANGELOG.md), following the example of existing changelog entries (but feel free to provide more detail).

To create a new changeset:

```shell
npm exec changeset
```

That will prompt you to indicate whether your change is a patch (a bug fix) or a minor or major change. If you are adding a feature it is a minor change, not a patch.

Changesets will create a new file in the `.changeset` directory that you can commit as part of your PR.

### `.git-blame-ignore-revs`

Some revisions in the git history are spurious in a git blame, such as linting the code base.
These revisions are listed in `.git-blame-ignore-revs`. You can configure your local git repository
to use this file to skip these revisions in a blame:

```shell
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

### `config.schema.json`

Useful references for the `config.schema.json`:

- https://github.com/oznu/homebridge-config-ui-x/wiki/Developers:-Plugin-Settings-GUI
- https://github.com/hamzahamidi/ajsf
- https://github.com/json-schema-form/angular-schema-form/blob/master/docs/index.md

### Releasing

The maintainer will run these steps to update the plugin version and publish to [npmjs.com](https://npmjs.com/package/homebridge-roomba):

```shell
npm exec changeset version
```

Review the additions to [`CHANGELOG.md`](./CHANGELOG.md) and `package.json`, commit with the comment "vX.X", and then publish:

```shell
npm exec changeset publish
```

## Credits

STVMallen - [Original plugin](https://github.com/stvmallen/homebridge-roomba-stv)

ncovercash - [Dock status](https://github.com/stvmallen/homebridge-roomba-stv/pull/63)
