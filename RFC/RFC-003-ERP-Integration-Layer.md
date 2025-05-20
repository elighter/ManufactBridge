# RFC-003: ERP Entegrasyon Katmanı

## Özet

Bu RFC, ManufactBridge platformunun ERP sistemleriyle entegrasyonunu sağlayan ERP Entegrasyon Katmanı'nın tasarımını ve uygulamasını tanımlar. Bu katman, endüstriyel verilerle ERP sistemleri arasında iki yönlü, güvenilir ve ölçeklenebilir bir veri akışı sağlayacaktır.

## Motivasyon

Üretim sistemleri ile ERP sistemleri arasındaki entegrasyon, genellikle karmaşık, tekrarlanan ve özel kodlama gerektiren bir süreçtir. Bu RFC, standartlaştırılmış bir mimari, hazır konnektörler ve kolay yapılandırılabilir entegrasyon akışları sunarak bu süreci basitleştirmeyi amaçlar. Bu sayede işletmeler, minimum özel kodlamayla üretim sistemleri ve ERP sistemleri arasında veri alışverişi yapabileceklerdir.

## Tasarım Detayları

### 1. ERP Entegrasyon Katmanı Mimarisi

ERP Entegrasyon Katmanı aşağıdaki temel bileşenlerden oluşacaktır:

1. **ERP Konnektörleri**: SAP, Odoo, ERPNext gibi popüler ERP sistemleri için hazır konnektörler
2. **API Gateway**: Tüm dış sistem entegrasyonları için güvenli ve yönetilebilir bir API katmanı
3. **Veri Dönüşüm Servisi**: UNS verilerini ERP formatına ve ERP verilerini UNS formatına dönüştürme
4. **İş Akışı Motoru**: Kompleks entegrasyon süreçlerini tanımlamak ve yönetmek için
5. **Hata Yönetimi**: Başarısız işlemlerin yakalanması, yeniden denenmesi ve telafi edici aksiyonlar
6. **İzleme ve Loglama**: Tüm entegrasyon trafiğinin izlenmesi ve raporlanması

```
+-------------------+      +------------------------+      +--------------------+
|                   |      |                        |      |                    |
|  Unified          |      |  ERP Entegrasyon       |      |  ERP Sistemleri    |
|  Namespace (UNS)  |      |  Katmanı               |      |                    |
|                   |      |                        |      |                    |
|  MQTT/Kafka       |      |  API Gateway           |      |  SAP S/4HANA       |
|  Broker           +----->+  Veri Dönüşüm          +----->+  Odoo              |
|                   |      |  İş Akışı Yönetimi     |      |  ERPNext           |
|                   |      |  Hata Yönetimi         |      |  ve diğerleri      |
|                   |      |  Güvenlik              |      |                    |
|                   |      |                        |      |                    |
+-------------------+      +------------------------+      +--------------------+
```

### 2. ERP Konnektör Mimarisi

Her ERP sistemi için aşağıdaki standart katmanları içeren bir konnektör mimarisi oluşturulacak:

1. **Bağlantı Yöneticisi**: Kimlik doğrulama, oturum yönetimi ve bağlantı havuzu
2. **Veri Format Dönüştürücü**: JSON/XML ve ERP formatları arasında dönüşüm
3. **Şema Eşleyici**: UNS veri şemaları ile ERP veri şemaları arasında eşleme
4. **İş Akışı Adaptörü**: İş süreçlerinin ERP sistemlerine aktarılması
5. **Hata İşleyici**: ERP spesifik hataların standart hatalara dönüştürülmesi

### 3. Desteklenen ERP Sistemleri ve İletişim Yöntemleri

İlk aşamada aşağıdaki ERP sistemleri desteklenecektir:

- **SAP S/4HANA**: OData, RFC, BAPI, iDocs
- **Odoo**: XML-RPC, REST API
- **ERPNext**: REST API, Frappe Framework API
- **Microsoft Dynamics 365**: REST API, OData
- **Generic REST/SOAP**: Genel amaçlı REST/SOAP entegrasyon

### 4. Veri Entegrasyon Modelleri

ERP Entegrasyon Katmanı, aşağıdaki entegrasyon modellerini destekleyecektir:

