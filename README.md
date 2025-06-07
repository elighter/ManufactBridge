# ManufactBridge: Modern Manufacturing-ERP Data Platform

ManufactBridge is a modern data architecture that combines data collected from industrial manufacturing systems (SCADA, Historian, DCS, analyzers) and ERP systems in a centralized data platform using the **Unified Namespace (UNS)** approach. Instead of traditional point-to-point integrations, it provides a scalable, consistent, and analytics-focused structure using a centralized and standardized data model.

## Table of Contents

- [Overview](#overview)
- [Why ManufactBridge](#why-manufactbridge)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Installation](#installation)
- [ERP Integration](#erp-integration)
- [Linear Integration](#linear-integration)
- [Contributing](#contributing)
- [License](#license)

## Overview

ManufactBridge is a comprehensive data platform that integrates industrial manufacturing data with ERP systems and combines them with a standard data model. It processes data collected from manufacturing systems in a batch manner, transforming them into meaningful insights and improving decision-making processes.

## Why ManufactBridge

- **Unified Namespace (UNS):** Eliminates data silos with a pub/sub-based approach where all systems share data in a centralized data space
- **Single Source of Truth:** Data consistency with an architecture that provides a single source of truth for all data and information
- **Comprehensive Data Platform:** Rich analytics capabilities with Data Lake, Time Series DB, and Stream Processing
- **Advanced Analytics:** Ready infrastructure for artificial intelligence and data analysis
- **Smart ERP Integration:** Transfer of only meaningful, processed data to ERP systems
- **Secure Architecture:** Layered security approach and data protection compliant with industrial standards

## Key Features

- **ISA-95 Based UNS Hierarchy:** Enterprise hierarchy structure using ISA-95 levels
- **MQTT/Kafka Based Messaging:** Scalable, real-time data transfer
- **Standard Data Models:** Enhanced data modeling with Sparkplug B specification
- **Data Lake Architecture:** Centralized repository for structured and unstructured data
- **Time Series Database:** Efficient storage of sensor and machine data
- **Stream Processing:** Real-time data processing and transformation capabilities
- **Edge Computing Support:** Data preprocessing at the source point
- **Bidirectional ERP Integration:** Inclusion of ERP data into UNS
- **Multi-Protocol Support:** OPC UA, Modbus, MQTT, Sparkplug B, Siemens S7
- **Enterprise ERP Connectors:** SAP, Odoo integration with more coming soon
- **Linear Integration:** Automatic issue creation and project management integration
- **Advanced Security:** OAuth2, TLS encryption, role-based access control
- **Production Ready:** 90%+ test coverage, comprehensive monitoring, and alerting

## Architecture

ManufactBridge aims to generate value from industrial data using a layered and modular architecture:

```
                   +---------------------+
                   |                     |
                   |   DATA SOURCES      |
                   |                     |
                   +---------+-----------+
                             |
                             v
+-------------------+      +------------------------+      +-------------------+
|                   |      |                        |      |                   |
|  Edge Connectors  |      |  Unified Namespace     |      |  ERP Integration  |
|                   |<---->|  (UNS)                 |<---->|  Layer            |
|                   |      |                        |      |                   |
+-------------------+      +------------------------+      +-------------------+
                                      |
                                      v
                             +------------------+
                             |                  |
                             |  Data Platform   |
                             |                  |
                             +--------+---------+
                                      |
                                      v
                             +------------------+
                             |                  |
                             |  Analytics       |
                             |  Layer           |
                             |                  |
                             +------------------+
```

## Installation

### Requirements
- Node.js 16+ 
- InfluxDB 2.0+
- MQTT Broker (Mosquitto recommended)
- SAP ERP system (optional)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/emrecakmak/ManufactBridge.git
cd ManufactBridge

# Install dependencies
npm install

# Configure the platform
cp config/default.json config/production.json
# Edit config/production.json according to your environment

# Start the platform
npm start
```

### Docker Installation

```bash
# Start all services with Docker Compose
docker-compose up -d

# Follow logs
docker-compose logs -f
```

### Manual Installation

1. **InfluxDB Installation**
```bash
# InfluxDB 2.0 installation (Ubuntu/Debian)
wget -qO- https://repos.influxdata.com/influxdb.key | sudo apt-key add -
echo "deb https://repos.influxdata.com/ubuntu focal stable" | sudo tee /etc/apt/sources.list.d/influxdb.list
sudo apt update && sudo apt install influxdb2
sudo systemctl start influxdb
```

2. **MQTT Broker Installation**
```bash
# Mosquitto MQTT broker installation
sudo apt install mosquitto mosquitto-clients
sudo systemctl start mosquitto
```

3. **ManufactBridge Installation**
```bash
npm install
npm run build
npm start
```

## ERP Integration

ManufactBridge goes beyond traditional ERP integrations by providing smart ERP integration through a modern industrial data platform:

- **SAP Connector:** Full S/4HANA integration with OData and RFC support
- **Odoo Connector:** Complete Odoo ERP integration with production orders, inventory, and quality control
- **ERPNext Connector:** (Coming Q1 2025) Open-source ERP integration
- Data standardization and transformation with UNS format
- Smart filtering and transfer of only meaningful data
- Bidirectional communication and full integration
- Real-time synchronization with manufacturing data

## Linear Integration

ManufactBridge includes comprehensive Linear integration for modern project management and issue tracking:

### Features
- **Automatic Issue Creation:** Manufacturing events automatically converted to Linear issues
- **Smart Prioritization:** Event severity mapped to Linear priority levels
- **Webhook Integration:** Bidirectional communication with Linear workspace
- **Manufacturing Dashboard:** Real-time statistics and issue tracking
- **Team Collaboration:** Automatic assignment and notification system

### Quick Setup

```bash
# Install Linear SDK
npm install @linear/sdk

# Configure environment variables
export LINEAR_API_KEY="your_linear_api_key"
export LINEAR_TEAM_ID="your_team_id"
export LINEAR_AUTO_CREATE_ISSUES="true"

# Enable in configuration
{
  "linear": {
    "enabled": true,
    "autoCreateIssues": true
  }
}
```

### Event Types
- **Machine Errors:** Critical priority issues for equipment failures
- **Quality Issues:** High priority issues for quality control problems
- **Maintenance Required:** Normal priority issues for scheduled maintenance
- **Production Delays:** High priority issues for production bottlenecks
- **Sensor Failures:** Critical priority issues for sensor malfunctions

For detailed Linear integration documentation, see [docs/LINEAR_INTEGRATION.md](docs/LINEAR_INTEGRATION.md).

## Contributing

To contribute to the project:

1. Fork this repository
2. Create a new branch
3. Commit your changes
4. Push your branch
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.