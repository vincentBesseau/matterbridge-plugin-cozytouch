/**
 * Integration test script for Cozytouch API connection.
 *
 * Usage:
 *   node scripts/test-cozytouch.mjs <email> <password> [service]
 *
 * Example:
 *   node scripts/test-cozytouch.mjs user@example.com mypassword cozytouch
 *
 * This script connects to the Overkiz API, lists all devices,
 * and shows their states. Useful to verify credentials and see
 * what devices/widgets are available before running the plugin.
 */

import { Client } from 'overkiz-client';

const email = process.argv[2];
const password = process.argv[3];
const service = process.argv[4] || 'cozytouch';

if (!email || !password) {
  console.error('Usage: node scripts/test-cozytouch.mjs <email> <password> [service]');
  console.error('');
  console.error('Services: cozytouch, tahoma, connexoon, somfy_europe, somfy_australia, somfy_north_america, rexel, hi_kumo, flexom, local');
  process.exit(1);
}

const log = {
  debug: (...args) => console.log('[DEBUG]', ...args),
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};

console.log(`\n🔌 Connecting to "${service}" as "${email}"...\n`);

const client = new Client(log, {
  service,
  user: email,
  password,
  pollingPeriod: 0, // Disable polling for this test
  refreshPeriod: 9999, // Don't auto-refresh
});

try {
  await client.connect(email, password);
  console.log('✅ Connected successfully!\n');

  const devices = await client.getDevices();
  console.log(`📦 Found ${devices.length} device(s):\n`);

  for (const device of devices) {
    const widget = device.definition?.widgetName || '?';
    const uiClass = device.definition?.uiClass || '?';
    const controllable = device.controllableName || '?';

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📱 ${device.label}`);
    console.log(`   UUID:          ${device.uuid}`);
    console.log(`   URL:           ${device.deviceURL}`);
    console.log(`   Widget:        ${widget}`);
    console.log(`   uiClass:       ${uiClass}`);
    console.log(`   Controllable:  ${controllable}`);
    console.log(`   Manufacturer:  ${device.manufacturer}`);
    console.log(`   Model:         ${device.model}`);

    // Show commands
    if (device.definition?.commands?.length > 0) {
      const cmds = device.definition.commands.map((c) => c.commandName);
      console.log(`   Commands:      ${cmds.join(', ')}`);
    }

    // Show states
    if (device.states?.length > 0) {
      console.log(`   States:`);
      for (const state of device.states) {
        const value = typeof state.value === 'object' ? JSON.stringify(state.value) : state.value;
        console.log(`     - ${state.name} = ${value}`);
      }
    }

    // Show sensors
    if (device.sensors?.length > 0) {
      console.log(`   Sensors:`);
      for (const sensor of device.sensors) {
        console.log(`     - ${sensor.label} (${sensor.definition?.widgetName})`);
      }
    }
    console.log('');
  }

  // Also show gateways
  const gateways = await client.getGateways();
  console.log(`\n🌐 Gateways: ${gateways.length}`);
  for (const gw of gateways) {
    console.log(`   - ${gw.gatewayId}`);
  }

  console.log('\n✅ Test completed successfully!');
  console.log('   You can now configure the plugin with these credentials.\n');
} catch (error) {
  console.error(`\n❌ Connection failed: ${error}\n`);
  console.error('Possible causes:');
  console.error('  - Wrong email/password');
  console.error('  - Wrong service (try "cozytouch" for Atlantic/Thermor/Sauter)');
  console.error('  - Temporary API maintenance');
  console.error('  - Too many login attempts (wait a few minutes)');
  process.exit(1);
}
