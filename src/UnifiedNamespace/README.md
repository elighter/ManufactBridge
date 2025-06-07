# ManufactBridge Unified Namespace (UNS)

This directory contains the Unified Namespace (UNS) component of the ManufactBridge platform. UNS provides a standardized data sharing mechanism between different systems and layers.

## What is UNS?

Unified Namespace is a data integration architecture designed to create a single point of reference for industrial data. This architecture standardizes and facilitates data flow between various systems and protocols.

## Key Features

- **Broker-Based Architecture**: Works on message brokers like MQTT or Kafka
- **Topic-Based Data Model**: Data paths are defined with standards such as ISA-95 hierarchy or Sparkplug B
- **Schema Validation**: Ensures consistency of shared data
- **Protocol Independence**: Supports different protocols
- **Security Layer**: Provides authentication and authorization support

## Architectural Components

UNS consists of the following core components:

- **Broker**: Message broker for data exchange (MQTT/Kafka)
- **Schema**: Data structure definitions and validation mechanisms
- **ISA95**: Industrial data hierarchy definitions
- **Sparkplug**: Industrial IoT protocol integration
- **Security**: Security and access management

## Topic Structure

ManufactBridge UNS uses the following topic structure:

```
manufactbridge/enterprise/site/area/line/device/datatype/tag
```

For example:
```
manufactbridge/acme/istanbul/machine-shop/line1/cnc5/data/temperature
```

## Usage

To use UNS:

```javascript
const { createUNS } = require('./UnifiedNamespace');

// Create UNS instance
const uns = createUNS({
  broker: {
    type: 'mqtt',
    mqtt: {
      url: 'mqtt://localhost:1883'
    }
  }
});

// Publish data
uns.publish('manufactbridge/acme/istanbul/assembly/line2/robot1/data/status', {
  timestamp: new Date().toISOString(),
  value: 'running',
  quality: 'GOOD',
  metadata: {
    source: 'robot-controller',
    dataType: 'string'
  }
});

// Subscribe to data
uns.subscribe('manufactbridge/acme/istanbul/assembly/line2/+/data/#', (topic, message) => {
  console.log(`${topic}: ${JSON.stringify(message)}`);
});
```

## Installation and Configuration

For detailed installation and configuration, see the [docker-compose.yml](./docker-compose.yml) and [server.js](./server.js) files.

## Sub-Components

- [Broker](./broker/README.md): Message broker management
- [Schema](./schema/README.md): Data schemas and validation
- [ISA95](./ISA95/README.md): ISA-95 standard integration
- [Sparkplug](./Sparkplug/README.md): Sparkplug B protocol support