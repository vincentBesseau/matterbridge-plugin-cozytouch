/**
 * Tests for water heater auxiliary switches (boost, away, DHW mode).
 *
 * @file vitest/waterHeaterSwitchesDevice.test.ts
 */

import type { OverkizDeviceInfo } from '../src/devices/types.js';
import { WATER_HEATER_SWITCHES, isBoostOn, isAwayOn, isDhwAutoMode, BOOST_AVAILABLE, AWAY_AVAILABLE, DHW_MODE_AVAILABLE } from '../src/devices/waterHeaterSwitchesDevice.js';
import { resolveSystemMode, SYSTEM_MODE } from '../src/devices/waterHeaterModes.js';

/**
 * Helper: create a mock OverkizDeviceInfo with optional states and commands.
 *
 * @param overrides
 */
function mockDevice(
  overrides: Partial<OverkizDeviceInfo> & {
    states?: Record<string, unknown>;
    commands?: string[];
  } = {},
): OverkizDeviceInfo {
  const states: Record<string, unknown> = overrides.states ?? {};
  const commands = new Set(overrides.commands ?? []);

  return {
    uuid: overrides.uuid ?? 'test-uuid',
    deviceURL: overrides.deviceURL ?? 'io://1234/5678',
    label: overrides.label ?? 'Test Water Heater',
    widgetName: overrides.widgetName ?? 'DomesticHotWaterProduction',
    uiClass: overrides.uiClass ?? 'WaterHeatingSystem',
    controllableName: overrides.controllableName ?? 'io:DHWComponent',
    manufacturer: overrides.manufacturer ?? 'Atlantic',
    model: overrides.model ?? 'Calypso',
    serialNumber: overrides.serialNumber ?? 'SN-12345',
    get: (name: string) => states[name] ?? null,
    getNumber: (name: string) => {
      const val = states[name];
      return typeof val === 'number' ? val : 0;
    },
    hasState: (name: string) => name in states,
    hasCommand: (name: string) => commands.has(name),
  };
}

