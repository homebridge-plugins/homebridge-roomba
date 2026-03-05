import type { API, EndpointType, Logger, MatterAccessory } from 'homebridge'

export interface BaseMatterAccessoryConfig {
  uuid: string
  displayName: string
  deviceType: EndpointType
  serialNumber: string
  manufacturer: string
  model: string
  firmwareRevision: string
  hardwareRevision: string
  context?: Record<string, unknown>
  clusters?: MatterAccessory['clusters']
  handlers?: MatterAccessory['handlers']
  parts?: MatterAccessory['parts']
  /** Optional mapping from legacy cluster names to supported cluster names. */
  clusterNameMap?: Record<string, string>
}

/**
 * Base class for all Matter accessories. Implements the MatterAccessory interface
 * and provides helpers for updating state and logging.
 */
export abstract class BaseMatterAccessory implements MatterAccessory {
  // Required MatterAccessory properties
  public readonly uuid: string
  /** Uppercase alias for uuid, required by some Homebridge versions */
  public readonly UUID: string
  public readonly displayName: string
  public readonly deviceType: EndpointType
  public readonly serialNumber: string
  public readonly manufacturer: string
  public readonly model: string
  public readonly firmwareRevision: string
  public readonly hardwareRevision: string
  public readonly context: Record<string, unknown>
  public readonly clusters?: MatterAccessory['clusters']
  public readonly handlers?: MatterAccessory['handlers']
  public readonly parts?: MatterAccessory['parts']
  /** Optional mapping table for legacy cluster names */
  public readonly clusterNameMap?: Record<string, string>

  protected readonly api: API
  protected readonly log: Logger

  constructor(api: API, log: Logger, config: BaseMatterAccessoryConfig) {
    this.api = api
    this.log = log

    this.uuid = config.uuid
    this.UUID = config.uuid
    this.displayName = config.displayName
    this.deviceType = config.deviceType
    this.serialNumber = config.serialNumber
    this.manufacturer = config.manufacturer
    this.model = config.model
    this.firmwareRevision = config.firmwareRevision
    this.hardwareRevision = config.hardwareRevision
    this.clusters = config.clusters
    this.handlers = config.handlers
    this.parts = config.parts
    this.clusterNameMap = config.clusterNameMap || {}

    this.context = {
      serialNumber: this.serialNumber,
      manufacturer: this.manufacturer,
      model: this.model,
      firmwareRevision: this.firmwareRevision,
      hardwareRevision: this.hardwareRevision,
      ...config.context,
    }
  }

  /**
   * Update the accessory state (cluster attributes). Supports optional mapping
   * from legacy cluster names like 'power' and 'diagnostics'.
   */
  protected async updateState(cluster: string, attributes: Record<string, unknown>): Promise<void> {
    const mapped = (this.clusterNameMap && this.clusterNameMap[cluster]) || cluster

    if (this.clusters && (mapped in this.clusters)) {
      await this.api.matter.updateAccessoryState(this.uuid, mapped, attributes)
      this.log.debug(`[${this.displayName}] Updated ${mapped} state (from ${cluster}):`, attributes)
      return
    }

    // Legacy helpers
    if (cluster === 'power') {
      const batteryLevel = attributes.batteryLevel as number | undefined
      const charging = attributes.charging as boolean | number | undefined
      if (typeof batteryLevel === 'number') {
        this.logInfo(`battery updated (via legacy 'power'): ${batteryLevel}%`)
      }
      if (typeof charging !== 'undefined' && this.clusters && ('rvcOperationalState' in this.clusters)) {
        const isCharging = charging === true || charging === 1
        const opState = isCharging ? 65 : 66 // Charging / Docked
        await this.api.matter.updateAccessoryState(this.uuid, 'rvcOperationalState', { operationalState: opState })
        this.log.debug(`[${this.displayName}] Translated legacy 'power' charging=${String(charging)} -> rvcOperationalState=${opState}`)
        return
      }
      const available = this.clusters ? Object.keys(this.clusters).join(', ') : '(none)'
      this.logWarn(`Attempt to update legacy cluster 'power' but no mapping or supported target found. Available clusters: ${available}`)
      return
    }

    if (cluster === 'diagnostics') {
      const errorCode = attributes.errorCode as number | undefined
      if (typeof errorCode === 'number' && errorCode > 0 && this.clusters && ('rvcOperationalState' in this.clusters)) {
        await this.api.matter.updateAccessoryState(this.uuid, 'rvcOperationalState', { operationalState: 3 }) // Error
        this.logWarn(`[${this.displayName}] Translated legacy 'diagnostics' errorCode=${errorCode} -> rvcOperationalState=3 (Error)`)
        return
      }
      const available = this.clusters ? Object.keys(this.clusters).join(', ') : '(none)'
      this.logWarn(`Attempt to update legacy cluster 'diagnostics' but no mapping or supported target found. Available clusters: ${available}`)
      return
    }

    const available = this.clusters ? Object.keys(this.clusters).join(', ') : '(none)'
    this.logWarn(`Attempt to update unknown cluster '${cluster}' (mapped to '${mapped}'). Available clusters: ${available}`)
  }

  protected logInfo(message: string, ...args: unknown[]): void {
    this.log.info(`[${this.displayName}] ${message}`, ...args)
  }

  protected logError(message: string, ...args: unknown[]): void {
    this.log.error(`[${this.displayName}] ${message}`, ...args)
  }

  protected logDebug(message: string, ...args: unknown[]): void {
    this.log.debug(`[${this.displayName}] ${message}`, ...args)
  }

  protected logWarn(message: string, ...args: unknown[]): void {
    this.log.warn(`[${this.displayName}] ${message}`, ...args)
  }

  /** Convert this instance to a plain MatterAccessory object for registration */
  public toAccessory(): MatterAccessory & { UUID: string } {
    return {
      UUID: this.uuid,
      uuid: this.uuid,
      displayName: this.displayName,
      deviceType: this.deviceType,
      serialNumber: this.serialNumber,
      manufacturer: this.manufacturer,
      model: this.model,
      firmwareRevision: this.firmwareRevision,
      hardwareRevision: this.hardwareRevision,
      context: this.context,
      clusters: this.clusters,
      handlers: this.handlers,
      parts: this.parts,
    }
  }
}
