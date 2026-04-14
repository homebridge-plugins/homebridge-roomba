/* eslint-disable style/indent */
import type { IncomingMessage } from 'node:http'

import type { Logger } from 'homebridge'

import type { RoombaPlatformConfig } from './settings.js'

import { Buffer } from 'node:buffer'
import * as dgram from 'node:dgram'
import * as https from 'node:https'

export async function getRoombas(email: string, password: string, log: Logger, config: RoombaPlatformConfig): Promise<Robot[]> {
    let robots: Robot[] = []

    if (config.disableDiscovery) {
        log.info('Using manual discovery as per config')
        robots = config.roombas || []
    } else {
        log.info('Logging into iRobot...')

        try {
            const credentials = await getCredentials(email, password)
            robots = await iRobotLogin(credentials)
            log.debug('robots:', JSON.stringify(robots))
        } catch (e: any) {
            log.error('Failed to login to iRobot, see below for details')
            log.error(e.message ?? e)
        }
    }

    // Extract the key from the JSON object and set it as the blid if not provided or if blid is 0
    for (const key in robots) {
        if (Object.prototype.hasOwnProperty.call(robots, key)) {
            const robot = robots[key]
            if (!robot.blid || robot.blid === '0') {
                robot.blid = key
                log.debug(`Set blid for robot ${robot.name} to ${robot.blid}`)
            }
        }
    }

    // Ensure robots is an array
    if (!Array.isArray(robots)) {
        log.debug('Converting robots object to array')
        robots = Object.values(robots)
    }

    log.debug('Processed robots:', JSON.stringify(robots))

    const goodRoombas: Robot[] = []
    const badRoombas: Robot[] = []

    for (const robot of robots) {
        if (!config.disableDiscovery) {
            log.debug('roomba name:', robot.name, 'blid:', robot.blid, 'password:', robot.password)
            if (!robot.name || !robot.blid || !robot.password) {
                log.error('Skipping configuration for roomba:', robot.name, 'due to missing name, blid or password')
                continue
            }

            log.info('Configuring roomba:', robot.name)

            try {
                const robotIP = await getIP(robot.blid)
                robot.ip = robotIP.ip
                robot.model = getModel(robotIP.sku)
                robot.multiRoom = getMultiRoom(robot.model)
                robot.info = robotIP
                goodRoombas.push(robot)
            } catch (e: any) {
                log.error('Failed to connect roomba:', robot.name, 'with error:', e.message ?? e)
                log.error('This usually happens if the Roomba is not on the same network as Homebridge, or the Roomba is not reachable from the network')
                badRoombas.push(robot)
            }
        } else {
            log.info('Skipping configuration for roomba:', robot.name, 'due to config')
        }
    }

    for (const roomba of badRoombas) {
        log.warn('Not creating an accessory for unreachable Roomba:', roomba.name)
    }

    return goodRoombas
}

function getModel(sku: string): string {
    switch (sku.charAt(0)) {
        case 'j':
        case 'i':
        case 's':
            return sku.substring(0, 2)
        case 'R':
            return sku.substring(1, 4)
        default:
            return sku
    }
}

function getMultiRoom(model: string): boolean {
    switch (model.charAt(0)) {
        case 's':
        case 'j':
            return Number.parseInt(model.charAt(1)) > 4
        case 'i':
            return Number.parseInt(model.charAt(1)) > 2
        case 'm':
            return Number.parseInt(model.charAt(1)) === 6
        default:
            return false
    }
}

export interface Robot {
    name: string
    blid: string
    sku?: string
    password: string
    autoConfig?: boolean
    ip: string
    model: string
    multiRoom: boolean
    softwareVer?: string
    info: DeviceInfo
}

export interface DeviceInfo {
    serialNum?: string
    ver?: string
    hostname?: string
    robotname?: string
    robotid?: string
    mac?: string
    sw: string
    sku?: string
    nc?: number
    proto?: string
    cap?: object
}

async function getIP(blid: string, maxAttempts: number = 5): Promise<any> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const result = await new Promise<any | null>((resolve, reject) => {
            const server = dgram.createSocket('udp4')
            let settled = false

            const cleanup = (err?: Error) => {
                if (settled) {
                    return
                }
                settled = true
                // Suppress any error fired during close (e.g. send-in-flight)
                server.removeAllListeners()
                server.on('error', () => {})
                server.close()
                if (err) {
                    reject(err)
                } else {
                    resolve(null) // null = not found this attempt, try again
                }
            }

            server.on('error', (err) => {
                cleanup(err)
            })

            server.on('message', (msg) => {
                if (settled) {
                    return
                }
                try {
                    const parsedMsg = JSON.parse(msg.toString())
                    const [prefix, id] = parsedMsg.hostname.split('-')
                    if ((prefix === 'Roomba' || prefix === 'iRobot') && id === blid) {
                        settled = true
                        server.removeAllListeners()
                        server.on('error', () => {})
                        server.close()
                        resolve(parsedMsg)
                    }
                } catch (e: any) { }
            })

            server.bind(() => {
                const message = Buffer.from('irobotmcs')
                server.setBroadcast(true)
                server.send(message, 0, message.length, 5678, '255.255.255.255', (err) => {
                    if (err) {
                        cleanup(err)
                        return
                    }
                    // Wait 5 s for a matching response before closing and retrying
                    setTimeout(() => cleanup(), 5000)
                })
            })
        })

        if (result !== null) {
            return result
        }
    }

    throw new Error(`No Roomba Found With Blid: ${blid}`)
}

