/**
 * Overkiz device type mapping for Cozytouch devices.
 *
 * Maps Overkiz widget names and uiClasses to Matter device types and
 * provides configuration helpers for creating Matterbridge endpoints.
 *
 * @file src/devices/deviceMapping.ts
 * @license Apache-2.0
 */

/**
 * Supported Matter device categories.
 */
export enum MatterDeviceType {
  Thermostat = 'thermostat',
  WaterHeater = 'waterHeater',
  Cover = 'cover',
  TemperatureSensor = 'temperatureSensor',
  Switch = 'switch',
  Light = 'light',
  HumiditySensor = 'humiditySensor',
  Unknown = 'unknown',
}

/**
 * Map of Overkiz widget names to Matter device types.
 * Based on the Home Assistant Overkiz integration mappings.
 */
export const WIDGET_TO_DEVICE_TYPE: Record<string, MatterDeviceType> = {
  // Climate / Heating devices
  AtlanticElectricalHeater: MatterDeviceType.Thermostat,
  AtlanticElectricalHeaterWithAdjustableTemperatureSetpoint: MatterDeviceType.Thermostat,
  AtlanticElectricalTowelDryer: MatterDeviceType.Thermostat,
  AtlanticHeatRecoveryVentilation: MatterDeviceType.Thermostat,
  AtlanticPassAPCHeatPump: MatterDeviceType.Thermostat,
  AtlanticPassAPCHeatingZone: MatterDeviceType.Thermostat,
  AtlanticPassAPCHeatingAndCoolingZone: MatterDeviceType.Thermostat,
  AtlanticPassAPCZoneControl: MatterDeviceType.Thermostat,
  SomfyThermostat: MatterDeviceType.Thermostat,
  SomfyHeatingTemperatureInterface: MatterDeviceType.Thermostat,
  ValveHeatingTemperatureInterface: MatterDeviceType.Thermostat,
  EvoHomeController: MatterDeviceType.Thermostat,

  // Water heater devices
  AtlanticPassAPCDHW: MatterDeviceType.WaterHeater,
  DomesticHotWaterProduction: MatterDeviceType.WaterHeater,
  AtlanticDomesticHotWaterProductionV2IOComponent: MatterDeviceType.WaterHeater,
  AtlanticDomesticHotWaterProductionMLBComponent: MatterDeviceType.WaterHeater,

  // Cover / Shutter devices
  PositionableRollerShutter: MatterDeviceType.Cover,
  PositionableRollerShutterWithLowSpeedManagement: MatterDeviceType.Cover,

  // Temperature sensors
  TemperatureSensor: MatterDeviceType.TemperatureSensor,
  AtlanticPassAPCOutsideTemperatureSensor: MatterDeviceType.TemperatureSensor,
  AtlanticPassAPCZoneTemperatureSensor: MatterDeviceType.TemperatureSensor,

  // Humidity sensors
  RelativeHumiditySensor: MatterDeviceType.HumiditySensor,

  // DomesticHotWaterTank is intentionally excluded:
  // its features (boost, absence, DHW mode) are already exposed as child
  // endpoints of the DomesticHotWaterProduction WaterHeater device.
};

/**
 * Map of Overkiz uiClass to Matter device types (fallback when widget is not matched).
 */
export const UI_CLASS_TO_DEVICE_TYPE: Record<string, MatterDeviceType> = {
  HeatingSystem: MatterDeviceType.Thermostat,
  WaterHeatingSystem: MatterDeviceType.WaterHeater,
  RollerShutter: MatterDeviceType.Cover,
  ExteriorScreen: MatterDeviceType.Cover,
  Screen: MatterDeviceType.Cover,
  Awning: MatterDeviceType.Cover,
  Curtain: MatterDeviceType.Cover,
  Shutter: MatterDeviceType.Cover,
  SwingingShutter: MatterDeviceType.Cover,
  VenetianBlind: MatterDeviceType.Cover,
  ExteriorVenetianBlind: MatterDeviceType.Cover,
  GarageDoor: MatterDeviceType.Cover,
  Gate: MatterDeviceType.Cover,
  Window: MatterDeviceType.Cover,
  Light: MatterDeviceType.Light,
  OnOff: MatterDeviceType.Switch,
};

/**
 * Ignored uiClasses that should not create devices.
 */
export const IGNORED_UI_CLASSES = new Set(['ProtocolGateway', 'Pod', 'ConfigurationComponent']);

/**
 * Widget names that should be explicitly ignored even if their uiClass is mapped.
 * DomesticHotWaterTank is covered by the WaterHeater composed device.
 */
export const IGNORED_WIDGETS = new Set(['DomesticHotWaterTank']);

/**
 * Resolve the Matter device type for an Overkiz device.
 *
 * @param widgetName
 * @param uiClass
 */
export function resolveDeviceType(widgetName: string, uiClass: string): MatterDeviceType {
  // Skip explicitly ignored widgets
  if (IGNORED_WIDGETS.has(widgetName)) {
    return MatterDeviceType.Unknown;
  }
  // First try widget name (more specific)
  if (widgetName in WIDGET_TO_DEVICE_TYPE) {
    return WIDGET_TO_DEVICE_TYPE[widgetName];
  }
  // Fallback to uiClass
  if (uiClass in UI_CLASS_TO_DEVICE_TYPE) {
    return UI_CLASS_TO_DEVICE_TYPE[uiClass];
  }
  return MatterDeviceType.Unknown;
}
