# ManufactBridge MVP Demo

Bu demo, ManufactBridge platformunun tam fonksiyonel bir örneğini gösterir. Gerçek bir üretim ortamını simüle ederek platform'un tüm özelliklerini deneyimleyebilirsiniz.

## 🎯 Demo Özellikleri

### Simüle Edilen Sistemler
- **Üretim Hattı**: Sensörler, makineler, kalite kontrol
- **SCADA Sistemi**: OPC UA protokolü ile veri toplama
- **ERP Sistemi**: SAP entegrasyonu simülasyonu
- **MQTT Broker**: Unified Namespace (UNS) mesajlaşma
- **Time Series Database**: InfluxDB ile veri depolama
- **Dashboard**: Grafana ile görselleştirme

### Gerçek Zamanlı Veriler
- **Sensör Verileri**: Sıcaklık, basınç, titreşim, hız
- **Üretim Verileri**: Parça sayısı, kalite oranı, vardiya bilgisi
- **Alert'ler**: Threshold aşımları, kalite sorunları
- **ERP Verileri**: Sipariş durumu, malzeme stoku

## 🚀 Demo Başlatma

### Hızlı Başlatma
```bash
npm run demo:start
```

### Manuel Başlatma
```bash
# 1. Docker servislerini başlat
docker-compose up -d influxdb mosquitto redis grafana

# 2. Platform'u başlat
npm start

# 3. Veri simülatörünü başlat (yeni terminal)
npm run demo:simulator
```

## 📊 Demo URL'leri

### Grafana Dashboard
- **URL**: http://localhost:3002
- **Kullanıcı**: admin
- **Şifre**: manufactbridge123

**Dashboard'lar**:
- Manufacturing Overview: Ana üretim göstergeleri
- Real-time Sensors: Sensör verileri
- Production Metrics: Üretim metrikleri
- System Alerts: Alert'ler ve uyarılar

### InfluxDB UI
- **URL**: http://localhost:8086
- **Token**: manufactbridge-super-secret-token
- **Organization**: manufactbridge
- **Bucket**: manufacturing_data

### Platform Monitoring
- **Health Check**: http://localhost:3001/health
- **Metrics**: http://localhost:3001/metrics

## 🎬 Demo Senaryoları

### Senaryo 1: Normal Üretim
1. Demo'yu başlatın
2. Grafana'da "Manufacturing Overview" dashboard'unu açın
3. Real-time sensör verilerini gözlemleyin
4. Üretim sayacının artışını izleyin

### Senaryo 2: Alert Yönetimi
1. Sıcaklık sensörünün 80°C'yi aşmasını bekleyin
2. "System Alerts" dashboard'unda alert'i görün
3. Alert'in otomatik olarak temizlenmesini izleyin

### Senaryo 3: ERP Entegrasyonu
1. "ERP Integration Status" panelini kontrol edin
2. Sipariş durumu güncellemelerini izleyin
3. Malzeme stoku değişimlerini gözlemleyin

### Senaryo 4: Kalite Kontrolü
1. Üretim verilerinde kalite sorunlarını izleyin
2. Kalite alert'lerinin tetiklenmesini bekleyin
3. Kalite oranı metriklerini analiz edin

## 📈 Demo Verileri

### Sensör Simülasyonu
```javascript
// Sıcaklık: 20-80°C arası, ±2°C varyans
// Basınç: 1.0-5.0 bar arası, ±0.2 bar varyans
// Titreşim: 0.1-2.0 mm/s arası, ±0.1 mm/s varyans
// Hız: 1000-2000 rpm arası, ±50 rpm varyans
```

### Üretim Simülasyonu
```javascript
// Üretim hızı: 10 parça/dakika
// Kalite oranı: %95
// Vardiya: Sabah (06:00-14:00), Öğleden sonra (14:00-22:00), Gece (22:00-06:00)
```

### Alert Simülasyonu
```javascript
// Sıcaklık yüksek: %5 olasılık
// Basınç düşük: %3 olasılık  
// Titreşim yüksek: %2 olasılık
// Kalite sorunu: %4 olasılık
```

## 🛑 Demo Durdurma

```bash
npm run demo:stop
```

veya

```bash
./demo/stop-demo.sh
```

## 📁 Log Dosyaları

Demo sırasında oluşturulan log dosyaları:

- `logs/demo-platform.log`: Platform logları
- `logs/demo-simulator.log`: Simülatör logları
- `logs/manufactbridge.log`: Ana platform logları

## 🔧 Konfigürasyon

Demo konfigürasyonu `config/default.json` dosyasında bulunur:

- **MQTT Broker**: localhost:1883
- **InfluxDB**: localhost:8086
- **Grafana**: localhost:3002
- **Platform**: localhost:3000
- **Monitoring**: localhost:3001

## 🐛 Sorun Giderme

### Docker Servisleri Başlamıyor
```bash
# Port'ları kontrol edin
netstat -tulpn | grep :8086
netstat -tulpn | grep :1883

# Docker loglarını kontrol edin
docker-compose logs influxdb
docker-compose logs mosquitto
```

### Platform Bağlanamıyor
```bash
# InfluxDB hazır mı?
curl http://localhost:8086/health

# MQTT broker çalışıyor mu?
nc -z localhost 1883
```

### Veri Gelmiyor
```bash
# Simülatör çalışıyor mu?
ps aux | grep data-simulator

# MQTT mesajlarını dinleyin
mosquitto_sub -h localhost -t "manufactbridge/+/+/+/+/+/+/+"
```

## 📞 Destek

Demo ile ilgili sorularınız için:
- GitHub Issues: [ManufactBridge Issues](https://github.com/emrecakmak/ManufactBridge/issues)
- Email: emre@example.com

---

**ManufactBridge MVP Demo v1.0**  
*Modern Üretim-ERP Veri Platformu* 