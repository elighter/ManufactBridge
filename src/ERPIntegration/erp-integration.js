/**
 * @fileoverview ManufactBridge - ERP Integration Manager
 * Bu modül, ERP sistemleri ile entegrasyon işlemlerini yönetir.
 */

const EventEmitter = require('eventemitter3');
const winston = require('winston');

/**
 * ERP Integration Ana Sınıfı
 * Farklı ERP sistemleri ile entegrasyon işlemlerini yönetir
 */
class ERPIntegration extends EventEmitter {
  /**
   * ERPIntegration constructor'ı
   * @param {Object} config - ERP entegrasyon konfigürasyonu
   */
  constructor(config = {}) {
    super();
    
    this.config = {
      enabled: config.enabled !== false,
      systems: config.systems || {},
      dataMapping: config.dataMapping || {},
      syncInterval: config.syncInterval || 300000, // 5 dakika
      batchSize: config.batchSize || 100,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 5000,
      ...config
    };
    
    // ERP connectors
    this.connectors = new Map();
    this.connected = false;
    this.syncTimer = null;
    
    // Veri buffer'ları
    this.outboundQueue = []; // ERP'ye gönderilecek veriler
    this.inboundQueue = []; // ERP'den gelen veriler
    
    // İstatistikler
    this.stats = {
      outboundSent: 0,
      inboundReceived: 0,
      errors: 0,
      lastSync: null,
      startTime: new Date()
    };
    
    // Logger konfigürasyonu
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'erp-integration' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/erp-integration.log' })
      ]
    });
    
    this.logger.info('ERP Integration oluşturuldu');
  }
  
  /**
   * ERP entegrasyonunu başlatır
   * @returns {Promise<boolean>} Başlatma başarılı ise true döner
   */
  async start() {
    try {
      if (!this.config.enabled) {
        this.logger.info('ERP entegrasyonu devre dışı');
        return true;
      }
      
      this.logger.info('ERP Integration başlatılıyor...');
      
      // ERP connector'larını başlat
      await this._initializeConnectors();
      
      // Sync timer'ı başlat
      this._startSyncTimer();
      
      this.connected = true;
      this.logger.info('ERP Integration başarıyla başlatıldı');
      this.emit('started');
      
      return true;
    } catch (error) {
      this.logger.error(`ERP Integration başlatma hatası: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * ERP entegrasyonunu durdurur
   * @returns {Promise<boolean>} Durdurma başarılı ise true döner
   */
  async stop() {
    try {
      this.logger.info('ERP Integration durduruluyor...');
      
      // Sync timer'ı durdur
      this._stopSyncTimer();
      
      // Bekleyen verileri gönder
      await this._flushQueues();
      
      // Connector'ları kapat
      for (const [systemId, connector] of this.connectors) {
        try {
          await connector.disconnect();
          this.logger.info(`ERP connector kapatıldı: ${systemId}`);
        } catch (error) {
          this.logger.error(`ERP connector kapatma hatası (${systemId}): ${error.message}`);
        }
      }
      
      this.connected = false;
      this.logger.info('ERP Integration durduruldu');
      this.emit('stopped');
      
      return true;
    } catch (error) {
      this.logger.error(`ERP Integration durdurma hatası: ${error.message}`);
      return false;
    }
  }
  
  /**
   * UNS verisini ERP sistemlerine gönderir
   * @param {Object} unsData - UNS formatındaki veri
   * @returns {Promise<boolean>} Gönderim başarılı ise true döner
   */
  async sendToERP(unsData) {
    try {
      if (!this.connected) {
        this.logger.warn('ERP Integration bağlı değil, veri queue\'ya eklendi');
        this.outboundQueue.push(unsData);
        return false;
      }
      
      // Veri mapping'i uygula
      const mappedData = this._mapUNSToERP(unsData);
      
      if (!mappedData) {
        this.logger.debug(`Veri mapping bulunamadı: ${unsData.topic}`);
        return false;
      }
      
      // İlgili ERP sistemlerine gönder
      const promises = [];
      for (const [systemId, systemData] of Object.entries(mappedData)) {
        const connector = this.connectors.get(systemId);
        if (connector && connector.isConnected()) {
          promises.push(this._sendToSystem(connector, systemData));
        } else {
          this.logger.warn(`ERP connector bağlı değil: ${systemId}`);
        }
      }
      
      if (promises.length > 0) {
        await Promise.all(promises);
        this.stats.outboundSent++;
        this.emit('dataSent', { unsData, mappedData });
        return true;
      }
      
      return false;
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`ERP veri gönderme hatası: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * ERP sistemlerinden veri çeker
   * @param {string} systemId - ERP sistem ID'si
   * @param {Object} query - Sorgu parametreleri
   * @returns {Promise<Array>} ERP'den gelen veriler
   */
  async pullFromERP(systemId, query = {}) {
    try {
      const connector = this.connectors.get(systemId);
      
      if (!connector || !connector.isConnected()) {
        throw new Error(`ERP connector bağlı değil: ${systemId}`);
      }
      
      const data = await connector.query(query);
      
      // ERP verisini UNS formatına dönüştür
      const unsData = this._mapERPToUNS(systemId, data);
      
      this.stats.inboundReceived += data.length;
      this.emit('dataReceived', { systemId, data: unsData });
      
      return unsData;
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`ERP veri çekme hatası (${systemId}): ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * ERP sistem durumunu döndürür
   * @returns {Object} ERP sistem durumları
   */
  getStatus() {
    const systemStatuses = {};
    
    for (const [systemId, connector] of this.connectors) {
      systemStatuses[systemId] = {
        connected: connector.isConnected(),
        lastSync: connector.getLastSync(),
        status: connector.getStatus()
      };
    }
    
    return {
      connected: this.connected,
      systems: systemStatuses,
      stats: {
        ...this.stats,
        uptime: Date.now() - this.stats.startTime.getTime(),
        queueSizes: {
          outbound: this.outboundQueue.length,
          inbound: this.inboundQueue.length
        }
      },
      config: {
        enabled: this.config.enabled,
        syncInterval: this.config.syncInterval,
        batchSize: this.config.batchSize
      }
    };
  }
  
  /**
   * Veri mapping'i ekler veya günceller
   * @param {string} topic - UNS topic
   * @param {Object} mapping - ERP mapping konfigürasyonu
   */
  addDataMapping(topic, mapping) {
    this.config.dataMapping[topic] = mapping;
    this.logger.info(`Veri mapping eklendi: ${topic}`, mapping);
  }
  
  /**
   * ERP connector'larını başlatır
   * @private
   */
  async _initializeConnectors() {
    for (const [systemId, systemConfig] of Object.entries(this.config.systems)) {
      try {
        const ConnectorClass = this._getConnectorClass(systemConfig.type);
        const connector = new ConnectorClass(systemConfig);
        
        await connector.connect();
        this.connectors.set(systemId, connector);
        
        this.logger.info(`ERP connector başlatıldı: ${systemId} (${systemConfig.type})`);
      } catch (error) {
        this.logger.error(`ERP connector başlatma hatası (${systemId}): ${error.message}`);
        throw error;
      }
    }
  }
  
  /**
   * Connector sınıfını döndürür
   * @param {string} type - ERP sistem tipi
   * @returns {Class} Connector sınıfı
   * @private
   */
  _getConnectorClass(type) {
    switch (type.toLowerCase()) {
      case 'sap':
        return require('./Connectors/sap-connector');
      case 'odoo':
        return require('./Connectors/odoo-connector');
      case 'erpnext':
        return require('./Connectors/erpnext-connector');
      default:
        throw new Error(`Desteklenmeyen ERP tipi: ${type}`);
    }
  }
  
  /**
   * UNS verisini ERP formatına dönüştürür
   * @param {Object} unsData - UNS verisi
   * @returns {Object|null} ERP formatındaki veri
   * @private
   */
  _mapUNSToERP(unsData) {
    const mapping = this.config.dataMapping[unsData.topic];
    
    if (!mapping) {
      return null;
    }
    
    const result = {};
    
    for (const [systemId, systemMapping] of Object.entries(mapping)) {
      if (!systemMapping.enabled) continue;
      
      const mappedData = {
        entity: systemMapping.entity,
        operation: systemMapping.operation || 'create',
        data: {},
        timestamp: unsData.payload.timestamp
      };
      
      // Field mapping'i uygula
      for (const [erpField, unsField] of Object.entries(systemMapping.fields)) {
        const value = this._extractValue(unsData.payload, unsField);
        if (value !== undefined) {
          mappedData.data[erpField] = value;
        }
      }
      
      // Transformation'ları uygula
      if (systemMapping.transformations) {
        mappedData.data = this._applyTransformations(mappedData.data, systemMapping.transformations);
      }
      
      result[systemId] = mappedData;
    }
    
    return Object.keys(result).length > 0 ? result : null;
  }
  
  /**
   * ERP verisini UNS formatına dönüştürür
   * @param {string} systemId - ERP sistem ID'si
   * @param {Array} erpData - ERP verisi
   * @returns {Array} UNS formatındaki veriler
   * @private
   */
  _mapERPToUNS(systemId, erpData) {
    const result = [];
    
    // Reverse mapping logic burada implement edilecek
    // Şimdilik basit bir dönüşüm yapıyoruz
    
    for (const item of erpData) {
      const unsData = {
        topic: `manufactbridge/erp/${systemId}/data/${item.entity || 'unknown'}`,
        payload: {
          value: item.value || item,
          timestamp: item.timestamp || new Date().toISOString(),
          quality: 'good',
          metadata: {
            source: 'erp',
            systemId: systemId,
            entity: item.entity,
            ...item.metadata
          }
        }
      };
      
      result.push(unsData);
    }
    
    return result;
  }
  
  /**
   * Nested object'ten değer çıkarır
   * @param {Object} obj - Kaynak object
   * @param {string} path - Değer yolu (örn: "payload.value")
   * @returns {*} Çıkarılan değer
   * @private
   */
  _extractValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
  
  /**
   * Veri transformation'larını uygular
   * @param {Object} data - Kaynak veri
   * @param {Array} transformations - Transformation kuralları
   * @returns {Object} Transform edilmiş veri
   * @private
   */
  _applyTransformations(data, transformations) {
    let result = { ...data };
    
    for (const transformation of transformations) {
      switch (transformation.type) {
        case 'scale':
          if (result[transformation.field] !== undefined) {
            result[transformation.field] *= transformation.factor;
          }
          break;
        case 'unit_convert':
          // Unit conversion logic
          break;
        case 'format':
          if (result[transformation.field] !== undefined) {
            result[transformation.field] = this._formatValue(
              result[transformation.field], 
              transformation.format
            );
          }
          break;
      }
    }
    
    return result;
  }
  
  /**
   * Değeri belirtilen formata dönüştürür
   * @param {*} value - Değer
   * @param {string} format - Format tipi
   * @returns {*} Formatlanmış değer
   * @private
   */
  _formatValue(value, format) {
    switch (format) {
      case 'integer':
        return parseInt(value, 10);
      case 'float':
        return parseFloat(value);
      case 'string':
        return String(value);
      case 'boolean':
        return Boolean(value);
      default:
        return value;
    }
  }
  
  /**
   * Belirli bir sisteme veri gönderir
   * @param {Object} connector - ERP connector
   * @param {Object} data - Gönderilecek veri
   * @returns {Promise<boolean>} Gönderim başarılı ise true döner
   * @private
   */
  async _sendToSystem(connector, data) {
    try {
      await connector.send(data);
      return true;
    } catch (error) {
      this.logger.error(`ERP sistem gönderim hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Sync timer'ı başlatır
   * @private
   */
  _startSyncTimer() {
    if (this.config.syncInterval > 0) {
      this.syncTimer = setInterval(async () => {
        try {
          await this._performSync();
        } catch (error) {
          this.logger.error(`Sync hatası: ${error.message}`);
        }
      }, this.config.syncInterval);
      
      this.logger.info(`ERP sync timer başlatıldı: ${this.config.syncInterval}ms`);
    }
  }
  
  /**
   * Sync timer'ı durdurur
   * @private
   */
  _stopSyncTimer() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      this.logger.info('ERP sync timer durduruldu');
    }
  }
  
  /**
   * Periyodik sync işlemini gerçekleştirir
   * @private
   */
  async _performSync() {
    try {
      // Outbound queue'yu işle
      await this._processOutboundQueue();
      
      // Inbound data'yı çek
      await this._pullInboundData();
      
      this.stats.lastSync = new Date();
      this.emit('syncCompleted');
      
      this.logger.debug('ERP sync tamamlandı');
    } catch (error) {
      this.logger.error(`ERP sync hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Outbound queue'yu işler
   * @private
   */
  async _processOutboundQueue() {
    if (this.outboundQueue.length === 0) return;
    
    const batch = this.outboundQueue.splice(0, this.config.batchSize);
    
    for (const unsData of batch) {
      try {
        await this.sendToERP(unsData);
      } catch (error) {
        this.logger.error(`Outbound queue işleme hatası: ${error.message}`);
        // Hatalı veriyi tekrar queue'ya ekle (retry logic)
        this.outboundQueue.push(unsData);
      }
    }
  }
  
  /**
   * ERP sistemlerinden veri çeker
   * @private
   */
  async _pullInboundData() {
    for (const [systemId, connector] of this.connectors) {
      if (!connector.isConnected()) continue;
      
      try {
        // Son sync'ten sonraki verileri çek
        const lastSync = connector.getLastSync();
        const query = {
          since: lastSync,
          limit: this.config.batchSize
        };
        
        const data = await this.pullFromERP(systemId, query);
        
        if (data.length > 0) {
          this.inboundQueue.push(...data);
          this.logger.debug(`${data.length} veri çekildi: ${systemId}`);
        }
      } catch (error) {
        this.logger.error(`Inbound data çekme hatası (${systemId}): ${error.message}`);
      }
    }
  }
  
  /**
   * Queue'ları temizler
   * @private
   */
  async _flushQueues() {
    try {
      // Son kez outbound queue'yu işle
      await this._processOutboundQueue();
      
      this.logger.info(`Queue'lar temizlendi - Outbound: ${this.outboundQueue.length}, Inbound: ${this.inboundQueue.length}`);
    } catch (error) {
      this.logger.error(`Queue flush hatası: ${error.message}`);
    }
  }
}

module.exports = ERPIntegration; 