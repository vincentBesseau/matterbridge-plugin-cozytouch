/**
 * On/Off switch device creator for generic Overkiz on/off devices.
 *
 * @file src/devices/switchDevice.ts
 * @license Apache-2.0
 */

import { MatterbridgeEndpoint, onOffOutlet } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';

import type { OverkizDeviceInfo } from './types.js';

/**
 * Create a Matterbridge on/off outlet endpoint from an Overkiz device.
 *
 * @param device
 * @param vendorId
 * @param log
 */
export function createSwitchEndpoint(device: OverkizDeviceInfo, vendorId: number, log: AnsiLogger): MatterbridgeEndpoint {
  const isOn = device.get('core:OnOffState') === 'on';

  const endpoint = new MatterbridgeEndpoint(onOffOutlet, { id: device.uuid })
    .createDefaultBridgedDeviceBasicInformationClusterServer(device.label, device.serialNumber, vendorId, device.manufacturer, device.model)
    .createDefaultPowerSourceWiredClusterServer()
    .createDefaultOnOffClusterServer(isOn)
    .addRequiredClusterServers();

  log.debug(`Created switch endpoint for "${device.label}" (${device.widgetName}) isOn=${isOn}`);

  return endpoint;
}

/**
 * Update a switch endpoint with fresh Overkiz state.
 *
 * @param endpoint
 * @param device
 * @param log
 */
export async function updateSwitchEndpoint(endpoint: MatterbridgeEndpoint, device: OverkizDeviceInfo, log: AnsiLogger): Promise<void> {
  const isOn = device.get('core:OnOffState') === 'on';
  await endpoint.setAttribute('onOff', 'onOff', isOn);

  log.debug(`Updated switch "${device.label}": isOn=${isOn}`);
}
