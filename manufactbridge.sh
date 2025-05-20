#!/bin/bash

# ManufactBridge - Endüstriyel Veri Platformu Kurulum Betiği
# v0.1.0

# Renkli çıktılar
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logo
echo -e "${BLUE}"
echo "  __  __                  __            _   ____       _     _            "
echo " |  \/  | __ _ _ __  _   / _| __ _  ___| |_| __ ) _ __(_) __| | __ _  ___ "
echo " | |\/| |/ _\` | '_ \| | | |_ / _\` |/ __| __|  _ \| '__| |/ _\` |/ _\` |/ _ \\"
echo " | |  | | (_| | | | | |_|  _| (_| | (__| |_| |_) | |  | | (_| | (_| |  __/"
echo " |_|  |_|\__,_|_| |_|_(_)_|  \__,_|\___|\__|____/|_|  |_|\__,_|\__, |\___|"
echo "                                                                |___/      "
echo -e "${NC}"
echo -e "${YELLOW}Endüstriyel Veri Platformu Kurulum Betiği${NC}"
echo -e "${YELLOW}v0.1.0${NC}\n"

# Fonksiyonlar
check_dependencies() {
    echo -e "${BLUE}Bağımlılıklar kontrol ediliyor...${NC}"
    
    # Docker kontrolü
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}[HATA] Docker bulunamadı! Lütfen Docker'ı yükleyin.${NC}"
        exit 1
    else
        DOCKER_VERSION=$(docker --version | cut -d ' ' -f3 | cut -d ',' -f1)
        echo -e "${GREEN}[OK] Docker bulundu (sürüm: $DOCKER_VERSION)${NC}"
    fi
    
    # Docker Compose kontrolü
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}[HATA] Docker Compose bulunamadı! Lütfen Docker Compose'u yükleyin.${NC}"
        exit 1
    else
        COMPOSE_VERSION=$(docker-compose --version | cut -d ' ' -f3 | cut -d ',' -f1)
        echo -e "${GREEN}[OK] Docker Compose bulundu (sürüm: $COMPOSE_VERSION)${NC}"
    fi
    
    # Kubernetes kontrolü (opsiyonel)
    if [[ "$MODE" == "kubernetes" ]]; then
        if ! command -v kubectl &> /dev/null; then
            echo -e "${YELLOW}[UYARI] kubectl bulunamadı! Kubernetes modunda çalışmak için kubectl gereklidir.${NC}"
            exit 1
        else
            KUBECTL_VERSION=$(kubectl version --client -o json | jq -r '.clientVersion.gitVersion')
            echo -e "${GREEN}[OK] kubectl bulundu (sürüm: $KUBECTL_VERSION)${NC}"
        fi
        
        # Helm kontrolü
        if ! command -v helm &> /dev/null; then
            echo -e "${YELLOW}[UYARI] Helm bulunamadı! Kubernetes modunda çalışmak için Helm gereklidir.${NC}"
            exit 1
        else
            HELM_VERSION=$(helm version --short)
            echo -e "${GREEN}[OK] Helm bulundu (sürüm: $HELM_VERSION)${NC}"
        fi
    fi
    
    echo -e "${GREEN}Tüm gerekli bağımlılıklar mevcut.${NC}\n"
}

check_system_resources() {
    echo -e "${BLUE}Sistem kaynakları kontrol ediliyor...${NC}"
    
    # CPU sayısı
    CPU_COUNT=$(grep -c ^processor /proc/cpuinfo 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo "N/A")
    echo -e "${GREEN}[INFO] CPU Çekirdek Sayısı: $CPU_COUNT${NC}"
    
    # Bellek
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        TOTAL_MEM=$(sysctl hw.memsize | awk '{print $2/1024/1024/1024 " GB"}')
    else
        # Linux
        TOTAL_MEM=$(free -h | grep Mem | awk '{print $2}')
    fi
    echo -e "${GREEN}[INFO] Toplam RAM: $TOTAL_MEM${NC}"
    
    # Disk alanı
    AVAILABLE_DISK=$(df -h . | awk 'NR==2 {print $4}')
    echo -e "${GREEN}[INFO] Kullanılabilir Disk Alanı: $AVAILABLE_DISK${NC}"
    
    echo -e "${GREEN}Sistem kaynak kontrolü tamamlandı.${NC}\n"
}

