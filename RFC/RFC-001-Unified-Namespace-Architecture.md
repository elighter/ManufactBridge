# RFC-001: Unified Namespace (UNS) Architecture

## Summary

This RFC defines the Unified Namespace (UNS) architecture, which is a core component of the ManufactBridge platform. UNS is an event-driven, publish/subscribe (pub/sub) based data architecture that enables the integration of data from different production systems and ERP systems in a central data space.

## Motivation

In industrial environments, data exchange between different systems is typically performed through point-to-point integrations. This approach becomes complex as the number of systems increases, makes maintenance difficult, and creates scalability problems. The UNS architecture aims to solve these problems by combining all data in a central model.

## Design Details

### 1. Architectural Components

The UNS architecture includes the following core components:

1. **Message Broker**: A high-performance, low-latency messaging system based on MQTT and/or Kafka
2. **Topic Hierarchy**: A hierarchical topic structure based on the ISA-95 standard
3. **Data Schema Management**: Standard data models enriched with Sparkplug B specification
4. **Message Routing**: Rules and filters that route data flow between different systems
5. **Data Transformers**: Adapters that convert data from different formats to UNS format

### 2. Topic Hierarchy

We will use the following hierarchical structure based on ISA-95 standards:

```
{namespace}/{enterprise}/{site}/{area}/{line}/{workcell}/{equipment}/{messageType}
```

Example:
```
manufactbridge/acme/istanbul/packaging/line1/filler/plc1/data
```

### 3. Message Format

Data messages will be in JSON format and follow this structure:

```json
{
  "timestamp": "2023-04-10T14:30:00.000Z",
  "source": "plc1",
  "metrics": {
    "temperature": 56.7,
    "pressure": 102.3,
    "state": "running"
  },
  "metadata": {
    "dataQuality": "good",
    "samplingRate": "1s"
  }
}
```

### 4. Scalability and High Availability

UNS must be scalable to operate even under high traffic:

- HiveMQ or VerneMQ clusters for MQTT
- Multi-broker deployment for Kafka
- Geo-replication support
- Automatic failover mechanisms

### 5. Authorization and Security

- Topic-based access control (ACL)
- End-to-end encryption with TLS/SSL
- OAuth2/OpenID Connect integration

## Implementation Steps

1. Installation of HiveMQ or Kafka as message broker on Kubernetes
2. Development of topic management and schema validation services
3. Configuration of ISA-95 compliant topic structure
4. Integration of Sparkplug B library
5. Development of data transformers
6. Implementation of security rules

## Alternatives

The following alternatives were evaluated instead of Unified Namespace:

1. **Point-to-point integration**: Rejected due to complexity and scalability issues
2. **Enterprise Service Bus (ESB)**: Rejected due to insufficient suitability for industrial environments
3. **Data lake approach**: Rejected due to lack of support for real-time data flow

## Conclusion

The UNS architecture will serve as the foundation of the ManufactBridge platform and all other modules will be integrated into this architecture. This model will enable real-time flow, standardization, and analysis of industrial data.

## References

1. ISA-95 Enterprise-Control System Integration Standards
2. MQTT Sparkplug Specification v3.0
3. Apache Kafka Documentation
4. HiveMQ MQTT Broker Documentation 