# Sparkplug B Protocol

This directory contains the necessary files to implement the Sparkplug B protocol in the ManufactBridge project.

## What is Sparkplug B?

Sparkplug B is an open specification developed by the Eclipse Foundation for Industrial IoT (IIoT) applications. Running over the MQTT protocol, Sparkplug B standardizes data exchange between OT (Operational Technology) and IT (Information Technology) systems.

## Key Features

- Runs on MQTT 3.1.1
- Session awareness
- Data format definition
- Device state management
- Compact, efficient data sharing
- Automatic client discovery
- Historical data support

## Topic Structure

Sparkplug B's standard topic structure:

```
spBv1.0/[group_id]/[message_type]/[edge_node_id]/[device_id]
```

For example:
```
spBv1.0/Factory1/DDATA/PLC1/TempSensor1
```

## Message Types

- `NBIRTH`: Edge node birth (connection)
- `NDEATH`: Edge node death (disconnection)
- `DBIRTH`: Device birth
- `DDEATH`: Device death
- `NDATA`: Data from edge node
- `DDATA`: Data from device
- `NCMD`: Command to edge node
- `DCMD`: Command to device

## Sparkplug B in ManufactBridge

ManufactBridge performs conversion between the Unified Namespace and Sparkplug B compatible devices. This includes converting standard Sparkplug B messages to UNS format and vice versa.

## Resources

- [Eclipse Sparkplug Specification](https://www.eclipse.org/tahu/spec/Sparkplug%20Topic%20Namespace%20and%20State%20ManagementV2.2-with%20appendix%20B%20format%20-%20Eclipse.pdf)
- [Sparkplug GitHub](https://github.com/eclipse/tahu)
- [Eclipse Sparkplug Working Group](https://sparkplug.eclipse.org/) 