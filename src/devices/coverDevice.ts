/**
 * Cover device creator for Overkiz shutter/blind devices.
 *
 * Handles roller shutters, venetian blinds, awnings, curtains, etc.
 *
 * @file src/devices/coverDevice.ts
 * @license Apache-2.0
 */

import { coverDevice, MatterbridgeEndpoint } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';

import type { OverkizDeviceInfo } from './types.js';

/**
 * Create a Matterbridge cover endpoint from an Overkiz device.
 *
 * @param device
 * @param vendorId
 * @param log
 */
export function createCoverEndpoint(device: OverkizDeviceInfo, vendorId: number, log: AnsiLogger): MatterbridgeEndpoint {
  // Overkiz uses 0 = open, 100 = closed for closures
  // Matter uses 0 = fully open, 10000 = fully closed (percent100ths)
  const closureState = device.getNumber('core:ClosureState') || device.getNumber('core:DeploymentState') || 0;

  // Convert: Overkiz 0-100 → Matter 0-10000
  const positionPercent100ths = closureState * 100;

  const endpoint = new MatterbridgeEndpoint(coverDevice, { id: device.uuid })
    .createDefaultBridgedDeviceBasicInformationClusterServer(device.label, device.serialNumber, vendorId, device.manufacturer, device.model)
    .createDefaultPowerSourceWiredClusterServer()
    .createDefaultWindowCoveringClusterServer(positionPercent100ths)
    .addRequiredClusterServers();

  log.debug(`Created cover endpoint for "${device.label}" (${device.widgetName}) position=${closureState}%`);

  return endpoint;
}

/**
 * Update a cover endpoint with fresh Overkiz state.
 *
 * @param endpoint
 * @param device
 * @param log
 */
export async function updateCoverEndpoint(endpoint: MatterbridgeEndpoint, device: OverkizDeviceInfo, log: AnsiLogger): Promise<void> {
  const closureState = device.getNumber('core:ClosureState') || device.getNumber('core:DeploymentState');

  const positionPercent100ths = closureState * 100;
  await endpoint.setWindowCoveringTargetAndCurrentPosition(positionPercent100ths);

  log.debug(`Updated cover "${device.label}": position=${closureState}%`);
}
