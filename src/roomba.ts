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

async function getIP(blid: string, attempt: number = 1): Promise<any> {
    return new Promise((resolve, reject) => {
        if (attempt > 5) {
            reject(new Error(`No Roomba Found With Blid: ${blid}`))
            return
        }

        const server = dgram.createSocket('udp4')

        server.on('error', (err) => {
            reject(err)
        })

        server.on('message', (msg) => {
            try {
                const parsedMsg = JSON.parse(msg.toString())
                const [prefix, id] = parsedMsg.hostname.split('-')
                if ((prefix === 'Roomba' || prefix === 'iRobot') && id === blid) {
                    server.close()
                    resolve(parsedMsg)
                }
            } catch (e: any) { }
        })

        server.on('listening', () => {
            setTimeout(() => {
                getIP(blid, attempt + 1).then(resolve).catch(reject)
            }, 5000)
        })

        server.bind(() => {
            const message = Buffer.from('irobotmcs')
            server.setBroadcast(true)
            server.send(message, 0, message.length, 5678, '255.255.255.255')
        })
    })
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

declare module 'dorita980' {
    export class RoombaLocal {
        constructor(username: string, password: string, ip: string, version?: 2 | 3, options?: object | number)
        on(event: 'connect', listener: () => void): this
        on(event: 'reconnect', listener: () => void): this
        on(event: 'close', listener: () => void): this
        on(event: 'offline', listener: () => void): this
        on(event: 'update', listener: (data: Data) => void): this
        on(event: 'mission', listener: (data: cleanMissionStatus) => void): this
        on(event: 'error', listener: (error: Error) => void): this
        on(event: 'state', listener: (data: unknown) => void): this
        removeAllListeners(event?: string | symbol): this
        end(): void
        getTime(): Promise<fullRobotState>
        getBbrun(): Promise<fullRobotState>
        getLangs(): Promise<fullRobotState>
        getSys(): Promise<fullRobotState>
        getWirelessLastStatus(): Promise<fullRobotState>
        getWeek(): Promise<fullRobotState>
        getPreferences(waitForFields?: string[]): this
        getRobotState(waitForFields?: string[]): this
        getMission(calwaitForFields?: string[]): this
        getBasicMission(waitForFields?: string[]): this
        getWirelessConfig(): Promise<fullRobotState>
        getWirelessStatus(): Promise<fullRobotState>
        getCloudConfig(): Promise<fullRobotState>
        getSKU(): Promise<fullRobotState>
        start(): Promise<{ ok: null }>
        clean(): Promise<{ ok: null }>
        cleanRoom(callback?: (args: any) => Promise<{ ok: null }>): this
        pause(): Promise<{ ok: null }>
        stop(): Promise<{ ok: null }>
        resume(): Promise<{ ok: null }>
        dock(): Promise<{ ok: null }>
        find(): Promise<{ ok: null }>
        evac(): Promise<{ ok: null }>
        train(): Promise<{ ok: null }>
        setWeek(callback?: (args: any) => Promise<{ ok: null }>): this
        setPreferences(callback?: (args: any) => Promise<{ ok: null }>): this
        setCarpetBoostAuto(): Promise<{ ok: null }>
        setCarpetBoostPerformance(): Promise<{ ok: null }>
        setCarpetBoostEco(): Promise<{ ok: null }>
        setEdgeCleanOn(): Promise<{ ok: null }>
        setEdgeCleanOff(): Promise<{ ok: null }>
        setCleaningPassesAuto(): Promise<{ ok: null }>
        setCleaningPassesOne(): Promise<{ ok: null }>
        setCleaningPassesTwo(): Promise<{ ok: null }>
        setAlwaysFinishOn(): Promise<{ ok: null }>
        setAlwaysFinishOff(): Promise<{ ok: null }>
    }

    export interface fullRobotState { }

    interface cleanMissionStatus {
        cleanMissionStatus: {
            cycle: string
            phase: string
            expireM: number
            rechrgM: number
            error: number
            notReady: number
            mssnM: number
            sqft: number
            initiator: string
            nMssn: number
        }
        pose: { theta: number, point: { x: number, y: number } }
    }

    interface Data {
        state: {
            reported: {
                soundVer: string
                uiSwVer: string
                navSwVer: string
                wifiSwVer: string
                mobilityVer: string
                bootloaderVer: string
                umiVer: string
                softwareVer: string
            }
        }
    }
}