describe('WATER_HEATER_SWITCHES', () => {
  it('should have 3 switch definitions', () => {
    expect(WATER_HEATER_SWITCHES).toHaveLength(3);
  });

  describe('Boost switch', () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const boostSwitch = WATER_HEATER_SWITCHES.find((s) => s.idSuffix === '-boost')!;

    it('should exist', () => {
      expect(boostSwitch).toBeDefined();
      expect(boostSwitch.labelSuffix).toBe(' Boost');
    });

    it('should be available when setBoostMode command exists', () => {
      const device = mockDevice({ commands: ['setBoostMode'] });
      expect(boostSwitch.isAvailable(device)).toBe(true);
    });

    it('should be available when setBoostModeDuration command exists', () => {
      const device = mockDevice({ commands: ['setBoostModeDuration'] });
      expect(boostSwitch.isAvailable(device)).toBe(true);
    });

    it('should be available when modbuslink boost state exists', () => {
      const device = mockDevice({ states: { 'modbuslink:DHWBoostModeState': 'off' } });
      expect(boostSwitch.isAvailable(device)).toBe(true);
    });

    it('should be available when boost duration state exists', () => {
      const device = mockDevice({ states: { 'core:BoostModeDurationState': 0 } });
      expect(boostSwitch.isAvailable(device)).toBe(true);
    });

    it('should NOT be available when no boost state or command exists', () => {
      const device = mockDevice();
      expect(boostSwitch.isAvailable(device)).toBe(false);
    });

    it('should report isOn=true when modbuslink boost state is "on"', () => {
      const device = mockDevice({ states: { 'modbuslink:DHWBoostModeState': 'on' } });
      expect(boostSwitch.isOn(device)).toBe(true);
    });

    it('should report isOn=false when modbuslink boost state is "off"', () => {
      const device = mockDevice({ states: { 'modbuslink:DHWBoostModeState': 'off' } });
      expect(boostSwitch.isOn(device)).toBe(false);
    });

    it('should report isOn=true when boost duration > 0', () => {
      const device = mockDevice({ states: { 'core:BoostModeDurationState': 2 } });
      expect(boostSwitch.isOn(device)).toBe(true);
    });

    it('should report isOn=false when boost duration = 0', () => {
      const device = mockDevice({ states: { 'core:BoostModeDurationState': 0 } });
      expect(boostSwitch.isOn(device)).toBe(false);
    });

    it('should report isOn=true when boost on/off state is "on"', () => {
      const device = mockDevice({ states: { 'core:BoostOnOffState': 'on' } });
      expect(boostSwitch.isOn(device)).toBe(true);
    });

    it('should report isOn=false when boost on/off state is "off"', () => {
      const device = mockDevice({ states: { 'core:BoostOnOffState': 'off' } });
      expect(boostSwitch.isOn(device)).toBe(false);
    });

    it('should report isOn=true with alt boost state > 0', () => {
      const device = mockDevice({ states: { 'io:DHWBoostModeDurationState': 5 } });
      expect(boostSwitch.isOn(device)).toBe(true);
    });

    it('should report isOn=false when no boost state exists', () => {
      const device = mockDevice();
      expect(boostSwitch.isOn(device)).toBe(false);
    });

    it('should have correct on/off commands', () => {
      expect(boostSwitch.onCommand).toBe('setBoostMode');
      expect(boostSwitch.onParams).toEqual(['on']);
      expect(boostSwitch.offCommand).toBe('setBoostMode');
      expect(boostSwitch.offParams).toEqual(['off']);
    });
  });

  describe('Away switch', () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const awaySwitch = WATER_HEATER_SWITCHES.find((s) => s.idSuffix === '-away')!;

    it('should exist', () => {
      expect(awaySwitch).toBeDefined();
      expect(awaySwitch.labelSuffix).toBe(' Absence');
    });

    it('should be available when setAbsenceMode command exists', () => {
      const device = mockDevice({ commands: ['setAbsenceMode'] });
      expect(awaySwitch.isAvailable(device)).toBe(true);
    });

    it('should be available when setAbsenceModeDuration command exists', () => {
      const device = mockDevice({ commands: ['setAbsenceModeDuration'] });
      expect(awaySwitch.isAvailable(device)).toBe(true);
    });

    it('should be available when modbuslink absence state exists', () => {
      const device = mockDevice({ states: { 'modbuslink:DHWAbsenceModeState': 'off' } });
      expect(awaySwitch.isAvailable(device)).toBe(true);
    });

    it('should be available when absence state exists', () => {
      const device = mockDevice({ states: { 'io:AbsenceModeState': 'off' } });
      expect(awaySwitch.isAvailable(device)).toBe(true);
    });

    it('should NOT be available when no absence state or command exists', () => {
      const device = mockDevice();
      expect(awaySwitch.isAvailable(device)).toBe(false);
    });

    it('should report isOn=true when modbuslink absence state is "on"', () => {
      const device = mockDevice({ states: { 'modbuslink:DHWAbsenceModeState': 'on' } });
      expect(awaySwitch.isOn(device)).toBe(true);
    });

    it('should report isOn=false when modbuslink absence state is "off"', () => {
      const device = mockDevice({ states: { 'modbuslink:DHWAbsenceModeState': 'off' } });
      expect(awaySwitch.isOn(device)).toBe(false);
    });

    it('should report isOn=true when absence on/off state is "on"', () => {
      const device = mockDevice({ states: { 'io:AbsenceOnOffState': 'on' } });
      expect(awaySwitch.isOn(device)).toBe(true);
    });

    it('should report isOn=false when absence on/off state is "off"', () => {
      const device = mockDevice({ states: { 'io:AbsenceOnOffState': 'off' } });
      expect(awaySwitch.isOn(device)).toBe(false);
    });

    it('should report isOn=true when absence mode is "on"', () => {
      const device = mockDevice({ states: { 'io:AbsenceModeState': 'on' } });
      expect(awaySwitch.isOn(device)).toBe(true);
    });

    it('should report isOn=true when absence mode is true', () => {
      const device = mockDevice({ states: { 'io:AbsenceModeState': true } });
      expect(awaySwitch.isOn(device)).toBe(true);
    });

    it('should report isOn=false when absence mode is "off"', () => {
      const device = mockDevice({ states: { 'io:AbsenceModeState': 'off' } });
      expect(awaySwitch.isOn(device)).toBe(false);
    });

    it('should report isOn=true with alt absence duration > 0', () => {
      const device = mockDevice({ states: { 'core:AbsenceModeDurationState': 3 } });
      expect(awaySwitch.isOn(device)).toBe(true);
    });

    it('should report isOn=false when no absence state exists', () => {
      const device = mockDevice();
      expect(awaySwitch.isOn(device)).toBe(false);
    });

    it('should have correct on/off commands', () => {
      expect(awaySwitch.onCommand).toBe('setAbsenceMode');
      expect(awaySwitch.onParams).toEqual(['on']);
      expect(awaySwitch.offCommand).toBe('setAbsenceMode');
      expect(awaySwitch.offParams).toEqual(['off']);
    });
  });

  describe('DHW Mode switch', () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const dhwSwitch = WATER_HEATER_SWITCHES.find((s) => s.idSuffix === '-dhwmode')!;

    it('should exist', () => {
      expect(dhwSwitch).toBeDefined();
      expect(dhwSwitch.labelSuffix).toBe(' Mode (Auto/Manuel)');
    });

    it('should be available when setDHWMode command exists', () => {
      const device = mockDevice({ commands: ['setDHWMode'] });
      expect(dhwSwitch.isAvailable(device)).toBe(true);
    });

    it('should be available when io:DHWModeState exists', () => {
      const device = mockDevice({ states: { 'io:DHWModeState': 'autoMode' } });
      expect(dhwSwitch.isAvailable(device)).toBe(true);
    });

    it('should NOT be available when no DHW mode state or command exists', () => {
      const device = mockDevice();
      expect(dhwSwitch.isAvailable(device)).toBe(false);
    });

    it('should report isOn=true when modbuslink DHW mode is autoMode', () => {
      const device = mockDevice({ states: { 'modbuslink:DHWModeState': 'autoMode' } });
      expect(dhwSwitch.isOn(device)).toBe(true);
    });

    it('should report isOn=false when modbuslink DHW mode is manualEcoActive', () => {
      const device = mockDevice({ states: { 'modbuslink:DHWModeState': 'manualEcoActive' } });
      expect(dhwSwitch.isOn(device)).toBe(false);
    });

    it('should report isOn=true when io:DHWModeState is autoMode', () => {
      const device = mockDevice({ states: { 'io:DHWModeState': 'autoMode' } });
      expect(dhwSwitch.isOn(device)).toBe(true);
    });

    it('should report isOn=false when io:DHWModeState is manualEcoActive', () => {
      const device = mockDevice({ states: { 'io:DHWModeState': 'manualEcoActive' } });
      expect(dhwSwitch.isOn(device)).toBe(false);
    });

    it('should report isOn=false when io:DHWModeState is manualEcoInactive', () => {
      const device = mockDevice({ states: { 'io:DHWModeState': 'manualEcoInactive' } });
      expect(dhwSwitch.isOn(device)).toBe(false);
    });

    it('should report isOn=true with alt DHW mode state set to autoMode', () => {
      const device = mockDevice({ states: { 'core:DHWModeState': 'autoMode' } });
      expect(dhwSwitch.isOn(device)).toBe(true);
    });

    it('should default to true (auto) when no DHW mode state exists', () => {
      const device = mockDevice();
      expect(dhwSwitch.isOn(device)).toBe(true);
    });

    it('should have correct on/off commands', () => {
      expect(dhwSwitch.onCommand).toBe('setDHWMode');
      expect(dhwSwitch.onParams).toEqual(['autoMode']);
      expect(dhwSwitch.offCommand).toBe('setDHWMode');
      expect(dhwSwitch.offParams).toEqual(['manualEcoActive']);
    });
  });
});

