# Unified Namespace Broker Component

This directory contains files related to message broker components in the ManufactBridge Unified Namespace (UNS) platform.

## What is a Broker?

The broker is the central component of the Unified Namespace architecture. It acts as a bridge between publisher and subscriber components. Its main functions:

- Receiving messages from publishers
- Delivering messages to relevant subscribers
- Topic filtering and routing
- Connection management
- Message buffering (for QoS)

## Supported Broker Types

The ManufactBridge UNS platform supports two different broker technologies:

### 1. MQTT Broker

MQTT (Message Queuing Telemetry Transport) is a lightweight, publish/subscribe-based messaging protocol. It is especially ideal for IoT scenarios.

**Features:**
- Low bandwidth usage
- Reliable message delivery (QoS levels)
- Session support
- Topic-based filtering
- TLS/SSL security support

### 2. Kafka Broker

Apache Kafka is a high-performance, distributed event streaming platform. It is suitable for scenarios requiring large data flows and high scalability.

**Features:**
- High throughput
- Scalability
- Durability
- Data retention
- Distributed architecture
- Fault tolerance

## Broker Selection

You can choose which broker to use based on your project requirements:

- MQTT: For IoT applications with low latency and limited bandwidth
- Kafka: For applications requiring large data volumes, data analytics, and high throughput

## Broker Configuration

Each broker's configuration is managed from the UNS `config.js` file. The following configuration example shows both MQTT and Kafka support:

```javascript
module.exports = {
  broker: {
    type: 'mqtt', // 'mqtt' veya 'kafka'
    mqtt: {
      url: 'mqtt://localhost:1883',
      options: {
        clientId: 'manufactbridge-uns',
        clean: true,
        // Other MQTT options
      }
    },
    kafka: {
      brokers: ['localhost:9092'],
      clientId: 'manufactbridge-uns',
      // Other Kafka options
    }
  }
};
```

## Resources

- [MQTT Protocol](https://mqtt.org/)
- [Eclipse Mosquitto](https://mosquitto.org/)
- [Apache Kafka](https://kafka.apache.org/)
- [Kafka Node.js Client](https://kafka.js.org/) 