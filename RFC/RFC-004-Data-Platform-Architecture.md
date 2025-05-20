# RFC-004: Veri Platformu Mimarisi

## Özet

Bu RFC, ManufactBridge platformunun veri depolama, işleme ve analiz ihtiyaçlarını karşılayacak kapsamlı bir Veri Platformu Mimarisi'ni tanımlar. Bu mimari, endüstriyel verilerin etkin bir şekilde saklanması, işlenmesi ve analize hazır hale getirilmesi için Data Lake, Time Series veritabanı ve Stream Processing bileşenlerini içerir.

## Motivasyon

Endüstriyel ortamlarda, büyük miktarda yapılandırılmış ve yapılandırılmamış veri üretilir. Bu verilerin etkili bir şekilde depolanması, işlenmesi ve anlamlandırılması, üretim süreçlerinin optimizasyonu ve karar verme mekanizmalarının iyileştirilmesi için kritik öneme sahiptir. Bu RFC, farklı veri tiplerini ve iş gereksinimlerini destekleyen, ölçeklenebilir, güvenli ve performanslı bir veri platformu sunmayı amaçlar.

## Tasarım Detayları

### 1. Veri Platformu Mimarisi

Veri Platformu aşağıdaki temel bileşenlerden oluşacaktır:

1. **Data Lake**: Ham ve işlenmiş tüm verilerin depolandığı, obje tabanlı merkezi depolama
2. **Time Series DB**: Sensör ve makine verilerinin zaman serisi formatında verimli depolanması
3. **Stream Processing**: Gerçek zamanlı veri işleme ve analitik fonksiyonlar
4. **Batch Processing**: Büyük veri kümelerinin toplu işlenmesi
5. **Veri Katalog**: Tüm veri varlıklarının merkezi olarak yönetilmesi ve keşfedilmesi
6. **Veri Şema Yönetimi**: Veri modelleri ve şemaların yönetimi
7. **Veri Kalitesi Yönetimi**: Veri doğrulama, temizleme ve zenginleştirme

```
                                    +---------------------+
                                    |                     |
                                    |  Unified Namespace  |
                                    |  (UNS)              |
                                    |                     |
                                    +----------+----------+
                                               |
                                               v
+-------------------+      +------------------+      +-------------------+
|                   |      |                  |      |                   |
|  Stream           |      |  Data Ingestion  |      |  Batch            |
|  Processing       |<---->|  Layer           |<---->|  Processing       |
|                   |      |                  |      |                   |
+-------------------+      +------------------+      +-------------------+
        |                           |                         |
        |                           v                         |
        |                  +------------------+               |
        |                  |                  |               |
        +----------------->|  Data Lake       |<--------------+
        |                  |                  |               |
        |                  +------------------+               |
        |                           |                         |
        v                           v                         v
+-------------------+      +------------------+      +-------------------+
|                   |      |                  |      |                   |
|  Time Series DB   |      |  Data Catalog    |      |  Analytics        |
|                   |      |  & Governance    |      |  & ML Models      |
|                   |      |                  |      |                   |
+-------------------+      +------------------+      +-------------------+
```

### 2. Data Lake Mimarisi

Data Lake, çoklu katmanlı bir mimariye sahip olacak:

1. **Raw Zone (Bronze)**: Tüm ham verilerin değiştirilmeden depolandığı katman
2. **Processed Zone (Silver)**: Temizlenmiş, yapılandırılmış ve zenginleştirilmiş verilerin bulunduğu katman
3. **Curated Zone (Gold)**: Analitik ve raporlama için hazırlanmış, yüksek değerli verilerin bulunduğu katman
4. **Consumption Zone**: İş kullanıcıları ve uygulamalar için optimize edilmiş veri görünümleri

```
+----------------------------------------------------------------------------------------+
|                                                                                        |
|  DATA LAKE                                                                             |
|                                                                                        |
|  +--------------+      +--------------+      +--------------+      +--------------+    |
|  |              |      |              |      |              |      |              |    |
|  |  RAW ZONE    |      |  PROCESSED   |      |  CURATED     |      | CONSUMPTION  |    |
|  |  (BRONZE)    |      |  ZONE        |      |  ZONE        |      | ZONE         |    |
|  |              |      |  (SILVER)    |      |  (GOLD)      |      |              |    |
|  |  Ham veriler |----->|  Temizlenmiş |----->|  Analitik    |----->|  İş          |    |
|  |  JSON, CSV,  |      |  veriler     |      |  veriler     |      |  kullanıcıları|    |
|  |  PARQUET vb. |      |  Standart    |      |  Performanslı|      |  ve           |    |
|  |              |      |  format      |      |  sorgular    |      |  uygulamalar  |    |
|  |              |      |              |      |              |      |              |    |
|  +--------------+      +--------------+      +--------------+      +--------------+    |
|                                                                                        |
+----------------------------------------------------------------------------------------+
```

### 3. Time Series DB Mimarisi

Time Series DB, endüstriyel sensör ve makine verilerinin zaman bazlı depolanması için optimize edilmiş bir veritabanı sunacak:

1. **Yüksek Yazma Performansı**: Saniyede binlerce veri noktası yazma kapasitesi
2. **Verimli Zaman Bazlı Sorgulama**: Zaman aralığı bazlı sorgular için optimize edilmiş
3. **Otomatik Veri Ömrü Yönetimi**: Eski verilerin otomatik arşivlenmesi/silinmesi
4. **Veri Sıkıştırma**: Zaman serisi verilerinin verimli şekilde sıkıştırılması
5. **Downsampling ve Aggregation**: Veri aralığına göre özetleme ve alt-örnekleme

