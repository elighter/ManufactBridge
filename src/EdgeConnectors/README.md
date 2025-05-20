# ManufactBridge Edge Connector Modülü

Edge Connector modülü, ManufactBridge platformunun farklı endüstriyel sistemlerden (SCADA, PLC, DCS, IoT cihazları, vb.) veri toplama katmanıdır. Bu modül, çeşitli endüstriyel protokollerle iletişim kurarak verileri standartlaştırılmış bir formatta Unified Namespace (UNS) üzerinden erişilebilir hale getirir.

## Mimari

Edge Connector modülü aşağıdaki bileşenlerden oluşur:

- **BaseAdapter**: Tüm protokol adaptörleri için temel sınıf
- **ConnectorManager**: Birden çok konnektörün yaşam döngüsünü yöneten ana sınıf
- **ConfigManager**: Konnektör yapılandırmalarını yöneten sınıf
- **Protokol Adaptörleri**: Farklı endüstriyel protokoller için özel adaptörler (Modbus, OPC UA, S7, MQTT vb.)

```
   +------------------+      +-------------------+      +------------------+
   |                  |      |                   |      |                  |
   | ConfigManager    +----->+ ConnectorManager  +----->+ UNS Publisher    |
   |                  |      |                   |      |                  |
   +------------------+      +---+------+------++      +------------------+
                                 |      |      |
           +-----------------+   |      |      |   +----------------+
           |                 |   |      |      |   |                |
           | Modbus Adapter  +<--+      |      +-->+ OPC UA Adapter |
           |                 |          |          |                |
           +-----------------+          |          +----------------+
                                        |
           +-----------------+          |          +----------------+
           |                 |          |          |                |
           | MQTT Adapter    +<---------+--------->+ S7 Adapter     |
           |                 |                     |                |
           +-----------------+                     +----------------+
```

## Desteklenen Protokoller

Edge Connector modülü, aşağıdaki endüstriyel protokolleri desteklemektedir (ya da destek planlanan protokollerdir):

- **Modbus TCP/RTU**: PLC'ler ve diğer endüstriyel cihazlar için yaygın protokol
- **OPC UA**: Modern endüstriyel sistemler için güvenli ve ölçeklenebilir iletişim protokolü
- **Siemens S7**: Siemens S7 serisi PLC'ler için özel protokol
- **MQTT**: IoT uygulamaları için hafif mesajlaşma protokolü
- **MTConnect**: CNC makineleri ve diğer üretim ekipmanları için veri toplama standardı
- **EtherNet/IP**: Allen-Bradley ve Rockwell Automation cihazları için protokol
- **Profinet**: Siemens ve diğer Avrupa merkezli endüstriyel cihazlar için protokol
- **BACnet**: Bina otomasyon sistemleri için protokol
- **REST API**: Web tabanlı sistemlerle entegrasyon

## Kurulum ve Kullanım

### Konnektör Yapılandırması

Konnektörler YAML dosyaları aracılığıyla yapılandırılır. Örnek bir Modbus TCP konnektör yapılandırması:

```yaml
connector:
  id: "plc-line1"
  type: "plc"
  protocol: "modbus-tcp"
  description: "Hat 1 PLC Modbus Konnektörü"
  
connection:
  host: "192.168.1.100"
  port: 502
  timeout: 5000
  retryInterval: 10000
  maxRetries: 3
  
tags:
  - name: "temperature"
    address: "HR100"
    dataType: "float"
    scanRate: "1s"
    deadband: 0.5
    
  - name: "pressure"
    address: "HR102"
    dataType: "float"
    scanRate: "1s"
    
  - name: "status"
    address: "C001"
    dataType: "boolean"
    scanRate: "500ms"
    
mapping:
  topic: "manufactbridge/factory1/area1/line1/plc1/data"
  metadata:
    location: "main-hall"
    equipmentType: "filling-machine"
```

### Programlama API Kullanımı

Edge Connector API'sini kullanarak konnektörleri programatik olarak yönetmek için:

```javascript
const { createEdgeConnector } = require('./EdgeConnectors');

// Edge Connector oluştur
const edgeConnector = createEdgeConnector({
  config: {
    configDir: './config',
    connectorsDir: './config/connectors'
  },
  connector: {
    unsPublisher: unsInstance, // UNS Publisher nesnesi
    autoReconnect: true,
    reconnectInterval: 5000
  }
});

// Konfigürasyon dosyasından konnektör yükle
edgeConnector.loadConnectorFromConfig('plc-line1');

// Konnektörleri başlat
await edgeConnector.startAllConnectors();

// Durum kontrolü
const status = edgeConnector.getStatus();
console.log('Konnektör durumu:', status);

// Belirli bir süre sonra konnektörleri durdur
setTimeout(async () => {
  await edgeConnector.stopAllConnectors();
  console.log('Konnektörler durduruldu');
}, 60000);
```

## Protokol Adaptörü Geliştirme

Yeni bir protokol adaptörü geliştirmek için `BaseAdapter` sınıfından türetme yapılarak gerekli metotlar uygulanmalıdır:

```javascript
const BaseAdapter = require('../base-adapter');

class MyCustomAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    // Özel başlatma kodu
  }
  
  async connect() {
    // Bağlantı kodu
  }
  
  async disconnect() {
    // Bağlantı kesme kodu
  }
  
  async readTag(tagName) {
    // Tag okuma kodu
  }
  
  async writeTag(tagName, value) {
    // Tag yazma kodu
  }
}

module.exports = MyCustomAdapter;
```

## Güvenlik

Edge Connector modülü, aşağıdaki güvenlik özelliklerini sunar:

- Kimlik doğrulama ve yetkilendirme mekanizmaları
- İletişim şifreleme (TLS/SSL)
- Hassas bilgilerin (kullanıcı adı, şifre vb.) güvenli saklama
- Erişim denetimi ve kayıt tutma

## Hata Toleransı ve Dayanıklılık

- Otomatik yeniden bağlanma
- Yerel önbellek ile bağlantı kesintilerinde veri kaybını önleme
- Çoklu bağlantı denemesi ve zaman aşımı yönetimi
- Durum izleme ve loglama

## Lisans

ManufactBridge platformu MIT lisansı altında dağıtılmaktadır. 