# RFC-002: Edge Connector Mimarisi ve Protokol Dönüşümü

## Özet

Bu RFC, ManufactBridge platformunun endüstriyel sistemlerden (SCADA, PLC, IoT sensörleri vb.) veri toplama için kullanılacak Edge Connector mimarisini tanımlar. Edge Connector'lar, farklı protokolleri UNS'ye (Unified Namespace) entegre ederek endüstriyel verilerin toplanmasını, filtrelenmesini, dönüştürülmesini ve standartlaştırılmasını sağlar.

## Motivasyon

Endüstriyel ortamlarda çok sayıda farklı protokol, cihaz, makine ve sistem bulunmaktadır. Her birinin veri formatı, protokolü ve iletişim yöntemi farklıdır. Bu karmaşık ortamda veri toplamayı basitleştirmek, standartlaştırmak ve ölçeklenebilir hale getirmek için esnek ve güçlü bir Edge Connector mimarisi gereklidir.

## Tasarım Detayları

### 1. Edge Connector Çerçevesi

Edge Connector mimarisi, aşağıdaki temel bileşenlerden oluşacaktır:

1. **Protokol Adaptörleri**: Endüstriyel protokolleri (Modbus, OPC UA, Profinet, EtherNet/IP, MQTT, vb.) destekleyen modüler adaptörler
2. **Veri Ön İşleme Motoru**: Ham verileri filtreleme, örneklendirme, ölçekleme ve doğrulama
3. **Edge Önbellek**: Bağlantı kesintilerinde veri kaybını önlemek için yerel depolama
4. **Mesaj Formatlayıcı**: Verileri UNS şema formatına uygun hale getirme
5. **Bağlantı Yöneticisi**: Kesintilere karşı yeniden bağlanma, otomatik yapılandırma
6. **Edge Analitik**: Kaynak noktasında basit analitik ve hesaplamalar

### 2. Desteklenen Protokoller

İlk aşamada aşağıdaki protokoller desteklenecektir:

- **OPC UA** (Unified Architecture)
- **Modbus TCP/RTU**
- **MQTT**
- **EtherNet/IP**
- **Profinet**
- **Siemens S7**
- **MTConnect**
- **REST API**
- **JDBC/ODBC** (Veritabanı bağlantıları)

### 3. Edge Connector Mimarisi

Edge Connector'lar, aşağıdaki katmanlı mimariyi kullanacaktır:

```
                    +---------------------------+
                    |                           |
                    |    Veri Ön İşleme         |
                    |    Filtreler, Şema Doğ.   |
                    |                           |
                    +------------+--------------+
                                 |
+-------------------+  +---------v----------+  +-------------------+
|                   |  |                    |  |                   |
|  Protokol         |  |  Mesaj Dönüşüm     |  |  Bağlantı         |
|  Adaptörleri      +-->  ve Formatlama     +-->  Yönetimi         |
|                   |  |                    |  |                   |
+-------------------+  +--------------------+  +--------+----------+
                                                        |
                                                        v
                                               +------------------+
                                               |                  |
                                               |  UNS Bağlantısı  |
                                               |  (MQTT/Kafka)    |
                                               |                  |
                                               +------------------+
```

### 4. Ölçeklenebilir Dağıtım Modeli

Edge Connector'ların farklı dağıtım senaryolarını desteklemesi gerekir:

- **Docker Container**: Tek bir makine veya gateway üzerinde çalışma
- **Kubernetes Pod**: Büyük ölçekli endüstriyel ortamlarda Kubernetes kümesinde çalışma
- **Gömülü Cihazlar**: Raspberry Pi gibi düşük güçlü cihazlarda çalışma
- **VM Bazlı**: Geleneksel hiper-visor ortamlarında çalışma

### 5. Veri Toplama Modları

Edge Connector'lar, aşağıdaki veri toplama yöntemlerini desteklemelidir:

- **Periyodik Toplama**: Belirli aralıklarla veri toplama (polling)
- **Değişiklik Tabanlı**: Sadece değer değiştiğinde veri toplama (change-based)
- **Olay Tabanlı**: Belirli olaylar gerçekleştiğinde veri toplama (event-based)
- **Akış Tabanlı**: Sürekli veri akışı (streaming)

### 6. Yapılandırma ve Yönetim

Edge Connector'lar için kolay yapılandırma sağlanmalıdır:

```yaml
# edge-connector-config.yaml örneği
connector:
  id: "plc-line1"
  type: "plc"
  protocol: "s7"
  
connection:
  host: "192.168.1.100"
  port: 102
  rack: 0
  slot: 1
  
tags:
  - name: "temperature"
    address: "DB1.DBD0"
    dataType: "float"
    scanRate: "1s"
    deadband: 0.5
    
  - name: "pressure"
    address: "DB1.DBD4"
    dataType: "float"
    scanRate: "1s"
    
  - name: "status"
    address: "DB1.DBX8.0"
    dataType: "boolean"
    scanRate: "500ms"
    
mapping:
  topic: "manufactbridge/acme/istanbul/packaging/line1/plc1/data"
  metadata:
    location: "main-hall"
    equipmentType: "filling-machine"
```

## Uygulama Adımları

1. Temel Edge Connector çerçevesinin geliştirilmesi
2. İlk protokol adaptörlerinin implementasyonu (OPC UA, Modbus TCP)
3. Veri ön işleme ve mesaj formatlama modüllerinin geliştirilmesi
4. UNS bağlantısı ve mesaj yayınlama sisteminin entegrasyonu
5. Yapılandırma ve yönetim arayüzünün geliştirilmesi
6. Edge Connector'ların container imajlarının hazırlanması
7. Entegrasyon testleri ve performans optimizasyonu

## Alternatifler

Aşağıdaki alternatifler değerlendirildi:

1. **Mevcut açık kaynak konnektörlerin kullanımı**: Protokol çeşitliliği ve özelleştirme esnekliği açısından yetersiz
2. **Merkezi veri toplama**: Edge özelliklerinin eksikliği ve yüksek bant genişliği gereksinimleri
3. **COTS ürünleri**: Açık kaynak hedeflerimiz ve topluluk işbirliği modeli ile uyumsuz

## Sonuç

Edge Connector mimarisi, ManufactBridge platformunun endüstriyel verileri toplamak için kullanacağı temel altyapıyı oluşturacaktır. Modüler, ölçeklenebilir ve esnek tasarımı sayesinde, geniş bir yelpazedeki endüstriyel sistemlerden veri toplanabilecek ve bu veriler standartlaştırılmış bir formatta UNS'ye aktarılabilecektir.

## Referanslar

1. OPC UA Specification
2. Modbus TCP/IP Reference Guide
3. MQTT Specification v5.0
4. ISA-95 Data Collection Standards 