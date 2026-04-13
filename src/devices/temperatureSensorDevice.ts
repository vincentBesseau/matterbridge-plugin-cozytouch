/**
 * Temperature sensor device creator for Overkiz sensors.
 *
 * @file src/devices/temperatureSensorDevice.ts
 * @license Apache-2.0
 */

import { MatterbridgeEndpoint, temperatureSensor } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';

import type { OverkizDeviceInfo } from './types.js';

/**
 * Create a Matterbridge temperature sensor endpoint from an Overkiz device.
 *
 * @param device
 * @param vendorId
 * @param log
 */
export function createTemperatureSensorEndpoint(device: OverkizDeviceInfo, vendorId: number, log: AnsiLogger): MatterbridgeEndpoint {
  const currentTemp = device.getNumber('core:TemperatureState') || 20;

  const endpoint = new MatterbridgeEndpoint(temperatureSensor, { id: device.uuid })
    .createDefaultBridgedDeviceBasicInformationClusterServer(device.label, device.serialNumber, vendorId, device.manufacturer, device.model)
    .addRequiredClusterServers();

  log.debug(`Created temperature sensor endpoint for "${device.label}" temp=${currentTemp}°C`);

  return endpoint;
}

/**
 * Update a temperature sensor endpoint with fresh Overkiz state.
 *
 * @param endpoint
 * @param device
 * @param log
 */
export async function updateTemperatureSensorEndpoint(endpoint: MatterbridgeEndpoint, device: OverkizDeviceInfo, log: AnsiLogger): Promise<void> {
  const currentTemp = device.getNumber('core:TemperatureState');
  if (currentTemp !== 0) {
    await endpoint.setAttribute('temperatureMeasurement', 'measuredValue', currentTemp * 100);
  }

  log.debug(`Updated temperature sensor "${device.label}": temp=${currentTemp}°C`);
}