- **Olay Odaklı (Event-Driven)**: UNS'deki olayların ERP'ye iletilmesi
- **Zamanlı (Scheduled)**: Belirli aralıklarla veri senkronizasyonu
- **Talep Üzerine (On-Demand)**: Kullanıcı veya sistem tarafından başlatılan entegrasyonlar
- **Çift Yönlü (Bidirectional)**: ERP'den UNS'ye ve UNS'den ERP'ye veri akışı

### 5. ERP Entegrasyon Akışı Yapılandırması

ERP entegrasyon akışları, YAML formatında tanımlanacaktır:

```yaml
# erp-integration-flow.yaml örneği
integration:
  name: "production-order-sync"
  description: "Üretim emirlerini SAP'den ManufactBridge'e aktarır"
  enabled: true
  
source:
  type: "sap"
  connection:
    url: "${SAP_API_URL}"
    auth_method: "oauth2"
    client_id: "${SAP_CLIENT_ID}"
    client_secret: "${SAP_CLIENT_SECRET}"
  
  query:
    method: "OData"
    service: "/sap/opu/odata/sap/API_PRODUCTION_ORDER_SRV"
    entity: "ProductionOrder"
    filter: "CreationDate gt datetime'${LAST_SYNC_DATE}'"
    
transform:
  mapping:
    - source: "ProductionOrder"
      target: "order.id"
    - source: "Material"
      target: "order.product.id"
    - source: "PlannedQuantity"
      target: "order.quantity"
    - source: "MfgOrderScheduledStartDate"
      target: "order.scheduledStart"
      transform: "dateTimeFormat('yyyy-MM-ddTHH:mm:ss')"
      
destination:
  type: "uns"
  topic: "manufactbridge/acme/istanbul/productionOrders"
  messageType: "production-order"
  
error_handling:
  retry:
    attempts: 3
    interval: "exponential"
    max_interval: "5m"
  dead_letter_topic: "manufactbridge/errors/erp-integration"
```

### 6. Güvenlik ve Kimlik Doğrulama

ERP Entegrasyon Katmanı, aşağıdaki güvenlik mekanizmalarını uygulayacaktır:

- OAuth2.0 / JWT tabanlı kimlik doğrulama
- TLS/SSL ile uçtan uca şifreleme
- Veri maskeleme ve hassas bilgilerin korunması
- Rol tabanlı erişim kontrolü (RBAC)
- Ayrıntılı denetim günlükleri

## Uygulama Adımları

1. Temel ERP Entegrasyon çerçevesinin geliştirilmesi
2. SAP OData ve Odoo REST API konnektörlerinin implementasyonu
3. Veri dönüşüm ve eşleme motorunun geliştirilmesi
4. İş akışı ve entegrasyon yönetimi bileşenlerinin geliştirilmesi
5. Hata yönetimi ve loglama altyapısının oluşturulması
6. Güvenlik ve kimlik doğrulama mekanizmalarının entegrasyonu
7. API Gateway'in implementasyonu
8. Örnek entegrasyon senaryolarının geliştirilmesi

## Alternatifler

Aşağıdaki alternatifler değerlendirildi:

1. **Ticari Entegrasyon Platformları**: Açık kaynak hedefleri ve maliyet nedeniyle uygun değil
2. **Doğrudan ERP API Kullanımı**: Ölçeklenebilirlik, bakım ve hata yönetimi sorunları
3. **ESB Tabanlı Entegrasyon**: Endüstriyel veri entegrasyonu için fazla genel amaçlı ve ağır

## Sonuç

ERP Entegrasyon Katmanı, ManufactBridge platformunun endüstriyel verilerini ERP sistemleriyle entegre etmesini sağlayacak kritik bir bileşendir. Bu katmanın modüler ve esnek tasarımı, farklı ERP sistemleriyle kolayca entegre olabilmeyi ve kompleks iş senaryolarını desteklemeyi mümkün kılacaktır.

## Referanslar

1. SAP OData API Specification
2. Odoo Web Service API Documentation
3. ERPNext REST API Documentation
4. OAuth 2.0 Framework
5. OpenAPI Specification 