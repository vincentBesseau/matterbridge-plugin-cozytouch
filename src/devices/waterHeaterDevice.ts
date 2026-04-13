/**
 * Water heater device creator for Overkiz DHW devices.
 *
 * Creates a **single** thermostat endpoint that exposes:
 * - Temperature measurement (current water temperature)
 * - Heating setpoint (target temperature)
 * - systemMode mapping:
 *     Off (0)            → Absence mode
 *     Heat (4)           → Normal / Auto DHW mode
 *     EmergencyHeat (5)  → Boost mode
 *
 * This ensures controllers like Gladys see exactly **one** device
 * with all water heater controls grouped together.
 *
 * @file src/devices/waterHeaterDevice.ts
 * @license Apache-2.0
 */

import { MatterbridgeEndpoint, thermostatDevice } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';

import type { OverkizDeviceInfo } from './types.js';
import { BOOST_AVAILABLE, AWAY_AVAILABLE, DHW_MODE_AVAILABLE } from './waterHeaterSwitchesDevice.js';
import { resolveSystemMode, SYSTEM_MODE } from './waterHeaterModes.js';

// Re-export for consumers
export { resolveSystemMode, SYSTEM_MODE } from './waterHeaterModes.js';

/**
 * Result of creating a water heater endpoint.
 */
export interface WaterHeaterResult {
  /** The single Matter endpoint. */
  endpoint: MatterbridgeEndpoint;
  /** Whether boost mode is supported. */
  hasBoost: boolean;
  /** Whether absence mode is supported. */
  hasAway: boolean;
  /** Whether DHW auto/manual toggle is supported. */
  hasDhwMode: boolean;
}

/**
 * Create a single Matterbridge thermostat endpoint for an Overkiz water heater.
 *
 * Note: createDefaultHeatingThermostatClusterServer expects temperature in °C
 * (it multiplies by 100 internally for Matter hundredths-of-°C).
 *
 * @param device
 * @param vendorId
 * @param log
 */
export function createWaterHeaterEndpoint(device: OverkizDeviceInfo, vendorId: number, log: AnsiLogger): WaterHeaterResult {
  // Try various temperature state names for DHW devices
  const rawMiddleTemp = device.getNumber('modbuslink:MiddleWaterTemperatureState') || device.getNumber('core:MiddleWaterTemperatureInState') || 0;
  const rawTemp = device.getNumber('core:TemperatureState') || device.getNumber('core:WaterTemperatureState') || rawMiddleTemp || 0;
  const rawTarget = device.getNumber('core:TargetTemperatureState') || device.getNumber('core:WaterTargetTemperatureState') || 0;
  const expectedShowers = device.getNumber('core:ExpectedNumberOfShowerState') || 0;

  // Use actual temperature if available, otherwise a safe default
  const currentTemp = rawTemp !== 0 ? rawTemp : 40;
  const targetTemp = rawTarget !== 0 ? rawTarget : 50;

  const hasBoost = BOOST_AVAILABLE(device);
  const hasAway = AWAY_AVAILABLE(device);
  const hasDhwMode = DHW_MODE_AVAILABLE(device);
  const systemMode = resolveSystemMode(device);

  log.info(`Water heater "${device.label}" raw values: temp=${rawTemp}, middleTemp=${rawMiddleTemp}, target=${rawTarget}, showers=${expectedShowers}`);
  log.info(`Water heater "${device.label}" using: currentTemp=${currentTemp}°C, targetTemp=${targetTemp}°C, systemMode=${systemMode}`);
  log.info(`Water heater "${device.label}" features: boost=${hasBoost}, away=${hasAway}, dhwMode=${hasDhwMode}`);

  const endpoint = new MatterbridgeEndpoint(thermostatDevice, { id: device.uuid })
    .createDefaultBridgedDeviceBasicInformationClusterServer(device.label, device.serialNumber, vendorId, device.manufacturer, `${device.model} (DHW)`)
    .createDefaultPowerSourceWiredClusterServer()
    .createDefaultHeatingThermostatClusterServer(
      currentTemp, // °C — the method multiplies by 100 internally
      targetTemp, // °C
      30, // min 30°C
      70, // max 70°C
    )
    .addRequiredClusterServers();

  log.info(`Created single water heater endpoint for "${device.label}" (${device.widgetName}) — systemMode=${systemMode}`);

  return { endpoint, hasBoost, hasAway, hasDhwMode };
}

/**
 * Update a water heater endpoint with fresh Overkiz state.
 *
 * @param endpoint
 * @param device
 * @param log
 */
export async function updateWaterHeaterEndpoint(
  endpoint: MatterbridgeEndpoint,
  device: OverkizDeviceInfo,
  log: AnsiLogger,
): Promise<void> {
  // Update thermostat temperature values
  const rawTemp =
    device.getNumber('modbuslink:MiddleWaterTemperatureState') ||
    device.getNumber('core:MiddleWaterTemperatureInState') ||
    device.getNumber('core:TemperatureState') ||
    device.getNumber('core:WaterTemperatureState');
  if (rawTemp !== 0) {
    await endpoint.setAttribute('thermostat', 'localTemperature', Math.round(rawTemp * 100));
  }

  const rawTarget = device.getNumber('core:TargetTemperatureState') || device.getNumber('core:WaterTargetTemperatureState');
  if (rawTarget !== 0) {
    await endpoint.setAttribute('thermostat', 'occupiedHeatingSetpoint', Math.round(rawTarget * 100));
  }

  // Update systemMode based on current Overkiz state
  const systemMode = resolveSystemMode(device);
  await endpoint.setAttribute('thermostat', 'systemMode', systemMode);

  log.debug(`Updated water heater "${device.label}": temp=${rawTemp}°C target=${rawTarget}°C systemMode=${systemMode}`);
}
