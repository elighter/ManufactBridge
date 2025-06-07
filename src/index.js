/**
 * @fileoverview ManufactBridge - Main Entry Point
 * Modern Manufacturing-ERP Data Platform
 */

const { SecurityManager } = require('./Security');
const { UNSManager } = require('./UNS');
const { OPCUAAdapter, ProtocolTransformer } = require('./EdgeConnectors');
const { DataPlatform, InfluxDBClient, StreamProcessor } = require('./DataPlatform');
const { ERPIntegration, SAPConnector } = require('./ERPIntegration');

/**
 * ManufactBridge Main Class
 * Manages all platform components
 */
class ManufactBridge {
  constructor(config = {}) {
    this.config = config;
    
    // Components
    this.security = null;
    this.uns = null;
    this.dataPlatform = null;
    this.erpIntegration = null;
    this.adapters = new Map();
    
    this.started = false;
  }
  
  /**
   * Starts the platform
   */
  async start() {
    try {
      console.log('🚀 Starting ManufactBridge...');
      
      // Start security layer
      if (this.config.security?.enabled) {
        this.security = new SecurityManager(this.config.security);
        await this.security.start();
        console.log('✅ Security layer started');
      }
      
      // Start UNS
      this.uns = new UNSManager(this.config.uns);
      await this.uns.start();
      console.log('✅ UNS started');
      
      // Start data platform
      this.dataPlatform = new DataPlatform(this.config.dataPlatform);
      await this.dataPlatform.start();
      console.log('✅ Data platform started');
      
      // Start ERP integration
      if (this.config.erp?.enabled) {
        this.erpIntegration = new ERPIntegration(this.config.erp);
        await this.erpIntegration.start();
        console.log('✅ ERP integration started');
      }
      
      // Start edge adapters
      await this._startAdapters();
      
      // Setup event handlers
      this._setupEventHandlers();
      
      this.started = true;
      console.log('🎉 ManufactBridge started successfully!');
      
    } catch (error) {
      console.error('❌ ManufactBridge startup error:', error.message);
      throw error;
    }
  }
  
  /**
   * Stops the platform
   */
  async stop() {
    try {
      console.log('🛑 Stopping ManufactBridge...');
      
      // Stop adapters
      for (const [id, adapter] of this.adapters) {
        await adapter.stop();
      }
      
      // Stop ERP integration
      if (this.erpIntegration) {
        await this.erpIntegration.stop();
      }
      
      // Stop data platform
      if (this.dataPlatform) {
        await this.dataPlatform.stop();
      }
      
      // Stop UNS
      if (this.uns) {
        await this.uns.stop();
      }
      
      // Stop security layer
      if (this.security) {
        await this.security.stop();
      }
      
      this.started = false;
      console.log('✅ ManufactBridge stopped');
      
    } catch (error) {
      console.error('❌ ManufactBridge shutdown error:', error.message);
    }
  }
  
  /**
   * Returns platform status
   */
  getStatus() {
    return {
      started: this.started,
      security: this.security?.getStatus() || null,
      uns: this.uns?.getStatus() || null,
      dataPlatform: this.dataPlatform?.getStatus() || null,
      erpIntegration: this.erpIntegration?.getStatus() || null,
      adapters: Array.from(this.adapters.entries()).map(([id, adapter]) => ({
        id,
        status: adapter.getStatus()
      }))
    };
  }
  
  /**
   * Starts edge adapters
   */
  async _startAdapters() {
    if (!this.config.adapters) return;
    
    for (const [adapterId, adapterConfig] of Object.entries(this.config.adapters)) {
      try {
        let adapter;
        
        switch (adapterConfig.type) {
          case 'opcua':
            adapter = new OPCUAAdapter(adapterConfig);
            break;
          default:
            console.warn(`Unsupported adapter type: ${adapterConfig.type}`);
            continue;
        }
        
        await adapter.start();
        this.adapters.set(adapterId, adapter);
        
        console.log(`✅ Adapter started: ${adapterId} (${adapterConfig.type})`);
        
      } catch (error) {
        console.error(`❌ Adapter startup error (${adapterId}):`, error.message);
      }
    }
  }
  
  /**
   * Sets up event handlers
   */
  _setupEventHandlers() {
    // UNS event'leri
    if (this.uns) {
      this.uns.on('dataReceived', async (data) => {
        try {
          // Veri platformuna gönder
          if (this.dataPlatform) {
            await this.dataPlatform.processUNSData(data);
          }
          
          // ERP'ye gönder
          if (this.erpIntegration) {
            await this.erpIntegration.sendToERP(data);
          }
        } catch (error) {
          console.error('UNS data processing error:', error.message);
        }
      });
    }
    
    // Adapter event'leri
    for (const [adapterId, adapter] of this.adapters) {
      adapter.on('dataReceived', async (data) => {
        try {
          // UNS'ye gönder
          if (this.uns) {
            await this.uns.publish(data.topic, data.payload);
          }
        } catch (error) {
          console.error(`Adapter data sending error (${adapterId}):`, error.message);
        }
      });
    }
    
    // Stream processing alerts
    if (this.dataPlatform) {
      this.dataPlatform.on('streamAlert', (alert) => {
        console.warn('🚨 Stream Alert:', alert);
      });
    }
  }
}

// Export'lar
module.exports = {
  ManufactBridge,
  SecurityManager,
  UNSManager,
  OPCUAAdapter,
  ProtocolTransformer,
  DataPlatform,
  InfluxDBClient,
  StreamProcessor,
  ERPIntegration,
  SAPConnector
};

// If this file is run directly
if (require.main === module) {
  const config = require('../config/default.json');
  const platform = new ManufactBridge(config);
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutdown signal received...');
    await platform.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Terminate signal received...');
    await platform.stop();
    process.exit(0);
  });
  
  // Start platform
  platform.start().catch((error) => {
    console.error('❌ Platform startup error:', error);
    process.exit(1);
  });
} 