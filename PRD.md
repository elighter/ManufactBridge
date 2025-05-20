# ManufactBridge PRD (Product Requirements Document)

## 1. Ürün Tanımı

ManufactBridge, endüstriyel üretim sistemleriyle ERP sistemleri arasında veri entegrasyonu sağlayan, hazır kuruluma uygun ve ölçeklenebilir bir açık kaynak platformdur. UNS (Unified Namespace) prensibiyle tasarlanmış, her işletmeye kolayca uyarlanabilen kapsamlı bir endüstriyel veri çözümüdür.

## 2. Paketlenmiş Çözüm Bileşenleri

### 2.1 Dağıtım Paketleri

- **Docker Compose Paketi**: Tek komutla tüm sistemi kurabilen yapılandırma
- **Kubernetes Helm Chart**: Production ortamlar için ölçeklenebilir kurulum
- **Installer Script**: Çeşitli ortamlar için ön koşulları kontrol edip kurulum yapabilen script

### 2.2 Modüler Yapı

Aşağıdaki bağımsız modüller isteğe bağlı etkinleştirilebilir/devre dışı bırakılabilir:

```
ManufactBridge/
├── edge-connectors/          # Endüstriyel sistem bağlantıları
│   ├── scada-connectors/     # SCADA bağlantıları (isteğe bağlı)
│   ├── mes-connectors/       # MES bağlantıları (isteğe bağlı)
│   ├── plc-connectors/       # PLC bağlantıları (isteğe bağlı)
│   └── iot-connectors/       # IoT sensör bağlantıları (isteğe bağlı)
├── unified-namespace/        # Merkezi veri alanı (temel modül)
├── data-platform/            # Veri depolama ve işleme (temel modül)
│   ├── data-lake/            # Uzun süreli veri depolama (isteğe bağlı)
│   ├── time-series-db/       # Zaman serisi veritabanı (isteğe bağlı)
│   └── stream-processing/    # Gerçek zamanlı veri işleme (isteğe bağlı)
├── analytics/                # Veri analitiği (isteğe bağlı)
│   ├── ml-platform/          # Makine öğrenmesi (isteğe bağlı)
│   ├── predictive-maintenance/ # Kestirimci bakım (isteğe bağlı)
│   └── dashboards/           # Görselleştirme (isteğe bağlı)
├── integration-layer/        # Sistem entegrasyonları (temel modül)
│   ├── erp-connectors/       # ERP bağlantıları (isteğe bağlı)
│   │   ├── sap-connector/    # SAP entegrasyonu (isteğe bağlı)
│   │   ├── odoo-connector/   # Odoo entegrasyonu (isteğe bağlı)
│   │   └── erpnext-connector/ # ERPNext entegrasyonu (isteğe bağlı)
│   └── api-gateway/          # API yönetimi (temel modül)
├── security-layer/           # Güvenlik bileşenleri (temel modül)
└── management-layer/         # Sistem yönetimi (temel modül)
```

## 3. Kurulum ve Yapılandırma

### 3.1 Kurulum Gereksinimleri

- **Minimum Donanım**: 4 CPU, 16GB RAM, 100GB depolama
- **Tavsiye Edilen**: 8+ CPU, 32GB+ RAM, 500GB+ depolama
- **Yazılım Gereksinimleri**: Docker 20.10+, Kubernetes 1.21+ (opsiyonel)

### 3.2 Tek Komutla Kurulum

```bash
# Docker Compose ile hızlı kurulum
./manufactbridge.sh install --mode=docker

# Kubernetes ile kurulum
./manufactbridge.sh install --mode=kubernetes --namespace=manufactbridge
```

### 3.3 Yapılandırma Dosyaları

Temel yapılandırma `.env` ve `config.yaml` dosyaları üzerinden yapılabilir:

```yaml
# config.yaml örneği
general:
  company_name: "ABC Üretim A.Ş."
  instance_id: "plant-istanbul"
  
edge:
  enabled_connectors:
    - scada
    - plc
  
erp:
  type: "sap"
  connection:
    url: "${ERP_API_URL}"
    auth_method: "oauth2"
    
modules:
  analytics: true
  data_lake: true
  machine_learning: false
```

## 4. Bağlantı Mimarisi

### 4.1 ERP Connector Mimarisi

