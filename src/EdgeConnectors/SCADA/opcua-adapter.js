/**
 * @fileoverview ManufactBridge - OPC UA Protokol Adaptörü
 * Bu adaptör, OPC UA protokolü üzerinden veri toplama işlemlerini gerçekleştirir.
 */

const BaseAdapter = require('../base-adapter');
const { OPCUAClient, MessageSecurityMode, SecurityPolicy, AttributeIds, ClientSubscription, TimestampsToReturn, MonitoringParametersOptions, ReadValueIdOptions, ClientMonitoredItem } = require('node-opcua');

/**
 * OPC UA Node ID Analiz Yardımcısı
 * Örnek: "ns=2;i=1001" -> { namespaceIndex: 2, identifier: 1001, identifierType: 'NUMERIC' }
 * @param {string} nodeId - OPC UA Node ID formatı
 * @returns {Object} Node ID bileşenleri
 */
function parseOPCUANodeId(nodeId) {
  // Node ID formatları:
  // ns=<namespaceIndex>;i=<numericId>     (Numeric)
  // ns=<namespaceIndex>;s=<stringId>      (String)
  // ns=<namespaceIndex>;g=<guidId>        (GUID)
  // ns=<namespaceIndex>;b=<opaqueId>      (Opaque)
  
  const parts = nodeId.split(';');
  let namespaceIndex = 0;
  let identifier = nodeId;
  let identifierType = 'STRING';
  
  for (const part of parts) {
    if (part.startsWith('ns=')) {
      namespaceIndex = parseInt(part.substring(3), 10);
    } else if (part.startsWith('i=')) {
      identifier = parseInt(part.substring(2), 10);
      identifierType = 'NUMERIC';
    } else if (part.startsWith('s=')) {
      identifier = part.substring(2);
      identifierType = 'STRING';
    } else if (part.startsWith('g=')) {
      identifier = part.substring(2);
      identifierType = 'GUID';
    } else if (part.startsWith('b=')) {
      identifier = part.substring(2);
      identifierType = 'OPAQUE';
    }
  }
  
  return {
    namespaceIndex,
    identifier,
    identifierType
  };
}

class OPCUAAdapter extends BaseAdapter {
  /**
   * OPC UA Adapter constructor'ı
   * @param {Object} config - OPC UA konnektör konfigürasyonu
   */
  constructor(config) {
    super(config);
    
    this.config = config;
    this.type = 'opcua';
    this.client = null;
    this.session = null;
    this.subscription = null;
    this.monitoredItems = new Map();
    this.connected = false;
    this.reconnecting = false;
    this.reconnectTimer = null;
    this.lastValues = new Map(); // Deadband için son değerleri sakla
    
    // OPC UA bağlantı seçenekleri
    this.connectionOptions = {
      applicationName: config.options?.applicationName || 'ManufactBridge OPC UA Client',
      clientName: config.options?.clientName || 'ManufactBridge Client',
      endpoint_must_exist: config.options?.endpointMustExist !== false,
      keepSessionAlive: config.options?.keepSessionAlive !== false,
      connectionStrategy: {
        initialDelay: config.options?.initialDelay || 1000,
        maxRetry: config.options?.maxRetries || 3,
        maxDelay: config.options?.maxDelay || 10000
      }
    };
    
    // Güvenlik ayarları
    this.securityMode = this._parseSecurityMode(config.options?.securityMode || 'None');
    this.securityPolicy = this._parseSecurityPolicy(config.options?.securityPolicy || 'None');
  }
  
  /**
   * Güvenlik modunu parse eder
   * @param {string} mode - Güvenlik modu string'i
   * @returns {MessageSecurityMode} OPC UA güvenlik modu
   * @private
   */
  _parseSecurityMode(mode) {
    switch (mode.toLowerCase()) {
      case 'none':
        return MessageSecurityMode.None;
      case 'sign':
        return MessageSecurityMode.Sign;
      case 'signandencrypt':
        return MessageSecurityMode.SignAndEncrypt;
      default:
        this.logger.warn(`Bilinmeyen güvenlik modu: ${mode}, 'None' kullanılıyor`);
        return MessageSecurityMode.None;
    }
  }
  
