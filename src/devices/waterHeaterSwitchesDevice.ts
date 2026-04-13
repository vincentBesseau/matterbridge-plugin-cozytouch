/**
 * Water heater auxiliary switch definitions for Overkiz DHW devices.
 *
 * Defines the switch metadata (state readers, commands) for:
 * - Boost mode: forces immediate water heating
 * - Away/Absence mode: reduces heating while away
 * - DHW mode: toggles between auto and manual modes
 *
 * These definitions are consumed by waterHeaterDevice.ts which creates
 * the child endpoints inside the composed device.
 *
 * @file src/devices/waterHeaterSwitchesDevice.ts
 * @license Apache-2.0
 */

import type { OverkizDeviceInfo } from './types.js';

/**
 * Overkiz state names used for DHW switches.
 */
const DHW_STATES = {
  // Boost mode
  BOOST_MODE_DURATION: 'core:BoostModeDurationState',
  BOOST_MODE_DURATION_ALT: 'io:DHWBoostModeDurationState',
  BOOST_ON_OFF: 'core:BoostOnOffState',
  BOOST_MODE_MODBUSLINK: 'modbuslink:DHWBoostModeState',

  // Away / Absence mode
  AWAY_MODE: 'io:AbsenceModeState',
  AWAY_MODE_DURATION: 'core:AbsenceModeDurationState',
  AWAY_ON_OFF: 'io:AbsenceOnOffState',
  AWAY_MODE_MODBUSLINK: 'modbuslink:DHWAbsenceModeState',

  // DHW operating mode (auto vs. manual)
  DHW_MODE: 'io:DHWModeState',
  DHW_MODE_ALT: 'core:DHWModeState',
  DHW_MODE_MODBUSLINK: 'modbuslink:DHWModeState',
} as const;

/**
 * Known DHW mode values from Overkiz.
 */
const DHW_MODE_VALUES = {
  AUTO_MODE: 'autoMode',
  MANUAL_ECO_ACTIVE: 'manualEcoActive',
  MANUAL_ECO_INACTIVE: 'manualEcoInactive',
} as const;

/**
 * Helper: determine if boost mode is currently on.
 *
 * @param device
 */
export function isBoostOn(device: OverkizDeviceInfo): boolean {
  // Modbuslink on/off state (Atlantic LINEO and similar)
  if (device.hasState(DHW_STATES.BOOST_MODE_MODBUSLINK)) {
    return device.get(DHW_STATES.BOOST_MODE_MODBUSLINK) === 'on';
  }
  // Check explicit on/off state
  if (device.hasState(DHW_STATES.BOOST_ON_OFF)) {
    return device.get(DHW_STATES.BOOST_ON_OFF) === 'on';
  }
  // Boost duration > 0 means boost is active
  if (device.hasState(DHW_STATES.BOOST_MODE_DURATION)) {
    return device.getNumber(DHW_STATES.BOOST_MODE_DURATION) > 0;
  }
  if (device.hasState(DHW_STATES.BOOST_MODE_DURATION_ALT)) {
    return device.getNumber(DHW_STATES.BOOST_MODE_DURATION_ALT) > 0;
  }
  return false;
}

/**
 * Helper: determine if away/absence mode is currently on.
 *
 * @param device
 */
export function isAwayOn(device: OverkizDeviceInfo): boolean {
  // Modbuslink on/off state (Atlantic LINEO and similar)
  if (device.hasState(DHW_STATES.AWAY_MODE_MODBUSLINK)) {
    return device.get(DHW_STATES.AWAY_MODE_MODBUSLINK) === 'on';
  }
  // Check explicit on/off state
  if (device.hasState(DHW_STATES.AWAY_ON_OFF)) {
    return device.get(DHW_STATES.AWAY_ON_OFF) === 'on';
  }
  if (device.hasState(DHW_STATES.AWAY_MODE)) {
    const val = device.get(DHW_STATES.AWAY_MODE);
    return val === 'on' || val === true;
  }
  if (device.hasState(DHW_STATES.AWAY_MODE_DURATION)) {
    return device.getNumber(DHW_STATES.AWAY_MODE_DURATION) > 0;
  }
  return false;
}

/**
 * Helper: determine if DHW mode is "auto" (on) vs. "manual" (off).
 *
 * @param device
 */
export function isDhwAutoMode(device: OverkizDeviceInfo): boolean {
  if (device.hasState(DHW_STATES.DHW_MODE_MODBUSLINK)) {
    return device.get(DHW_STATES.DHW_MODE_MODBUSLINK) === DHW_MODE_VALUES.AUTO_MODE;
  }
  if (device.hasState(DHW_STATES.DHW_MODE)) {
    return device.get(DHW_STATES.DHW_MODE) === DHW_MODE_VALUES.AUTO_MODE;
  }
  if (device.hasState(DHW_STATES.DHW_MODE_ALT)) {
    return device.get(DHW_STATES.DHW_MODE_ALT) === DHW_MODE_VALUES.AUTO_MODE;
  }
  return true; // Default to auto
}

