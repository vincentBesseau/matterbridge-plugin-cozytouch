import { IGNORED_UI_CLASSES, MatterDeviceType, resolveDeviceType } from '../src/devices/deviceMapping.js';

describe('Device Mapping', () => {
  describe('resolveDeviceType', () => {
    it('should resolve Atlantic Electrical Heater widget to Thermostat', () => {
      expect(resolveDeviceType('AtlanticElectricalHeater', 'HeatingSystem')).toBe(MatterDeviceType.Thermostat);
    });

    it('should resolve Atlantic Electrical Heater with adjustable temp to Thermostat', () => {
      expect(resolveDeviceType('AtlanticElectricalHeaterWithAdjustableTemperatureSetpoint', 'HeatingSystem')).toBe(MatterDeviceType.Thermostat);
    });

    it('should resolve Atlantic DHW to WaterHeater', () => {
      expect(resolveDeviceType('AtlanticPassAPCDHW', 'WaterHeatingSystem')).toBe(MatterDeviceType.WaterHeater);
    });

    it('should resolve DomesticHotWaterProduction to WaterHeater', () => {
      expect(resolveDeviceType('DomesticHotWaterProduction', 'WaterHeatingSystem')).toBe(MatterDeviceType.WaterHeater);
    });

    it('should resolve PositionableRollerShutter to Cover', () => {
      expect(resolveDeviceType('PositionableRollerShutter', 'RollerShutter')).toBe(MatterDeviceType.Cover);
    });

    it('should resolve TemperatureSensor to TemperatureSensor', () => {
      expect(resolveDeviceType('TemperatureSensor', 'TemperatureSensor')).toBe(MatterDeviceType.TemperatureSensor);
    });

    it('should fallback to uiClass when widget is unknown', () => {
      expect(resolveDeviceType('UnknownWidget', 'HeatingSystem')).toBe(MatterDeviceType.Thermostat);
      expect(resolveDeviceType('UnknownWidget', 'RollerShutter')).toBe(MatterDeviceType.Cover);
      expect(resolveDeviceType('UnknownWidget', 'Light')).toBe(MatterDeviceType.Light);
      expect(resolveDeviceType('UnknownWidget', 'OnOff')).toBe(MatterDeviceType.Switch);
    });

    it('should return Unknown for unsupported devices', () => {
      expect(resolveDeviceType('CompletelyUnknown', 'AlsoUnknown')).toBe(MatterDeviceType.Unknown);
    });
  });

  describe('IGNORED_UI_CLASSES', () => {
    it('should ignore ProtocolGateway', () => {
      expect(IGNORED_UI_CLASSES.has('ProtocolGateway')).toBe(true);
    });

    it('should ignore Pod', () => {
      expect(IGNORED_UI_CLASSES.has('Pod')).toBe(true);
    });

    it('should not ignore HeatingSystem', () => {
      expect(IGNORED_UI_CLASSES.has('HeatingSystem')).toBe(false);
    });
  });
});