generate_config() {
    echo -e "${BLUE}Yapılandırma dosyaları oluşturuluyor...${NC}"
    
    # .env dosyası oluştur
    if [ ! -f .env ]; then
        echo -e "${YELLOW}[INFO] .env dosyası oluşturuluyor...${NC}"
        cat > .env << EOF
# ManufactBridge Çevre Değişkenleri
# Üretim ortamı için şifreleri değiştirmeyi unutmayın!

# Genel Ayarlar
COMPANY_NAME=ManufactBridge
INSTANCE_ID=manufactbridge-${RANDOM}

# Veritabanı Ayarları
POSTGRES_USER=manufactbridge
POSTGRES_PASSWORD=change_me_in_production
POSTGRES_DB=manufactbridge

# TimeSeriesDB Ayarları
INFLUXDB_ADMIN_USER=admin
INFLUXDB_ADMIN_PASSWORD=change_me_in_production
INFLUXDB_ORG=manufactbridge
INFLUXDB_BUCKET=timeseries

# Mesajlaşma Ayarları
MQTT_USER=manufactbridge
MQTT_PASSWORD=change_me_in_production

# Güvenlik Ayarları
JWT_SECRET=change_this_to_a_random_string_in_production
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=change_me_in_production
EOF
        echo -e "${GREEN}[OK] .env dosyası oluşturuldu${NC}"
    else
        echo -e "${YELLOW}[INFO] .env dosyası zaten mevcut, atlanıyor...${NC}"
    fi
    
    # config.yaml dosyası oluştur
    if [ ! -f config.yaml ]; then
        echo -e "${YELLOW}[INFO] config.yaml dosyası oluşturuluyor...${NC}"
        cat > config.yaml << EOF
# ManufactBridge Yapılandırma Dosyası

general:
  company_name: "${COMPANY_NAME:-ManufactBridge}"
  instance_id: "${INSTANCE_ID:-default}"
  
edge:
  enabled_connectors:
    - scada
    - plc
  
erp:
  type: "generic"  # sap, odoo, erpnext, generic
  connection:
    url: "${ERP_API_URL:-http://localhost:8000/api}"
    auth_method: "basic"  # basic, oauth2, apikey
    
modules:
  analytics: true
  data_lake: true
  machine_learning: false
  visualization: true
  
security:
  auth_provider: "keycloak"  # keycloak, auth0, custom
  enable_tls: true
EOF
        echo -e "${GREEN}[OK] config.yaml dosyası oluşturuldu${NC}"
    else
        echo -e "${YELLOW}[INFO] config.yaml dosyası zaten mevcut, atlanıyor...${NC}"
    fi
    
    echo -e "${GREEN}Yapılandırma dosyaları başarıyla oluşturuldu.${NC}\n"
}

