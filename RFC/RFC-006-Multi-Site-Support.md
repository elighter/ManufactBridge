# RFC-006: Çoklu Saha Desteği ve Federasyon

## Özet

Bu RFC, ManufactBridge platformunun birden fazla üretim tesisi, saha veya fabrikanın eş zamanlı olarak yönetilmesini sağlayan Çoklu Saha Desteği ve Federasyon mimarisini tanımlar. Bu mimari, farklı coğrafi konumlardaki sistemlerin merkezi olarak izlenmesini, yönetilmesini ve aynı zamanda yerel özerkliklerini korumasını mümkün kılacaktır.

## Motivasyon

Günümüzde çoğu üretim şirketi, birden fazla tesiste veya farklı coğrafi konumlarda faaliyet göstermektedir. Her ne kadar her tesisteki operasyonlar benzer olsa da, yerel gereksinimler, üretim süreçleri ve altyapı önemli ölçüde farklılık gösterebilir. Bu RFC, hem yerel özerkliği koruyan hem de merkezi izleme, analiz ve yönetim imkanı sunan bir federasyon mimarisi ile bu zorluğu çözmeyi amaçlar.

## Tasarım Detayları

### 1. Federasyon Mimarisi

Çoklu Saha Federasyonu aşağıdaki temel bileşenlerden oluşacaktır:

1. **Merkezi Hub**: Tüm sahaların verilerini toplayan, izleyen ve yöneten merkezi sistem
2. **Saha Düğümleri**: Her üretim tesisinde bulunan, yerel olarak çalışabilen ManufactBridge kurulumları
3. **Federasyon Katmanı**: Merkezi hub ile sahalar arasındaki senkronizasyon ve iletişimi sağlayan katman
4. **Saha Yönetim API'si**: Uzaktan saha yönetimi ve yapılandırma için API servisleri
5. **Federasyon Veri Yönetimi**: Hangi verilerin yerel kalacağı, hangilerinin merkeze gönderileceğini yöneten kurallar

```
                        +-------------------+
                        |                   |
                        |   MERKEZİ HUB     |
                        |                   |
                        +----+------+-------+
                             |      |
                    +--------+      +--------+
                    |                        |
           +--------v-------+      +---------v------+
           |                |      |                |
           |  SAHA-1        |      |  SAHA-2        |
           |                |      |                |
+----------+  UNS           |      |  UNS           +----------+
|          |  Edge          |      |  Edge          |          |
| Fabrika  |  Data Platform |      |  Data Platform | Fabrika  |
| Sistemler|  ERP Connector |      |  ERP Connector | Sistemler|
|          |                |      |                |          |
+----------+----------------+      +----------------+----------+
```

### 2. Federasyon Senkronizasyon Modları

Saha düğümleri ile merkezi hub arasında aşağıdaki senkronizasyon modları desteklenecektir:

1. **Gerçek Zamanlı**: Kritik verilerin anlık olarak merkeze aktarılması
2. **Periyodik**: Belirli aralıklarla veri senkronizasyonu
3. **Olay Bazlı**: Yalnızca belirli olaylar veya koşullar gerçekleştiğinde veri gönderimi
4. **Veri Özeti**: Ham veriler yerine özet verilerin gönderilmesi
5. **İstek Üzerine**: Merkezi hubdan gelen talep üzerine veri gönderimi

### 3. Çevrimdışı Çalışma ve Hata Toleransı

Federasyon mimarisi, internet bağlantısı kesintilerinde bile sahaların çalışmaya devam etmesini sağlayacaktır:

1. **Yerel Otonom Çalışma**: Saha düğümleri bağlantı olmasa bile tam işlevsel çalışabilir
2. **Veri Tamponu**: Bağlantı kesintisi sırasında veriler yerel olarak tamponlanır
3. **Otomatik Senkronizasyon**: Bağlantı yeniden kurulduğunda veriler otomatik senkronize edilir
4. **Conflict Resolution**: Çakışan verilerin akıllı şekilde çözümlenmesi
5. **Öncelikli Senkronizasyon**: Bağlantı kısıtlı olduğunda, en önemli verilerin öncelikli gönderimi

### 4. Güvenlik ve Yetkilendirme

Federasyon mimarisi için çok katmanlı güvenlik modeli:

