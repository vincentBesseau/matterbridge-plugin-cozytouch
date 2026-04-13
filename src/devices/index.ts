/**
 * Device creators index.
 *
 * @file src/devices/index.ts
 * @license Apache-2.0
 */

export { createCoverEndpoint, updateCoverEndpoint } from './coverDevice.js';
export { IGNORED_UI_CLASSES, MatterDeviceType, resolveDeviceType } from './deviceMapping.js';
export { createSwitchEndpoint, updateSwitchEndpoint } from './switchDevice.js';
export { createTemperatureSensorEndpoint, updateTemperatureSensorEndpoint } from './temperatureSensorDevice.js';
export { createThermostatEndpoint, updateThermostatEndpoint } from './thermostatDevice.js';
export type { OverkizDeviceInfo } from './types.js';
export type { WaterHeaterResult } from './waterHeaterDevice.js';
export { createWaterHeaterEndpoint, updateWaterHeaterEndpoint, SYSTEM_MODE } from './waterHeaterDevice.js';
