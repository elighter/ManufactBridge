# RFC-002: Edge Connector Architecture and Protocol Transformation

## Summary

This RFC defines the Edge Connector architecture that will be used by the ManufactBridge platform for data collection from industrial systems (SCADA, PLC, IoT sensors, etc.). Edge Connectors enable the collection, filtering, transformation, and standardization of industrial data by integrating different protocols into the UNS (Unified Namespace).

## Motivation

Industrial environments contain numerous different protocols, devices, machines, and systems. Each has different data formats, protocols, and communication methods. To simplify, standardize, and make data collection scalable in this complex environment, a flexible and powerful Edge Connector architecture is required.

## Design Details

### 1. Edge Connector Framework

The Edge Connector architecture will consist of the following core components:

1. **Protocol Adapters**: Modular adapters supporting industrial protocols (Modbus, OPC UA, Profinet, EtherNet/IP, MQTT, etc.)
2. **Data Pre-processing Engine**: Filtering, sampling, scaling, and validation of raw data
3. **Edge Cache**: Local storage to prevent data loss during connection outages
4. **Message Formatter**: Making data compliant with UNS schema format
5. **Connection Manager**: Reconnection against outages, automatic configuration
6. **Edge Analytics**: Simple analytics and calculations at the source point

### 2. Supported Protocols

The following protocols will be supported in the first phase:

- **OPC UA** (Unified Architecture)
- **Modbus TCP/RTU**
- **MQTT**
- **EtherNet/IP**
- **Profinet**
- **Siemens S7**
- **MTConnect**
- **REST API**
- **JDBC/ODBC** (Database connections)

### 3. Edge Connector Architecture

Edge Connectors will use the following layered architecture:

```
                    +---------------------------+
                    |                           |
                    |    Data Pre-processing    |
                    |    Filters, Schema Val.   |
                    |                           |
                    +------------+--------------+
                                 |
+-------------------+  +---------v----------+  +-------------------+
|                   |  |                    |  |                   |
|  Protocol         |  |  Message Transform |  |  Connection       |
|  Adapters         +-->  and Formatting    +-->  Management       |
|                   |  |                    |  |                   |
+-------------------+  +--------------------+  +--------+----------+
                                                        |
                                                        v
                                               +------------------+
                                               |                  |
                                               |  UNS Connection  |
                                               |  (MQTT/Kafka)    |
                                               |                  |
                                               +------------------+
```

### 4. Scalable Deployment Model

Edge Connectors need to support different deployment scenarios:

- **Docker Container**: Running on a single machine or gateway
- **Kubernetes Pod**: Running in Kubernetes clusters in large-scale industrial environments
- **Embedded Devices**: Running on low-power devices like Raspberry Pi
- **VM-Based**: Running in traditional hypervisor environments

### 5. Data Collection Modes

Edge Connectors should support the following data collection methods:

- **Periodic Collection**: Data collection at specific intervals (polling)
- **Change-Based**: Data collection only when values change (change-based)
- **Event-Based**: Data collection when specific events occur (event-based)
- **Stream-Based**: Continuous data flow (streaming)

### 6. Configuration and Management

Easy configuration should be provided for Edge Connectors:

```yaml
# edge-connector-config.yaml example
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

## Implementation Steps

1. Development of basic Edge Connector framework
2. Implementation of initial protocol adapters (OPC UA, Modbus TCP)
3. Development of data pre-processing and message formatting modules
4. Integration of UNS connection and message publishing system
5. Development of configuration and management interface
6. Preparation of Edge Connector container images
7. Integration testing and performance optimization

## Alternatives

The following alternatives were evaluated:

1. **Using existing open source connectors**: Insufficient in terms of protocol diversity and customization flexibility
2. **Centralized data collection**: Lack of edge features and high bandwidth requirements
3. **COTS products**: Incompatible with our open source goals and community collaboration model

## Conclusion

The Edge Connector architecture will form the basic infrastructure that the ManufactBridge platform will use to collect industrial data. Thanks to its modular, scalable, and flexible design, data can be collected from a wide range of industrial systems and transferred to the UNS in a standardized format.

## References

1. OPC UA Specification
2. Modbus TCP/IP Reference Guide
3. MQTT Specification v5.0
4. ISA-95 Data Collection Standards 