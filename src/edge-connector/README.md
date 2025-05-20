# Edge Connector Modülü

Bu modül, ManufactBridge platformunun endüstriyel sistemlerden veri toplama bileşenidir. Edge Connector modülü, farklı protokolleri destekleyen, çeşitli endüstriyel sistemlerden veri toplayabilen, dönüştürebilen ve Unified Namespace'e aktarabilen esnek bir yapı sunar.

## Özet

Edge Connector modülü, üretim ortamındaki PLC, SCADA, sensörler ve diğer endüstriyel cihazlardan veri toplamak için kullanılır. Modüler adaptör mimarisi sayesinde farklı endüstriyel protokolleri destekleyerek (Modbus, OPC UA, EtherNet/IP, vb.), ham verileri standart bir formata dönüştürür ve Unified Namespace'e aktarır.

## Temel Bileşenler

- **Protokol Adaptörleri**: Endüstriyel protokollerle iletişim için modüler adaptörler
- **Veri Ön İşleme Motoru**: Ham verileri filtreleme, örneklendirme ve dönüştürme
- **Edge Önbellek**: Bağlantı kesintilerinde veri kaybını önlemek için yerel depolama
- **Mesaj Formatlayıcı**: Verileri UNS şema formatına dönüştürme
- **Bağlantı Yöneticisi**: Kesintilere karşı yeniden bağlanma, otomatik yapılandırma
- **Edge Analitik**: Kaynak noktasında veri ön işleme ve basit analizler

## Desteklenen Protokoller

Edge Connector, aşağıdaki endüstriyel protokolleri destekler:

- **OPC UA** (Unified Architecture)
- **Modbus TCP/RTU**
- **MQTT**
- **EtherNet/IP**
- **Profinet**
- **Siemens S7**
- **MTConnect**
- **REST API**
- **JDBC/ODBC** (Veritabanı bağlantıları)

## Veri Toplama Modları

Edge Connector, aşağıdaki veri toplama modlarını destekler:

- **Periyodik Toplama**: Belirli aralıklarla veri toplama (polling)
- **Değişiklik Tabanlı**: Sadece değer değiştiğinde veri toplama (change-based)
- **Olay Tabanlı**: Belirli olaylar gerçekleştiğinde veri toplama (event-based)
- **Akış Tabanlı**: Sürekli veri akışı (streaming)

## Kullanım

Edge Connector'ı yapılandırmak ve kullanmak için örnek:

```javascript
// Edge Connector örneği oluştur
const connector = new EdgeConnector({
  id: 'plc-line1',
  protocol: 'opcua',
  connection: {
    endpointUrl: 'opc.tcp://192.168.1.100:4840',
    securityMode: 'None',
    securityPolicy: 'None'
  },
  uns: {
    brokerUrl: 'mqtt://localhost:1883',
    clientId: 'edge-connector-plc1',
    topicPrefix: 'manufactbridge/acme/istanbul/packaging/line1'
  }
});

// Tag tanımlamaları
connector.addTags([
  {
    name: 'temperature',
    nodeId: 'ns=2;s=Temperature',
    dataType: 'double',
    scanRate: '1s',
    deadband: 0.5
  },
  {
    name: 'pressure',
    nodeId: 'ns=2;s=Pressure',
    dataType: 'double',
    scanRate: '1s'
  },
  {
    name: 'status',
    nodeId: 'ns=2;s=Status',
    dataType: 'integer',
    scanRate: '500ms'
  }
]);

// Connectorı başlat
connector.start();

// Veri değişikliği olaylarını dinle
connector.on('data', (tagName, value, timestamp, quality) => {
  console.log(`${tagName}: ${value} [${timestamp}] - Quality: ${quality}`);
});

// Hataları dinle
connector.on('error', (error) => {
  console.error('Error:', error.message);
});
```

## Yapılandırma

Edge Connector, YAML formatında yapılandırma dosyası kullanır:

```yaml
# edge-connector-config.yaml
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

## Kurulum

Edge Connector modülünün kurulumu için Docker Compose kullanabilirsiniz:

```bash
docker-compose -f docker-compose.edge.yml up -d
```

## Entegrasyon

Edge Connector, Unified Namespace ile entegre çalışır ve topladığı verileri burada belirtilen topic'lere yayınlar. Yapılandırma dosyasında veya kod içinde UNS bağlantı bilgilerini tanımlamak yeterlidir.