```
┌─────────────────┐    ┌───────────────────┐    ┌───────────────────┐
│                 │    │                   │    │                   │
│  Üretim Verileri│    │  Connector Bridge │    │   ERP Sistemi     │
│  (UNS)          │───>│  (Adaptör Katmanı)│───>│   (SAP/Odoo vb.)  │
│                 │    │                   │    │                   │
└─────────────────┘    └───────────────────┘    └───────────────────┘
```

Her ERP sistemi için standart bir adaptör yapısı:
1. Veri Format Dönüştürücü
2. Şema Eşleyici
3. Kimlik Doğrulama Yöneticisi
4. İş Akışı Motoru
5. Hata İşleme Mekanizması

### 4.2 API Standartları

- **REST API**: OpenAPI 3.0 ile dokümante edilmiş
- **GraphQL API**: Karmaşık veri sorguları için
- **WebHooks**: Event-driven entegrasyon
- **Swagger UI**: Otomatik üretilen API dokümantasyonu

```yaml
# OpenAPI örneği (erp-connector.yaml)
openapi: 3.0.0
info:
  title: ManufactBridge ERP Connector API
  version: 1.0.0
paths:
  /api/v1/erp/production-orders:
    get:
      summary: Üretim emirlerini ERP'den getir
      responses:
        '200':
          description: Başarılı
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ProductionOrder'
```

## 5. Güvenlik Altyapısı

### 5.1 Varsayılan Güvenlik Özellikleri

- **Kimlik Doğrulama**: OAuth 2.0 / JWT tabanlı
- **Yetkilendirme**: RBAC (Role-Based Access Control)
- **TLS Şifreleme**: Tüm ağ trafiği için varsayılan
- **Güvenli Veri Saklama**: Hassas bilgiler için şifreleme

### 5.2 Güvenlik Yapılandırması

```yaml
# security-config.yaml
auth:
  provider: keycloak  # keycloak, auth0, veya custom
  oauth_settings:
    client_id: ${OAUTH_CLIENT_ID}
    client_secret: ${OAUTH_CLIENT_SECRET}
    auth_url: ${OAUTH_AUTH_URL}

tls:
  enabled: true
  cert_manager: true  # Otomatik sertifika yönetimi

rbac:
  default_roles:
    - viewer
    - operator
    - admin
```

## 6. Ölçeklenebilirlik ve İşletme

### 6.1 Production Ortamı için Bileşenler

- **Kubernetes Manifests**: Tüm bileşenler için hazır manifest dosyaları
- **Ölçeklendirme Kuralları**: HPA (Horizontal Pod Autoscaler) yapılandırmaları
- **Health Checks**: Readiness ve liveness probe'lar
- **Backup & Recovery**: Otomatik yedekleme ve geri yükleme

### 6.2 İzleme ve Log Yönetimi

- **Prometheus**: Tüm metrikler için merkezi toplama
- **Grafana**: Hazır izleme dashboardları
- **ELK/EFK Stack**: Loglama altyapısı
- **Alerting**: E-posta, Slack, PagerDuty entegrasyonları

## 7. Demo ve Sandbox

### 7.1 Demo Verileri ve Senaryolar

- **Demo Data Generator**: Gerçekçi üretim verisi üreten script
- **Senaryo Paketleri**:
  - Kestirimci Bakım Senaryosu
  - Üretim Kalite Analizi Senaryosu
  - OEE İzleme Senaryosu
  - Enerji Tüketimi Optimizasyonu Senaryosu

### 7.2 Online Sandbox

```bash
# Sandbox ortamını başlat
./manufactbridge.sh demo --scenario=predictive-maintenance
```

## 8. Dokümantasyon

### 8.1 Kullanıcı Dokümantasyonu

- **Hızlı Başlangıç Rehberi**: 15 dakikada kurulum
- **Kullanım Kılavuzları**: Tüm modüller için
- **Konfigürasyon Referansı**: Tüm ayar seçenekleri
- **Troubleshooting**: Sık karşılaşılan sorunlar ve çözümleri

### 8.2 Geliştirici Dokümantasyonu

- **API Referansı**: Tüm API'ler için Swagger arayüzü
- **SDK Örnekleri**: Python, JavaScript, Java ve .NET için
- **Entegrasyon Örnekleri**: SAP, Odoo ve diğer sistemler için
- **Mimari Şemalar**: Tüm bileşenler ve veri akışları için

