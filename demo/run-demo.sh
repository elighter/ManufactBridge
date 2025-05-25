#!/bin/bash

# ManufactBridge Demo Script
# Bu script, tam demo ortamını başlatır

echo "🎬 Starting ManufactBridge Demo..."
echo "=================================="

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Hata kontrolü
set -e

# Demo dizinine git
cd "$(dirname "$0")/.."

echo -e "${BLUE}📋 Demo Steps:${NC}"
echo "1. Docker services will be started"
echo "2. ManufactBridge platform will be started"
echo "3. Data simulator will be started"
echo "4. Grafana dashboards will be opened"
echo ""

# Docker servislerini başlat
echo -e "${YELLOW}🐳 Docker servisleri başlatılıyor...${NC}"
docker-compose up -d influxdb mosquitto redis grafana

# Servislerin hazır olmasını bekle
echo -e "${YELLOW}⏳ Servisler hazırlanıyor...${NC}"
sleep 30

# InfluxDB hazır mı kontrol et
echo -e "${YELLOW}🔍 InfluxDB bağlantısı kontrol ediliyor...${NC}"
until curl -f http://localhost:8086/health > /dev/null 2>&1; do
    echo "InfluxDB henüz hazır değil, bekleniyor..."
    sleep 5
done
echo -e "${GREEN}✅ InfluxDB hazır${NC}"

# MQTT broker hazır mı kontrol et
echo -e "${YELLOW}🔍 MQTT broker kontrol ediliyor...${NC}"
until nc -z localhost 1883; do
    echo "MQTT broker henüz hazır değil, bekleniyor..."
    sleep 2
done
echo -e "${GREEN}✅ MQTT broker hazır${NC}"

# ManufactBridge platform'u başlat (arka planda)
echo -e "${YELLOW}🚀 ManufactBridge platform başlatılıyor...${NC}"
npm start > logs/demo-platform.log 2>&1 &
PLATFORM_PID=$!
echo "Platform PID: $PLATFORM_PID"

# Platform'un başlamasını bekle
sleep 10

# Veri simülatörünü başlat (arka planda)
echo -e "${YELLOW}🎬 Veri simülatörü başlatılıyor...${NC}"
node demo/data-simulator.js > logs/demo-simulator.log 2>&1 &
SIMULATOR_PID=$!
echo "Simülatör PID: $SIMULATOR_PID"

# PID'leri kaydet
echo $PLATFORM_PID > demo/platform.pid
echo $SIMULATOR_PID > demo/simulator.pid

echo ""
echo -e "${GREEN}🎉 Demo başarıyla başlatıldı!${NC}"
echo "========================================"
echo ""
echo -e "${BLUE}📊 Demo URL'leri:${NC}"
echo "• Grafana Dashboard: http://localhost:3002"
echo "  - Kullanıcı: admin"
echo "  - Şifre: manufactbridge123"
echo ""
echo "• InfluxDB UI: http://localhost:8086"
echo "  - Token: manufactbridge-super-secret-token"
echo "  - Org: manufactbridge"
echo ""
echo "• Platform Monitoring: http://localhost:3001/health"
echo ""
echo -e "${BLUE}📁 Log Dosyaları:${NC}"
echo "• Platform: logs/demo-platform.log"
echo "• Simülatör: logs/demo-simulator.log"
echo "• Docker: docker-compose logs -f"
echo ""
echo -e "${YELLOW}⚠️  Demo'yu durdurmak için:${NC}"
echo "  ./demo/stop-demo.sh"
echo ""
echo -e "${GREEN}✨ Demo hazır! Grafana dashboard'unu açabilirsiniz.${NC}"

# Demo durumunu göster
echo ""
echo -e "${BLUE}📈 Gerçek Zamanlı Demo Verileri:${NC}"
echo "Simülatör şu verileri üretiyor:"
echo "• Sensör verileri (sıcaklık, basınç, titreşim, hız)"
echo "• Üretim verileri (parça sayısı, kalite)"
echo "• Alert'ler (sıcaklık, basınç, kalite sorunları)"
echo "• ERP verileri (sipariş durumu, malzeme stoku)"
echo ""

# Grafana'yı otomatik aç (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${BLUE}🌐 Grafana dashboard'u açılıyor...${NC}"
    sleep 5
    open http://localhost:3002
fi

# Linux için
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo -e "${BLUE}🌐 Grafana dashboard'u için: http://localhost:3002${NC}"
fi

echo ""
echo -e "${GREEN}🎬 Demo aktif! Ctrl+C ile çıkmak için stop-demo.sh kullanın.${NC}" 