1. **Merkezi Kimlik Yönetimi**: Tüm sahalar için tek kimlik doğrulama ve yetkilendirme
2. **Rol Bazlı Erişim**: Saha, bölüm ve rol bazlı erişim kontrolü
3. **Güvenli İletişim**: TLS/mTLS ile şifrelenmiş iletişim
4. **Veri Güvenliği**: Hassas verilerin şifrelenmesi ve maskelenmesi
5. **Veri Egemenliği**: Belirli verilerin yerel sınırlar içinde tutulması için kurallar

### 5. Federasyon Veri Modeli

Federasyon mimarisi, sahaların veri yapılarında belirli bir özerkliğe sahip olmasına izin verirken temel bir veri modeli standartlaştırması sağlayacaktır:

1. **Ortak Veri Modeli**: Tüm sahalarda uyumlu temel veri modeli
2. **Yerel Uzantılar**: Saha spesifik veri modeli uzantıları
3. **Veri Haritalama**: Yerel veriden merkezi modele dönüşüm
4. **Şema Evrim Yönetimi**: Veri modeli değişikliklerinin yönetimi
5. **Metadata Katalog**: Tüm sahalar için merkezi metadata yönetimi

### 6. Federasyon Yapılandırma Örneği

```yaml
# federation-config.yaml örneği
federation:
  name: "global-manufacturing"
  description: "Global Üretim Ağı Federasyonu"
  
central_hub:
  url: "https://hub.manufactbridge.com"
  authentication:
    method: "oauth2"
    client_id: "${HUB_CLIENT_ID}"
    client_secret: "${HUB_CLIENT_SECRET}"
  
site:
  id: "istanbul-plant"
  name: "İstanbul Üretim Tesisi"
  region: "europe"
  
synchronization:
  modes:
    - type: "realtime"
      topics:
        - "manufactbridge/+/istanbul/+/+/+/alarms"
        - "manufactbridge/+/istanbul/+/+/+/status"
        
    - type: "periodic"
      interval: "15m"
      topics:
        - "manufactbridge/+/istanbul/+/+/+/metrics"
        
    - type: "event_based"
      events:
        - "production_start"
        - "production_end"
        - "quality_issue"
  
  data_rules:
    include:
      - "production_data.*"
      - "quality_metrics.*"
      - "equipment_status.*"
    exclude:
      - "*.raw_data"
      - "*.personal_info"
    transformations:
      - source: "temperature_readings"
        target: "temperature_summary"
        function: "avg_by_hour"
        
offline_operation:
  buffer_size: "10GB"
  buffer_time: "7d"
  priority_rules:
    high:
      - "*.alarms"
      - "*.critical_issues"
    medium:
      - "*.production_metrics"
    low:
      - "*.detailed_logs"
```

## Uygulama Adımları

1. Federasyon protokolü ve API'lerin tasarımı ve implementasyonu
2. Merkezi Hub bileşenlerinin geliştirilmesi
3. Saha düğümleri için federasyon adaptörlerinin geliştirilmesi
4. Çevrimdışı çalışma ve veri tamponlama mekanizmalarının implementasyonu
5. Federasyon veri modelinin ve dönüşüm kurallarının geliştirilmesi
6. Güvenlik ve yetkilendirme sistemi entegrasyonu
7. Saha yönetim ve izleme arayüzlerinin geliştirilmesi
8. Federasyon örnek konfigürasyonlarının hazırlanması

## Alternatifler

Aşağıdaki alternatifler değerlendirildi:

1. **Tamamen Merkezi Mimari**: Tüm sahaları tek bir merkezi sistemden yönetme - Yerel özerklik ve hata toleransı eksikliği nedeniyle reddedildi
2. **Tamamen Bağımsız Sahalar**: Her sahanın bağımsız çalışması - Merkezi izleme ve yönetim eksikliği nedeniyle reddedildi
3. **Hibrit Bulut Çözümü**: Bulut tabanlı merkezi hub - Bazı endüstriyel ortamlarda bulut bağlantısının olmaması veya güvenlik politikaları nedeniyle reddedildi

## Sonuç

Çoklu Saha Desteği ve Federasyon mimarisi, ManufactBridge platformunun gerçek dünya üretim ortamlarındaki karmaşık organizasyonel yapılara uyum sağlamasını mümkün kılacaktır. Bu mimari, hem yerel özerklik ve hata toleransı sağlarken hem de merkezi izleme, yönetim ve analiz imkanları sunacaktır.

## Referanslar

1. ISA-95 Multi-Site Operations Management Models
2. Distributed Systems Federation Patterns
3. Edge-to-Cloud Federation Architectures
4. Data Sovereignty and Localization Requirements
5. Conflict-free Replicated Data Types (CRDT) for Distributed Systems 