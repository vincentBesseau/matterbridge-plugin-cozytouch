/**
 * Shared types for Overkiz device mapping.
 *
 * @file src/devices/types.ts
 * @license Apache-2.0
 */

/**
 * Simplified interface for Overkiz device data used by device creators.
 * This abstracts away the overkiz-client Device class to make testing easier.
 */
export interface OverkizDeviceInfo {
  /** Unique device identifier (UUID). */
  uuid: string;
  /** Overkiz device URL. */
  deviceURL: string;
  /** Device label / display name. */
  label: string;
  /** Overkiz widget name (e.g. "AtlanticElectricalHeater"). */
  widgetName: string;
  /** Overkiz UI class (e.g. "HeatingSystem"). */
  uiClass: string;
  /** Controllable name (e.g. "io:AtlanticElectricalHeaterIOComponent"). */
  controllableName: string;
  /** Device manufacturer. */
  manufacturer: string;
  /** Device model. */
  model: string;
  /** Device serial number. */
  serialNumber: string;
  /** Get a state value by name. */
  get(stateName: string): unknown;
  /** Get a state value as number. */
  getNumber(stateName: string): number;
  /** Check if a state exists. */
  hasState(stateName: string): boolean;
  /** Check if a command exists. */
  hasCommand(commandName: string): boolean;
}
