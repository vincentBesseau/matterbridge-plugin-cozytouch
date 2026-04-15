/**
 * Water heater device creator for Overkiz DHW devices.
 *
 * Creates a composed device that exposes:
 * - Thermostat cluster: water temperature + target setpoint + temperatureMeasurement
 * - Child OnOff endpoints: Boost, Absence, DHW Mode (Auto/Manuel)
 *
 * Gladys sees this as a single device with multiple features.
 *
 * @file src/devices/waterHeaterDevice.ts
 * @license Apache-2.0
 */

import { MatterbridgeEndpoint, onOffOutlet, thermostatDevice } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';

import type { OverkizDeviceInfo } from './types.js';
import { WATER_HEATER_SWITCHES, type WaterHeaterSwitch } from './waterHeaterSwitchesDevice.js';

// Re-export for consumers
export { resolveSystemMode, SYSTEM_MODE } from './waterHeaterModes.js';

/**
 * Metadata about a child switch endpoint created inside the composed device.
 */
export interface WaterHeaterChildSwitch {
  /** The child MatterbridgeEndpoint. */
  endpoint: MatterbridgeEndpoint;
  /** The switch definition (commands, state reader). */
  switchDef: WaterHeaterSwitch;
}

/**
 * Result of creating a water heater composed device.
 */
export interface WaterHeaterResult {
  /** The root composed endpoint (thermostat). */
  endpoint: MatterbridgeEndpoint;
  /** Child switch endpoints embedded inside the composed device. */
  childSwitches: WaterHeaterChildSwitch[];
}

/**
 * Create a composed Matterbridge water heater endpoint from an Overkiz device.
 *
 * The root endpoint is a thermostat (temperature + setpoint + temperatureMeasurement).
 * Child endpoints are OnOff switches for Boost, Absence, and DHW Mode,
 * created only when the device supports them.
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

  log.info(`Water heater "${device.label}" raw values: temp=${rawTemp}, middleTemp=${rawMiddleTemp}, target=${rawTarget}, showers=${expectedShowers}`);
  log.info(`Water heater "${device.label}" using: currentTemp=${currentTemp}°C, targetTemp=${targetTemp}°C`);

  const endpoint = new MatterbridgeEndpoint(thermostatDevice, { id: device.uuid })
    .createDefaultBridgedDeviceBasicInformationClusterServer(device.label, device.serialNumber, vendorId, device.manufacturer, `${device.model} (DHW)`)
    .createDefaultPowerSourceWiredClusterServer()
    .createDefaultHeatingThermostatClusterServer(
      currentTemp, // °C — the method multiplies by 100 internally
      targetTemp, // °C
      30, // min 30°C
      70, // max 70°C
    )
    // Add temperatureMeasurement cluster so controllers can read current water temp
    .createDefaultTemperatureMeasurementClusterServer(
      Math.round(currentTemp * 100), // hundredths of °C
      30 * 100, // min
      70 * 100, // max
    )
    .addRequiredClusterServers();

  // Create child switch endpoints for available features (boost, absence, dhw mode)
  const childSwitches: WaterHeaterChildSwitch[] = [];

  for (const switchDef of WATER_HEATER_SWITCHES) {
    if (!switchDef.isAvailable(device)) {
      log.debug(`Water heater child switch "${switchDef.labelSuffix}" not available for "${device.label}"`);
      continue;
    }

    const isOn = switchDef.isOn(device);
    const childName = switchDef.idSuffix.replace('-', '');
    const childLabel = `${device.label}${switchDef.labelSuffix}`;
    const child = endpoint.addChildDeviceType(childName, onOffOutlet, { id: device.uuid + switchDef.idSuffix });
    child.createDefaultBridgedDeviceBasicInformationClusterServer(
      childLabel,
      `${device.serialNumber}${switchDef.idSuffix}`,
      vendorId,
      device.manufacturer,
      `${device.model}${switchDef.labelSuffix}`,
    );
    child.createDefaultOnOffClusterServer(isOn);
    child.addRequiredClusterServers();

    log.info(`  ↳ Child switch "${device.label}${switchDef.labelSuffix}" (${switchDef.idSuffix}) isOn=${isOn}`);
    childSwitches.push({ endpoint: child, switchDef });
  }

  log.info(`Created water heater endpoint for "${device.label}" (${device.widgetName}) with ${childSwitches.length} child switch(es)`);

  return { endpoint, childSwitches };
}

/**
 * Update a water heater endpoint with fresh Overkiz state.
 * Updates the thermostat values, temperature measurement, and child switch states.
 *
 * @param endpoint
 * @param childSwitches
 * @param device
 * @param log
 */
export async function updateWaterHeaterEndpoint(
  endpoint: MatterbridgeEndpoint,
  childSwitches: WaterHeaterChildSwitch[],
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
    await endpoint.setAttribute('temperatureMeasurement', 'measuredValue', Math.round(rawTemp * 100));
  }

  const rawTarget = device.getNumber('core:TargetTemperatureState') || device.getNumber('core:WaterTargetTemperatureState');
  if (rawTarget !== 0) {
    await endpoint.setAttribute('thermostat', 'occupiedHeatingSetpoint', Math.round(rawTarget * 100));
  }

  // Update child switch states
  for (const { endpoint: childEp, switchDef } of childSwitches) {
    const isOn = switchDef.isOn(device);
    await childEp.setAttribute('onOff', 'onOff', isOn);
    log.debug(`  ↳ Updated child switch "${switchDef.idSuffix}": isOn=${isOn}`);
  }

  log.debug(`Updated water heater "${device.label}": temp=${rawTemp}°C target=${rawTarget}°C`);
}
