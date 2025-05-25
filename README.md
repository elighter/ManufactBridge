# ManufactBridge: Modern Üretim-ERP Veri Platformu

ManufactBridge, endüstriyel üretim sistemlerinden (SCADA, Historian, DCS, analizörler) ve ERP sistemlerinden toplanan verileri **Unified Namespace (UNS)** yaklaşımıyla merkezi bir veri platformunda birleştiren modern bir veri mimarisidir. Geleneksel noktadan noktaya entegrasyonlar yerine, merkezi ve standartlaştırılmış bir veri modeli kullanarak ölçeklenebilir, tutarlı ve analitik odaklı bir yapı sunar.

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [Neden ManufactBridge](#neden-manufactbridge)
- [Temel Özellikler](#temel-özellikler)
- [Mimari](#mimari)
- [Kurulum](#kurulum)
- [ERP Entegrasyonu](#erp-entegrasyonu)
- [Katkı Sağlama](#katkı-sağlama)
- [Lisans](#lisans)

## Genel Bakış

ManufactBridge, endüstriyel üretim verilerini ERP sistemleriyle entegre eden ve standart bir veri modeliyle birleştiren kapsamlı bir veri platformudur. Üretim sistemlerinden toplanan verileri toplu bir şekilde işleyerek anlamlı içgörülere dönüştürür ve karar verme süreçlerini iyileştirir.

## Neden ManufactBridge

- **Unified Namespace (UNS):** Bir merkezi veri alanında tüm sistemlerin verilerini paylaştığı pub/sub temelli yaklaşım ile veri siloları ortadan kaldırılır
- **Tek Gerçek Kaynağı:** Tüm veriler ve bilgiler için tek bir gerçek kaynağı sağlayan mimarisi ile veri tutarlılığı
- **Kapsamlı Veri Platformu:** Data Lake, Time Series DB ve Stream Processing ile zengin analitik imkanları
- **İleri Analitik:** Yapay zeka ve veri analizi için hazır altyapı 
- **Akıllı ERP Entegrasyonu:** Yalnızca anlamlı, işlenmiş verilerin ERP sistemlerine aktarımı
- **Güvenli Mimari:** Katmanlı güvenlik yaklaşımı ve endüstriyel standartlara uygun veri koruma

## Temel Özellikler

- **ISA-95 Tabanlı UNS Hiyerarşisi:** ISA-95 seviyeleri kullanarak kurumsal hiyerarşi yapısı
- **MQTT/Kafka Tabanlı Mesajlaşma:** Ölçeklenebilir, gerçek zamanlı veri aktarımı
- **Standart Veri Modelleri:** Sparkplug B spesifikasyonu ile zenginleştirilmiş veri modelleme
- **Data Lake Mimarisi:** Yapılandırılmış ve yapılandırılmamış verilerin merkezi deposu
- **Zaman Serisi Veritabanı:** Sensör ve makine verilerinin verimli depolanması
- **Stream Processing:** Gerçek zamanlı veri işleme ve dönüştürme yeteneği
- **Edge Computing Desteği:** Kaynak noktasında veri ön işleme
- **Çift Yönlü ERP Entegrasyonu:** ERP verilerinin de UNS'ye dahil edilmesi

## Mimari

ManufactBridge, katmanlı ve modüler bir mimari yapı kullanarak endüstriyel verilerden değer üretmeyi amaçlar:

```
                   +---------------------+
                   |                     |
                   |  VERİ KAYNAKLARI    |
                   |                     |
                   +---------+-----------+
                             |
                             v
+-------------------+      +------------------------+      +-------------------+
|                   |      |                        |      |                   |
|  Edge Connectors  |      |  Unified Namespace     |      |  ERP Entegrasyon  |
|                   |<---->|  (UNS)                 |<---->|  Katmanı          |
|                   |      |                        |      |                   |
+-------------------+      +------------------------+      +-------------------+
                                      |
                                      v
                             +------------------+
                             |                  |
                             |  Veri Platformu  |
                             |                  |
                             +--------+---------+
                                      |
                                      v
                             +------------------+
                             |                  |
                             |  Analitik        |
                             |  Katmanı         |
                             |                  |
                             +------------------+
```

## Kurulum

### Gereksinimler
- Node.js 16+ 
- InfluxDB 2.0+
- MQTT Broker (Mosquitto önerilir)
- SAP ERP sistemi (opsiyonel)

### Hızlı Başlangıç

```bash
# Repository'yi klonlayın
git clone https://github.com/emrecakmak/ManufactBridge.git
cd ManufactBridge

# Bağımlılıkları yükleyin
npm install

# Konfigürasyonu düzenleyin
cp config/default.json config/production.json
# config/production.json dosyasını ortamınıza göre düzenleyin

# Platform'u başlatın
npm start
```

### Docker ile Kurulum

```bash
# Docker Compose ile tüm servisleri başlatın
docker-compose up -d

# Logları takip edin
docker-compose logs -f
```

### Manuel Kurulum

1. **InfluxDB Kurulumu**
```bash
# InfluxDB 2.0 kurulumu (Ubuntu/Debian)
wget -qO- https://repos.influxdata.com/influxdb.key | sudo apt-key add -
echo "deb https://repos.influxdata.com/ubuntu focal stable" | sudo tee /etc/apt/sources.list.d/influxdb.list
sudo apt update && sudo apt install influxdb2
sudo systemctl start influxdb
```

2. **MQTT Broker Kurulumu**
```bash
# Mosquitto MQTT broker kurulumu
sudo apt install mosquitto mosquitto-clients
sudo systemctl start mosquitto
```

3. **ManufactBridge Kurulumu**
```bash
npm install
npm run build
npm start
```

## ERP Entegrasyonu

ManufactBridge, geleneksel ERP entegrasyonlarının ötesine geçerek, modern bir endüstriyel veri platformu üzerinden akıllı ERP entegrasyonu sağlar:

- SAP S/4HANA, Odoo, ERPNext ve diğer popüler ERP sistemleri için hazır konnektörler
- Veri standardizasyonu ve dönüşümü
- Akıllı filtreleme ve yalnızca anlamlı verilerin aktarımı
- Çift yönlü iletişim ve tam entegrasyon

## Katkı Sağlama

Projeye katkıda bulunmak için:

1. Bu repository'yi fork edin
2. Yeni bir branch oluşturun
3. Değişikliklerinizi commit edin
4. Branch'inizi push edin
5. Pull Request açın

## Lisans

Bu proje MIT Lisansı altında lisanslanmıştır - detaylar için [LICENSE](LICENSE) dosyasına bakın.