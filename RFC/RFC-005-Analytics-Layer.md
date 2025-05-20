# RFC-005: Analitik Katmanı ve İş Zekası Entegrasyonu

## Özet

Bu RFC, ManufactBridge platformunun endüstriyel verileri anlamlandırma, görselleştirme ve karar verme süreçlerini destekleme yeteneklerini sağlayan Analitik Katmanı ve İş Zekası Entegrasyonu'nu tanımlar. Bu katman, ham üretim verilerini anlamlı içgörülere dönüştürecek, kestirimci bakım, kalite analitiği ve operasyonel mükemmellik için gerekli analitik fonksiyonları sağlayacaktır.

## Motivasyon

Endüstriyel ortamlarda toplanan büyük miktardaki verinin gerçek değeri, verileri eyleme geçirilebilir içgörülere dönüştürecek güçlü analitik yetenekleriyle ortaya çıkar. Üretim performansını artırmak, kestirimci bakımı mümkün kılmak, maliyetleri düşürmek ve kaliteyi iyileştirmek için anlamlı analitik çözümlere ihtiyaç vardır. Bu RFC, endüstriyel veri analitiğinin tüm aşamalarını destekleyecek kapsamlı bir analitik katmanı tanımlamayı amaçlar.

## Tasarım Detayları

### 1. Analitik Katmanı Mimarisi

Analitik Katmanı aşağıdaki temel bileşenlerden oluşacaktır:

1. **İstatistiksel Analiz Servisleri**: Temel ve ileri düzey istatistiksel analizler
2. **Makine Öğrenmesi Platformu**: Model geliştirme, eğitim ve dağıtım altyapısı
3. **Kestirimci Bakım Modülleri**: Ekipman arızalarını önceden tahmin etme
4. **Kalite Analitik Modülleri**: Ürün kalitesini etkileyen faktörlerin analizi
5. **İş Zekası ve Görselleştirme**: Dashboard ve rapor oluşturma araçları
6. **OEE (Overall Equipment Effectiveness) İzleme**: Ekipman verimliliği takibi
7. **Anomali Tespit Motoru**: Normal olmayan durumların tespiti
8. **Öneri Sistemleri**: Süreç optimizasyonu ve karar destek önerileri

```
                   +---------------------+
                   |                     |
                   |  Veri Platformu     |
                   |  (Data Lake, TSDB)  |
                   |                     |
                   +---------+-----------+
                             |
                             v
+-------------------+      +------------------------+      +-------------------+
|                   |      |                        |      |                   |
|  Model            |      |  Analitik              |      |  İş Zekası &      |
|  Geliştirme       |<---->|  Çekirdek              |<---->|  Görselleştirme   |
|  Ortamı           |      |  Servisleri            |      |                   |
|                   |      |                        |      |                   |
+-------------------+      +------------------------+      +-------------------+
                                      |
                                      v
                             +------------------+
                             |                  |
                             |  Analitik        |
                             |  Uygulamalar     |
                             |                  |
                             +--------+---------+
                                      |
            +---------------------+---+---+---------------------+
            |                     |       |                     |
+-----------v----------+ +--------v-----+ +---------v---------+ +----------v-----------+
|                      | |              | |                   | |                      |
| Kestirimci Bakım     | | Kalite       | | OEE Optimizasyon  | | Enerji Tüketimi      |
| Uygulamaları         | | Analizi      | | Modülleri         | | Analizi              |
|                      | |              | |                   | |                      |
+----------------------+ +--------------+ +-------------------+ +----------------------+
```

### 2. Makine Öğrenmesi Platformu

Makine Öğrenmesi Platformu şu bileşenlerden oluşacak:

1. **Model Geliştirme Araçları**: Jupyter Notebook, Python ve R desteği
2. **Model Eğitim Altyapısı**: Ölçeklenebilir model eğitimi
3. **Model Dağıtım Sistemi**: Modellerin üretim ortamında çalıştırılması
4. **Model İzleme**: Model performansının sürekli izlenmesi
5. **Model Versiyonlama**: Modellerin versiyon kontrolü
6. **Öznitelik Mağazası (Feature Store)**: Yeniden kullanılabilir öznitelikler
7. **AutoML Yetenek**: Otomatik model geliştirme ve optimizasyon

### 3. Kestirimci Bakım Modülleri

Kestirimci Bakım bileşeni aşağıdaki özellikleri içerecek:

1. **Ekipman Durum İzleme**: Gerçek zamanlı ekipman durumu izleme
2. **Arıza Tahmin Modelleri**: Farklı arıza tipleri için tahmin modelleri
3. **Sağlık Skoru Hesaplama**: Ekipmanların sağlık durumu skorlaması
4. **Kalan Faydalı Ömür Tahmini**: Ekipmanların kalan kullanım ömrünün tahmini
5. **Bakım Planlama Optimizasyonu**: Optimal bakım planı önerileri
6. **Arıza Analizi ve Kök Neden Tespiti**: Arızaların analizini ve kök nedenini tespit etme

