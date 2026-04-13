#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# docker-setup.sh
#
# Lance Matterbridge dans Docker et installe le plugin Cozytouch.
#
# Usage :
#   ./scripts/docker-setup.sh              # Juste build + start
#   ./scripts/docker-setup.sh --configure  # + configure les credentials
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONTAINER_NAME="matterbridge-cozytouch"

cd "$PROJECT_DIR"

# ─── Couleurs ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}ℹ ${NC} $*"; }
ok()    { echo -e "${GREEN}✅${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠️ ${NC} $*"; }
err()   { echo -e "${RED}❌${NC} $*"; }

# ─── Vérifications ─────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  err "Docker n'est pas installé. Installe Docker Desktop : https://www.docker.com/products/docker-desktop"
  exit 1
fi

if ! docker info &>/dev/null 2>&1; then
  err "Le démon Docker n'est pas démarré. Lance Docker Desktop d'abord."
  exit 1
fi

# ─── Build du plugin ──────────────────────────────────────────────────────
info "Build du plugin TypeScript..."
npm run cleanBuild 2>/dev/null || npm run build
ok "Plugin buildé"

# ─── Docker Compose Up ────────────────────────────────────────────────────
info "Démarrage du container Matterbridge..."
docker compose up -d --pull always
ok "Container démarré"

# ─── Attendre que Matterbridge soit prêt ──────────────────────────────────
info "Attente du démarrage de Matterbridge (max 60s)..."
for i in $(seq 1 60); do
  if docker exec "$CONTAINER_NAME" mb_health &>/dev/null 2>&1; then
    ok "Matterbridge est prêt !"
    break
  fi
  if [ "$i" -eq 60 ]; then
    warn "Timeout — Matterbridge n'a pas encore répondu. Vérifie les logs : docker compose logs -f"
  fi
  sleep 1
done

# ─── Installer le plugin dans Matterbridge ────────────────────────────────
info "Installation du plugin dans le container..."

# Installer les dépendances du plugin et linker matterbridge (peer dep)
docker exec "$CONTAINER_NAME" sh -c '
  cd /root/Matterbridge/matterbridge-plugin-cozytouch && \
  npm install --omit=dev 2>/dev/null && \
  npm link matterbridge 2>/dev/null && \
  echo "Dependencies installed"
'

# Enregistrer et activer le plugin dans Matterbridge
docker exec "$CONTAINER_NAME" sh -c '
  cd /root/Matterbridge/matterbridge-plugin-cozytouch && \
  matterbridge -add . 2>/dev/null || true
'
docker exec "$CONTAINER_NAME" sh -c '
  cd /root/Matterbridge/matterbridge-plugin-cozytouch && \
  matterbridge -enable . 2>/dev/null || true
'
ok "Plugin installé et enregistré"

# Redémarrer pour charger le plugin
info "Redémarrage de Matterbridge pour charger le plugin..."
docker compose restart
sleep 5
ok "Plugin chargé"

# ─── Configuration optionnelle ────────────────────────────────────────────
if [ "${1:-}" = "--configure" ]; then
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  Configuration Cozytouch${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  read -rp "Email Cozytouch : " COZY_USER
  read -rsp "Mot de passe    : " COZY_PASS
  echo ""
  read -rp "Service [cozytouch] : " COZY_SERVICE
  COZY_SERVICE="${COZY_SERVICE:-cozytouch}"

  # Mettre à jour la config
  CONFIG_FILE="matterbridge-plugin-cozytouch.config.json"
  # Utiliser node pour modifier le JSON proprement
  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
    cfg.user = '$COZY_USER';
    cfg.password = '$COZY_PASS';
    cfg.service = '$COZY_SERVICE';
    fs.writeFileSync('$CONFIG_FILE', JSON.stringify(cfg, null, 2) + '\\n');
    console.log('Config updated');
  "
  ok "Configuration sauvegardée"

  # Redémarrer pour prendre en compte la config
  info "Redémarrage de Matterbridge..."
  docker compose restart
  ok "Redémarré"
fi

# ─── Résumé ───────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Matterbridge Cozytouch est prêt !${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  🌐 Frontend Matterbridge : ${CYAN}http://localhost:8283${NC}"
echo -e "  📋 Logs                  : ${CYAN}docker compose logs -f${NC}"
echo -e "  🔧 Shell container       : ${CYAN}docker compose exec matterbridge sh${NC}"
echo -e "  🛑 Arrêter               : ${CYAN}docker compose down${NC}"
echo ""
if [ "${1:-}" != "--configure" ]; then
  echo -e "  ${YELLOW}N'oublie pas de configurer tes credentials Cozytouch !${NC}"
  echo -e "  → Via le frontend : http://localhost:8283"
  echo -e "  → Ou relance avec : ${CYAN}./scripts/docker-setup.sh --configure${NC}"
  echo ""
fi

