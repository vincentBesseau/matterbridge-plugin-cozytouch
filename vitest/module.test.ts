import path from 'node:path';

import { MatterbridgeEndpoint, PlatformConfig, PlatformMatterbridge } from 'matterbridge';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { VendorId } from 'matterbridge/matter';

import { CozytouchPlatform } from '../src/module.js';

const mockLog = {
  fatal: vi.fn((message: string, ...parameters: any[]) => {}),
  error: vi.fn((message: string, ...parameters: any[]) => {}),
  warn: vi.fn((message: string, ...parameters: any[]) => {}),
  notice: vi.fn((message: string, ...parameters: any[]) => {}),
  info: vi.fn((message: string, ...parameters: any[]) => {}),
  debug: vi.fn((message: string, ...parameters: any[]) => {}),
} as unknown as AnsiLogger;

const mockMatterbridge: PlatformMatterbridge = {
  systemInformation: {
    ipv4Address: '192.168.1.1',
    ipv6Address: 'fd78:cbf8:4939:746:a96:8277:346f:416e',
    osRelease: 'x.y.z',
    nodeVersion: '22.10.0',
  },
  rootDirectory: path.join('.cache', 'vitest', 'CozytouchPlugin'),
  homeDirectory: path.join('.cache', 'vitest', 'CozytouchPlugin'),
  matterbridgeDirectory: path.join('.cache', 'vitest', 'CozytouchPlugin', '.matterbridge'),
  matterbridgePluginDirectory: path.join('.cache', 'vitest', 'CozytouchPlugin', 'Matterbridge'),
  matterbridgeCertDirectory: path.join('.cache', 'vitest', 'CozytouchPlugin', '.mattercert'),
  globalModulesDirectory: path.join('.cache', 'vitest', 'CozytouchPlugin', 'node_modules'),
  matterbridgeVersion: '3.5.0',
  matterbridgeLatestVersion: '3.5.0',
  matterbridgeDevVersion: '3.5.0',
  bridgeMode: 'bridge',
  restartMode: '',
  aggregatorVendorId: VendorId(0xfff1),
  aggregatorVendorName: 'Matterbridge',
  aggregatorProductId: 0x8000,
  aggregatorProductName: 'Matterbridge aggregator',
  // Mocked methods
  registerVirtualDevice: vi.fn(async (name: string, type: 'light' | 'outlet' | 'switch' | 'mounted_switch', callback: () => Promise<void>) => {}),
  addBridgedEndpoint: vi.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {}),
  removeBridgedEndpoint: vi.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {}),
  removeAllBridgedEndpoints: vi.fn(async (pluginName: string) => {}),
} as unknown as PlatformMatterbridge;

const mockConfig: PlatformConfig = {
  name: 'matterbridge-plugin-cozytouch',
  type: 'DynamicPlatform',
  version: '0.1.0',
  whiteList: [],
  blackList: [],
  debug: false,
  unregisterOnShutdown: false,
  service: 'cozytouch',
  user: '',
  password: '',
  pollingInterval: 60,
};

const loggerLogSpy = vi.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});

describe('Matterbridge Plugin Cozytouch', () => {
  let instance: CozytouchPlatform;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('should throw an error if matterbridge is not the required version', async () => {
    // @ts-expect-error Ignore readonly for testing purposes
    mockMatterbridge.matterbridgeVersion = '2.0.0';
    expect(() => new CozytouchPlatform(mockMatterbridge, mockLog, mockConfig)).toThrow(
      'This plugin requires Matterbridge version >= "3.4.0". Please update Matterbridge from 2.0.0 to the latest version in the frontend.',
    );
    // @ts-expect-error Ignore readonly for testing purposes
    mockMatterbridge.matterbridgeVersion = '3.5.0';
  });

  it('should create an instance of the platform', async () => {
    instance = (await import('../src/module.js')).default(mockMatterbridge, mockLog, mockConfig) as CozytouchPlatform;
    // @ts-expect-error Accessing private method for testing purposes
    instance.setMatterNode(
      // @ts-expect-error Accessing private method for testing purposes
      mockMatterbridge.addBridgedEndpoint,
      // @ts-expect-error Accessing private method for testing purposes
      mockMatterbridge.removeBridgedEndpoint,
      // @ts-expect-error Accessing private method for testing purposes
      mockMatterbridge.removeAllBridgedEndpoints,
      // @ts-expect-error Accessing private method for testing purposes
      mockMatterbridge.registerVirtualDevice,
    );
    expect(instance).toBeInstanceOf(CozytouchPlatform);
    expect(instance.matterbridge).toBe(mockMatterbridge);
    expect(instance.log).toBe(mockLog);
    expect(instance.config).toBe(mockConfig);
    expect(mockLog.info).toHaveBeenCalledWith('Initializing Cozytouch Platform...');
  });

  it('should start and log missing credentials', async () => {
    await instance.onStart('Vitest');
    expect(mockLog.info).toHaveBeenCalledWith('onStart called with reason: Vitest');
    expect(mockLog.error).toHaveBeenCalledWith('Missing Cozytouch credentials. Please configure user and password in the plugin settings.');
  });

  it('should configure', async () => {
    await instance.onConfigure();
    expect(mockLog.info).toHaveBeenCalledWith('onConfigure called — setting up state listeners and push timers');
  });

  it('should change logger level', async () => {
    await instance.onChangeLoggerLevel(LogLevel.DEBUG);
    expect(mockLog.info).toHaveBeenCalledWith('onChangeLoggerLevel called with: debug');
  });

  it('should shutdown', async () => {
    await instance.onShutdown('Vitest');
    expect(mockLog.info).toHaveBeenCalledWith('onShutdown called with reason: Vitest');

    mockConfig.unregisterOnShutdown = true;
    await instance.onShutdown();
    expect(mockLog.info).toHaveBeenCalledWith('onShutdown called with reason: none');
    // @ts-expect-error Accessing private method for testing purposes
    expect(mockMatterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();
    mockConfig.unregisterOnShutdown = false;
  });
});