  /**
   * Güvenlik politikasını parse eder
   * @param {string} policy - Güvenlik politikası string'i
   * @returns {SecurityPolicy} OPC UA güvenlik politikası
   * @private
   */
  _parseSecurityPolicy(policy) {
    switch (policy.toLowerCase()) {
      case 'none':
        return SecurityPolicy.None;
      case 'basic128':
        return SecurityPolicy.Basic128;
      case 'basic128rsa15':
        return SecurityPolicy.Basic128Rsa15;
      case 'basic256':
        return SecurityPolicy.Basic256;
      case 'basic256sha256':
        return SecurityPolicy.Basic256Sha256;
      default:
        this.logger.warn(`Bilinmeyen güvenlik politikası: ${policy}, 'None' kullanılıyor`);
        return SecurityPolicy.None;
    }
  }
  
  /**
   * Konfigürasyon doğrulama metodu
   * @throws {Error} Konfigürasyon geçerli değilse hata fırlatır
   */
  validateConfig() {
    super.validateConfig();
    
    if (!this.config.connection || !this.config.connection.endpoint) {
      throw new Error('OPC UA bağlantısı için geçerli bir endpoint gereklidir');
    }
    
    // Endpoint URL formatını kontrol et
    const endpoint = this.config.connection.endpoint;
    if (!endpoint.startsWith('opc.tcp://')) {
      throw new Error('OPC UA endpoint URL\'si opc.tcp:// ile başlamalıdır');
    }
    
    // Varsayılan değerleri ayarla
    if (!this.config.options) {
      this.config.options = {};
    }
  }
  
  /**
   * OPC UA sunucusuna bağlanır
   * @returns {Promise<boolean>} Bağlantı başarılı ise true döner
   */
  async connect() {
    if (this.connected) {
      return true;
    }
    
    try {
      this.logger.info(`OPC UA sunucusuna bağlanılıyor: ${this.config.connection.endpoint}`);
      
      // OPC UA Client oluştur
      this.client = OPCUAClient.create(this.connectionOptions);
      
      // Client olaylarını dinle
      this._setupClientEvents();
      
      // Sunucuya bağlan
      await this.client.connect(this.config.connection.endpoint);
      this.logger.info('OPC UA sunucusuna bağlantı kuruldu');
      
      // Session oluştur
      const userIdentity = this._createUserIdentity();
      this.session = await this.client.createSession(userIdentity);
      this.logger.info('OPC UA session oluşturuldu');
      
      // Session olaylarını dinle
      this._setupSessionEvents();
      
      this.connected = true;
      this.status = 'connected';
      this.lastError = null;
      
      // Başarılı bağlantı olayını tetikle
      this.emit('connect', { timestamp: new Date() });
      
      // Tag'leri tanımlayıp subscription'ı başlat
      if (this.config.tags && Array.isArray(this.config.tags)) {
        await this.defineTags(this.config.tags);
        await this._createSubscription();
      }
      
      return true;
    } catch (err) {
      this.connected = false;
      this.status = 'error';
      this.lastError = err.message;
      
      this.logger.error(`OPC UA bağlantı hatası: ${err.message}`);
      this.emit('error', {
        message: `OPC UA bağlantı hatası: ${err.message}`,
        details: err
      });
      
      // Otomatik yeniden bağlanma
      this._scheduleReconnect();
      
      throw err;
    }
  }
  
  /**
   * Kullanıcı kimlik bilgilerini oluşturur
   * @returns {Object} Kullanıcı kimlik bilgileri
   * @private
   */
  _createUserIdentity() {
    const auth = this.config.connection.authentication;
    
    if (!auth) {
      return {}; // Anonymous
    }
    
    if (auth.type === 'username') {
      return {
        userName: auth.username,
        password: auth.password
      };
    }
    
    if (auth.type === 'certificate') {
      return {
        certificateFile: auth.certificateFile,
        privateKeyFile: auth.privateKeyFile
      };
    }
    
    return {}; // Anonymous
  }
  
