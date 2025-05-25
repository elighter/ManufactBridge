/**
 * ManufactBridge Edge Connector Modülü
 * 
 * Bu modül, ManufactBridge platformunun Edge Connector bileşenlerini dışa aktarır.
 * Endüstriyel sistemlerle iletişim kurmak ve veri aktarmak için gerekli adaptörleri,
 * veri yönetim ve yapılandırma araçlarını sağlar.
 */

const BaseAdapter = require('./base-adapter');
const ConnectorManager = require('./connector-manager');
const ConfigManager = require('./config-manager');
const config = require('./config');

// SCADA adaptörleri
const ModbusAdapter = require('./SCADA/modbus-adapter');
const OPCUAAdapter = require('./SCADA/opcua-adapter');

/**
 * Edge Connector modülü ana fonksiyonu
 * Bu fonksiyon, gerekli bileşenleri başlatır ve yapılandırır.
 * 
 * @param {Object} options - Başlatma seçenekleri
 * @returns {Object} Edge Connector modülü API'si
 */
function createEdgeConnector(options = {}) {
  // Konfigürasyon yöneticisini oluştur
  const configManager = new ConfigManager({
    configDir: options.configDir,
    connectorsDir: options.connectorsDir
  });
  
  // Connector Manager'ı oluştur
  const connectorManager = new ConnectorManager({
    ...options,
    configManager: configManager
  });
  
  // Modülün dışa açılan API'si
  return {
    connectorManager,
    configManager,
    BaseAdapter,
    adapters: {
      ModbusAdapter,
      OPCUAAdapter
      // Diğer adaptörler eklenebilir
    },
    config
  };
}

// Modül içeriğini dışa aktar
module.exports = {
  createEdgeConnector,
  BaseAdapter,
  ConnectorManager,
  ConfigManager,
  ModbusAdapter,
  OPCUAAdapter,
  config
}; 