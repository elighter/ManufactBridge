/**
 * @fileoverview ManufactBridge - Odoo ERP Connector
 * Bu modül, Odoo ERP sistemi ile entegrasyon sağlar.
 */

const BaseERPConnector = require('./base-erp-connector');
const winston = require('winston');
const axios = require('axios');

/**
 * Odoo ERP Connector Sınıfı
 * Odoo ERP sistemi ile veri alışverişi yapar
 */
class OdooConnector extends BaseERPConnector {
  /**
   * OdooConnector constructor'ı
   * @param {Object} config - Connector konfigürasyonu
   */
  constructor(config = {}) {
    super(config);
    
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:8069',
      database: config.database || 'odoo',
      username: config.username,
      password: config.password,
      apiKey: config.apiKey,
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      ...config
    };
    
    // Odoo bağlantı durumu
    this.authenticated = false;
    this.sessionId = null;
    this.userId = null;
    this.httpClient = null;
    
    // API endpoints
    this.endpoints = {
      auth: '/web/session/authenticate',
      logout: '/web/session/destroy',
      dataset: '/web/dataset/call_kw',
      search_read: '/web/dataset/search_read'
    };
    
    // İstatistikler
    this.stats = {
      authTime: null,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastRequest: null,
      avgResponseTime: 0
    };
    