  /**
   * Client olaylarını ayarlar
   * @private
   */
  _setupClientEvents() {
    this.client.on('connection_reestablished', () => {
      this.logger.info('OPC UA bağlantısı yeniden kuruldu');
      this.connected = true;
      this.status = 'connected';
      this.emit('reconnect', { timestamp: new Date() });
    });
    
    this.client.on('connection_lost', () => {
      this.logger.warn('OPC UA bağlantısı kesildi');
      this.connected = false;
      this.status = 'disconnected';
      this.emit('disconnect', { timestamp: new Date() });
      this._scheduleReconnect();
    });
    
    this.client.on('close', () => {
      this.logger.info('OPC UA client kapatıldı');
      this.connected = false;
      this.status = 'disconnected';
    });
  }
  
  /**
   * Session olaylarını ayarlar
   * @private
   */
  _setupSessionEvents() {
    this.session.on('session_closed', (statusCode) => {
      this.logger.warn(`OPC UA session kapatıldı: ${statusCode}`);
      this.connected = false;
      this.status = 'disconnected';
      this.emit('disconnect', { timestamp: new Date() });
    });
  }
  
  /**
   * Subscription oluşturur ve monitored item'ları ekler
   * @private
   */
  async _createSubscription() {
    try {
      // Subscription oluştur
      this.subscription = ClientSubscription.create(this.session, {
        requestedPublishingInterval: this.config.options?.publishingInterval || 1000,
        requestedLifetimeCount: this.config.options?.lifetimeCount || 60,
        requestedMaxKeepAliveCount: this.config.options?.maxKeepAliveCount || 10,
        maxNotificationsPerPublish: this.config.options?.maxNotificationsPerPublish || 1000,
        publishingEnabled: true,
        priority: this.config.options?.priority || 10
      });
      
      this.logger.info('OPC UA subscription oluşturuldu');
      
      // Subscription olaylarını dinle
      this.subscription.on('started', () => {
        this.logger.info('OPC UA subscription başlatıldı');
      });
      
      this.subscription.on('terminated', () => {
        this.logger.warn('OPC UA subscription sonlandırıldı');
      });
      
      // Her tag için monitored item oluştur
      for (const [tagName, tag] of this.tags.entries()) {
        await this._createMonitoredItem(tagName, tag);
      }
      
    } catch (err) {
      this.logger.error(`Subscription oluşturma hatası: ${err.message}`);
      throw err;
    }
  }
  
  /**
   * Monitored item oluşturur
   * @param {string} tagName - Tag adı
   * @param {Object} tag - Tag konfigürasyonu
   * @private
   */
  async _createMonitoredItem(tagName, tag) {
    try {
      const nodeId = tag.nodeId || tag.address;
      const samplingInterval = this._parseScanRate(tag.scanRate || '1s');
      
      const itemToMonitor = {
        nodeId: nodeId,
        attributeId: AttributeIds.Value
      };
      
      const monitoringParameters = {
        samplingInterval: samplingInterval,
        discardOldest: true,
        queueSize: tag.queueSize || 1
      };
      
      // Deadband ayarları
      if (tag.deadband && tag.deadband > 0) {
        monitoringParameters.filter = {
          deadbandType: 1, // Absolute deadband
          deadbandValue: tag.deadband
        };
      }
      
      const monitoredItem = ClientMonitoredItem.create(
        this.subscription,
        itemToMonitor,
        monitoringParameters,
        TimestampsToReturn.Both
      );
      
      // Monitored item olaylarını dinle
      monitoredItem.on('changed', (dataValue) => {
        this._handleDataChange(tagName, tag, dataValue);
      });
      
      monitoredItem.on('err', (err) => {
        this.logger.error(`Monitored item hatası (${tagName}): ${err.message}`);
      });
      
      this.monitoredItems.set(tagName, monitoredItem);
      this.logger.debug(`Monitored item oluşturuldu: ${tagName} (${nodeId})`);
      
    } catch (err) {
      this.logger.error(`Monitored item oluşturma hatası (${tagName}): ${err.message}`);
    }
  }
  