describe('Exported helper functions', () => {
  describe('isBoostOn', () => {
    it('should return true when modbuslink boost state is "on"', () => {
      const device = mockDevice({ states: { 'modbuslink:DHWBoostModeState': 'on' } });
      expect(isBoostOn(device)).toBe(true);
    });

    it('should return false when no boost state exists', () => {
      const device = mockDevice();
      expect(isBoostOn(device)).toBe(false);
    });
  });

  describe('isAwayOn', () => {
    it('should return true when absence on/off is "on"', () => {
      const device = mockDevice({ states: { 'io:AbsenceOnOffState': 'on' } });
      expect(isAwayOn(device)).toBe(true);
    });

    it('should return false when no absence state exists', () => {
      const device = mockDevice();
      expect(isAwayOn(device)).toBe(false);
    });
  });

  describe('isDhwAutoMode', () => {
    it('should return true when DHW mode is autoMode', () => {
      const device = mockDevice({ states: { 'io:DHWModeState': 'autoMode' } });
      expect(isDhwAutoMode(device)).toBe(true);
    });

    it('should default to true when no DHW state exists', () => {
      const device = mockDevice();
      expect(isDhwAutoMode(device)).toBe(true);
    });
  });
});

describe('Availability checkers', () => {
  it('BOOST_AVAILABLE should return true when setBoostMode exists', () => {
    const device = mockDevice({ commands: ['setBoostMode'] });
    expect(BOOST_AVAILABLE(device)).toBe(true);
  });

  it('BOOST_AVAILABLE should return false when no boost feature', () => {
    const device = mockDevice();
    expect(BOOST_AVAILABLE(device)).toBe(false);
  });

  it('AWAY_AVAILABLE should return true when setAbsenceMode exists', () => {
    const device = mockDevice({ commands: ['setAbsenceMode'] });
    expect(AWAY_AVAILABLE(device)).toBe(true);
  });

  it('AWAY_AVAILABLE should return false when no away feature', () => {
    const device = mockDevice();
    expect(AWAY_AVAILABLE(device)).toBe(false);
  });

  it('DHW_MODE_AVAILABLE should return true when setDHWMode exists', () => {
    const device = mockDevice({ commands: ['setDHWMode'] });
    expect(DHW_MODE_AVAILABLE(device)).toBe(true);
  });

  it('DHW_MODE_AVAILABLE should return false when no DHW mode feature', () => {
    const device = mockDevice();
    expect(DHW_MODE_AVAILABLE(device)).toBe(false);
  });
});