    // Logger konfigürasyonu
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'odoo-connector', connectorId: this.config.id },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/odoo-connector.log' })
      ]
    });
    
    this.logger.info('Odoo Connector oluşturuldu', {
      baseUrl: this.config.baseUrl,
      database: this.config.database,
      username: this.config.username
    });
    
    // HTTP client'ı oluştur
    this._createHttpClient();
  }
  
  /**
   * Odoo'ya bağlanır ve kimlik doğrulama yapar
   * @returns {Promise<boolean>} Bağlantı başarılı ise true döner
   */
  async connect() {
    try {
      this.logger.info('Odoo\'ya bağlanılıyor...');
      
      const authData = {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: this.config.database,
          login: this.config.username,
          password: this.config.password
        }
      };
      
      const response = await this.httpClient.post(this.endpoints.auth, authData);
      
      if (response.data.error) {
        throw new Error(`Odoo kimlik doğrulama hatası: ${response.data.error.message}`);
      }
      
      if (!response.data.result || !response.data.result.uid) {
        throw new Error('Odoo kimlik doğrulama başarısız');
      }
      
      this.authenticated = true;
      this.userId = response.data.result.uid;
      this.sessionId = response.data.result.session_id;
      this.stats.authTime = new Date();
      
      // Session cookie'sini ayarla
      if (response.headers['set-cookie']) {
        this.httpClient.defaults.headers.Cookie = response.headers['set-cookie'].join('; ');
      }
      
      this.logger.info('Odoo bağlantısı kuruldu', {
        userId: this.userId,
        sessionId: this.sessionId
      });
      
      this.emit('connected');
      return true;
    } catch (error) {
      this.logger.error(`Odoo bağlantı hatası: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Odoo bağlantısını kapatır
   * @returns {Promise<boolean>} Kapatma başarılı ise true döner
   */
  async disconnect() {
    try {
      if (this.authenticated && this.sessionId) {
        await this.httpClient.post(this.endpoints.logout, {
          jsonrpc: '2.0',
          method: 'call',
          params: {}
        });
      }
      
      this.authenticated = false;
      this.sessionId = null;
      this.userId = null;
      
      this.logger.info('Odoo bağlantısı kapatıldı');
      this.emit('disconnected');
      
      return true;
    } catch (error) {
      this.logger.error(`Odoo bağlantı kapatma hatası: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Üretim emirlerini getirir
   * @param {Object} filters - Filtreleme kriterleri
   * @returns {Promise<Array>} Üretim emirleri
   */
  async getProductionOrders(filters = {}) {
    if (!this.authenticated) {
      throw new Error('Odoo bağlı değil');
    }
    
    try {
      const domain = this._buildDomain(filters);
      
      const requestData = {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'mrp.production',
          method: 'search_read',
          args: [domain],
          kwargs: {
            fields: [
              'name', 'product_id', 'product_qty', 'product_uom_id',
              'state', 'date_planned_start', 'date_planned_finished',
              'date_start', 'date_finished', 'location_src_id',
              'location_dest_id', 'routing_id', 'bom_id'
            ]
          }
        }
      };
      
      const response = await this._makeRequest(this.endpoints.dataset, requestData);
      
      if (response.error) {
        throw new Error(`Üretim emirleri getirme hatası: ${response.error.message}`);
      }
      
      return response.result || [];
    } catch (error) {
      this.logger.error(`Üretim emirleri getirme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Ürün bilgilerini getirir
   * @param {Object} filters - Filtreleme kriterleri
   * @returns {Promise<Array>} Ürün bilgileri
   */
  async getProducts(filters = {}) {
    if (!this.authenticated) {
      throw new Error('Odoo bağlı değil');
    }
    
    try {
      const domain = this._buildDomain(filters);
      
      const requestData = {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.product',
          method: 'search_read',
          args: [domain],
          kwargs: {
            fields: [
              'name', 'default_code', 'barcode', 'categ_id',
              'uom_id', 'uom_po_id', 'type', 'active',
              'list_price', 'standard_price'
            ]
          }
        }
      };
      
      const response = await this._makeRequest(this.endpoints.dataset, requestData);
      
      if (response.error) {
        throw new Error(`Ürün bilgileri getirme hatası: ${response.error.message}`);
      }
      
      return response.result || [];
    } catch (error) {
      this.logger.error(`Ürün bilgileri getirme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Stok hareketlerini getirir
   * @param {Object} filters - Filtreleme kriterleri
   * @returns {Promise<Array>} Stok hareketleri
   */
  async getStockMoves(filters = {}) {
    if (!this.authenticated) {
      throw new Error('Odoo bağlı değil');
    }
    
    try {
      const domain = this._buildDomain(filters);
      
      const requestData = {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.move',
          method: 'search_read',
          args: [domain],
          kwargs: {
            fields: [
              'name', 'product_id', 'product_uom_qty', 'product_uom',
              'location_id', 'location_dest_id', 'state', 'date',
              'date_expected', 'picking_id', 'origin'
            ]
          }
        }
      };
      
      const response = await this._makeRequest(this.endpoints.dataset, requestData);
      
      if (response.error) {
        throw new Error(`Stok hareketleri getirme hatası: ${response.error.message}`);
      }
      
      return response.result || [];
    } catch (error) {
      this.logger.error(`Stok hareketleri getirme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Kalite kontrol verilerini getirir
   * @param {Object} filters - Filtreleme kriterleri
   * @returns {Promise<Array>} Kalite kontrol verileri
   */
  async getQualityChecks(filters = {}) {
    if (!this.authenticated) {
      throw new Error('Odoo bağlı değil');
    }
    
    try {
      const domain = this._buildDomain(filters);
      
      const requestData = {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'quality.check',
          method: 'search_read',
          args: [domain],
          kwargs: {
            fields: [
              'name', 'product_id', 'lot_id', 'quality_state',
              'test_type', 'measure', 'norm', 'tolerance_min',
              'tolerance_max', 'date', 'user_id'
            ]
          }
        }
      };
      
      const response = await this._makeRequest(this.endpoints.dataset, requestData);
      
      if (response.error) {
        throw new Error(`Kalite kontrol verileri getirme hatası: ${response.error.message}`);
      }
      
      return response.result || [];
    } catch (error) {
      this.logger.error(`Kalite kontrol verileri getirme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Üretim verilerini Odoo'ya gönderir
   * @param {Object} productionData - Üretim verisi
   * @returns {Promise<boolean>} Gönderme başarılı ise true döner
   */
  async sendProductionData(productionData) {
    if (!this.authenticated) {
      throw new Error('Odoo bağlı değil');
    }
    
    try {
      // Üretim emri güncelleme
      if (productionData.productionOrderId) {
        const updateData = {
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'mrp.production',
            method: 'write',
            args: [
              [productionData.productionOrderId],
              {
                qty_produced: productionData.quantityProduced,
                date_start: productionData.startTime,
                date_finished: productionData.endTime,
                state: productionData.state || 'in_progress'
              }
            ]
          }
        };
        
        const response = await this._makeRequest(this.endpoints.dataset, updateData);
        
        if (response.error) {
          throw new Error(`Üretim verisi gönderme hatası: ${response.error.message}`);
        }
      }
      
      // Kalite kontrol verisi oluşturma
      if (productionData.qualityData) {
        for (const qualityCheck of productionData.qualityData) {
          const createData = {
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'quality.check',
              method: 'create',
              args: [{
                product_id: qualityCheck.productId,
                lot_id: qualityCheck.lotId,
                measure: qualityCheck.measure,
                quality_state: qualityCheck.result,
                test_type: qualityCheck.testType,
                date: new Date().toISOString()
              }]
            }
          };
          
          await this._makeRequest(this.endpoints.dataset, createData);
        }
      }
      
      this.logger.info('Üretim verisi Odoo\'ya gönderildi', {
        productionOrderId: productionData.productionOrderId
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Üretim verisi gönderme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Connector durumunu döner
   * @returns {Object} Connector durumu
   */
  getStatus() {
    return {
      ...super.getStatus(),
      authenticated: this.authenticated,
      baseUrl: this.config.baseUrl,
      database: this.config.database,
      username: this.config.username,
      userId: this.userId,
      sessionId: this.sessionId,
      stats: {
        ...this.stats,
        uptime: this.stats.authTime ? Date.now() - this.stats.authTime.getTime() : 0,
        successRate: this.stats.totalRequests > 0 ? 
          (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) : 0
      }
    };
  }
  
  /**
   * HTTP client'ı oluşturur
   * @private
   */
  _createHttpClient() {
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        this.stats.totalRequests++;
        this.stats.lastRequest = new Date();
        return config;
      },
      (error) => {
        this.stats.failedRequests++;
        return Promise.reject(error);
      }
    );
    
    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        this.stats.successfulRequests++;
        return response;
      },
      (error) => {
        this.stats.failedRequests++;
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * HTTP isteği yapar (retry mekanizması ile)
   * @param {string} endpoint - API endpoint
   * @param {Object} data - İstek verisi
   * @returns {Promise<Object>} Yanıt verisi
   * @private
   */
  async _makeRequest(endpoint, data) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const startTime = Date.now();
        const response = await this.httpClient.post(endpoint, data);
        const responseTime = Date.now() - startTime;
        
        // Ortalama yanıt süresini güncelle
        this.stats.avgResponseTime = (this.stats.avgResponseTime + responseTime) / 2;
        
        return response.data;
      } catch (error) {
        lastError = error;
        
        if (attempt < this.config.retryAttempts) {
          this.logger.warn(`İstek başarısız, yeniden deneniyor (${attempt}/${this.config.retryAttempts}): ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Filtreleri Odoo domain formatına dönüştürür
   * @param {Object} filters - Filtreler
   * @returns {Array} Odoo domain
   * @private
   */
  _buildDomain(filters) {
    const domain = [];
    
    if (filters.state) {
      domain.push(['state', '=', filters.state]);
    }
    
    if (filters.productId) {
      domain.push(['product_id', '=', filters.productId]);
    }
    
    if (filters.dateFrom) {
      domain.push(['date', '>=', filters.dateFrom]);
    }
    
    if (filters.dateTo) {
      domain.push(['date', '<=', filters.dateTo]);
    }
    
    if (filters.active !== undefined) {
      domain.push(['active', '=', filters.active]);
    }
    
    // Özel filtreler
    if (filters.custom) {
      for (const [field, operator, value] of filters.custom) {
        domain.push([field, operator, value]);
      }
    }
    
    return domain;
  }
  
  /**
   * UNS verisini Odoo formatına dönüştürür
   * @param {Object} unsData - UNS verisi
   * @returns {Object} Odoo formatındaki veri
   */
  transformUNSToOdoo(unsData) {
    const topic = unsData.topic;
    const payload = unsData.payload;
    
    // Topic'ten bilgi çıkar
    const topicParts = topic.split('/');
    const enterprise = topicParts[1];
    const site = topicParts[2];
    const area = topicParts[3];
    const line = topicParts[4];
    const device = topicParts[5];
    const dataType = topicParts[6];
    const tagName = topicParts[7];
    
    return {
      source: {
        enterprise,
        site,
        area,
        line,
        device
      },
      measurement: {
        name: tagName,
        value: payload.value,
        quality: payload.quality,
        timestamp: payload.timestamp,
        unit: payload.metadata?.unit,
        dataType: payload.metadata?.dataType
      },
      metadata: {
        protocol: payload.metadata?.protocol,
        adapterId: payload.metadata?.adapterId
      }
    };
  }
  
  /**
   * Odoo verisini UNS formatına dönüştürür
   * @param {Object} odooData - Odoo verisi
   * @param {string} topicPrefix - Topic öneki
   * @returns {Object} UNS formatındaki veri
   */
  transformOdooToUNS(odooData, topicPrefix = 'manufactbridge') {
    const hierarchy = this.config.hierarchy || {
      enterprise: 'enterprise1',
      site: 'site1',
      area: 'area1',
      line: 'line1'
    };
    
    const topic = `${topicPrefix}/${hierarchy.enterprise}/${hierarchy.site}/${hierarchy.area}/${hierarchy.line}/erp/data/${odooData.model}`;
    
    return {
      topic,
      payload: {
        value: odooData,
        quality: 'good',
        timestamp: new Date().toISOString(),
        metadata: {
          protocol: 'odoo',
          connectorId: this.config.id,
          model: odooData.model,
          recordId: odooData.id
        }
      }
    };
  }
}

module.exports = OdooConnector; 