/**
 * @fileoverview ManufactBridge - Edge Connector Modülü
 * Bu modül, farklı endüstriyel sistemlerden veri toplama için konnektörleri içerir.
 */

const BaseAdapter = require('./base-adapter');
const ConnectorManager = require('./connector-manager');
const ConfigManager = require('./config-manager');

// Protokol adaptörlerini içeri aktarma denemesi (henüz uygulanmamış olabilir)
let ModbusAdapter, OpcUaAdapter, MqttAdapter, S7Adapter;

try {
  ModbusAdapter = require('./SCADA/modbus-adapter');
} catch (error) {
  ModbusAdapter = null;
}

try {
  OpcUaAdapter = require('./SCADA/opcua-adapter');
} catch (error) {
  OpcUaAdapter = null;
}

try {
  MqttAdapter = require('./SCADA/mqtt-adapter');
} catch (error) {
  MqttAdapter = null;
}

try {
  S7Adapter = require('./SCADA/s7-adapter');
} catch (error) {
  S7Adapter = null;
}

/**
 * Desteklenen protokoller
 * @type {Object}
 */
const SUPPORTED_PROTOCOLS = {
  'modbus-tcp': ModbusAdapter !== null,
  'opcua': OpcUaAdapter !== null,
  'mqtt': MqttAdapter !== null,
  's7': S7Adapter !== null
};

/**
 * Edge Connector modülünü oluşturur
 * @param {Object} options - Opsiyonel yapılandırma
 * @returns {Object} Edge Connector API'si
 */
function createEdgeConnector(options = {}) {
  const configManager = new ConfigManager(options.config);
  const connectorManager = new ConnectorManager(options.connector);
  
  /**
   * Konnektör fabrika fonksiyonu
   * @param {string} protocol - Protokol adı
   * @param {Object} config - Konnektör konfigürasyonu
   * @returns {BaseAdapter} Konnektör nesnesi
   */
  function createConnector(protocol, config) {
    switch (protocol) {
      case 'modbus-tcp':
        if (!ModbusAdapter) {
          throw new Error('Modbus TCP adaptörü kullanılamıyor');
        }
        return new ModbusAdapter(config);
        
      case 'opcua':
        if (!OpcUaAdapter) {
          throw new Error('OPC UA adaptörü kullanılamıyor');
        }
        return new OpcUaAdapter(config);
        
      case 'mqtt':
        if (!MqttAdapter) {
          throw new Error('MQTT adaptörü kullanılamıyor');
        }
        return new MqttAdapter(config);
        
      case 's7':
        if (!S7Adapter) {
          throw new Error('S7 adaptörü kullanılamıyor');
        }
        return new S7Adapter(config);
        
      default:
        throw new Error(`Desteklenmeyen protokol: ${protocol}`);
    }
  }
  
  /**
   * Konfigürasyon dosyasından konnektör yükler
   * @param {string} configId - Konfigürasyon ID'si
   * @returns {BaseAdapter} Konnektör nesnesi
   */
  function loadConnectorFromConfig(configId) {
    const config = configManager.getConfig(configId);
    if (!config) {
      throw new Error(`${configId} için konfigürasyon bulunamadı`);
    }
    
    const protocol = config.connector.protocol;
    
    if (!SUPPORTED_PROTOCOLS[protocol]) {
      throw new Error(`Protokol desteklenmiyor veya uygulanmamış: ${protocol}`);
    }
    
    const connector = createConnector(protocol, config);
    connectorManager.addConnector(configId, connector);
    
    return connector;
  }
  
  // Edge Connector API'si
  return {
    // Konnektör yönetimi
    createConnector,
    loadConnectorFromConfig,
    getConnectorManager: () => connectorManager,
    startAllConnectors: () => connectorManager.start(),
    stopAllConnectors: () => connectorManager.stop(),
    getStatus: () => connectorManager.getStatus(),
    
    // Konfigürasyon yönetimi
    getConfigManager: () => configManager,
    loadConfig: (configId) => configManager.loadConfig(configId),
    saveConfig: (configId, config) => configManager.saveConfig(configId, config),
    loadAllConfigs: () => configManager.loadAllConfigs(),
    createSampleConfig: (configId, type, protocol) => configManager.createSampleConfig(configId, type, protocol),
    listConfigs: () => configManager.listConfigs(),
    deleteConfig: (configId) => configManager.deleteConfig(configId),
    
    // Taban sınıflar (özelleştirme ve genişletme için)
    BaseAdapter,
    ConnectorManager,
    ConfigManager,
    
    // Desteklenen protokoller
    getSupportedProtocols: () => ({ ...SUPPORTED_PROTOCOLS }),
    
    // Protokol adaptörleri (varsa)
    ModbusAdapter,
    OpcUaAdapter,
    MqttAdapter,
    S7Adapter
  };
}

module.exports = {
  createEdgeConnector,
  BaseAdapter,
  ConnectorManager,
  ConfigManager
}; 