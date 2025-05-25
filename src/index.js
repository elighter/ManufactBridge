/**
 * @fileoverview ManufactBridge - Ana Giriş Noktası
 * Modern Üretim-ERP Veri Platformu
 */

const { SecurityManager } = require('./Security');
const { UNSManager } = require('./UNS');
const { OPCUAAdapter, ProtocolTransformer } = require('./EdgeConnectors');
const { DataPlatform, InfluxDBClient, StreamProcessor } = require('./DataPlatform');
const { ERPIntegration, SAPConnector } = require('./ERPIntegration');

/**
 * ManufactBridge Ana Sınıfı
 * Tüm platform bileşenlerini yönetir
 */
class ManufactBridge {
  constructor(config = {}) {
    this.config = config;
    
    // Bileşenler
    this.security = null;
    this.uns = null;
    this.dataPlatform = null;
    this.erpIntegration = null;
    this.adapters = new Map();
    
    this.started = false;
  }
  
  /**
   * Platform'u başlatır
   */
  async start() {
    try {
      console.log('🚀 ManufactBridge başlatılıyor...');
      
      // Güvenlik katmanını başlat
      if (this.config.security?.enabled) {
        this.security = new SecurityManager(this.config.security);
        await this.security.start();
        console.log('✅ Güvenlik katmanı başlatıldı');
      }
      
      // UNS'yi başlat
      this.uns = new UNSManager(this.config.uns);
      await this.uns.start();
      console.log('✅ UNS başlatıldı');
      
      // Veri platformunu başlat
      this.dataPlatform = new DataPlatform(this.config.dataPlatform);
      await this.dataPlatform.start();
      console.log('✅ Veri platformu başlatıldı');
      
      // ERP entegrasyonunu başlat
      if (this.config.erp?.enabled) {
        this.erpIntegration = new ERPIntegration(this.config.erp);
        await this.erpIntegration.start();
        console.log('✅ ERP entegrasyonu başlatıldı');
      }
      
      // Edge adapter'ları başlat
      await this._startAdapters();
      
      // Event handler'ları ayarla
      this._setupEventHandlers();
      
      this.started = true;
      console.log('🎉 ManufactBridge başarıyla başlatıldı!');
      
    } catch (error) {
      console.error('❌ ManufactBridge başlatma hatası:', error.message);
      throw error;
    }
  }
  
  /**
   * Platform'u durdurur
   */
  async stop() {
    try {
      console.log('🛑 ManufactBridge durduruluyor...');
      
      // Adapter'ları durdur
      for (const [id, adapter] of this.adapters) {
        await adapter.stop();
      }
      
      // ERP entegrasyonunu durdur
      if (this.erpIntegration) {
        await this.erpIntegration.stop();
      }
      
      // Veri platformunu durdur
      if (this.dataPlatform) {
        await this.dataPlatform.stop();
      }
      
      // UNS'yi durdur
      if (this.uns) {
        await this.uns.stop();
      }
      
      // Güvenlik katmanını durdur
      if (this.security) {
        await this.security.stop();
      }
      
      this.started = false;
      console.log('✅ ManufactBridge durduruldu');
      
    } catch (error) {
      console.error('❌ ManufactBridge durdurma hatası:', error.message);
    }
  }
  
  /**
   * Platform durumunu döndürür
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
   * Edge adapter'ları başlatır
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
            console.warn(`Desteklenmeyen adapter tipi: ${adapterConfig.type}`);
            continue;
        }
        
        await adapter.start();
        this.adapters.set(adapterId, adapter);
        
        console.log(`✅ Adapter başlatıldı: ${adapterId} (${adapterConfig.type})`);
        
      } catch (error) {
        console.error(`❌ Adapter başlatma hatası (${adapterId}):`, error.message);
      }
    }
  }
  
  /**
   * Event handler'ları ayarlar
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
          console.error('UNS veri işleme hatası:', error.message);
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
          console.error(`Adapter veri gönderme hatası (${adapterId}):`, error.message);
        }
      });
    }
    
    // Stream processing alert'leri
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

// Eğer bu dosya doğrudan çalıştırılıyorsa
if (require.main === module) {
  const config = require('../config/default.json');
  const platform = new ManufactBridge(config);
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutdown signal alındı...');
    await platform.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Terminate signal alındı...');
    await platform.stop();
    process.exit(0);
  });
  
  // Platform'u başlat
  platform.start().catch((error) => {
    console.error('❌ Platform başlatma hatası:', error);
    process.exit(1);
  });
} 