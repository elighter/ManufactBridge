# ManufactBridge Edge Connector Module

The Edge Connector module is the data collection layer of the ManufactBridge platform for various industrial systems (SCADA, PLC, DCS, IoT devices, etc.). This module communicates with various industrial protocols and makes data accessible through the Unified Namespace (UNS) in a standardized format.

## Architecture

The Edge Connector module consists of the following components:

- **BaseAdapter**: Base class for all protocol adapters
- **ConnectorManager**: Main class that manages the lifecycle of multiple connectors
- **ConfigManager**: Class that manages connector configurations
- **Protocol Adapters**: Specialized adapters for different industrial protocols (Modbus, OPC UA, S7, MQTT, etc.)

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

## Supported Protocols

The Edge Connector module supports the following industrial protocols (or protocols planned for support):

- **Modbus TCP/RTU**: Common protocol for PLCs and other industrial devices
- **OPC UA**: Secure and scalable communication protocol for modern industrial systems
- **Siemens S7**: Specialized protocol for Siemens S7 series PLCs
- **MQTT**: Lightweight messaging protocol for IoT applications
- **MTConnect**: Data collection standard for CNC machines and other manufacturing equipment
- **EtherNet/IP**: Protocol for Allen-Bradley and Rockwell Automation devices
- **Profinet**: Protocol for Siemens and other European-centered industrial devices
- **BACnet**: Protocol for building automation systems
- **REST API**: Integration with web-based systems

## Installation and Usage

### Connector Configuration

Connectors are configured through YAML files. Example Modbus TCP connector configuration:

```yaml
connector:
  id: "plc-line1"
  type: "plc"
  protocol: "modbus-tcp"
  description: "Line 1 PLC Modbus Connector"
  
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

### Programming API Usage

To manage connectors programmatically using the Edge Connector API:

```javascript
const { createEdgeConnector } = require('./EdgeConnectors');

// Create Edge Connector
const edgeConnector = createEdgeConnector({
  config: {
    configDir: './config',
    connectorsDir: './config/connectors'
  },
  connector: {
    unsPublisher: unsInstance, // UNS Publisher object
    autoReconnect: true,
    reconnectInterval: 5000
  }
});

// Load connector from configuration file
edgeConnector.loadConnectorFromConfig('plc-line1');

// Start connectors
await edgeConnector.startAllConnectors();

// Status check
const status = edgeConnector.getStatus();
console.log('Connector status:', status);

// Stop connectors after a certain time
setTimeout(async () => {
  await edgeConnector.stopAllConnectors();
  console.log('Connectors stopped');
}, 60000);
```

## Protocol Adapter Development

To develop a new protocol adapter, derive from the `BaseAdapter` class and implement the required methods:

```javascript
const BaseAdapter = require('../base-adapter');

class MyCustomAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    // Custom initialization code
  }
  
  async connect() {
    // Connection code
  }
  
  async disconnect() {
    // Disconnection code
  }
  
  async readTag(tagName) {
    // Tag reading code
  }
  
  async writeTag(tagName, value) {
    // Tag writing code
  }
}

module.exports = MyCustomAdapter;
```

## Security

The Edge Connector module provides the following security features:

- Authentication and authorization mechanisms
- Communication encryption (TLS/SSL)
- Secure storage of sensitive information (username, password, etc.)
- Access control and audit logging

## Fault Tolerance and Resilience

- Automatic reconnection
- Local caching to prevent data loss during connection interruptions
- Multiple connection attempts and timeout management
- Status monitoring and logging

## License

The ManufactBridge platform is distributed under the MIT license. 