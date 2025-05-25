#!/bin/bash

# ManufactBridge Demo Stop Script

echo "🛑 Stopping ManufactBridge Demo..."
echo "================================="

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Demo dizinine git
cd "$(dirname "$0")/.."

# PID dosyalarını kontrol et ve process'leri durdur
if [ -f "demo/platform.pid" ]; then
    PLATFORM_PID=$(cat demo/platform.pid)
    echo -e "${YELLOW}🛑 Platform durduruluyor (PID: $PLATFORM_PID)...${NC}"
    kill $PLATFORM_PID 2>/dev/null || echo "Platform zaten durdurulmuş"
    rm -f demo/platform.pid
fi

if [ -f "demo/simulator.pid" ]; then
    SIMULATOR_PID=$(cat demo/simulator.pid)
    echo -e "${YELLOW}🛑 Simülatör durduruluyor (PID: $SIMULATOR_PID)...${NC}"
    kill $SIMULATOR_PID 2>/dev/null || echo "Simülatör zaten durdurulmuş"
    rm -f demo/simulator.pid
fi

# Docker servislerini durdur
echo -e "${YELLOW}🐳 Docker servisleri durduruluyor...${NC}"
docker-compose down

# Temizlik
echo -e "${YELLOW}🧹 Temizlik yapılıyor...${NC}"
pkill -f "node.*data-simulator" 2>/dev/null || true
pkill -f "node.*src/index.js" 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Demo başarıyla durduruldu!${NC}"
echo ""
echo -e "${YELLOW}📁 Log dosyaları korundu:${NC}"
echo "• logs/demo-platform.log"
echo "• logs/demo-simulator.log"
echo ""
echo -e "${GREEN}🎬 Demo'yu tekrar başlatmak için: ./demo/run-demo.sh${NC}" 