/**
 * Diagnostic script — dumps all Overkiz device details.
 *
 * Run inside the Docker container:
 *   docker exec matterbridge-cozytouch node /root/Matterbridge/matterbridge-plugin-cozytouch/scripts/dump-devices.mjs <email> <password> [service]
 *
 * Or locally:
 *   node scripts/dump-devices.mjs <email> <password> [service]
 */

import { Client } from 'overkiz-client';

const email = process.argv[2];
const password = process.argv[3];
const service = process.argv[4] || 'cozytouch';

if (!email || !password) {
  console.error('Usage: node scripts/dump-devices.mjs <email> <password> [service]');
  process.exit(1);
}

const log = {
  debug: () => {},
  info: (...a) => console.log('[INFO]', ...a),
  warn: (...a) => console.warn('[WARN]', ...a),
  error: (...a) => console.error('[ERROR]', ...a),
};

const client = new Client(log, {
  service,
  user: email,
  password,
  pollingPeriod: 0,
  refreshPeriod: 9999,
});

try {
  await client.connect(email, password);
  console.log('✅ Connected\n');

  const devices = await client.getDevices();
  console.log(`📦 ${devices.length} device(s) found\n`);

  for (const device of devices) {
    const w = device.definition?.widgetName || '?';
    const ui = device.definition?.uiClass || '?';
    const ctrl = device.controllableName || '?';

    console.log('═══════════════════════════════════════════════════');
    console.log(`📱 ${device.label}`);
    console.log(`   UUID          : ${device.uuid}`);
    console.log(`   deviceURL     : ${device.deviceURL}`);
    console.log(`   widget        : ${w}`);
    console.log(`   uiClass       : ${ui}`);
    console.log(`   controllable  : ${ctrl}`);
    console.log(`   manufacturer  : ${device.manufacturer}`);
    console.log(`   model         : ${device.model}`);

    if (device.definition?.commands?.length) {
      console.log(`   commands      :`);
      for (const c of device.definition.commands) {
        console.log(`     - ${c.commandName} (${c.nparams} param)`);
      }
    }

    if (device.states?.length) {
      console.log(`   states        :`);
      for (const s of device.states) {
        const v = typeof s.value === 'object' ? JSON.stringify(s.value) : s.value;
        console.log(`     - ${s.name} = ${v}  (type ${s.type})`);
      }
    }

    if (device.sensors?.length) {
      console.log(`   sensors       :`);
      for (const sensor of device.sensors) {
        console.log(`     📡 ${sensor.label} (${sensor.definition?.widgetName})`);
        if (sensor.states?.length) {
          for (const s of sensor.states) {
            const v = typeof s.value === 'object' ? JSON.stringify(s.value) : s.value;
            console.log(`        - ${s.name} = ${v}`);
          }
        }
      }
    }

    console.log('');
  }

  // Also dump raw JSON for debugging
  console.log('\n\n📋 RAW JSON (for debugging):');
  console.log(
    JSON.stringify(
      devices.map((d) => ({
        label: d.label,
        uuid: d.uuid,
        deviceURL: d.deviceURL,
        widget: d.definition?.widgetName,
        uiClass: d.definition?.uiClass,
        controllableName: d.controllableName,
        manufacturer: d.manufacturer,
        model: d.model,
        commands: d.definition?.commands?.map((c) => c.commandName),
        states: d.states?.map((s) => ({ name: s.name, value: s.value, type: s.type })),
        sensors: d.sensors?.map((s) => ({
          label: s.label,
          widget: s.definition?.widgetName,
          states: s.states?.map((st) => ({ name: st.name, value: st.value })),
        })),
      })),
      null,
      2,
    ),
  );
} catch (error) {
  console.error(`❌ Error: ${error}`);
  process.exit(1);
}
