/**
 * Matterbridge plugin for Cozytouch (Atlantic/Thermor/Sauter) devices.
 *
 * Uses the Overkiz API via overkiz-client to discover and control devices,
 * and exposes them as Matter devices via Matterbridge.
 *
 * @file module.ts
 * @author vincentBesseau
 * @version 0.1.0
 * @license Apache-2.0
 */

import { MatterbridgeDynamicPlatform, MatterbridgeEndpoint, PlatformConfig, PlatformMatterbridge } from 'matterbridge';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { Client as OverkizClient, Device as OverkizDevice } from 'overkiz-client';

import {
  createCoverEndpoint,
  createSwitchEndpoint,
  createTemperatureSensorEndpoint,
  createThermostatEndpoint,
  createWaterHeaterEndpoint,
  IGNORED_UI_CLASSES,
  MatterDeviceType,
  resolveDeviceType,
  updateCoverEndpoint,
  updateSwitchEndpoint,
  updateTemperatureSensorEndpoint,
  updateThermostatEndpoint,
  updateWaterHeaterEndpoint,
} from './devices/index.js';
import type { WaterHeaterChildSwitch } from './devices/index.js';
import type { OverkizDeviceInfo } from './devices/types.js';
import type { WaterHeaterSwitch } from './devices/waterHeaterSwitchesDevice.js';
import { toDeviceInfo } from './overkizDeviceAdapter.js';

/**
 * Plugin configuration interface extending PlatformConfig with Cozytouch-specific fields.
 */
export interface CozytouchConfig extends PlatformConfig {
  service?: string;
  user?: string;
  password?: string;
  pollingInterval?: number;
}

/**
 * Tracked device info pairing an Overkiz device with its Matter endpoint.
 */
interface TrackedDevice {
  deviceInfo: OverkizDeviceInfo;
  endpoint: MatterbridgeEndpoint;
  deviceType: MatterDeviceType;
  overkizDevice: OverkizDevice;
  /** Child switch endpoints embedded in the composed water heater device. */
  childSwitches?: WaterHeaterChildSwitch[];
}

/**
 * Default function exported for Matterbridge plugin initialization.
 *
 * @param matterbridge
 * @param log
 * @param config
 */
export default function initializePlugin(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: PlatformConfig): CozytouchPlatform {
  return new CozytouchPlatform(matterbridge, log, config as CozytouchConfig);
}

/**
 * CozytouchPlatform - Dynamic platform plugin that discovers and exposes
 * Cozytouch devices (heaters, water heaters, covers, sensors) via Matter.
 */
export class CozytouchPlatform extends MatterbridgeDynamicPlatform {
  private overkizClient: OverkizClient | undefined;
  private trackedDevices: Map<string, TrackedDevice> = new Map();
  private pollingTimer: NodeJS.Timeout | undefined;
  declare config: CozytouchConfig;

  constructor(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: CozytouchConfig) {
    super(matterbridge, log, config);

    if (this.verifyMatterbridgeVersion === undefined || typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion('3.4.0')) {
      throw new Error(
        `This plugin requires Matterbridge version >= "3.4.0". Please update Matterbridge from ${this.matterbridge.matterbridgeVersion} to the latest version in the frontend."`,
      );
    }

    this.log.info('Initializing Cozytouch Platform...');
  }

