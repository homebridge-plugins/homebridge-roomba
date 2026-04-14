import type { Logging } from 'homebridge'
import type { RobotState as DoritaRobotState } from 'dorita980'

import process from 'node:process'

import dorita980 from 'dorita980'

const logger = console as unknown as Logging

if (!process.argv[4]) {
  logger.error('Usage: npm run getlastcommand <robot_blid> <robot_pwd> <robot_ip_address>')
  process.exit()
}

const robot_blid = process.argv[2]
const robot_pwd = process.argv[3]
const robot_ip_address = process.argv[4]

const myRobotViaLocal = new dorita980.Local(robot_blid, robot_pwd, robot_ip_address)

myRobotViaLocal.on('connect', init)

function init() {
  myRobotViaLocal.getRobotState(['lastCommand'])
    .then((result: DoritaRobotState) => {
      logger.info('lastCommand:', result.lastCommand, ', regionsDetails:', result.lastCommand?.regions)
      myRobotViaLocal.end()
    })
    .catch(logger.error)
}
