/**
 * @fileoverview ManufactBridge Demo - Veri Simülatörü
 * Bu script, demo için gerçekçi üretim verilerini simüle eder.
 */

const mqtt = require('mqtt');
const { ManufactBridge } = require('../src/index');

class DataSimulator {
  constructor(config = {}) {
    this.config = {
      mqttBroker: config.mqttBroker || 'mqtt://localhost:1883',
      interval: config.interval || 2000, // 2 saniye
      ...config
    };
    
    this.client = null;
    this.running = false;
    this.timers = [];
    
    // Simülasyon verileri
    this.sensors = {
      temperature: { value: 45, min: 20, max: 80, variance: 2 },
      pressure: { value: 2.5, min: 1.0, max: 5.0, variance: 0.2 },
      vibration: { value: 0.5, min: 0.1, max: 2.0, variance: 0.1 },
      speed: { value: 1500, min: 1000, max: 2000, variance: 50 }
    };
    
    this.production = {
      count: 0,
      rate: 10, // dakikada 10 parça
      quality: 0.95 // %95 kalite
    };
    
    this.alerts = [
      { type: 'temperature_high', probability: 0.05 },
      { type: 'pressure_low', probability: 0.03 },
      { type: 'vibration_high', probability: 0.02 },
      { type: 'quality_issue', probability: 0.04 }
    ];
  }
  
  /**
   * Simülatörü başlatır
   */
  async start() {
    try {
      console.log('🎬 Demo Veri Simülatörü başlatılıyor...');
      
      // MQTT bağlantısı
      this.client = mqtt.connect(this.config.mqttBroker);
      
      this.client.on('connect', () => {
        console.log('✅ MQTT broker\'a bağlanıldı');
        this._startSimulation();
      });
      
      this.client.on('error', (error) => {
        console.error('❌ MQTT bağlantı hatası:', error.message);
      });
      
      this.running = true;
      
    } catch (error) {
      console.error('❌ Simülatör başlatma hatası:', error.message);
      throw error;
    }
  }
  
  /**
   * Simülatörü durdurur
   */
  async stop() {
    console.log('🛑 Demo Veri Simülatörü durduruluyor...');
    
    this.running = false;
    
    // Timer'ları temizle
    this.timers.forEach(timer => clearInterval(timer));
    this.timers = [];
    
    // MQTT bağlantısını kapat
    if (this.client) {
      this.client.end();
    }
    
    console.log('✅ Simülatör durduruldu');
  }
  
  /**
   * Simülasyonu başlatır
   * @private
   */
  _startSimulation() {
    console.log('🚀 Veri simülasyonu başlatıldı');
    
    // Sensör verileri simülasyonu
    const sensorTimer = setInterval(() => {
      this._simulateSensorData();
    }, this.config.interval);
    this.timers.push(sensorTimer);
    
    // Üretim verileri simülasyonu
    const productionTimer = setInterval(() => {
      this._simulateProductionData();
    }, 5000); // 5 saniyede bir
    this.timers.push(productionTimer);
    
    // Alert simülasyonu
    const alertTimer = setInterval(() => {
      this._simulateAlerts();
    }, 10000); // 10 saniyede bir
    this.timers.push(alertTimer);
    
    // ERP veri simülasyonu
    const erpTimer = setInterval(() => {
      this._simulateERPData();
    }, 30000); // 30 saniyede bir
    this.timers.push(erpTimer);
  }
  
  /**
   * Sensör verilerini simüle eder
   * @private
   */
  _simulateSensorData() {
    const timestamp = new Date().toISOString();
    
    // Her sensör için veri üret
    Object.entries(this.sensors).forEach(([sensorType, sensor]) => {
      // Rastgele değişim
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
      
      // MQTT'ye yayınla
      this.client.publish(unsData.topic, JSON.stringify(unsData.payload));
      
      console.log(`📊 ${sensorType}: ${sensor.value.toFixed(2)} ${this._getUnit(sensorType)}`);
    });
  }
  
  /**
   * Üretim verilerini simüle eder
   * @private
   */
  _simulateProductionData() {
    const timestamp = new Date().toISOString();
    
    // Üretim sayısını artır
    const increment = Math.random() < (this.production.rate / 12) ? 1 : 0; // 5 saniyede bir kontrol
    this.production.count += increment;
    
    // Kalite kontrolü
    const qualityOK = Math.random() < this.production.quality;
    
    if (increment > 0) {
      // Üretim sayısı
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
      
      // Kalite verisi
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
      
      console.log(`🏭 Üretim: ${this.production.count} parça, Kalite: ${qualityOK ? '✅' : '❌'}`);
    }
  }
  
  /**
   * Alert'leri simüle eder
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
   * ERP verilerini simüle eder
   * @private
   */
  _simulateERPData() {
    const timestamp = new Date().toISOString();
    
    // Sipariş durumu
    const orderData = {
      topic: 'manufactbridge/erp/sap_production/data/work_order_status',
      payload: {
        value: Math.floor(Math.random() * 5) + 1, // 1-5 arası sipariş durumu
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
    
    // Malzeme durumu
    const materialData = {
      topic: 'manufactbridge/erp/sap_production/data/material_status',
      payload: {
        value: Math.floor(Math.random() * 100) + 50, // 50-150 arası stok
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
    
    console.log(`💼 ERP: Sipariş durumu güncellendi, Malzeme stoku: ${materialData.payload.value} kg`);
  }
  
  /**
   * Sensör tipine göre birim döndürür
   * @param {string} sensorType - Sensör tipi
   * @returns {string} Birim
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
   * Mevcut vardiyayı döndürür
   * @returns {string} Vardiya
   * @private
   */
  _getCurrentShift() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) return 'morning';
    if (hour >= 14 && hour < 22) return 'afternoon';
    return 'night';
  }
  
  /**
   * Alert şiddetini döndürür
   * @param {string} alertType - Alert tipi
   * @returns {string} Şiddet
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
   * Alert açıklamasını döndürür
   * @param {string} alertType - Alert tipi
   * @returns {string} Açıklama
   * @private
   */
  _getAlertDescription(alertType) {
    const descriptions = {
      temperature_high: 'Sıcaklık normal değerlerin üzerinde',
      pressure_low: 'Basınç kritik seviyenin altında',
      vibration_high: 'Titreşim değerleri yüksek',
      quality_issue: 'Kalite kontrolünde sorun tespit edildi'
    };
    return descriptions[alertType] || 'Bilinmeyen alert';
  }
}

// Eğer bu dosya doğrudan çalıştırılıyorsa
if (require.main === module) {
  const simulator = new DataSimulator();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Simülatör durduruluyor...');
    await simulator.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Simülatör durduruluyor...');
    await simulator.stop();
    process.exit(0);
  });
  
  // Simülatörü başlat
  simulator.start().catch((error) => {
    console.error('❌ Simülatör başlatma hatası:', error);
    process.exit(1);
  });
}

module.exports = DataSimulator; 