  override async onStart(reason?: string) {
    this.log.info(`onStart called with reason: ${reason ?? 'none'}`);

    await this.ready;
    await this.clearSelect();

    // Validate configuration
    if (!this.config.user || !this.config.password) {
      this.log.error('Missing Cozytouch credentials. Please configure user and password in the plugin settings.');
      return;
    }

    // Initialize the Overkiz client
    const service = this.config.service ?? 'cozytouch';
    const pollingPeriod = this.config.pollingInterval ?? 60;

    this.log.info(`Connecting to Overkiz service "${service}" as "${this.config.user}"...`);

    try {
      this.overkizClient = new OverkizClient(this.log, {
        service,
        user: this.config.user,
        password: this.config.password,
        pollingPeriod,
        refreshPeriod: 30, // 30 minutes
      });

      // Listen for device state changes
      this.overkizClient.on('connect', () => {
        this.log.info('Connected to Overkiz API');
      });
      this.overkizClient.on('disconnect', () => {
        this.log.warn('Disconnected from Overkiz API');
      });

      // Connect and discover devices
      await this.overkizClient.connect(this.config.user, this.config.password);
      await this.discoverDevices();
    } catch (error) {
      this.log.error(`Failed to connect to Overkiz API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  override async onConfigure() {
    await super.onConfigure();
    this.log.info('onConfigure called');

    // Set up state change listeners for each tracked device
    for (const [_deviceURL, tracked] of this.trackedDevices) {
      this.log.info(`Configuring device: ${tracked.endpoint.uniqueId}`);

      // Listen for Overkiz state changes and update Matter endpoint
      tracked.overkizDevice.on('states', async () => {
        try {
          const freshInfo = toDeviceInfo(tracked.overkizDevice);

          if (tracked.deviceType === MatterDeviceType.WaterHeater) {
            // Water heater: update thermostat + child switches
            await updateWaterHeaterEndpoint(tracked.endpoint, tracked.childSwitches ?? [], freshInfo, this.log);
          } else {
            await this.updateEndpoint(tracked.endpoint, freshInfo, tracked.deviceType);
          }
        } catch (error) {
          this.log.error(`Error updating device "${tracked.deviceInfo.label}": ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    }

    // Set up command handlers
    this.setupCommandHandlers();
  }

  override async onChangeLoggerLevel(logLevel: LogLevel) {
    this.log.info(`onChangeLoggerLevel called with: ${logLevel}`);
  }

  override async onShutdown(reason?: string) {
    await super.onShutdown(reason);
    this.log.info(`onShutdown called with reason: ${reason ?? 'none'}`);

    // Clear polling timer
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }

    // Clear tracked devices
    this.trackedDevices.clear();

    if (this.config.unregisterOnShutdown === true) await this.unregisterAllDevices();
  }

