# Unified Namespace (UNS) Modülü

Bu modül, ManufactBridge platformunun temel bileşeni olan Unified Namespace (UNS) yapısını oluşturur. UNS, farklı sistemlerden gelen verilerin paylaşıldığı merkezi bir veri alanı sağlar ve pub/sub mesajlaşma modeli üzerine kurulmuştur.

## Özet

UNS modülü, endüstriyel üretim sistemlerinden ve ERP sistemlerinden gelen verilerin merkezi bir veri alanında bütünleştirilmesini sağlar. Verilere standart bir şema ve topic hiyerarşisi yapısı uygulayarak veri paylaşımı, entegrasyon ve analiz süreçlerini basitleştirir.

## Temel Bileşenler

- **Mesaj Aracısı (Message Broker)**: MQTT ve/veya Kafka tabanlı yüksek performanslı mesajlaşma sistemi
- **Topic Yönetimi**: ISA-95 standardına dayalı hiyerarşik topic yapısı yönetimi 
- **Şema Doğrulama**: Sparkplug B ile uyumlu veri şemaları ve doğrulama 
- **Mesaj Yönlendirme**: Kural tabanlı veri yönlendirme ve filtreleme servisleri

## Topic Hiyerarşisi

UNS içerisinde kullanılan ISA-95 standardına dayalı hiyerarşik topic yapısı:

```
{namespace}/{enterprise}/{site}/{area}/{line}/{workcell}/{equipment}/{messageType}
```

Örnek:
```
manufactbridge/acme/istanbul/packaging/line1/filler/plc1/data
```

## Veri Formatı

UNS veri mesajları JSON formatında olup şu yapıyı izler:

```json
{
  "timestamp": "2023-04-10T14:30:00.000Z",
  "source": "plc1",
  "metrics": {
    "temperature": 56.7,
    "pressure": 102.3,
    "state": "running"
  },
  "metadata": {
    "dataQuality": "good",
    "samplingRate": "1s"
  }
}
```

## Kullanım

UNS modülüne veri yayınlamak (publish) ve UNS'den veri almak (subscribe) için örnek kod:

```javascript
// Veri yayınlama örneği (publish)
const topic = 'manufactbridge/acme/istanbul/packaging/line1/filler/plc1/data';
const message = {
  timestamp: new Date().toISOString(),
  source: 'plc1',
  metrics: {
    temperature: 56.7,
    pressure: 102.3,
    state: 'running'
  },
  metadata: {
    dataQuality: 'good',
    samplingRate: '1s'
  }
};

// Veri alma örneği (subscribe)
unsClient.subscribe('manufactbridge/acme/istanbul/packaging/+/+/+/data', (message, topic) => {
  console.log(`Alınan mesaj: ${topic}`);
  console.log(message);
});
```

## Güvenlik Özellikleri

- Topic tabanlı erişim kontrolü (ACL)
- TLS/SSL ile uçtan uca şifreleme 
- OAuth2/OpenID Connect entegrasyonu

## Kurulum

UNS modülünün kurulumu için Docker Compose kullanabilirsiniz:

```bash
docker-compose -f docker-compose.uns.yml up -d
```

## Konfigürasyon

UNS modülünün konfigürasyonu için `uns-config.yaml` dosyasını düzenleyin:

```yaml
broker:
  type: mqtt  # mqtt veya kafka
  mqtt:
    host: localhost
    port: 1883
    username: ${MQTT_USERNAME}
    password: ${MQTT_PASSWORD}
    use_tls: true
  kafka:
    bootstrap_servers: ${KAFKA_BOOTSTRAP_SERVERS}
    
schema_validation:
  enabled: true
  sparkplug_compatible: true
  custom_schemas_path: ./schemas
  
topic_management:
  root_namespace: manufactbridge
  enforce_hierarchy: true
  max_topic_depth: 8
  
security:
  acl_enabled: true
  acl_config_path: ./acl
  authentication:
    type: oauth2  # basic, oauth2, certificate
    oauth2:
      issuer_url: ${OAUTH_ISSUER_URL}
      audience: ${OAUTH_AUDIENCE}
```