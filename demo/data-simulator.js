/**
 * @fileoverview ManufactBridge Demo - Data Simulator
 * This script simulates realistic production data for demo purposes.
 */

const mqtt = require('mqtt');
const { ManufactBridge } = require('../src/index');

class DataSimulator {
  constructor(config = {}) {
    this.config = {
      mqttBroker: config.mqttBroker || 'mqtt://localhost:1883',
      interval: config.interval || 2000, // 2 seconds
      ...config
    };
    
    this.client = null;
    this.running = false;
    this.timers = [];
    
    // Simulation data
    this.sensors = {
      temperature: { value: 45, min: 20, max: 80, variance: 2 },
      pressure: { value: 2.5, min: 1.0, max: 5.0, variance: 0.2 },
      vibration: { value: 0.5, min: 0.1, max: 2.0, variance: 0.1 },
      speed: { value: 1500, min: 1000, max: 2000, variance: 50 }
    };
    
    this.production = {
      count: 0,
      rate: 10, // 10 parts per minute
      quality: 0.95 // 95% quality
    };
    
    this.alerts = [
      { type: 'temperature_high', probability: 0.05 },
      { type: 'pressure_low', probability: 0.03 },
      { type: 'vibration_high', probability: 0.02 },
      { type: 'quality_issue', probability: 0.04 }
    ];
  }
  
  /**
   * Starts the simulator
   */
  async start() {
    try {
      console.log('🎬 Starting Demo Data Simulator...');
      
      // MQTT connection
      this.client = mqtt.connect(this.config.mqttBroker);
      
      this.client.on('connect', () => {
        console.log('✅ Connected to MQTT broker');
        this._startSimulation();
      });
      
      this.client.on('error', (error) => {
        console.error('❌ MQTT connection error:', error.message);
      });
      
      this.running = true;
      
    } catch (error) {
      console.error('❌ Simulator startup error:', error.message);
      throw error;
    }
  }
  
  /**
   * Stops the simulator
   */
  async stop() {
    console.log('🛑 Stopping Demo Data Simulator...');
    
    this.running = false;
    
    // Clear timers
    this.timers.forEach(timer => clearInterval(timer));
    this.timers = [];
    
    // Close MQTT connection
    if (this.client) {
      this.client.end();
    }
    
    console.log('✅ Simulator stopped');
  }
  
  /**
   * Starts the simulation
   * @private
   */
  _startSimulation() {
    console.log('🚀 Data simulation started');
    
    // Sensor data simulation
    const sensorTimer = setInterval(() => {
      this._simulateSensorData();
    }, this.config.interval);
    this.timers.push(sensorTimer);
    
    // Production data simulation
    const productionTimer = setInterval(() => {
      this._simulateProductionData();
    }, 5000); // Every 5 seconds
    this.timers.push(productionTimer);
    
    // Alert simülasyonu
    const alertTimer = setInterval(() => {
      this._simulateAlerts();
    }, 10000); // Every 10 seconds
    this.timers.push(alertTimer);
    
    // ERP veri simülasyonu
    const erpTimer = setInterval(() => {
      this._simulateERPData();
    }, 30000); // Every 30 seconds
    this.timers.push(erpTimer);
  }
  
  /**
   * Simulates sensor data
   * @private
   */
  _simulateSensorData() {
    const timestamp = new Date().toISOString();
    
    // Generate data for each sensor
    Object.entries(this.sensors).forEach(([sensorType, sensor]) => {
      // Random change
      const change = (Math.random() - 0.5) * 2 * sensor.variance;
      sensor.value = Math.max(sensor.min, Math.min(sensor.max, sensor.value + change));
      
      // UNS formatında veri oluştur
      const unsData = {
        topic: `manufactbridge/enterprise1/site1/area1/line1/sensor1/data/${sensorType}`,
        payload: {
          value: Math.round(sensor.value * 100) / 100,
          timestamp: timestamp,
          quality: 'good',
          metadata: {
            source: 'simulator',
            sensorType: sensorType,
            unit: this._getUnit(sensorType),
            line: 'line1',
            area: 'area1'
          }
        }
      };
      
      // Publish to MQTT
      this.client.publish(unsData.topic, JSON.stringify(unsData.payload));
      
      console.log(`📊 ${sensorType}: ${sensor.value.toFixed(2)} ${this._getUnit(sensorType)}`);
    });
  }
  
