/**
 * Water heater mode resolution — pure logic, no Matterbridge dependencies.
 *
 * Maps Overkiz device states to Matter thermostat systemMode values:
 *   Off (0)            → Absence mode
 *   Heat (4)           → Normal / Auto DHW mode
 *   EmergencyHeat (5)  → Boost mode
 *
 * @file src/devices/waterHeaterModes.ts
 * @license Apache-2.0
 */

import type { OverkizDeviceInfo } from './types.js';
import { isBoostOn, isAwayOn, BOOST_AVAILABLE, AWAY_AVAILABLE } from './waterHeaterSwitchesDevice.js';

/**
 * Matter systemMode values used by the thermostat cluster.
 */
export const SYSTEM_MODE = {
  OFF: 0, // mapped to → Absence mode
  HEAT: 4, // mapped to → Normal / Auto DHW mode
  EMERGENCY_HEAT: 5, // mapped to → Boost mode
} as const;

/**
 * Determine the Matter systemMode from current Overkiz state.
 *
 * Priority: Boost > Absence > normal (auto/heat).
 *
 * @param device
 */
export function resolveSystemMode(device: OverkizDeviceInfo): number {
  if (BOOST_AVAILABLE(device) && isBoostOn(device)) return SYSTEM_MODE.EMERGENCY_HEAT;
  if (AWAY_AVAILABLE(device) && isAwayOn(device)) return SYSTEM_MODE.OFF;
  return SYSTEM_MODE.HEAT;
}

