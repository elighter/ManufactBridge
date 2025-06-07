# ISA-95 Standard

This directory contains the necessary files to implement the ISA-95 standard in the ManufactBridge project.

## What is ISA-95?

ISA-95 is an international standard that defines the integration between manufacturing management systems and enterprise systems. It standardizes communication between Enterprise Resource Planning (ERP) and Manufacturing Execution Systems (MES).

## Hierarchy Model

The ISA-95 standard defines factory and production structures hierarchically as follows:

- Level 0: Physical production process
- Level 1: Sensors and actuators
- Level 2: Control systems (PLC, DCS, SCADA)
- Level 3: Manufacturing operations management (MES)
- Level 4: Business planning and logistics (ERP)

## ISA-95 in ManufactBridge

ManufactBridge uses the ISA-95 hierarchy as topic paths within the Unified Namespace (UNS) in the following format:

```
manufactbridge/enterprise/site/area/line/device/datatype/tagname
```

For example:
```
manufactbridge/acme/istanbul/machine-shop/line1/cnc5/data/temperature
```

## Topic Paths

ISA-95 based topic paths include:

- **enterprise**: Enterprise name
- **site**: Plant/Factory location
- **area**: Production area
- **line**: Production line
- **device**: Device or equipment
- **datatype**: Data type (data, event, command)
- **tagname**: Variable name

## Resources

- [ISA-95 Official Website](https://www.isa.org/standards-and-publications/isa-standards/isa-standards-committees/isa95)
- [ANSI/ISA-95.00.01-2010](https://www.isa.org/products/ansi-isa-95-00-01-2010-enterprise-control-system-in) 