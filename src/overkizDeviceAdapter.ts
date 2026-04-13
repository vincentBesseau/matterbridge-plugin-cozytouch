/**
 * Adapter to convert overkiz-client Device objects to our OverkizDeviceInfo interface.
 *
 * @file src/overkizDeviceAdapter.ts
 * @license Apache-2.0
 */

import type { Device } from 'overkiz-client';

import type { OverkizDeviceInfo } from './devices/types.js';

/**
 * Wraps an overkiz-client Device into the OverkizDeviceInfo interface.
 *
 * @param device
 */
export function toDeviceInfo(device: Device): OverkizDeviceInfo {
  return {
    uuid: device.uuid,
    deviceURL: device.deviceURL,
    label: device.label,
    widgetName: device.definition?.widgetName ?? '',
    uiClass: device.definition?.uiClass ?? '',
    controllableName: device.controllableName ?? '',
    manufacturer: device.manufacturer ?? 'Atlantic',
    model: device.model ?? device.definition?.uiClass ?? 'Unknown',
    serialNumber: device.uuid,
    get: (stateName: string) => device.get(stateName),
    getNumber: (stateName: string) => device.getNumber(stateName),
    hasState: (stateName: string) => device.hasState(stateName),
    hasCommand: (commandName: string) => device.hasCommand(commandName),
  };
}