  /**
   * Veri değişikliğini işler
   * @param {string} tagName - Tag adı
   * @param {Object} tag - Tag konfigürasyonu
   * @param {Object} dataValue - OPC UA veri değeri
   * @private
   */
  _handleDataChange(tagName, tag, dataValue) {
    try {
      // Veri kalitesini kontrol et
      if (!dataValue.statusCode.isGood()) {
        this.logger.warn(`Kötü veri kalitesi (${tagName}): ${dataValue.statusCode.toString()}`);
        return;
      }
      
      let value = dataValue.value.value;
      const timestamp = dataValue.sourceTimestamp || dataValue.serverTimestamp || new Date();
      
      // Veri tipi dönüşümü
      value = this._convertDataType(value, tag.dataType);
      
      // Deadband kontrolü (eğer local deadband varsa)
      if (tag.deadband && this._shouldApplyDeadband(tagName, value, tag.deadband)) {
        return; // Deadband içinde, veri değişikliği yayınlanmaz
      }
      
      // Veri olayını tetikle
      this.emit('data', {
        name: tagName,
        value: value,
        timestamp: timestamp,
        quality: 'good',
        tag: tag
      });
      
      // Son değeri kaydet (deadband için)
      this._updateLastValue(tagName, value);
      
    } catch (err) {
      this.logger.error(`Veri işleme hatası (${tagName}): ${err.message}`);
    }
  }
  
  /**
   * OPC UA bağlantısını kapatır
   * @returns {Promise<boolean>} Kapatma başarılı ise true döner
   */
  async disconnect() {
    try {
      this.logger.info('OPC UA bağlantısı kapatılıyor...');
      
      // Yeniden bağlanma timer'ını temizle
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      
      // Monitored item'ları temizle
      this.monitoredItems.clear();
      
      // Subscription'ı kapat
      if (this.subscription) {
        await this.subscription.terminate();
        this.subscription = null;
      }
      
      // Session'ı kapat
      if (this.session) {
        await this.session.close();
        this.session = null;
      }
      
      // Client'ı kapat
      if (this.client) {
        await this.client.disconnect();
        this.client = null;
      }
      
      this.connected = false;
      this.status = 'disconnected';
      
      this.logger.info('OPC UA bağlantısı kapatıldı');
      this.emit('disconnect', { timestamp: new Date() });
      
      return true;
    } catch (err) {
      this.logger.error(`OPC UA bağlantı kapatma hatası: ${err.message}`);
      return false;
    }
  }
  
  /**
   * Tek bir tag'i okur
   * @param {string} tagName - Okunacak tag adı
   * @returns {Promise<*>} Tag değeri
   */
  async readTag(tagName) {
    if (!this.connected || !this.session) {
      throw new Error('OPC UA bağlantısı mevcut değil');
    }
    
    const tag = this.tags.get(tagName);
    if (!tag) {
      throw new Error(`Tag bulunamadı: ${tagName}`);
    }
    
    try {
      const nodeId = tag.nodeId || tag.address;
      const dataValue = await this.session.readVariableValue(nodeId);
      
      if (!dataValue.statusCode.isGood()) {
        throw new Error(`Kötü veri kalitesi: ${dataValue.statusCode.toString()}`);
      }
      
      let value = dataValue.value.value;
      value = this._convertDataType(value, tag.dataType);
      
      return value;
    } catch (err) {
      this.logger.error(`Tag okuma hatası (${tagName}): ${err.message}`);
      throw err;
    }
  }
  
