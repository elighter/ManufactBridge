/**
 * @fileoverview ManufactBridge - Main Entry Point
 * Modern Manufacturing-ERP Data Platform
 */

const { SecurityManager } = require('./Security');
const { UNSManager } = require('./UNS');
const { OPCUAAdapter, ProtocolTransformer } = require('./EdgeConnectors');
const { DataPlatform, InfluxDBClient, StreamProcessor } = require('./DataPlatform');
const { ERPIntegration, SAPConnector } = require('./ERPIntegration');
const { LinearService } = require('./IntegrationLayer/LinearIntegration');

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
    this.linearService = null;
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
      
      // Start Linear integration
      if (this.config.linear?.enabled) {
        this.linearService = new LinearService(this.config.linear);
        await this.linearService.initialize();
        console.log('✅ Linear integration started');
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
      
      // Stop Linear integration
      if (this.linearService) {
        await this.linearService.shutdown();
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
      linearService: this.linearService?.getStatus() || null,
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
          
          // Linear'a manufacturing event olarak gönder
          if (this.linearService && this._isManufacturingData(data)) {
            this.linearService.emit('manufacturing:event', this._convertToManufacturingEvent(data));
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
        
        // Linear'a alert gönder
        if (this.linearService) {
          this.linearService.emit('manufacturing:alert', {
            type: alert.type || 'stream_alert',
            severity: alert.severity || 'medium',
            machineId: alert.machineId || 'data_platform',
            message: alert.message,
            timestamp: alert.timestamp || new Date().toISOString(),
            additionalData: alert
          });
        }
      });
    }
    
    // Linear service event'leri
    if (this.linearService) {
      this.linearService.on('linear:issue:updated', (data) => {
        console.log('📋 Linear issue updated:', data.issueId);
      });
      
      this.linearService.on('manufacturing:issue:created', (data) => {
        console.log('🏭 Manufacturing issue created in Linear:', data.issueId);
             });
     }
   }
   
   /**
    * Verinin manufacturing ile ilgili olup olmadığını kontrol et
    */
   _isManufacturingData(data) {
     if (!data || !data.topic) return false;
     
     const manufacturingTopics = [
       'machine',
       'production',
       'quality',
       'maintenance',
       'sensor',
       'alarm',
       'alert'
     ];
     
     return manufacturingTopics.some(topic => 
       data.topic.toLowerCase().includes(topic)
     );
   }
   
   /**
    * UNS verisini manufacturing event'ine çevir
    */
   _convertToManufacturingEvent(data) {
     const payload = data.payload || {};
     
     // Severity belirleme
     let severity = 'medium';
     if (payload.alarm || payload.alert) {
       severity = payload.severity || 'high';
     } else if (payload.error) {
       severity = 'critical';
     } else if (payload.warning) {
       severity = 'medium';
     }
     
     // Event type belirleme
     let eventType = 'data_update';
     if (data.topic.includes('alarm') || data.topic.includes('alert')) {
       eventType = 'machine_error';
     } else if (data.topic.includes('quality')) {
       eventType = 'quality_issue';
     } else if (data.topic.includes('maintenance')) {
       eventType = 'maintenance_required';
     } else if (data.topic.includes('production')) {
       eventType = 'production_delay';
     }
     
     // Machine ID çıkarma
     const machineId = payload.machineId || 
                      payload.deviceId || 
                      data.topic.split('/')[1] || 
                      'unknown';
     
     return {
       eventType,
       severity,
       machineId,
       description: payload.message || `${eventType} detected on ${machineId}`,
       timestamp: payload.timestamp || new Date().toISOString(),
       additionalData: {
         topic: data.topic,
         payload: payload,
         source: 'uns'
       }
     };
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
  SAPConnector,
  LinearService
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