async function getCredentials(email: string, password: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const apiKey = '3_rWtvxmUKwgOzu3AUPTMLnM46lj-LxURGflmu5PcE_sGptTbD-wMeshVbLvYpq01K'
        const gigyaURL = new URL('https://accounts.us1.gigya.com/accounts.login')
        gigyaURL.search = new URLSearchParams({
            apiKey,
            targetenv: 'mobile',
            loginID: email,
            password,
            format: 'json',
            targetEnv: 'mobile',
        }).toString()

        const gigyaLoginOptions = {
            hostname: gigyaURL.hostname,
            path: gigyaURL.pathname + gigyaURL.search,
            method: 'POST',
            headers: {
                Connection: 'close',
            },
        }

        const req = https.request(gigyaLoginOptions, (res) => {
            let data = ''

            res.on('data', (chunk) => {
                data += chunk
            })

            res.on('end', () => {
                gigyaLoginResponse(null, res, JSON.parse(data), resolve, reject)
            })
        })

        req.on('error', (error) => {
            gigyaLoginResponse(error, undefined, undefined, resolve, reject)
        })

        req.end()
    })
}

function gigyaLoginResponse(error: Error | null, response?: IncomingMessage, body?: any, resolve?: (value: any) => void, reject?: (reason?: any) => void): void {
    if (error) {
        reject?.(new Error(`Fatal error logging into Gigya API. Please check your credentials or Gigya API Key. ${error.message}`))
        return
    }

    if (response?.statusCode !== undefined && [401, 403].includes(response.statusCode)) {
        reject?.(new Error(`Authentication error. Check your credentials. ${response.statusCode}`))
    } else if (response && response.statusCode === 400) {
        reject?.(new Error(`Error logging into Gigya API. ${response.statusCode}`))
    } else if (response && response.statusCode === 200) {
        gigyaSuccess(body, resolve, reject)
    } else {
        reject?.(new Error('Unexpected response. Checking again...'))
    }
}

function gigyaSuccess(body: any, resolve?: (value: any) => void, reject?: (reason?: any) => void): void {
    if (body.statusCode === 403) {
        reject?.(new Error(`Authentication error. Please check your credentials. ${body.statusCode}`))
        return
    }
    if (body.statusCode === 400) {
        reject?.(new Error(`Error logging into Gigya API. ${body.statusCode}`))
        return
    }
    if (body.statusCode === 200 && body.errorCode === 0 && body.UID && body.UIDSignature && body.signatureTimestamp && body.sessionInfo && body.sessionInfo.sessionToken) {
        resolve?.(body)
    } else {
        reject?.(new Error(`Error logging into iRobot account. Missing fields in login response. ${body.statusCode}`))
    }
}

async function iRobotLogin(body: any, server: number = 1): Promise<any> {
    return new Promise((resolve, reject) => {
        const iRobotLoginOptions = {
            hostname: `unauth${server}.prod.iot.irobotapi.com`,
            path: '/v2/login',
            method: 'POST',
            headers: {
                'Connection': 'close',
                'Content-Type': 'application/json',
            },
        }

        const req = https.request(iRobotLoginOptions, (res) => {
            let data = ''

            res.on('data', (chunk) => {
                data += chunk
            })

            res.on('end', () => {
                try {
                    iRobotLoginResponse(null, res, JSON.parse(data), resolve, reject)
                } catch (e: any) {
                    if (server === 1) {
                        iRobotLogin(body, 2).then(resolve).catch(reject)
                    } else {
                        iRobotLoginResponse(e.message ?? e, undefined, undefined, resolve, reject)
                    }
                }
            })
        })

        req.on('error', (error) => {
            iRobotLoginResponse(error, undefined, undefined, resolve, reject)
        })

        req.write(JSON.stringify({
            app_id: 'ANDROID-C7FB240E-DF34-42D7-AE4E-A8C17079A294',
            assume_robot_ownership: 0,
            gigya: {
                signature: body.UIDSignature,
                timestamp: body.signatureTimestamp,
                uid: body.UID,
            },
        }))

        req.end()
    })
}

function iRobotLoginResponse(error: Error | null, _response?: IncomingMessage, body?: any, resolve?: (value: any) => void, reject?: (reason?: any) => void): void {
    if (error) {
        reject?.(new Error(`Fatal error logging into iRobot account. Please check your credentials or API Key. ${error.message}`))
        return
    }
    if (body && body.robots) {
        resolve?.(body.robots)
    } else {
        reject?.(new Error(`Fatal error logging into iRobot account. Please check your credentials or API Key. ${body?.statusCode}`))
    }
}
