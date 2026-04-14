declare module 'dorita980' {
  export interface RobotMission {
    cycle?: string
    phase?: string
    [key: string]: any
  }

  export interface RobotState {
    cleanMissionStatus?: RobotMission
    batPct?: number
    bin?: {
      full?: boolean
      [key: string]: any
    }
    tankLvl?: number
    lastCommand?: {
      regions?: Array<{
        regionId: number
        regionType: string
      }>
      [key: string]: any
    }
    [key: string]: any
  }

  export interface Roomba {
    on: (event: string, listener: (...args: any[]) => void) => this
    removeAllListeners: (event?: string | symbol) => this
    end: () => void
    getRobotState: (waitForFields?: string[]) => Promise<RobotState>
    getMission: (waitForFields?: string[]) => Promise<{ cleanMissionStatus?: RobotMission }>
    start: () => Promise<{ ok: null }>
    clean: () => Promise<{ ok: null }>
    cleanRoom: (arg?: any) => Promise<{ ok: null }> | this
    pause: () => Promise<{ ok: null }>
    stop: () => Promise<{ ok: null }>
    resume: () => Promise<{ ok: null }>
    dock: () => Promise<{ ok: null }>
    [key: string]: any
  }

  interface Dorita980Module {
    Local: new (username: string, password: string, ip: string, version?: 2 | 3, options?: object | number) => Roomba
  }

  const dorita980: Dorita980Module
  export default dorita980
}