  /**
   * Simulates production data
   * @private
   */
  _simulateProductionData() {
    const timestamp = new Date().toISOString();
    
    // Increment production count
    const increment = Math.random() < (this.production.rate / 12) ? 1 : 0; // Check every 5 seconds
    this.production.count += increment;
    
    // Quality control
    const qualityOK = Math.random() < this.production.quality;
    
    if (increment > 0) {
      // Production count
      const productionData = {
        topic: 'manufactbridge/enterprise1/site1/area1/line1/machine1/data/production_count',
        payload: {
          value: this.production.count,
          timestamp: timestamp,
          quality: 'good',
          metadata: {
            source: 'simulator',
            type: 'production',
            line: 'line1',
            shift: this._getCurrentShift()
          }
        }
      };
      
      this.client.publish(productionData.topic, JSON.stringify(productionData.payload));
      
      // Quality data
      const qualityData = {
        topic: 'manufactbridge/enterprise1/site1/area1/line1/machine1/data/quality_status',
        payload: {
          value: qualityOK ? 1 : 0,
          timestamp: timestamp,
          quality: 'good',
          metadata: {
            source: 'simulator',
            type: 'quality',
            line: 'line1',
            defectType: qualityOK ? null : 'surface_defect'
          }
        }
      };
      
      this.client.publish(qualityData.topic, JSON.stringify(qualityData.payload));
      
      console.log(`🏭 Production: ${this.production.count} parts, Quality: ${qualityOK ? '✅' : '❌'}`);
    }
  }
  
  /**
   * Simulates alerts
   * @private
   */
  _simulateAlerts() {
    const timestamp = new Date().toISOString();
    
    this.alerts.forEach(alert => {
      if (Math.random() < alert.probability) {
        const alertData = {
          topic: `manufactbridge/enterprise1/site1/area1/line1/alerts/${alert.type}`,
          payload: {
            value: 1,
            timestamp: timestamp,
            quality: 'good',
            metadata: {
              source: 'simulator',
              type: 'alert',
              severity: this._getAlertSeverity(alert.type),
              description: this._getAlertDescription(alert.type),
              line: 'line1'
            }
          }
        };
        
        this.client.publish(alertData.topic, JSON.stringify(alertData.payload));
        
        console.log(`🚨 Alert: ${alert.type} - ${alertData.payload.metadata.description}`);
      }
    });
  }
  
  /**
   * Simulates ERP data
   * @private
   */
  _simulateERPData() {
    const timestamp = new Date().toISOString();
    
    // Order status
    const orderData = {
      topic: 'manufactbridge/erp/sap_production/data/work_order_status',
      payload: {
        value: Math.floor(Math.random() * 5) + 1, // Order status between 1-5
        timestamp: timestamp,
        quality: 'good',
        metadata: {
          source: 'erp_simulator',
          type: 'work_order',
          orderId: 'WO-2024-001',
          status: 'in_progress',
          plannedQuantity: 1000,
          actualQuantity: this.production.count
        }
      }
    };
    
    this.client.publish(orderData.topic, JSON.stringify(orderData.payload));
    
    // Material status
    const materialData = {
      topic: 'manufactbridge/erp/sap_production/data/material_status',
      payload: {
        value: Math.floor(Math.random() * 100) + 50, // Stock between 50-150
        timestamp: timestamp,
        quality: 'good',
        metadata: {
          source: 'erp_simulator',
          type: 'material',
          materialCode: 'MAT-001',
          unit: 'kg',
          location: 'WH-01'
        }
      }
    };
    
    this.client.publish(materialData.topic, JSON.stringify(materialData.payload));
    
    console.log(`💼 ERP: Order status updated, Material stock: ${materialData.payload.value} kg`);
  }
  
  /**
   * Returns unit based on sensor type
   * @param {string} sensorType - Sensor type
   * @returns {string} Unit
   * @private
   */
  _getUnit(sensorType) {
    const units = {
      temperature: '°C',
      pressure: 'bar',
      vibration: 'mm/s',
      speed: 'rpm'
    };
    return units[sensorType] || '';
  }
  
  /**
   * Returns current shift
   * @returns {string} Shift
   * @private
   */
  _getCurrentShift() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) return 'morning';
    if (hour >= 14 && hour < 22) return 'afternoon';
    return 'night';
  }
  
  /**
   * Returns alert severity
   * @param {string} alertType - Alert type
   * @returns {string} Severity
   * @private
   */
  _getAlertSeverity(alertType) {
    const severities = {
      temperature_high: 'warning',
      pressure_low: 'critical',
      vibration_high: 'warning',
      quality_issue: 'major'
    };
    return severities[alertType] || 'info';
  }
  
  /**
   * Returns alert description
   * @param {string} alertType - Alert type
   * @returns {string} Description
   * @private
   */
  _getAlertDescription(alertType) {
    const descriptions = {
      temperature_high: 'Temperature above normal values',
      pressure_low: 'Pressure below critical level',
      vibration_high: 'High vibration values',
      quality_issue: 'Issue detected in quality control'
    };
    return descriptions[alertType] || 'Unknown alert';
  }
}

// If this file is run directly
if (require.main === module) {
  const simulator = new DataSimulator();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Stopping simulator...');
    await simulator.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Stopping simulator...');
    await simulator.stop();
    process.exit(0);
  });
  
  // Start simulator
  simulator.start().catch((error) => {
    console.error('❌ Simulator startup error:', error);
    process.exit(1);
  });
}

module.exports = DataSimulator; 