  /**
   * Discover devices from the Overkiz API and register them as Matter endpoints.
   */
  private async discoverDevices() {
    this.log.info('Discovering Cozytouch devices...');

    if (!this.overkizClient) {
      this.log.error('Overkiz client not initialized');
      return;
    }

    try {
      const devices = await this.overkizClient.getDevices();
      this.log.info(`Found ${devices.length} device(s) from Overkiz API`);

      // Log all devices for diagnostic purposes
      for (const device of devices) {
        const widget = device.definition?.widgetName ?? '?';
        const uiClass = device.definition?.uiClass ?? '?';
        const ctrl = device.controllableName ?? '?';
        this.log.info(`  📱 "${device.label}" widget=${widget} uiClass=${uiClass} controllable=${ctrl}`);

        // Log all states
        if (device.states && device.states.length > 0) {
          for (const state of device.states) {
            const val = typeof state.value === 'object' ? JSON.stringify(state.value) : state.value;
            this.log.info(`     state: ${state.name} = ${val}`);
          }
        }

        // Log commands
        if (device.definition?.commands?.length) {
          const cmds = device.definition.commands.map((c: { commandName: string }) => c.commandName).join(', ');
          this.log.info(`     commands: ${cmds}`);
        }

        // Log sensors
        if (device.sensors && device.sensors.length > 0) {
          for (const sensor of device.sensors) {
            this.log.info(`     📡 sensor: "${sensor.label}" (${sensor.definition?.widgetName})`);
            if (sensor.states) {
              for (const s of sensor.states) {
                const sv = typeof s.value === 'object' ? JSON.stringify(s.value) : s.value;
                this.log.info(`        ${s.name} = ${sv}`);
              }
            }
          }
        }
      }

      for (const device of devices) {
        try {
          await this.processDevice(device);
        } catch (error) {
          this.log.warn(`Failed to process device "${device.label}": ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      this.log.info(`Registered ${this.trackedDevices.size} device(s) as Matter endpoints`);
    } catch (error) {
      this.log.error(`Failed to discover devices: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process a single Overkiz device: determine its type, create endpoint, register it.
   *
   * @param device
   */
  private async processDevice(device: OverkizDevice) {
    const widgetName = device.definition?.widgetName ?? '';
    const uiClass = device.definition?.uiClass ?? '';

    // Skip ignored device types
    if (IGNORED_UI_CLASSES.has(uiClass)) {
      this.log.debug(`Skipping ignored device "${device.label}" (uiClass: ${uiClass})`);
      return;
    }

    const deviceType = resolveDeviceType(widgetName, uiClass);
    if (deviceType === MatterDeviceType.Unknown) {
      this.log.debug(`Skipping unsupported device "${device.label}" (widget: ${widgetName}, uiClass: ${uiClass})`);
      return;
    }

    const deviceInfo = toDeviceInfo(device);
    const vendorId = this.matterbridge.aggregatorVendorId;

    // Set the selectDevice for frontend linking
    this.setSelectDevice(deviceInfo.serialNumber, deviceInfo.label);

    // Validate with white/black list
    const selected = this.validateDevice([deviceInfo.label, deviceInfo.serialNumber]);
    if (!selected) {
      this.log.debug(`Device "${device.label}" excluded by white/black list`);
      return;
    }

    // Water heater: thermostat + independent switch endpoints
    if (deviceType === MatterDeviceType.WaterHeater) {
      const result = createWaterHeaterEndpoint(deviceInfo, vendorId, this.log);

      // Register thermostat endpoint
      await this.registerDevice(result.endpoint);

      // Register each switch as an independent bridge-level device
      for (const { endpoint: switchEp } of result.childSwitches) {
        await this.registerDevice(switchEp);
      }

      this.trackedDevices.set(device.deviceURL, {
        deviceInfo,
        endpoint: result.endpoint,
        deviceType,
        overkizDevice: device,
        childSwitches: result.childSwitches,
      });

      this.log.info(`Registered device "${device.label}" as ${deviceType} (widget: ${widgetName}) with ${result.childSwitches.length} switch(es)`);
      return;
    }

    // All other device types: create a simple endpoint
    const endpoint = this.createEndpoint(deviceInfo, deviceType);

    if (!endpoint) {
      this.log.warn(`Could not create endpoint for "${device.label}" (type: ${deviceType})`);
      return;
    }

    await this.registerDevice(endpoint);

    this.trackedDevices.set(device.deviceURL, {
      deviceInfo,
      endpoint,
      deviceType,
      overkizDevice: device,
    });

    this.log.info(`Registered device "${device.label}" as ${deviceType} (widget: ${widgetName})`);
  }

  /**
   * Create a Matter endpoint for a given device type.
   *
   * @param deviceInfo
   * @param deviceType
   */
  private createEndpoint(deviceInfo: OverkizDeviceInfo, deviceType: MatterDeviceType): MatterbridgeEndpoint | null {
    const vendorId = this.matterbridge.aggregatorVendorId;

    switch (deviceType) {
      case MatterDeviceType.Thermostat:
        return createThermostatEndpoint(deviceInfo, vendorId, this.log);
      case MatterDeviceType.Cover:
        return createCoverEndpoint(deviceInfo, vendorId, this.log);
      case MatterDeviceType.TemperatureSensor:
        return createTemperatureSensorEndpoint(deviceInfo, vendorId, this.log);
      case MatterDeviceType.Switch:
        return createSwitchEndpoint(deviceInfo, vendorId, this.log);
      default:
        return null;
    }
  }

  /**
   * Update a Matter endpoint with fresh Overkiz state data.
   *
   * @param endpoint
   * @param deviceInfo
   * @param deviceType
   */
  private async updateEndpoint(endpoint: MatterbridgeEndpoint, deviceInfo: OverkizDeviceInfo, deviceType: MatterDeviceType): Promise<void> {
    switch (deviceType) {
      case MatterDeviceType.Thermostat:
        await updateThermostatEndpoint(endpoint, deviceInfo, this.log);
        break;
      case MatterDeviceType.Cover:
        await updateCoverEndpoint(endpoint, deviceInfo, this.log);
        break;
      case MatterDeviceType.TemperatureSensor:
        await updateTemperatureSensorEndpoint(endpoint, deviceInfo, this.log);
        break;
      case MatterDeviceType.Switch:
        await updateSwitchEndpoint(endpoint, deviceInfo, this.log);
        break;
    }
  }

  /**
   * Set up Matter command handlers that forward commands to the Overkiz API.
   */
  private setupCommandHandlers() {
    for (const [, tracked] of this.trackedDevices) {
      const { endpoint, deviceType, overkizDevice, deviceInfo } = tracked;

      if (deviceType === MatterDeviceType.Thermostat || deviceType === MatterDeviceType.WaterHeater) {
        this.setupThermostatCommandHandlers(endpoint, overkizDevice, deviceInfo);
      } else if (deviceType === MatterDeviceType.Cover) {
        this.setupCoverCommandHandlers(endpoint, overkizDevice, deviceInfo);
      } else if (deviceType === MatterDeviceType.Switch) {
        this.setupSwitchCommandHandlers(endpoint, overkizDevice, deviceInfo);
      }

      // Set up command handlers for water heater child switches
      if (tracked.childSwitches) {
        for (const { endpoint: switchEp, switchDef } of tracked.childSwitches) {
          this.setupWaterHeaterSwitchCommandHandlers(switchEp, overkizDevice, deviceInfo, switchDef);
        }
      }
    }
  }

  /**
   * Set up thermostat command handlers (setpoint changes).
   *
   * @param endpoint
   * @param device
   * @param info
   */
  private setupThermostatCommandHandlers(endpoint: MatterbridgeEndpoint, device: OverkizDevice, info: OverkizDeviceInfo) {
    // Handle setpoint change via Matter
    endpoint.addCommandHandler('setpointRaiseLower', async (data) => {
      this.log.info(`Setpoint raise/lower command on "${info.label}": ${JSON.stringify(data)}`);
      // The overkiz-client execute method will be used for actual command execution
      // This requires constructing an Overkiz Action with appropriate commands
    });
  }

  /**
   * Set up cover command handlers (open, close, stop, go to position).
   *
   * @param endpoint
   * @param device
   * @param info
   */
  private setupCoverCommandHandlers(endpoint: MatterbridgeEndpoint, device: OverkizDevice, info: OverkizDeviceInfo) {
    endpoint.addCommandHandler('upOrOpen', async () => {
      this.log.info(`Open command on cover "${info.label}"`);
      await this.executeOverkizCommand(device, 'open');
    });

    endpoint.addCommandHandler('downOrClose', async () => {
      this.log.info(`Close command on cover "${info.label}"`);
      await this.executeOverkizCommand(device, 'close');
    });

    endpoint.addCommandHandler('stopMotion', async () => {
      this.log.info(`Stop command on cover "${info.label}"`);
      await this.executeOverkizCommand(device, 'stop');
    });

    endpoint.addCommandHandler('goToLiftPercentage', async (data) => {
      this.log.info(`GoToLiftPercentage command on cover "${info.label}": ${JSON.stringify(data)}`);
      // Convert Matter percent100ths (0-10000) to Overkiz closure (0-100)
      // Matter: 0 = open, 10000 = closed
      // Overkiz: 0 = open, 100 = closed
    });
  }

  /**
   * Set up switch command handlers (on, off).
   *
   * @param endpoint
   * @param device
   * @param info
   */
  private setupSwitchCommandHandlers(endpoint: MatterbridgeEndpoint, device: OverkizDevice, info: OverkizDeviceInfo) {
    endpoint.addCommandHandler('on', async () => {
      this.log.info(`On command on switch "${info.label}"`);
      await this.executeOverkizCommand(device, 'on');
    });

    endpoint.addCommandHandler('off', async () => {
      this.log.info(`Off command on switch "${info.label}"`);
      await this.executeOverkizCommand(device, 'off');
    });
  }

  /**
   * Set up command handlers for a water heater auxiliary switch (boost, away, dhw mode).
   */
  private setupWaterHeaterSwitchCommandHandlers(endpoint: MatterbridgeEndpoint, device: OverkizDevice, info: OverkizDeviceInfo, switchDef: WaterHeaterSwitch) {
    endpoint.addCommandHandler('on', async () => {
      this.log.info(`On command on "${info.label}${switchDef.labelSuffix}": ${switchDef.onCommand}(${JSON.stringify(switchDef.onParams)})`);
      await this.executeOverkizCommand(device, switchDef.onCommand, ...switchDef.onParams);
    });

    endpoint.addCommandHandler('off', async () => {
      this.log.info(`Off command on "${info.label}${switchDef.labelSuffix}": ${switchDef.offCommand}(${JSON.stringify(switchDef.offParams)})`);
      await this.executeOverkizCommand(device, switchDef.offCommand, ...switchDef.offParams);
    });
  }

  /**
   * Execute an Overkiz command on a device via the API.
   *
   * @param device
   * @param commandName
   * @param {...any} params
   */
  private async executeOverkizCommand(device: OverkizDevice, commandName: string, ...params: unknown[]) {
    if (!this.overkizClient) {
      this.log.error('Overkiz client not available');
      return;
    }

    try {
      const { Action, Command, Execution } = await import('overkiz-client');
      const command = new Command(commandName, params.length > 0 ? params : undefined);
      const action = new Action(device.deviceURL, [command]);
      const execution = new Execution(`Matterbridge - ${commandName}`, action);
      await this.overkizClient.execute('apply', execution);
      this.log.debug(`Executed command "${commandName}" on "${device.label}"`);
    } catch (error) {
      this.log.error(`Failed to execute command "${commandName}" on "${device.label}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