  /**
   * Tek bir tag'e yazar
   * @param {string} tagName - Yazılacak tag adı
   * @param {*} value - Yazılacak değer
   * @returns {Promise<boolean>} Yazma başarılı ise true döner
   */
  async writeTag(tagName, value) {
    if (!this.connected || !this.session) {
      throw new Error('OPC UA bağlantısı mevcut değil');
    }
    
    const tag = this.tags.get(tagName);
    if (!tag) {
      throw new Error(`Tag bulunamadı: ${tagName}`);
    }
    
    try {
      const nodeId = tag.nodeId || tag.address;
      
      // Veri tipini dönüştür
      const convertedValue = this._convertDataType(value, tag.dataType);
      
      const statusCode = await this.session.writeSingleNode(nodeId, convertedValue);
      
      if (!statusCode.isGood()) {
        throw new Error(`Yazma hatası: ${statusCode.toString()}`);
      }
      
      this.logger.debug(`Tag yazıldı: ${tagName} = ${convertedValue}`);
      return true;
    } catch (err) {
      this.logger.error(`Tag yazma hatası (${tagName}): ${err.message}`);
      throw err;
    }
  }
  
  /**
   * Yeniden bağlanmayı zamanlar
   * @private
   */
  _scheduleReconnect() {
    if (this.reconnecting || this.reconnectTimer) {
      return;
    }
    
    const reconnectInterval = this.config.connection?.reconnectInterval || 10000;
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      
      if (!this.connected) {
        this.logger.info('OPC UA yeniden bağlanma deneniyor...');
        this.reconnecting = true;
        
        try {
          await this.connect();
          this.reconnecting = false;
        } catch (err) {
          this.reconnecting = false;
          this.logger.error(`Yeniden bağlanma başarısız: ${err.message}`);
          this._scheduleReconnect(); // Tekrar dene
        }
      }
    }, reconnectInterval);
  }
  
  /**
   * Veri tipi dönüşümü
   * @param {*} value - Ham değer
   * @param {string} dataType - Veri tipi
   * @returns {*} Dönüştürülmüş değer
   */
  _convertDataType(value, dataType) {
    switch (dataType?.toLowerCase()) {
      case 'boolean':
        return Boolean(value);
      case 'int16':
      case 'int32':
      case 'uint16':
      case 'uint32':
        return parseInt(value, 10);
      case 'float':
      case 'double':
        return parseFloat(value);
      case 'string':
        return String(value);
      default:
        return value;
    }
  }

  /**
   * Scan rate'i milisaniyeye çevirir
   * @param {string|number} scanRate - Scan rate
   * @returns {number} Milisaniye cinsinden scan rate
   */
  _parseScanRate(scanRate) {
    if (typeof scanRate === 'number') {
      return scanRate;
    }
    
    if (typeof scanRate === 'string') {
      const match = scanRate.match(/^(\d+)(ms|s|m|h)?$/i);
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = (match[2] || 'ms').toLowerCase();
        
        switch (unit) {
          case 'ms':
            return value;
          case 's':
            return value * 1000;
          case 'm':
            return value * 60 * 1000;
          case 'h':
            return value * 60 * 60 * 1000;
          default:
            return value;
        }
      }
    }
    
    return 1000; // Varsayılan 1 saniye
  }

  /**
   * Deadband kontrolü yapar
   * @param {string} tagName - Tag adı
   * @param {*} value - Yeni değer
   * @param {number} deadband - Deadband değeri
   * @returns {boolean} Deadband uygulanmalı mı
   */
  _shouldApplyDeadband(tagName, value, deadband) {
    if (!this.lastValues.has(tagName)) {
      return false;
    }
    
    const lastValue = this.lastValues.get(tagName);
    if (typeof value === 'number' && typeof lastValue === 'number') {
      const diff = Math.abs(value - lastValue);
      return diff < deadband;
    }
    
    return false;
  }

  /**
   * Son değeri günceller
   * @param {string} tagName - Tag adı
   * @param {*} value - Değer
   */
  _updateLastValue(tagName, value) {
    this.lastValues.set(tagName, value);
  }

  /**
   * Adaptör durumunu döndürür
   * @returns {Object} Adaptör durumu
   */
  getStatus() {
    return {
      ...super.getStatus(),
      connected: this.connected,
      endpoint: this.config?.connection?.endpoint,
      sessionId: this.session?.sessionId?.toString(),
      subscriptionId: this.subscription?.subscriptionId,
      monitoredItemCount: this.monitoredItems.size,
      securityMode: this.securityMode,
      securityPolicy: this.securityPolicy
    };
  }
}

module.exports = OPCUAAdapter; 