### 4. İş Zekası ve Görselleştirme

İş Zekası ve Görselleştirme bileşeni şu özellikleri sunacak:

1. **Üretim Dashboard'ları**: Gerçek zamanlı üretim takibi
2. **KPI İzleme**: Anahtar performans göstergelerinin izlenmesi
3. **Drill-Down Analizler**: Detaya inebilen interaktif analizler
4. **Eğilim Analizi**: Üretim verilerinde eğilimlerin tespiti
5. **Özelleştirilebilir Raporlama**: Departman ve rol bazlı raporlar
6. **Veri Keşfi Araçları**: Self-service veri keşfi imkanları
7. **Mobil Dashboard Desteği**: Mobil cihazlarda erişilebilir dashboard'lar

### 5. Analitik Uygulamalar

Analitik Katmanı, aşağıdaki hazır analitik uygulamaları içerecek:

1. **OEE (Overall Equipment Effectiveness)**: Ekipman verimliliğinin izlenmesi ve analizi
2. **Kalite Kontrol**: Kalite performansı izleme ve sapma analizi
3. **Enerji Tüketimi Optimizasyonu**: Enerji kullanımının izlenmesi ve optimizasyonu
4. **Malzeme Kullanım Analizi**: Malzeme kullanımının izlenmesi ve kaybın azaltılması
5. **Süreç Optimizasyonu**: Üretim süreçlerinin optimizasyonu
6. **Tedarik Zinciri Analitik**: Tedarik zinciri performansının analizi
7. **İnsan Performansı Analizi**: Operatör performans analizi ve eğitim ihtiyaçları

### 6. Analitik Akışı Yapılandırması

Analitik modeller ve uygulamalar için YAML tabanlı yapılandırma:

```yaml
# analytics-model-config.yaml örneği
model:
  name: "pump_failure_prediction"
  type: "predictive_maintenance"
  description: "Pompa arızalarını 24-48 saat önceden tahmin eden model"
  version: "1.0.0"
  
data_sources:
  - source: "time_series_db"
    metrics:
      - "pump_vibration"
      - "pump_temperature"
      - "flow_rate"
      - "pressure"
    time_window: "30d"
    
  - source: "data_lake"
    table: "maintenance_history"
    
features:
  - name: "vibration_trend"
    source: "pump_vibration"
    transformation: "rolling_mean(window=24h)"
    
  - name: "temperature_slope"
    source: "pump_temperature"
    transformation: "linear_regression(window=48h).slope"
    
model_config:
  algorithm: "random_forest"
  hyperparameters:
    n_estimators: 100
    max_depth: 10
  training:
    train_test_split: 0.8
    cross_validation: 5
    
deployment:
  trigger: "scheduled"
  frequency: "1h"
  output:
    topic: "manufactbridge/analytics/predictions/pump_failure"
    alert_threshold: 0.75
    
visualization:
  dashboard: "equipment_health"
  panels:
    - title: "Arıza Olasılığı"
      chart_type: "gauge"
      range: [0, 1]
    - title: "Sağlık Eğilimi"
      chart_type: "time_series"
      time_range: "7d"
```

## Uygulama Adımları

1. Temel analitik platformu altyapısının kurulması
2. Jupyter Notebook ortamı ve veri bilimi araçlarının entegrasyonu
3. İstatistiksel analiz kütüphanelerinin entegrasyonu
4. Makine öğrenmesi model eğitim altyapısının kurulması
5. Model dağıtım ve izleme mekanizmalarının geliştirilmesi
6. Grafana ve Superset gibi görselleştirme araçlarının entegrasyonu
7. Kestirimci bakım ve kalite analitiği modüllerinin geliştirilmesi
8. Dashboard ve rapor şablonlarının hazırlanması
9. Analitik model konfigürasyon API'lerinin geliştirilmesi

## Alternatifler

Aşağıdaki alternatifler değerlendirildi:

1. **Kurumsal İş Zekası Araçları**: Ticari BI araçları yerine açık kaynak çözümler tercih edildi
2. **Tek Bir Analitik Platform**: Farklı ihtiyaçlar için özelleşmiş araçları bir araya getirmek daha uygun bulundu
3. **Bulut Bazlı ML Servisleri**: On-premise deployment ihtiyaçları nedeniyle self-hosted çözümler tercih edildi

## Sonuç

Analitik Katmanı ve İş Zekası Entegrasyonu, ManufactBridge platformunun veri değer zincirini tamamlayan kritik bir bileşendir. Bu katman sayesinde, üretim verilerinden elde edilen içgörüler, daha verimli operasyonlar, daha yüksek kalite ve daha düşük maliyetler sağlayacaktır.

## Referanslar

1. Industry 4.0 Analytics Best Practices
2. Predictive Maintenance Methodologies
3. OEE (Overall Equipment Effectiveness) Standards
4. Grafana ve Superset Documentation
5. MLflow ve Kubeflow Documentation
6. Python Veri Bilimi Ekosistemleri (NumPy, Pandas, Scikit-learn) 