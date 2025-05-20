# Unified Namespace Broker Bileşeni

Bu dizin, ManufactBridge Unified Namespace (UNS) platformundaki mesaj broker bileşenlerine ait dosyaları içerir.

## Broker Nedir?

Broker, Unified Namespace mimarisinin merkezi bileşenidir. Yayıncı (Publisher) ve abone (Subscriber) bileşenleri arasında köprü görevi görür. Temel görevleri:

- Mesajları yayıncılardan almak
- Mesajları ilgili abonelere iletmek
- Konu filtreleme ve yönlendirme
- Bağlantı yönetimi
- Mesaj arabelleği (QoS için)

## Desteklenen Broker Tipleri

ManufactBridge UNS platformu, iki farklı broker teknolojisini destekler:

### 1. MQTT Broker

MQTT (Message Queuing Telemetry Transport), hafif, yayın/abone temelli bir mesajlaşma protokolüdür. Özellikle IoT senaryoları için idealdir.

**Özellikler:**
- Düşük bant genişliği kullanımı
- Güvenilir mesaj aktarımı (QoS seviyeleri)
- Oturum desteği
- Topic-based filtreleme
- TLS/SSL güvenlik desteği

### 2. Kafka Broker

Apache Kafka, yüksek performanslı, dağıtık bir olay akış platformudur. Büyük veri akışları ve yüksek ölçeklenebilirlik gerektiren senaryolar için uygundur.

**Özellikler:**
- Yüksek verim
- Ölçeklenebilirlik
- Dayanıklılık
- Veri saklama
- Dağıtık mimari
- Hata toleransı

## Broker Seçimi

Proje gereksinimlerinize göre hangi broker'ı kullanacağınızı seçebilirsiniz:

- MQTT: Düşük gecikme, sınırlı bant genişliği olan IoT uygulamaları için
- Kafka: Büyük veri hacmi, veri analitiği ve yüksek verim gerektiren uygulamalar için

## Broker Yapılandırması

Her broker'ın yapılandırması, UNS `config.js` dosyasından yönetilir. Aşağıdaki yapılandırma örneği, hem MQTT hem de Kafka desteğini gösterir:

```javascript
module.exports = {
  broker: {
    type: 'mqtt', // 'mqtt' veya 'kafka'
    mqtt: {
      url: 'mqtt://localhost:1883',
      options: {
        clientId: 'manufactbridge-uns',
        clean: true,
        // Diğer MQTT seçenekleri
      }
    },
    kafka: {
      brokers: ['localhost:9092'],
      clientId: 'manufactbridge-uns',
      // Diğer Kafka seçenekleri
    }
  }
};
```

## Kaynaklar

- [MQTT Protokolü](https://mqtt.org/)
- [Eclipse Mosquitto](https://mosquitto.org/)
- [Apache Kafka](https://kafka.apache.org/)
- [Kafka Node.js İstemcisi](https://kafka.js.org/) 