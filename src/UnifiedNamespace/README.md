# ManufactBridge Unified Namespace (UNS)

Bu dizin, ManufactBridge platformunun Unified Namespace (UNS) bileşenini içerir. UNS, farklı sistemler ve katmanlar arasında standartlaştırılmış bir veri paylaşım mekanizması sunar.

## UNS Nedir?

Unified Namespace, endüstriyel veriler için tek bir referans noktası oluşturmak amacıyla tasarlanmış bir veri entegrasyon mimarisidir. Bu mimari, çeşitli sistemler ve protokoller arasında veri akışını standartlaştırır ve kolaylaştırır.

## Temel Özellikler

- **Broker Tabanlı Mimari**: MQTT veya Kafka gibi mesaj broker'ları üzerinde çalışır
- **Konuya Dayalı Veri Modeli**: ISA-95 hiyerarşisi veya Sparkplug B gibi standartlarla veri yolları tanımlanır
- **Şema Doğrulama**: Paylaşılan verilerin tutarlılığını sağlar
- **Protokol Bağımsızlığı**: Farklı protokolleri destekler
- **Güvenlik Katmanı**: Kimlik doğrulama ve yetkilendirme desteği sağlar

## Mimari Bileşenler

UNS aşağıdaki temel bileşenlerden oluşur:

- **Broker**: Veri değişimi için mesaj aracısı (MQTT/Kafka)
- **Schema**: Veri yapısı tanımları ve doğrulama mekanizmaları
- **ISA95**: Endüstriyel veri hiyerarşisi tanımları
- **Sparkplug**: Endüstriyel IoT protokolü entegrasyonu
- **Security**: Güvenlik ve erişim yönetimi

## Konu Yapısı

ManufactBridge UNS, aşağıdaki konu yapısını kullanır:

```
manufactbridge/enterprise/site/area/line/device/datatype/tag
```

Örneğin:
```
manufactbridge/acme/istanbul/machine-shop/line1/cnc5/data/temperature
```

## Kullanım

UNS'yi kullanmak için:

```javascript
const { createUNS } = require('./UnifiedNamespace');

// UNS örneğini oluştur
const uns = createUNS({
  broker: {
    type: 'mqtt',
    mqtt: {
      url: 'mqtt://localhost:1883'
    }
  }
});

// Veri yayınla
uns.publish('manufactbridge/acme/istanbul/assembly/line2/robot1/data/status', {
  timestamp: new Date().toISOString(),
  value: 'running',
  quality: 'GOOD',
  metadata: {
    source: 'robot-controller',
    dataType: 'string'
  }
});

// Verilere abone ol
uns.subscribe('manufactbridge/acme/istanbul/assembly/line2/+/data/#', (topic, message) => {
  console.log(`${topic}: ${JSON.stringify(message)}`);
});
```

## Kurulum ve Yapılandırma

Ayrıntılı kurulum ve yapılandırma için [docker-compose.yml](./docker-compose.yml) ve [server.js](./server.js) dosyalarına bakabilirsiniz.

## Alt Bileşenler

- [Broker](./broker/README.md): Mesaj broker yönetimi
- [Schema](./schema/README.md): Veri şemaları ve doğrulama
- [ISA95](./ISA95/README.md): ISA-95 standardı entegrasyonu
- [Sparkplug](./Sparkplug/README.md): Sparkplug B protokolü desteği