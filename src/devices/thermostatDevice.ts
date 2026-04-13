/**
 * Thermostat device creator for Overkiz heating devices.
 *
 * Handles Atlantic electrical heaters, heat pumps, towel dryers,
 * and other heating systems exposed via the Overkiz API.
 *
 * @file src/devices/thermostatDevice.ts
 * @license Apache-2.0
 */

import { MatterbridgeEndpoint, thermostatDevice } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';

import type { OverkizDeviceInfo } from './types.js';

/**
 * Known Overkiz heating level values.
 */
const HEATING_LEVELS = {
  OFF: 'off',
  FROST_PROTECTION: 'frostprotection',
  ECO: 'eco',
  COMFORT: 'comfort',
  COMFORT_1: 'comfort-1',
  COMFORT_2: 'comfort-2',
} as const;

/**
 * Map Overkiz target heating level to an approximate temperature in °C.
 *
 * @param level
 */
function heatingLevelToCelsius(level: string | null): number {
  switch (level) {
    case HEATING_LEVELS.OFF:
      return 7;
    case HEATING_LEVELS.FROST_PROTECTION:
      return 8;
    case HEATING_LEVELS.ECO:
      return 17;
    case HEATING_LEVELS.COMFORT_2:
      return 19;
    case HEATING_LEVELS.COMFORT_1:
      return 20;
    case HEATING_LEVELS.COMFORT:
      return 21;
    default:
      return 20;
  }
}

/**
 * Create a Matterbridge thermostat endpoint from an Overkiz device.
 *
 * @param device
 * @param vendorId
 * @param log
 */
export function createThermostatEndpoint(device: OverkizDeviceInfo, vendorId: number, log: AnsiLogger): MatterbridgeEndpoint {
  const rawTemp = device.getNumber('core:TemperatureState') || 20;
  const targetHeatingLevel = device.get('io:TargetHeatingLevelState') as string | null;

  const hasSetpoint = device.hasState('core:TargetTemperatureState') || device.hasState('core:ComfortRoomTemperatureState') || device.hasState('core:EcoRoomTemperatureState');

  const comfortTemp = device.getNumber('core:ComfortRoomTemperatureState') || device.getNumber('core:TargetTemperatureState') || 21;

  // All values in °C — createDefaultHeatingThermostatClusterServer multiplies by 100 internally
  const localTemperature = rawTemp;
  const occupiedHeatingSetpoint = hasSetpoint ? comfortTemp : heatingLevelToCelsius(targetHeatingLevel);
  const minHeatSetpoint = 5; // 5°C
  const maxHeatSetpoint = 35; // 35°C

  log.info(`Thermostat "${device.label}" raw values: temp=${rawTemp}, comfortTemp=${comfortTemp}, level=${targetHeatingLevel}`);
  log.info(`Thermostat "${device.label}" using: localTemp=${localTemperature}°C, setpoint=${occupiedHeatingSetpoint}°C`);

  const endpoint = new MatterbridgeEndpoint(thermostatDevice, { id: device.uuid })
    .createDefaultBridgedDeviceBasicInformationClusterServer(device.label, device.serialNumber, vendorId, device.manufacturer, device.model)
    .createDefaultPowerSourceWiredClusterServer()
    .createDefaultHeatingThermostatClusterServer(localTemperature, occupiedHeatingSetpoint, minHeatSetpoint, maxHeatSetpoint)
    .addRequiredClusterServers();

  log.info(`Created thermostat endpoint for "${device.label}" (${device.widgetName})`);

  return endpoint;
}

/**
 * Update a thermostat endpoint with fresh Overkiz state.
 *
 * @param endpoint
 * @param device
 * @param log
 */
export async function updateThermostatEndpoint(endpoint: MatterbridgeEndpoint, device: OverkizDeviceInfo, log: AnsiLogger): Promise<void> {
  const rawTemp = device.getNumber('core:TemperatureState');
  if (rawTemp !== 0) {
    // setAttribute expects raw Matter hundredths-of-°C
    await endpoint.setAttribute('thermostat', 'localTemperature', Math.round(rawTemp * 100));
  }

  const hasSetpoint = device.hasState('core:TargetTemperatureState') || device.hasState('core:ComfortRoomTemperatureState');

  if (hasSetpoint) {
    const targetTemp = device.getNumber('core:TargetTemperatureState') || device.getNumber('core:ComfortRoomTemperatureState');
    if (targetTemp !== 0) {
      await endpoint.setAttribute('thermostat', 'occupiedHeatingSetpoint', Math.round(targetTemp * 100));
    }
  } else {
    const targetLevel = device.get('io:TargetHeatingLevelState') as string | null;
    await endpoint.setAttribute('thermostat', 'occupiedHeatingSetpoint', Math.round(heatingLevelToCelsius(targetLevel) * 100));
  }

  log.debug(`Updated thermostat "${device.label}": temp=${rawTemp}°C`);
}