### 4. Stream Processing Özellikleri

Stream Processing katmanı aşağıdaki özellikleri sunacak:

1. **Gerçek Zamanlı Veri İşleme**: Milisaniyeler içinde veri işleme
2. **Durum Tabanlı İşlemler**: Geçmiş veri durumuna göre işlemler gerçekleştirebilme
3. **Karmaşık Olay İşleme**: Çoklu veri kaynağından gelen olayların korelasyonu
4. **Pencere Tabanlı Analitik**: Belirli zaman pencereleri üzerinde analitik işlemler
5. **Anormal Durum Tespiti**: Gerçek zamanlı olarak anomalilerin tespiti
6. **Kural Motoru Entegrasyonu**: İş kurallarının gerçek zamanlı uygulanması

### 5. Veri Katalog ve Yönetişim

Veri Platformu, tüm veri varlıklarının etkin yönetimi için aşağıdaki özellikleri sunacak:

1. **Veri Keşfi**: Tüm veri varlıklarının otomatik keşfi ve kataloglanması
2. **Metadata Yönetimi**: Teknik ve iş metaverilerinin yönetimi
3. **Veri Soy Ağacı (Lineage)**: Verinin kaynaktan tüketime kadar izlenmesi
4. **Şema Değişim Yönetimi**: Veri şemalarındaki değişikliklerin yönetimi
5. **Veri Kalitesi İzleme**: Veri kalitesi metriklerinin tanımlanması ve izlenmesi
6. **Erişim Kontrolü**: Veri varlıkları için ayrıntılı erişim kontrolü

### 6. Veri Akışı İşlem Hattı

ManufactBridge Veri Platformu, aşağıdaki veri işlem hattını uygulayacaktır:

```
+-------------+    +------------+    +---------------+    +-------------+    +------------+
|             |    |            |    |               |    |             |    |            |
| UNS & IoT   |--->| İngestion  |--->| Processing &  |--->| Storage &   |--->| Analytics  |
| Sources     |    | Pipeline   |    | Transformation|    | Governance  |    | & ML       |
|             |    |            |    |               |    |             |    |            |
+-------------+    +------------+    +---------------+    +-------------+    +------------+
```

### 7. Örnek Yapılandırma

Veri platformu için referans mimari yapılandırma:

```yaml
# data-platform-config.yaml örneği
data_lake:
  storage_type: "s3_compatible"
  endpoint: "${MINIO_ENDPOINT}"
  access_key: "${MINIO_ACCESS_KEY}"
  secret_key: "${MINIO_SECRET_KEY}"
  buckets:
    raw: "manufactbridge-raw"
    processed: "manufactbridge-processed"
    curated: "manufactbridge-curated"
  
time_series_db:
  type: "influxdb"
  url: "${INFLUXDB_URL}"
  token: "${INFLUXDB_TOKEN}"
  org: "${INFLUXDB_ORG}"
  retention_policies:
    - name: "short_term"
      duration: "7d"
      replication: 1
    - name: "long_term"
      duration: "1y"
      replication: 2
      
stream_processing:
  engine: "kafka_streams"
  kafka:
    bootstrap_servers: "${KAFKA_BOOTSTRAP_SERVERS}"
    application_id: "manufactbridge-streams"
  
batch_processing:
  engine: "spark"
  master: "k8s://kubernetes.default.svc"
  executor_instances: 2
  executor_memory: "2g"
  
data_catalog:
  type: "datahub"
  url: "${DATAHUB_URL}"
  authentication:
    type: "oauth2"
```

## Uygulama Adımları

1. Temel Data Lake (MinIO/S3) altyapısının kurulması
2. Time Series veritabanının (InfluxDB/TimescaleDB) kurulması
3. Stream Processing (Kafka Streams) bileşenlerinin implementasyonu
4. Batch Processing (Apache Spark) altyapısının kurulması
5. Veri işlem hattı (pipeline) geliştirmesi
6. Veri Katalog ve yönetişim bileşenlerinin entegrasyonu
7. Veri kalitesi kontrollerinin implementasyonu
8. Yetkilendirme ve güvenlik mekanizmalarının uygulanması

## Alternatifler

Aşağıdaki alternatifler değerlendirildi:

1. **Tek RDBMS Kullanımı**: Ölçeklenebilirlik sınırlamaları ve farklı veri tiplerini destekleme zorluğu nedeniyle reddedildi
2. **Sadece Data Lake Yaklaşımı**: Gerçek zamanlı veri işleme ve zaman serisi sorgulama performansı eksiklikleri nedeniyle reddedildi
3. **Tamamen SaaS Bazlı Çözümler**: Açık kaynak stratejisi ve farklı deployment ihtiyaçları nedeniyle reddedildi

## Sonuç

Veri Platformu Mimarisi, ManufactBridge'in endüstriyel verilerden değer elde etmesini sağlayan kritik bir bileşendir. Bu RFC'de tanımlanan mimari, farklı veri tipleri ve kullanım senaryoları için optimize edilmiş, ölçeklenebilir, güvenli ve esnek bir veri platformu sunmaktadır.

## Referanslar

1. Lambda ve Kappa Mimari Desenleri
2. Apache Kafka ve Kafka Streams Documentation
3. Apache Spark Documentation
4. InfluxDB ve TimescaleDB Documentation
5. MinIO S3 Compatible Storage Documentation
6. DataHub ve Apache Atlas için Veri Katalog ve Soy Ağacı Özellikleri 