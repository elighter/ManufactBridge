/**
 * ManufactBridge Edge Connector Modülü
 * 
 * This module exports the Edge Connector components of the ManufactBridge platform.
 * Provides adapters, data management and configuration tools needed to
 * communicate with industrial systems and transfer data.
 */

const BaseAdapter = require('./base-adapter');
const ConnectorManager = require('./connector-manager');
const ConfigManager = require('./config-manager');
const config = require('./config');

// SCADA adaptörleri
const ModbusAdapter = require('./SCADA/modbus-adapter');
const OPCUAAdapter = require('./SCADA/opcua-adapter');

/**
 * Edge Connector module main function
 * This function initializes and configures the required components.
 * 
 * @param {Object} options - Startup options
 * @returns {Object} Edge Connector module API
 */
function createEdgeConnector(options = {}) {
  // Create configuration manager
  const configManager = new ConfigManager({
    configDir: options.configDir,
    connectorsDir: options.connectorsDir
  });
  
  // Connector Manager'ı oluştur
  const connectorManager = new ConnectorManager({
    ...options,
    configManager: configManager
  });
  
  // Module's exposed API
  return {
    connectorManager,
    configManager,
    BaseAdapter,
    adapters: {
      ModbusAdapter,
      OPCUAAdapter
      // Other adapters can be added
    },
    config
  };
}

// Export module content
module.exports = {
  createEdgeConnector,
  BaseAdapter,
  ConnectorManager,
  ConfigManager,
  ModbusAdapter,
  OPCUAAdapter,
  config
}; 