/**
 * Metadata for each auxiliary switch type.
 */
export interface WaterHeaterSwitch {
  /** Suffix appended to the device UUID for the switch endpoint ID. */
  idSuffix: string;
  /** Display label suffix. */
  labelSuffix: string;
  /** The Overkiz command to send when toggling on. */
  onCommand: string;
  /** Parameters for the on command. */
  onParams: unknown[];
  /** The Overkiz command to send when toggling off. */
  offCommand: string;
  /** Parameters for the off command. */
  offParams: unknown[];
  /** Function to determine current state from device info. */
  isOn: (device: OverkizDeviceInfo) => boolean;
  /** Function to determine if this switch is available for the device. */
  isAvailable: (device: OverkizDeviceInfo) => boolean;
}

/**
 * All known auxiliary switch definitions for water heater devices.
 */
export const WATER_HEATER_SWITCHES: WaterHeaterSwitch[] = [
  {
    idSuffix: '-boost',
    labelSuffix: ' Boost',
    onCommand: 'setBoostMode',
    onParams: ['on'],
    offCommand: 'setBoostMode',
    offParams: ['off'],
    isOn: isBoostOn,
    isAvailable: (device) =>
      device.hasCommand('setBoostMode') ||
      device.hasCommand('setBoostModeDuration') ||
      device.hasCommand('setBoostOnOffState') ||
      device.hasState(DHW_STATES.BOOST_MODE_MODBUSLINK) ||
      device.hasState(DHW_STATES.BOOST_MODE_DURATION) ||
      device.hasState(DHW_STATES.BOOST_MODE_DURATION_ALT) ||
      device.hasState(DHW_STATES.BOOST_ON_OFF),
  },
  {
    idSuffix: '-away',
    labelSuffix: ' Absence',
    onCommand: 'setAbsenceMode',
    onParams: ['on'],
    offCommand: 'setAbsenceMode',
    offParams: ['off'],
    isOn: isAwayOn,
    isAvailable: (device) =>
      device.hasCommand('setAbsenceMode') ||
      device.hasCommand('setAbsenceModeDuration') ||
      device.hasState(DHW_STATES.AWAY_MODE_MODBUSLINK) ||
      device.hasState(DHW_STATES.AWAY_MODE) ||
      device.hasState(DHW_STATES.AWAY_MODE_DURATION) ||
      device.hasState(DHW_STATES.AWAY_ON_OFF),
  },
  {
    idSuffix: '-dhwmode',
    labelSuffix: ' Mode (Auto/Manuel)',
    onCommand: 'setDHWMode',
    onParams: ['autoMode'],
    offCommand: 'setDHWMode',
    offParams: ['manualEcoActive'],
    isOn: isDhwAutoMode,
    isAvailable: (device) => device.hasCommand('setDHWMode') || device.hasState(DHW_STATES.DHW_MODE) || device.hasState(DHW_STATES.DHW_MODE_ALT),
  },
];

/**
 * Availability checkers — reusable predicates for each feature.
 */
export const BOOST_AVAILABLE = (device: OverkizDeviceInfo): boolean =>
  device.hasCommand('setBoostMode') ||
  device.hasCommand('setBoostModeDuration') ||
  device.hasCommand('setBoostOnOffState') ||
  device.hasState(DHW_STATES.BOOST_MODE_MODBUSLINK) ||
  device.hasState(DHW_STATES.BOOST_MODE_DURATION) ||
  device.hasState(DHW_STATES.BOOST_MODE_DURATION_ALT) ||
  device.hasState(DHW_STATES.BOOST_ON_OFF);

export const AWAY_AVAILABLE = (device: OverkizDeviceInfo): boolean =>
  device.hasCommand('setAbsenceMode') ||
  device.hasCommand('setAbsenceModeDuration') ||
  device.hasState(DHW_STATES.AWAY_MODE_MODBUSLINK) ||
  device.hasState(DHW_STATES.AWAY_MODE) ||
  device.hasState(DHW_STATES.AWAY_MODE_DURATION) ||
  device.hasState(DHW_STATES.AWAY_ON_OFF);

export const DHW_MODE_AVAILABLE = (device: OverkizDeviceInfo): boolean =>
  device.hasCommand('setDHWMode') || device.hasState(DHW_STATES.DHW_MODE) || device.hasState(DHW_STATES.DHW_MODE_ALT);

