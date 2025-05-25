# ManufactBridge MVP Demo

This demo showcases a fully functional example of the ManufactBridge platform. You can experience all features of the platform by simulating a real production environment.

## 🎯 Demo Features

### Simulated Systems
- **Production Line**: Sensors, machines, quality control
- **SCADA System**: Data collection via OPC UA protocol
- **ERP System**: SAP integration simulation
- **MQTT Broker**: Unified Namespace (UNS) messaging
- **Time Series Database**: Data storage with InfluxDB
- **Dashboard**: Visualization with Grafana

### Real-time Data
- **Sensor Data**: Temperature, pressure, vibration, speed
- **Production Data**: Part count, quality ratio, shift information
- **Alerts**: Threshold violations, quality issues
- **ERP Data**: Order status, material inventory

## 🚀 Starting the Demo

### Quick Start
```bash
npm run demo:start
```

### Manual Start
```bash
# 1. Start Docker services
docker-compose up -d influxdb mosquitto redis grafana

# 2. Start the platform
npm start

# 3. Start data simulator (new terminal)
npm run demo:simulator
```

## 📊 Demo URLs

### Grafana Dashboard
- **URL**: http://localhost:3002
- **Username**: admin
- **Password**: manufactbridge123

**Dashboards**:
- Manufacturing Overview: Main production indicators
- Real-time Sensors: Sensor data
- Production Metrics: Production metrics
- System Alerts: Alerts and warnings

### InfluxDB UI
- **URL**: http://localhost:8086
- **Token**: manufactbridge-super-secret-token
- **Organization**: manufactbridge
- **Bucket**: manufacturing_data

### Platform Monitoring
- **Health Check**: http://localhost:3001/health
- **Metrics**: http://localhost:3001/metrics

## 🎬 Demo Scenarios

### Scenario 1: Normal Production
1. Start the demo
2. Open "Manufacturing Overview" dashboard in Grafana
3. Observe real-time sensor data
4. Monitor the production counter increase

### Scenario 2: Alert Management
1. Wait for temperature sensor to exceed 80°C
2. See the alert in "System Alerts" dashboard
3. Watch the alert automatically clear

### Scenario 3: ERP Integration
1. Check "ERP Integration Status" panel
2. Monitor order status updates
3. Observe material inventory changes

### Scenario 4: Quality Control
1. Monitor quality issues in production data
2. Wait for quality alerts to trigger
3. Analyze quality ratio metrics

## 📈 Demo Data

### Sensor Simulation
```javascript
// Temperature: 20-80°C range, ±2°C variance
// Pressure: 1.0-5.0 bar range, ±0.2 bar variance
// Vibration: 0.1-2.0 mm/s range, ±0.1 mm/s variance
// Speed: 1000-2000 rpm range, ±50 rpm variance
```

### Production Simulation
```javascript
// Production rate: 10 parts/minute
// Quality ratio: 95%
// Shifts: Morning (06:00-14:00), Afternoon (14:00-22:00), Night (22:00-06:00)
```

### Alert Simulation
```javascript
// High temperature: 5% probability
// Low pressure: 3% probability  
// High vibration: 2% probability
// Quality issue: 4% probability
```

## 🛑 Stopping the Demo

```bash
npm run demo:stop
```

or

```bash
./demo/stop-demo.sh
```

## 📁 Log Files

Log files generated during the demo:

- `logs/demo-platform.log`: Platform logs
- `logs/demo-simulator.log`: Simulator logs
- `logs/manufactbridge.log`: Main platform logs

## 🔧 Configuration

Demo configuration is located in `config/default.json`:

- **MQTT Broker**: localhost:1883
- **InfluxDB**: localhost:8086
- **Grafana**: localhost:3002
- **Platform**: localhost:3000
- **Monitoring**: localhost:3001

## 🐛 Troubleshooting

### Docker Services Not Starting
```bash
# Check ports
netstat -tulpn | grep :8086
netstat -tulpn | grep :1883

# Check Docker logs
docker-compose logs influxdb
docker-compose logs mosquitto
```

### Platform Cannot Connect
```bash
# Is InfluxDB ready?
curl http://localhost:8086/health

# Is MQTT broker running?
nc -z localhost 1883
```

### No Data Coming
```bash
# Is simulator running?
ps aux | grep data-simulator

# Listen to MQTT messages
mosquitto_sub -h localhost -t "manufactbridge/+/+/+/+/+/+/+"
```

## 📞 Support

For questions about the demo:
- GitHub Issues: [ManufactBridge Issues](https://github.com/emrecakmak/ManufactBridge/issues)
- Email: emre@example.com

---

**ManufactBridge MVP Demo v1.0**  
*Modern Manufacturing-ERP Data Platform* 