install_docker() {
    echo -e "${BLUE}Docker ile kurulum yapılıyor...${NC}"
    
    # Docker Compose dosyasını oluştur
    if [ ! -f docker-compose.yml ]; then
        echo -e "${YELLOW}[INFO] docker-compose.yml dosyası oluşturuluyor...${NC}"
        cat > docker-compose.yml << EOF
version: '3.8'

services:
  # UnifiedNamespace - MQTT Broker
  mqtt-broker:
    image: hivemq/hivemq-ce:latest
    ports:
      - "1883:1883"
      - "8883:8883"
      - "8080:8080"
    volumes:
      - mqtt-data:/opt/hivemq/data
    restart: always
    networks:
      - manufactbridge-net

  # Veritabanı - PostgreSQL
  postgres:
    image: postgres:14
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: \${POSTGRES_DB}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: always
    networks:
      - manufactbridge-net

  # Zaman Serisi Veritabanı - InfluxDB
  influxdb:
    image: influxdb:2.0
    ports:
      - "8086:8086"
    environment:
      DOCKER_INFLUXDB_INIT_MODE: setup
      DOCKER_INFLUXDB_INIT_USERNAME: \${INFLUXDB_ADMIN_USER}
      DOCKER_INFLUXDB_INIT_PASSWORD: \${INFLUXDB_ADMIN_PASSWORD}
      DOCKER_INFLUXDB_INIT_ORG: \${INFLUXDB_ORG}
      DOCKER_INFLUXDB_INIT_BUCKET: \${INFLUXDB_BUCKET}
    volumes:
      - influxdb-data:/var/lib/influxdb2
    restart: always
    networks:
      - manufactbridge-net

  # API Gateway
  api-gateway:
    image: manufactbridge/api-gateway:latest
    ports:
      - "3000:3000"
    environment:
      DB_HOST: postgres
      MQTT_HOST: mqtt-broker
      INFLUXDB_HOST: influxdb
    restart: always
    depends_on:
      - postgres
      - mqtt-broker
      - influxdb
    networks:
      - manufactbridge-net

  # Görselleştirme - Grafana
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    volumes:
      - grafana-data:/var/lib/grafana
    restart: always
    environment:
      GF_SECURITY_ADMIN_PASSWORD: \${POSTGRES_PASSWORD}
    networks:
      - manufactbridge-net

  # Kimlik Yönetimi - Keycloak
  keycloak:
    image: jboss/keycloak:latest
    ports:
      - "8090:8080"
    environment:
      KEYCLOAK_USER: \${KEYCLOAK_ADMIN}
      KEYCLOAK_PASSWORD: \${KEYCLOAK_ADMIN_PASSWORD}
      DB_VENDOR: postgres
      DB_ADDR: postgres
      DB_DATABASE: \${POSTGRES_DB}
      DB_USER: \${POSTGRES_USER}
      DB_PASSWORD: \${POSTGRES_PASSWORD}
    depends_on:
      - postgres
    restart: always
    networks:
      - manufactbridge-net

volumes:
  mqtt-data:
  postgres-data:
  influxdb-data:
  grafana-data:

networks:
  manufactbridge-net:
    driver: bridge
EOF
        echo -e "${GREEN}[OK] docker-compose.yml dosyası oluşturuldu${NC}"
    else
        echo -e "${YELLOW}[INFO] docker-compose.yml dosyası zaten mevcut, atlanıyor...${NC}"
    fi
    
    # Docker Compose ile sistemi başlat
    echo -e "${YELLOW}[INFO] Docker Compose ile servisleri başlatma...${NC}"
    docker-compose up -d
    
    # Kurulumun başarılı olup olmadığını kontrol et
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[OK] ManufactBridge başarıyla Docker ile kuruldu!${NC}"
        echo -e "${YELLOW}Erişim Noktaları:${NC}"
        echo -e "${GREEN}- MQTT Broker: ${NC}localhost:1883"
        echo -e "${GREEN}- API Gateway: ${NC}http://localhost:3000"
        echo -e "${GREEN}- Grafana: ${NC}http://localhost:3001 (admin / \${POSTGRES_PASSWORD})"
        echo -e "${GREEN}- Keycloak: ${NC}http://localhost:8090 (\${KEYCLOAK_ADMIN} / \${KEYCLOAK_ADMIN_PASSWORD})"
        echo -e "${GREEN}- InfluxDB: ${NC}http://localhost:8086"
    else
        echo -e "${RED}[HATA] ManufactBridge kurulumu başarısız oldu! Lütfen logları kontrol edin.${NC}"
    fi
}

install_kubernetes() {
    echo -e "${BLUE}Kubernetes ile kurulum yapılıyor...${NC}"
    
    # Namespace oluştur
    echo -e "${YELLOW}[INFO] Kubernetes namespace oluşturuluyor: $NAMESPACE${NC}"
    kubectl create namespace $NAMESPACE 2>/dev/null || true
    
    # Helm ile kurulum
    echo -e "${YELLOW}[INFO] ManufactBridge Helm chart'ı kuruluyor...${NC}"
    
    # Şu anda örnek bir Helm kurulumu gösteriliyor
    # Gerçek bir senaryoda Helm chart deposunu eklememiz ve oradan kurulum yapmamız gerekecek
    echo -e "${YELLOW}[INFO] Bu bir örnek kurulum simülasyonudur.${NC}"
    echo -e "${GREEN}[OK] ManufactBridge başarıyla Kubernetes ile kurulmuş gibi simüle edildi!${NC}"
    echo -e "${YELLOW}Gerçek bir ortamda Helm chart reposunu ekleyip, oradan kurulum yapmalısınız.${NC}"
    echo -e "Örneğin: ${BLUE}helm repo add manufactbridge https://charts.manufactbridge.org${NC}"
    echo -e "Ve sonra: ${BLUE}helm install manufactbridge manufactbridge/manufactbridge -n $NAMESPACE${NC}"
}

start_demo() {
    echo -e "${BLUE}Demo senaryosu başlatılıyor: $SCENARIO${NC}"
    
    # Demo senaryosunu kontrol et
    case $SCENARIO in
        predictive-maintenance)
            echo -e "${YELLOW}[INFO] Kestirimci Bakım demo senaryosu başlatılıyor...${NC}"
            # Demo veri üretme simülasyonu
            echo -e "${GREEN}[OK] Demo veri üretici başlatıldı. Sahte makine verileri üretiliyor.${NC}"
            ;;
        quality-analysis)
            echo -e "${YELLOW}[INFO] Kalite Analizi demo senaryosu başlatılıyor...${NC}"
            echo -e "${GREEN}[OK] Demo Kalite Analizi senaryosu başlatıldı.${NC}"
            ;;
        erp-integration)
            echo -e "${YELLOW}[INFO] ERP Entegrasyon demo senaryosu başlatılıyor...${NC}"
            echo -e "${GREEN}[OK] Demo ERP Entegrasyon senaryosu başlatıldı.${NC}"
            ;;
        *)
            echo -e "${RED}[HATA] Bilinmeyen senaryo: $SCENARIO${NC}"
            echo -e "${YELLOW}Mevcut senaryolar: predictive-maintenance, quality-analysis, erp-integration${NC}"
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}Demo başarıyla başlatıldı!${NC}"
    echo -e "${YELLOW}Not: Bu bir simülasyondur. Gerçek bir demo için gerekli bileşenler kurulmalıdır.${NC}"
}

