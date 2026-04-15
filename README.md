# matterbridge-plugin-cozytouch

[![npm version](https://img.shields.io/npm/v/matterbridge-plugin-cozytouch)](https://www.npmjs.com/package/matterbridge-plugin-cozytouch)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

A [Matterbridge](https://github.com/Luligu/matterbridge) plugin that exposes **Atlantic / Thermor / Sauter Cozytouch** devices as Matter devices.

This plugin uses the [Overkiz API](https://github.com/dubocr/overkiz-client) (the same cloud platform behind Cozytouch, TaHoma, Connexoon, etc.) to discover and control your devices, then bridges them into the Matter ecosystem so they work with **Apple Home, Google Home, Amazon Alexa, Samsung SmartThings**, and any other Matter-compatible controller.

## Supported Devices

| Cozytouch Device Type        | Matter Device Type    | Features                                                                       |
| ---------------------------- | --------------------- | ------------------------------------------------------------------------------ |
| **Heaters / Thermostats**    | Thermostat            | Temperature, setpoint, heating levels                                          |
| **Water Heaters**            | Thermostat (composed) | Temperature, setpoint + child switches: Boost, Absence, DHW Mode (Auto/Manuel) |
| **Roller Shutters / Blinds** | Window Covering       | Position, open/close/stop                                                      |
| **Temperature Sensors**      | Temperature Sensor    | Current temperature                                                            |
| **On/Off Devices**           | On/Off Outlet         | On/Off state                                                                   |

> The device mapping is based on the excellent [Home Assistant Overkiz integration](https://github.com/home-assistant/core/tree/dev/homeassistant/components/overkiz).

## Prerequisites

- [Matterbridge](https://github.com/Luligu/matterbridge) >= 3.4.0
- Node.js >= 20.19.0
- A **Cozytouch account** (Atlantic, Thermor, or Sauter)

## Installation

### From Matterbridge UI

1. Open the Matterbridge frontend
2. Go to **Plugins** → **Add Plugin**
3. Search for `matterbridge-plugin-cozytouch`
4. Install and configure

### From CLI

```bash
matterbridge -add matterbridge-plugin-cozytouch
```

## Configuration

| Parameter         | Description                             | Default      |
| ----------------- | --------------------------------------- | ------------ |
| `service`         | Overkiz service name                    | `cozytouch`  |
| `user`            | Your Cozytouch email address            | _(required)_ |
| `password`        | Your Cozytouch password                 | _(required)_ |
| `pollingInterval` | State polling interval in seconds       | `60`         |
| `whiteList`       | Only expose these devices (empty = all) | `[]`         |
| `blackList`       | Exclude these devices                   | `[]`         |
| `debug`           | Enable debug logging                    | `false`      |

### Supported Services

| Service               | Platform                              |
| --------------------- | ------------------------------------- |
| `cozytouch`           | Atlantic / Thermor / Sauter Cozytouch |
| `tahoma`              | Somfy TaHoma                          |
| `connexoon`           | Somfy Connexoon                       |
| `somfy_europe`        | Somfy Europe                          |
| `somfy_australia`     | Somfy Australia                       |
| `somfy_north_america` | Somfy North America                   |
| `rexel`               | Rexel Energeasy Connect               |
| `hi_kumo`             | Hitachi Hi Kumo                       |
| `flexom`              | Flexom                                |
| `local`               | Local API (developer mode)            |

### Example Configuration

```json
{
  "name": "matterbridge-plugin-cozytouch",
  "type": "DynamicPlatform",
  "service": "cozytouch",
  "user": "your-email@example.com",
  "password": "your-password",
  "pollingInterval": 60,
  "whiteList": [],
  "blackList": [],
  "debug": false,
  "unregisterOnShutdown": false
}
```

## Architecture

```
src/
├── module.ts                        # Main platform (CozytouchPlatform)
├── overkizDeviceAdapter.ts          # Converts overkiz-client Device → OverkizDeviceInfo
└── devices/
    ├── index.ts                     # Device creators barrel export
    ├── types.ts                     # OverkizDeviceInfo interface
    ├── deviceMapping.ts             # Widget/uiClass → MatterDeviceType mapping
    ├── thermostatDevice.ts          # Thermostat endpoint creator
    ├── waterHeaterDevice.ts         # Water heater composed device (thermostat + child switches)
    ├── waterHeaterSwitchesDevice.ts # Switch definitions (boost, absence, DHW mode)
    ├── coverDevice.ts               # Window covering endpoint creator
    ├── temperatureSensorDevice.ts   # Temperature sensor endpoint creator
    └── switchDevice.ts              # On/Off switch endpoint creator
```

### Water Heater – Composed Device

The water heater is exposed as a **single composed Matter device** containing:

- A **Thermostat** root endpoint (temperature + target setpoint)
- Up to 3 **OnOff child endpoints** (only created when the device supports them):
  - 🔥 **Boost** – forces immediate heating (`setBoostMode`)
  - 🏖️ **Absence** – reduces heating while away (`setAbsenceMode`)
  - ⚡ **DHW Mode** – ON = auto, OFF = manual eco (`setDHWMode`)

### How It Works

1. **Authentication** – The plugin connects to the Overkiz cloud API using your Cozytouch credentials (JWT-based auth for Cozytouch, session cookies for other services)
2. **Discovery** – It fetches all devices from the API and maps each one to a Matter device type based on its Overkiz widget name and uiClass
3. **Registration** – Each supported device is registered as a Matterbridge endpoint with the appropriate Matter clusters
4. **State Sync** – The overkiz-client library polls for state changes and updates Matter attributes in real-time
5. **Command Handling** – Matter commands (e.g., set thermostat, open cover) are translated to Overkiz commands and sent to the API

## Docker

La méthode recommandée pour faire tourner le plugin est via Docker.

### ⚠️ Important : réseau et mDNS

Le protocole Matter utilise **mDNS** (multicast DNS) pour la découverte et la communication entre appareils. Cela impose des contraintes réseau :

| Plateforme | Compose file | Mode réseau | mDNS |
|---|---|---|---|
| **Linux** (production / Gladys) | `docker-compose.yml` | `network_mode: host` ✅ | Fonctionne nativement |
| **macOS** (développement) | `docker-compose.macos.yml` | Bridge + port mapping | ⚠️ Limité |

> **Sur Linux**, `network_mode: host` est **obligatoire** pour que les contrôleurs Matter (Gladys, Apple Home, Google Home…) puissent communiquer avec le bridge. Sans cela, les paquets mDNS multicast ne traversent pas le NAT Docker et les mises à jour d'état ne sont pas reçues.

#### Spécifier l'interface mDNS

Si votre machine a plusieurs interfaces réseau (Docker en crée beaucoup), vous devez indiquer à Matterbridge laquelle utiliser :

```bash
# Via variable d'environnement
MDNS_INTERFACE=eth0 docker compose up -d

# Interfaces courantes : eth0, end0, enp0s3, wlan0
# Pour trouver la bonne : ip -o link show | grep -v docker
```

### Démarrage rapide

```bash
# 1. Setup complet automatique (build + start + install plugin)
npm run docker:setup

# 2. Ouvrir le frontend pour configurer
open http://localhost:8283
```

### Avec configuration interactive

```bash
# Setup + demande les credentials Cozytouch
npm run docker:setup:configure
```

### Commandes Docker

```bash
npm run docker:start     # Démarrer le container
npm run docker:stop      # Arrêter le container
npm run docker:logs      # Voir les logs en temps réel
npm run docker:shell     # Ouvrir un shell dans le container
npm run docker:restart   # Redémarrer
```

### docker-compose.yml (Linux / production)

Le `docker-compose.yml` principal utilise :

- L'image officielle `luligu/matterbridge:latest`
- Le mode réseau **`host`** (requis pour Matter/mDNS)
- Le paramètre `--mdnsinterface` (via `MDNS_INTERFACE`) pour cibler la bonne interface
- Des volumes persistants pour les données Matterbridge
- Un montage du code source du plugin

### docker-compose.macos.yml (macOS / développement)

Le fichier `docker-compose.macos.yml` utilise le mapping de ports classique car `network_mode: host` n'est pas supporté sur macOS Docker Desktop.

```bash
# Utilisation sur macOS
docker compose -f docker-compose.macos.yml up -d
```

### Configuration via le Frontend

Une fois le container démarré, ouvre **http://localhost:8283** dans ton navigateur :

1. Va dans **Plugins** → tu verras `matterbridge-plugin-cozytouch`
2. Clique sur ⚙️ pour configurer
3. Renseigne ton **email** et **mot de passe** Cozytouch
4. Redémarre le plugin

## Development

```bash
# Install dependencies
npm install
npm link matterbridge  # Link local Matterbridge for development

# Build
npm run build

# Run tests
npm test                # Jest
npm run test:vitest     # Vitest

# Lint & format
npm run lint
npm run format

# Add to local Matterbridge
npm run matterbridge:add
```

## Credits

- [Matterbridge](https://github.com/Luligu/matterbridge) by Luca Liguori
- [overkiz-client](https://github.com/dubocr/overkiz-client) by Romain Duboc
- [Home Assistant Overkiz integration](https://github.com/home-assistant/core/tree/dev/homeassistant/components/overkiz) – device mapping inspiration

## License

[Apache-2.0](LICENSE)