describe('resolveSystemMode', () => {
  it('should return EMERGENCY_HEAT when boost is active', () => {
    const device = mockDevice({
      commands: ['setBoostMode', 'setAbsenceMode'],
      states: { 'modbuslink:DHWBoostModeState': 'on' },
    });
    expect(resolveSystemMode(device)).toBe(SYSTEM_MODE.EMERGENCY_HEAT);
  });

  it('should return OFF when absence is active (and no boost)', () => {
    const device = mockDevice({
      commands: ['setBoostMode', 'setAbsenceMode'],
      states: {
        'modbuslink:DHWBoostModeState': 'off',
        'io:AbsenceOnOffState': 'on',
      },
    });
    expect(resolveSystemMode(device)).toBe(SYSTEM_MODE.OFF);
  });

  it('should return HEAT when neither boost nor absence is active', () => {
    const device = mockDevice({
      commands: ['setBoostMode', 'setAbsenceMode'],
      states: {
        'modbuslink:DHWBoostModeState': 'off',
        'io:AbsenceOnOffState': 'off',
      },
    });
    expect(resolveSystemMode(device)).toBe(SYSTEM_MODE.HEAT);
  });

  it('should return HEAT when no features are available', () => {
    const device = mockDevice();
    expect(resolveSystemMode(device)).toBe(SYSTEM_MODE.HEAT);
  });

  it('should prioritize boost over absence when both active', () => {
    const device = mockDevice({
      commands: ['setBoostMode', 'setAbsenceMode'],
      states: {
        'modbuslink:DHWBoostModeState': 'on',
        'io:AbsenceOnOffState': 'on',
      },
    });
    expect(resolveSystemMode(device)).toBe(SYSTEM_MODE.EMERGENCY_HEAT);
  });
});