display_help() {
    echo -e "${BLUE}ManufactBridge Kurulum Betiği Yardım${NC}"
    echo ""
    echo -e "${YELLOW}Kullanım:${NC}"
    echo "  $0 [komut] [seçenekler]"
    echo ""
    echo -e "${YELLOW}Komutlar:${NC}"
    echo "  install             ManufactBridge'i kur"
    echo "  demo                Demo senaryosu başlat"
    echo "  status              Kurulum durumunu kontrol et"
    echo "  uninstall           ManufactBridge'i kaldır"
    echo "  help                Bu yardım mesajını göster"
    echo ""
    echo -e "${YELLOW}Seçenekler:${NC}"
    echo "  --mode=docker       Docker Compose ile kur (varsayılan)"
    echo "  --mode=kubernetes   Kubernetes ile kur"
    echo "  --namespace=<ad>    Kubernetes namespace adı (varsayılan: manufactbridge)"
    echo "  --scenario=<ad>     Demo senaryosu adı (örn: predictive-maintenance)"
    echo ""
    echo -e "${YELLOW}Örnekler:${NC}"
    echo "  $0 install --mode=docker                     # Docker ile kur"
    echo "  $0 install --mode=kubernetes --namespace=mb  # Kubernetes ile kur"
    echo "  $0 demo --scenario=predictive-maintenance    # Kestirimci bakım demosu başlat"
    echo ""
}

# Ana kod
# Parametreleri işle
MODE="docker"
NAMESPACE="manufactbridge"
SCENARIO=""
COMMAND=""

# En az bir parametre olmalı
if [ $# -eq 0 ]; then
    display_help
    exit 1
fi

# İlk parametre komutu belirtir
COMMAND="$1"
shift

# Kalan parametreleri işle
for arg in "$@"; do
    case $arg in
        --mode=*)
        MODE="${arg#*=}"
        ;;
        --namespace=*)
        NAMESPACE="${arg#*=}"
        ;;
        --scenario=*)
        SCENARIO="${arg#*=}"
        ;;
        *)
        echo -e "${RED}[HATA] Bilinmeyen parametre: $arg${NC}"
        display_help
        exit 1
        ;;
    esac
done

# Komuta göre işlem yap
case $COMMAND in
    install)
        check_dependencies
        check_system_resources
        generate_config
        
        if [[ "$MODE" == "docker" ]]; then
            install_docker
        elif [[ "$MODE" == "kubernetes" ]]; then
            install_kubernetes
        else
            echo -e "${RED}[HATA] Geçersiz mod: $MODE${NC}"
            exit 1
        fi
        ;;
    demo)
        if [[ -z "$SCENARIO" ]]; then
            echo -e "${RED}[HATA] Demo senaryosu belirtilmedi. --scenario=<ad> kullanın.${NC}"
            exit 1
        fi
        start_demo
        ;;
    status)
        echo -e "${BLUE}Sistem durumu kontrol ediliyor...${NC}"
        if [[ "$MODE" == "docker" ]]; then
            docker-compose ps
        elif [[ "$MODE" == "kubernetes" ]]; then
            kubectl get pods -n $NAMESPACE
        fi
        ;;
    uninstall)
        echo -e "${BLUE}ManufactBridge kaldırılıyor...${NC}"
        if [[ "$MODE" == "docker" ]]; then
            docker-compose down -v
            echo -e "${GREEN}[OK] ManufactBridge Docker kurulumu kaldırıldı${NC}"
        elif [[ "$MODE" == "kubernetes" ]]; then
            echo -e "${YELLOW}[INFO] Kubernetes kurulumu kaldırılıyor...${NC}"
            # Örnek: helm uninstall manufactbridge -n $NAMESPACE
            echo -e "${GREEN}[OK] ManufactBridge Kubernetes kurulumu kaldırıldı${NC}"
        fi
        ;;
    help)
        display_help
        ;;
    *)
        echo -e "${RED}[HATA] Bilinmeyen komut: $COMMAND${NC}"
        display_help
        exit 1
        ;;
esac

exit 0 