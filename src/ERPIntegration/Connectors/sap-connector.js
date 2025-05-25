/**
 * @fileoverview ManufactBridge - SAP ERP Connector
 * Bu modül, SAP ERP sistemleri ile entegrasyon işlemlerini yönetir.
 */

const EventEmitter = require('eventemitter3');
const winston = require('winston');
const axios = require('axios');

/**
 * SAP ERP Connector Sınıfı
 * SAP sistemleri ile REST API ve RFC üzerinden entegrasyon sağlar
 */
class SAPConnector extends EventEmitter {
  /**
   * SAPConnector constructor'ı
   * @param {Object} config - SAP bağlantı konfigürasyonu
   */
  constructor(config) {
    super();
    
    this.config = {
      host: config.host,
      port: config.port || 8000,
      client: config.client || '100',
      username: config.username,
      password: config.password,
      language: config.language || 'EN',
      protocol: config.protocol || 'https',
      apiPath: config.apiPath || '/sap/opu/odata/sap',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 5000,
      ...config
    };
    
    this.connected = false;
    this.lastSync = null;
    this.authToken = null;
    this.sessionId = null;
    
    // HTTP client
    this.httpClient = axios.create({
      baseURL: `${this.config.protocol}://${this.config.host}:${this.config.port}`,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // İstatistikler
    this.stats = {
      requestsSent: 0,
      responsesReceived: 0,
      errors: 0,
      lastRequest: null,
      connectionTime: null
    };
    
    // Logger konfigürasyonu
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'sap-connector' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/sap-connector.log' })
      ]
    });
    
