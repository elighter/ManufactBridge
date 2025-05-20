# RFC-001: Unified Namespace (UNS) Mimarisi

## Özet

Bu RFC, ManufactBridge platformunun temel bileşeni olan Unified Namespace (UNS) mimarisini tanımlar. UNS, farklı üretim sistemlerinden ve ERP sistemlerinden gelen verilerin merkezi bir veri alanında bütünleştirilmesini sağlayan, olay odaklı, yayın/abone (pub/sub) tabanlı bir veri mimarisidir.

## Motivasyon

Endüstriyel ortamlarda, farklı sistemler arasında veri alışverişi genellikle noktadan noktaya entegrasyonlarla gerçekleştirilir. Bu yaklaşım, sistem sayısı arttıkça karmaşıklaşır, bakımı zorlaşır ve ölçeklenebilirlik sorunları yaratır. UNS mimarisi, tüm verileri merkezi bir modelde birleştirerek bu sorunları çözmeyi amaçlar.

## Tasarım Detayları

### 1. Mimari Bileşenler

UNS mimarisi aşağıdaki temel bileşenleri içerir:

1. **Mesaj Aracısı (Message Broker)**: MQTT ve/veya Kafka tabanlı, yüksek performanslı, düşük gecikmeli bir mesajlaşma sistemi
2. **Topic Hiyerarşisi**: ISA-95 standardına dayalı hiyerarşik bir konu (topic) yapısı
3. **Veri Şema Yönetimi**: Sparkplug B spesifikasyonuyla zenginleştirilmiş, standart veri modelleri
4. **Mesaj Yönlendirme**: Farklı sistemler arasında veri akışını yönlendiren kurallar ve filtreler
5. **Veri Dönüştürücüler**: Farklı formatlardaki verileri UNS formatına dönüştüren adaptörler

### 2. Topic Hiyerarşisi

ISA-95 standartlarına dayalı şu hiyerarşik yapıyı kullanacağız:

```
{namespace}/{enterprise}/{site}/{area}/{line}/{workcell}/{equipment}/{messageType}
```

Örnek:
```
manufactbridge/acme/istanbul/packaging/line1/filler/plc1/data
```

### 3. Mesaj Formatı

Veri mesajları JSON formatında olacak ve şu yapıyı izleyecektir:

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

### 4. Ölçeklenebilirlik ve Yüksek Erişilebilirlik

UNS, yüksek trafik altında bile çalışabilecek şekilde ölçeklenebilir olmalıdır:

- MQTT için HiveMQ veya VerneMQ kümeleri
- Kafka için çoklu broker dağıtımı
- Geo-replikasyon desteği
- Automatic failover mekanizmaları

### 5. Yetkilendirme ve Güvenlik

- Topic bazlı erişim kontrolü (ACL)
- TLS/SSL ile uçtan uca şifreleme
- OAuth2/OpenID Connect entegrasyonu

## Uygulama Adımları

1. Mesaj aracısı olarak HiveMQ veya Kafka'nın Kubernetes üzerinde kurulumu
2. Topic yönetimi ve şema doğrulama servisleri geliştirilmesi
3. ISA-95 uyumlu topic yapısının konfigürasyonu
4. Sparkplug B kütüphanesinin entegrasyonu
5. Veri dönüştürücülerin geliştirilmesi
6. Güvenlik kurallarının uygulanması

## Alternatifler

Unified Namespace yerine aşağıdaki alternatifler değerlendirildi:

1. **Noktadan noktaya entegrasyon**: Karmaşıklık ve ölçeklenebilirlik sorunları nedeniyle reddedildi
2. **Enterprise Service Bus (ESB)**: Endüstriyel ortamlara yeterince uygun olmaması nedeniyle reddedildi
3. **Veri havuzu yaklaşımı**: Gerçek zamanlı veri akışını desteklememesi nedeniyle reddedildi

## Sonuç

UNS mimarisi, ManufactBridge platformunun temeli olarak hizmet edecek ve tüm diğer modüller bu mimariye entegre olacaktır. Bu model, endüstriyel verilerin gerçek zamanlı akışını, standartlaştırılmasını ve analiz edilmesini sağlayacaktır.

## Referanslar

1. ISA-95 Enterprise-Control System Integration Standards
2. MQTT Sparkplug Specification v3.0
3. Apache Kafka Documentation
4. HiveMQ MQTT Broker Documentation 