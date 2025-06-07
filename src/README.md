# ManufactBridge Source Code

This folder contains the source code of the ManufactBridge project. Below is a brief description of each module.

## Documentation Structure

The ManufactBridge project includes the following documentation files:

1. **Main Project Information**: For general project description, installation instructions, and basic information, see the [main README.md](/README.md) file.

2. **User and Integration Guides**: For detailed usage guides, API references, and integration guides, please review the [docs/README.md](/docs/README.md) file.

3. **Source Code Structure**: This file (src/README.md) contains the source code organization and detailed descriptions of modules.

4. **Contributing Guide**: For information on how to contribute to the project, please refer to the [CONTRIBUTING.md](/CONTRIBUTING.md) file.

## Modules

### EdgeConnectors

Data collection components from industrial systems and other data sources:

- **SCADA**: Data adapters for SCADA systems (OPC UA, OPC DA, Modbus)
- **Historian**: Data adapters for Historian systems (OSIsoft PI, Wonderware, AspenTech IP.21)
- **DCS**: Data adapters for distributed control systems (ABB, Siemens, Honeywell, Yokogawa)
- **Analyzers**: Data adapters for production analyzers (Quality, Spectrometer, Chromatograph)
- **ERP**: Data adapters for ERP systems (SAP, Oracle, Microsoft Dynamics)

### UnifiedNamespace

Central messaging layer for data flow:

- **broker**: MQTT/Kafka message broker configurations
- **schema**: Data schema definitions and validation components
- **Sparkplug**: Sparkplug B protocol adaptation components
- **ISA95**: Hierarchical structure components in ISA-95 standard

### DataPlatform

Base platform for data storage and processing:

- **DataLake**: Unstructured data storage (MinIO, S3 compatible)
- **TimeSeriesDB**: Time series database integration (InfluxDB, TimescaleDB)
- **StreamProcessing**: Real-time data processing (Kafka Streams)
- **BatchProcessing**: Batch data processing components (Apache Spark)

### Analytics

Data analytics and machine learning components:

- **ML**: Machine learning models and algorithms
- **AI**: Artificial intelligence and advanced analytics components
- **PredictiveMaintenance**: Predictive maintenance modules
- **Visualization**: Data visualization tools and dashboards

### IntegrationLayer

Integration components with other systems:

- **ERPConnectors**: Connection points for different ERP systems
  - **SAP**: Connection components for SAP systems
  - **OpenSource**: Connection components for open source ERP systems
  - **Legacy**: Connection components for legacy ERP systems
- **API**: REST and GraphQL API components
- **MessageBrokers**: Message broker integration
- **DataTransformation**: Data transformation services
- **Orchestration**: Workflow and orchestration components
- **ErrorHandling**: Error management and compensation mechanisms

### SecurityLayer

Security and authorization components:

- **Authentication**: Authentication services
- **Authorization**: Authorization and access control
- **Encryption**: Data encryption services
- **Audit**: Audit and log monitoring
- **ThreatDetection**: Security threat detection components

### ResilienceLayer

Resilience and fault tolerance components:

- **CircuitBreakers**: Circuit breaker components
- **Retry**: Retry strategies
- **Fallback**: Alternative operation mechanisms
- **Monitoring**: Error monitoring components
- **Recovery**: Data and system recovery components

### ManagementLayer

System management and monitoring components:

- **SystemManagement**: System management tools
- **PerformanceMonitoring**: Performance monitoring components
- **Alerting**: Alert and notification components
- **Dashboards**: Management dashboards

## Getting Started with Development

When developing modules, follow these standards:

1. Each module should be independent within itself
2. Module interfaces should be clearly defined
3. Unit tests should be written
4. Documentation should be added
5. Coding standards should be followed

For more information on development: [CONTRIBUTING.md](/CONTRIBUTING.md) 