    this._setupInterceptors();
    this.logger.info('SAP Connector oluşturuldu');
  }
  
  /**
   * SAP sistemine bağlanır
   * @returns {Promise<boolean>} Bağlantı başarılı ise true döner
   */
  async connect() {
    try {
      this.logger.info(`SAP sistemine bağlanılıyor: ${this.config.host}`);
      
      // Authentication
      await this._authenticate();
      
      // Connection test
      await this._testConnection();
      
      this.connected = true;
      this.stats.connectionTime = new Date();
      
      this.logger.info('SAP bağlantısı başarılı');
      this.emit('connected');
      
      return true;
    } catch (error) {
      this.connected = false;
      this.logger.error(`SAP bağlantı hatası: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * SAP bağlantısını kapatır
   * @returns {Promise<boolean>} Kapatma başarılı ise true döner
   */
  async disconnect() {
    try {
      this.logger.info('SAP bağlantısı kapatılıyor...');
      
      // Logout işlemi
      if (this.authToken) {
        await this._logout();
      }
      
      this.connected = false;
      this.authToken = null;
      this.sessionId = null;
      
      this.logger.info('SAP bağlantısı kapatıldı');
      this.emit('disconnected');
      
      return true;
    } catch (error) {
      this.logger.error(`SAP bağlantı kapatma hatası: ${error.message}`);
      return false;
    }
  }
  
  /**
   * SAP sistemine veri gönderir
   * @param {Object} data - Gönderilecek veri
   * @returns {Promise<Object>} SAP'den gelen yanıt
   */
  async send(data) {
    try {
      if (!this.connected) {
        throw new Error('SAP sistemi bağlı değil');
      }
      
      const { entity, operation, data: payload } = data;
      
      let response;
      
      switch (operation) {
        case 'create':
          response = await this._createEntity(entity, payload);
          break;
        case 'update':
          response = await this._updateEntity(entity, payload);
          break;
        case 'delete':
          response = await this._deleteEntity(entity, payload);
          break;
        default:
          throw new Error(`Desteklenmeyen operasyon: ${operation}`);
      }
      
      this.logger.debug(`SAP veri gönderildi: ${entity}/${operation}`);
      this.emit('dataSent', { entity, operation, response });
      
      return response;
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`SAP veri gönderme hatası: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * SAP sisteminden veri çeker
   * @param {Object} query - Sorgu parametreleri
   * @returns {Promise<Array>} SAP'den gelen veriler
   */
  async query(query = {}) {
    try {
      if (!this.connected) {
        throw new Error('SAP sistemi bağlı değil');
      }
      
      const {
        entity,
        filters = {},
        fields = [],
        limit = 100,
        offset = 0,
        orderBy = null
      } = query;
      
      const response = await this._queryEntity(entity, {
        filters,
        fields,
        limit,
        offset,
        orderBy
      });
      
      this.lastSync = new Date();
      
      this.logger.debug(`SAP veri çekildi: ${entity} (${response.length} kayıt)`);
      this.emit('dataReceived', { entity, count: response.length });
      
      return response;
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`SAP veri çekme hatası: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Bağlantı durumunu döndürür
   * @returns {boolean} Bağlı ise true döner
   */
  isConnected() {
    return this.connected;
  }
  
  /**
   * Son sync zamanını döndürür
   * @returns {Date|null} Son sync zamanı
   */
  getLastSync() {
    return this.lastSync;
  }
  
  /**
   * Connector durumunu döndürür
   * @returns {Object} Connector durumu
   */
  getStatus() {
    return {
      connected: this.connected,
      host: this.config.host,
      client: this.config.client,
      lastSync: this.lastSync,
      stats: {
        ...this.stats,
        uptime: this.stats.connectionTime ? 
          Date.now() - this.stats.connectionTime.getTime() : 0
      }
    };
  }
  
  /**
   * SAP RFC fonksiyonu çağırır
   * @param {string} functionName - RFC fonksiyon adı
   * @param {Object} parameters - Fonksiyon parametreleri
   * @returns {Promise<Object>} RFC yanıtı
   */
  async callRFC(functionName, parameters = {}) {
    try {
      if (!this.connected) {
        throw new Error('SAP sistemi bağlı değil');
      }
      
      const response = await this.httpClient.post('/sap/bc/rest/rfc', {
        function: functionName,
        parameters: parameters
      }, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'X-CSRF-Token': await this._getCSRFToken()
        }
      });
      
      this.stats.requestsSent++;
      this.stats.responsesReceived++;
      this.stats.lastRequest = new Date();
      
      this.logger.debug(`RFC çağrısı tamamlandı: ${functionName}`);
      
      return response.data;
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`RFC çağrı hatası (${functionName}): ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Authentication işlemini gerçekleştirir
   * @private
   */
  async _authenticate() {
    try {
      const response = await this.httpClient.post('/sap/bc/rest/oauth2/token', {
        grant_type: 'password',
        username: this.config.username,
        password: this.config.password,
        client: this.config.client
      });
      
      this.authToken = response.data.access_token;
      this.sessionId = response.data.session_id;
      
      // HTTP client'a auth header ekle
      this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;
      
      this.logger.info('SAP authentication başarılı');
    } catch (error) {
      this.logger.error(`SAP authentication hatası: ${error.message}`);
      throw new Error(`SAP authentication başarısız: ${error.message}`);
    }
  }
  
  /**
   * Bağlantıyı test eder
   * @private
   */
  async _testConnection() {
    try {
      const response = await this.httpClient.get('/sap/opu/odata/sap/$metadata', {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`Bağlantı testi başarısız: ${response.status}`);
      }
      
      this.logger.debug('SAP bağlantı testi başarılı');
    } catch (error) {
      throw new Error(`SAP bağlantı testi başarısız: ${error.message}`);
    }
  }
  
  /**
   * Logout işlemini gerçekleştirir
   * @private
   */
  async _logout() {
    try {
      await this.httpClient.post('/sap/bc/rest/oauth2/revoke', {
        token: this.authToken
      });
      
      this.logger.debug('SAP logout başarılı');
    } catch (error) {
      this.logger.error(`SAP logout hatası: ${error.message}`);
    }
  }
  
  /**
   * CSRF token alır
   * @returns {Promise<string>} CSRF token
   * @private
   */
  async _getCSRFToken() {
    try {
      const response = await this.httpClient.get('/sap/opu/odata/sap', {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'X-CSRF-Token': 'Fetch'
        }
      });
      
      return response.headers['x-csrf-token'];
    } catch (error) {
      this.logger.error(`CSRF token alma hatası: ${error.message}`);
      return '';
    }
  }
  
  /**
   * Entity oluşturur
   * @param {string} entity - Entity adı
   * @param {Object} data - Entity verisi
   * @returns {Promise<Object>} Oluşturulan entity
   * @private
   */
  async _createEntity(entity, data) {
    const response = await this.httpClient.post(
      `${this.config.apiPath}/${entity}`,
      data,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'X-CSRF-Token': await this._getCSRFToken()
        }
      }
    );
    
    this.stats.requestsSent++;
    this.stats.responsesReceived++;
    this.stats.lastRequest = new Date();
    
    return response.data;
  }
  
  /**
   * Entity günceller
   * @param {string} entity - Entity adı
   * @param {Object} data - Güncellenecek veri
   * @returns {Promise<Object>} Güncellenen entity
   * @private
   */
  async _updateEntity(entity, data) {
    const { id, ...updateData } = data;
    
    const response = await this.httpClient.put(
      `${this.config.apiPath}/${entity}('${id}')`,
      updateData,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'X-CSRF-Token': await this._getCSRFToken()
        }
      }
    );
    
    this.stats.requestsSent++;
    this.stats.responsesReceived++;
    this.stats.lastRequest = new Date();
    
    return response.data;
  }
  
  /**
   * Entity siler
   * @param {string} entity - Entity adı
   * @param {Object} data - Silinecek entity bilgisi
   * @returns {Promise<boolean>} Silme başarılı ise true döner
   * @private
   */
  async _deleteEntity(entity, data) {
    const { id } = data;
    
    await this.httpClient.delete(
      `${this.config.apiPath}/${entity}('${id}')`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'X-CSRF-Token': await this._getCSRFToken()
        }
      }
    );
    
    this.stats.requestsSent++;
    this.stats.responsesReceived++;
    this.stats.lastRequest = new Date();
    
    return true;
  }
  
  /**
   * Entity sorgular
   * @param {string} entity - Entity adı
   * @param {Object} options - Sorgu seçenekleri
   * @returns {Promise<Array>} Sorgu sonuçları
   * @private
   */
  async _queryEntity(entity, options) {
    const { filters, fields, limit, offset, orderBy } = options;
    
    // OData query parametrelerini oluştur
    const params = new URLSearchParams();
    
    if (fields.length > 0) {
      params.append('$select', fields.join(','));
    }
    
    if (Object.keys(filters).length > 0) {
      const filterString = Object.entries(filters)
        .map(([key, value]) => `${key} eq '${value}'`)
        .join(' and ');
      params.append('$filter', filterString);
    }
    
    if (limit) {
      params.append('$top', limit.toString());
    }
    
    if (offset) {
      params.append('$skip', offset.toString());
    }
    
    if (orderBy) {
      params.append('$orderby', orderBy);
    }
    
    const response = await this.httpClient.get(
      `${this.config.apiPath}/${entity}?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      }
    );
    
    this.stats.requestsSent++;
    this.stats.responsesReceived++;
    this.stats.lastRequest = new Date();
    
    return response.data.d?.results || response.data.value || [];
  }
  
  /**
   * HTTP interceptor'ları ayarlar
   * @private
   */
  _setupInterceptors() {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(`SAP Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error(`SAP Request Error: ${error.message}`);
        return Promise.reject(error);
      }
    );
    
    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`SAP Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        this.logger.error(`SAP Response Error: ${error.response?.status} ${error.message}`);
        
        // Token expired - yeniden authenticate et
        if (error.response?.status === 401) {
          this.connected = false;
          this.authToken = null;
          this.emit('authenticationExpired');
        }
        
        return Promise.reject(error);
      }
    );
  }
}

module.exports = SAPConnector; 