## 9. Lisans ve Uyumluluk

- **Lisans**: MIT Lisansı
- **Bağımlılık Denetimi**: Kullanılan tüm açık kaynak bileşenlerin lisans uyumluluğu
- **Standartlar**: OPC UA, MQTT Sparkplug, ISA-95 standartları ile uyumlu
- **Veri Koruma**: GDPR gereksinimleri ile uyumluluk için yapılandırma seçenekleri

## 10. Görev Listesi ve Sürüm Planı

### 10.1 Hedef Sürümler

- **v1.0 (İlk Sürüm)**: Temel UNS ve ERP entegrasyonu
- **v1.1**: Daha fazla ERP connector ve analitik özellikler
- **v1.2**: Çoklu saha desteği ve federasyon
- **v1.3**: Operator/Helm Chart ile Kurulum - Tek komutla Kubernetes ortamına kurulum için K8s Operator desteği
- **v1.4**: Plug-and-Play Connector - Görsel arayüz ile yeni ERP/saha sistemleri bağlantısı
- **v2.0**: Yapay zeka destekli anomali tespiti
- **v2.1**: Marketplace Hazırlığı - AWS, Azure, GCP Marketplace için deployment manifest'leri

### 10.2 Geliştirme Yol Haritası

```
[Ocak 2025] - Mimari tasarım tamamlanacak
[Mart 2025] - Temel modüller geliştirme
[Mayıs 2025] - İlk alfa testi
[Temmuz 2025] - Beta sürümü
[Ekim 2025] - v1.0 resmi sürüm
```

## 11. Sık Sorulan Sorular (SSS)

### 11.1 Genel Sorular

**S: ManufactBridge'i mevcut ERP sistemimizle entegre edebilir miyiz?**  
C: Evet, SAP, Odoo, ERPNext gibi yaygın ERP sistemleri için hazır konnektörler sunuyoruz. Diğer ERP sistemleri için ise genel API adaptör şablonları kullanılabilir.

**S: Offline çalışma modu var mı?**  
C: Evet, edge bileşeni internet bağlantısı olmadan da çalışabilir ve bağlantı geldiğinde verileri merkezi sisteme senkronize edebilir.

**S: Kaç üretim hattını destekleyebilir?**  
C: ManufactBridge ölçeklenebilir bir mimariye sahiptir. Küçük işletmelerden (1-2 hat) büyük fabrikalara (100+ hat) kadar her ölçekte kullanılabilir.

### 11.2 Teknik Sorular

**S: Mevcut SCADA sistemlerimizle entegrasyon nasıl sağlanır?**  
C: Yaygın SCADA protokolleri (OPC UA, Modbus, MQTT) için hazır bağlantı adaptörleri bulunmaktadır. Ayrıca özel protokoller için genişletilebilir bir adaptör mimarisi mevcuttur.

**S: Veri güvenliği nasıl sağlanıyor?**  
C: Uçtan uca şifreleme, OAuth2/JWT ile kimlik doğrulama, rol tabanlı erişim kontrolleri ve kapsamlı denetim loglaması ile veri güvenliği sağlanmaktadır.

**S: Yüksek erişilebilirlik için ne öneriyorsunuz?**  
C: Production ortamları için Kubernetes üzerinde çoklu pod, veritabanları için replikasyon ve otomatik fail-over mekanizmaları öneriyoruz.

## 12. İletişim Bilgileri

- **Proje Web Sitesi**: [https://manufactbridge.org](https://manufactbridge.org)
- **GitHub Repository**: [https://github.com/ManufactBridge/ManufactBridge](https://github.com/ManufactBridge/ManufactBridge)
- **Teknik Destek**: [support@manufactbridge.org](mailto:support@manufactbridge.org)
- **Topluluk Forumu**: [https://community.manufactbridge.org](https://community.manufactbridge.org)

---

Bu PRD, ManufactBridge'i kolayca kurulabilen ve her şirkete adapte edilebilen bir hazır paket haline getirmeye yönelik gereksinimleri tanımlamaktadır. İşletmelerin minimum geliştirme çabasıyla endüstriyel verilerini ERP sistemleriyle entegre etmelerini sağlayacak kapsamlı bir çözüm sunulmuştur. 