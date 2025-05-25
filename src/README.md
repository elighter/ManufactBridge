# ManufactBridge Kaynak Kodu

Bu klasör, ManufactBridge projesinin kaynak kodunu içerir. Aşağıda her bir modülün kısa bir açıklaması bulunmaktadır.

## Dokümantasyon Yapısı

ManufactBridge projesi aşağıdaki dokümantasyon dosyalarını içerir:

1. **Ana Proje Bilgileri**: Genel proje tanımı, kurulum talimatları ve temel bilgiler için [ana README.md](/README.md) dosyasına bakabilirsiniz.

2. **Kullanıcı ve Entegrasyon Rehberleri**: Detaylı kullanım kılavuzları, API referansları ve entegrasyon rehberleri için [docs/README.md](/docs/README.md) dosyasını inceleyebilirsiniz.

3. **Kaynak Kod Yapısı**: Bu dosya (src/README.md) kaynak kod organizasyonunu ve modüllerin detaylı açıklamalarını içerir.

4. **Katkı Sağlama Rehberi**: Projeye nasıl katkıda bulunulacağı hakkında bilgi için [CONTRIBUTING.md](/CONTRIBUTING.md) dosyasına başvurabilirsiniz.

## Modüller

### EdgeConnectors

Endüstriyel sistemler ve diğer veri kaynaklarından veri toplama bileşenleri:

- **SCADA**: SCADA sistemleri için veri adaptörleri (OPC UA, OPC DA, Modbus)
- **Historian**: Historian sistemleri için veri adaptörleri (OSIsoft PI, Wonderware, AspenTech IP.21)
- **DCS**: Dağıtık kontrol sistemleri için veri adaptörleri (ABB, Siemens, Honeywell, Yokogawa)
- **Analyzers**: Üretim analizörleri için veri adaptörleri (Quality, Spectrometer, Chromatograph)
- **ERP**: ERP sistemleri için veri adaptörleri (SAP, Oracle, Microsoft Dynamics)

### UnifiedNamespace

Veri akışının merkezi mesajlaşma katmanı:

- **broker**: MQTT/Kafka mesaj aracı yapılandırmaları
- **schema**: Veri şema tanımları ve doğrulama bileşenleri
- **Sparkplug**: Sparkplug B protokolü uyarlama bileşenleri
- **ISA95**: ISA-95 standardında hiyerarşik yapı bileşenleri

### DataPlatform

Verilerin depolanması ve işlenmesi için temel platform:

- **DataLake**: Yapılandırılmamış veri depolama (MinIO, S3 uyumlu)
- **TimeSeriesDB**: Zaman serisi veritabanı entegrasyonu (InfluxDB, TimescaleDB)
- **StreamProcessing**: Gerçek zamanlı veri işleme (Kafka Streams)
- **BatchProcessing**: Toplu veri işleme bileşenleri (Apache Spark)

### Analytics

Veri analitiği ve makine öğrenmesi bileşenleri:

- **ML**: Makine öğrenmesi modelleri ve algoritmaları
- **AI**: Yapay zeka ve ileri analitik bileşenleri
- **PredictiveMaintenance**: Kestirimci bakım modülleri
- **Visualization**: Veri görselleştirme araçları ve dashboard'lar

### IntegrationLayer

Diğer sistemlerle entegrasyon bileşenleri:

- **ERPConnectors**: Farklı ERP sistemleri için bağlantı noktaları
  - **SAP**: SAP sistemlerine bağlantı bileşenleri
  - **OpenSource**: Açık kaynak ERP sistemlerine bağlantı bileşenleri
  - **Legacy**: Eski ERP sistemlerine bağlantı bileşenleri
- **API**: REST ve GraphQL API bileşenleri
- **MessageBrokers**: Mesaj aracıları entegrasyonu
- **DataTransformation**: Veri dönüşüm servisleri
- **Orchestration**: İş akışı ve orkestrasyon bileşenleri
- **ErrorHandling**: Hata yönetimi ve telafi mekanizmaları

### SecurityLayer

Güvenlik ve yetkilendirme bileşenleri:

- **Authentication**: Kimlik doğrulama servisleri
- **Authorization**: Yetkilendirme ve erişim kontrolü
- **Encryption**: Veri şifreleme servisleri
- **Audit**: Denetim ve log izleme
- **ThreatDetection**: Güvenlik tehdidi tespit bileşenleri

### ResilienceLayer

Dayanıklılık ve hata toleransı bileşenleri:

- **CircuitBreakers**: Devre kesici bileşenler
- **Retry**: Yeniden deneme stratejileri
- **Fallback**: Alternatif işlem mekanizmaları
- **Monitoring**: Hata izleme bileşenleri
- **Recovery**: Veri ve sistem kurtarma bileşenleri

### ManagementLayer

Sistem yönetimi ve izleme bileşenleri:

- **SystemManagement**: Sistem yönetimi araçları
- **PerformanceMonitoring**: Performans izleme bileşenleri
- **Alerting**: Uyarı ve bildirim bileşenleri
- **Dashboards**: Yönetim panoları

## Geliştirmeye Başlarken

Modül geliştirirken aşağıdaki standartları takip edin:

1. Her modül kendi içinde bağımsız olmalıdır
2. Modül arayüzleri açıkça tanımlanmalıdır
3. Birim testleri yazılmalıdır
4. Dokümantasyon eklenmelidir
5. Kodlama standartlarına uyulmalıdır

Geliştirme için daha fazla bilgi: [CONTRIBUTING.md](/CONTRIBUTING.md) 