/**
 * @fileoverview ManufactBridge - Connector Manager Sınıfı
 * Bu sınıf, farklı protokol adaptörlerini yönetir ve UNS'ye veri aktarımını koordine eder.
 */

const EventEmitter = require('events');
const BaseAdapter = require('./base-adapter');

class ConnectorManager extends EventEmitter {
  /**
   * Connector Manager constructor'ı
   * @param {Object} options - Opsiyonel konfigürasyon seçenekleri
   */
  constructor(options = {}) {
    super();
    
    this.connectors = new Map();
    this.unsPublisher = options.unsPublisher || null;
    this.dataCache = new Map();
    this.status = 'stopped';
    this.options = {
      autoReconnect: options.autoReconnect !== undefined ? options.autoReconnect : true,
      reconnectInterval: options.reconnectInterval || 5000,
      dataBufferSize: options.dataBufferSize || 1000,
      ...options
    };
    
    this._setupUnsPublisher();
  }
  
  /**
   * UNS Publisher'ı yapılandırır
   * @private
   */
  _setupUnsPublisher() {
    if (!this.unsPublisher) {
      console.warn('UNS Publisher yapılandırılmadı. Veriler UNS\'ye gönderilemeyecek.');
      return;
    }
    
    // UNS Publisher olaylarını dinleme
    this.unsPublisher.on('error', (err) => {
      this.emit('error', {
        source: 'UNS Publisher',
        message: err.message,
        details: err
      });
    });
    
    this.unsPublisher.on('published', (data) => {
      this.emit('data-published', data);
    });
  }
  
  /**
   * Yeni bir konnektör ekler
   * @param {string} id - Konnektör ID'si
   * @param {BaseAdapter} connector - BaseAdapter'dan türeyen konnektör nesnesi
   * @returns {boolean} Ekleme başarılı ise true döner
   */
  addConnector(id, connector) {
    if (!connector || !(connector instanceof BaseAdapter)) {
      throw new Error('Konnektör, BaseAdapter sınıfından türetilmiş olmalıdır');
    }
    
    if (this.connectors.has(id)) {
      throw new Error(`${id} ID'si ile bir konnektör zaten mevcut`);
    }
    
    // Konnektör olaylarını dinleme
    connector.on('data', (data) => this._handleConnectorData(id, data));
    connector.on('error', (err) => this._handleConnectorError(id, err));
    connector.on('connect', () => this._handleConnectorConnect(id));
    connector.on('disconnect', () => this._handleConnectorDisconnect(id));
    
    this.connectors.set(id, connector);
    
    this.emit('connector-added', {
      id,
      connector: connector.getStatus()
    });
    
    return true;
  }
  
  /**
   * Konnektör nesnesini kaldırır
   * @param {string} id - Kaldırılacak konnektör ID'si
   * @returns {boolean} Silme işlemi başarılı ise true döner
   */
  removeConnector(id) {
    if (!this.connectors.has(id)) {
      throw new Error(`${id} ID'si ile bir konnektör bulunamadı`);
    }
    
    const connector = this.connectors.get(id);
    
    // Önce bağlantıyı kapat
    if (connector.connected) {
      try {
        connector.disconnect();
      } catch (err) {
        console.error(`Konnektör bağlantısı kapatılırken hata: ${err.message}`);
      }
    }
    
    this.connectors.delete(id);
    
    this.emit('connector-removed', { id });
    
    return true;
  }
  
  /**
   * Tüm konnektörleri başlatır
   * @returns {Promise<Object>} Başlatma sonuçlarını içeren nesne
   */
  async start() {
    if (this.status === 'running') {
      return { success: true, message: 'Connector Manager zaten çalışıyor' };
    }
    
    this.status = 'starting';
    this.emit('starting');
    
    const results = {
      success: true,
      connectors: {}
    };
    
    // Tüm konnektörleri başlatma
    for (const [id, connector] of this.connectors.entries()) {
      try {
        await connector.connect();
        results.connectors[id] = { success: true };
      } catch (err) {
        results.success = false;
        results.connectors[id] = { 
          success: false, 
          error: err.message 
        };
        
        this.emit('error', {
          source: id,
          message: `Konnektör başlatma hatası: ${err.message}`,
          details: err
        });
        
        // Otomatik yeniden bağlanma etkinse, zamanlayıcı kur
        if (this.options.autoReconnect) {
          this._setupReconnectTimer(id);
        }
      }
    }
    
    this.status = results.success ? 'running' : 'partial';
    this.emit('started', results);
    
    return results;
  }
  
  /**
   * Tüm konnektörleri durdurur
   * @returns {Promise<Object>} Durdurma sonuçlarını içeren nesne
   */
  async stop() {
    if (this.status === 'stopped') {
      return { success: true, message: 'Connector Manager zaten durdurulmuş' };
    }
    
    this.status = 'stopping';
    this.emit('stopping');
    
    const results = {
      success: true,
      connectors: {}
    };
    
    // Tüm konnektörleri durdurma
    for (const [id, connector] of this.connectors.entries()) {
      try {
        await connector.disconnect();
        results.connectors[id] = { success: true };
      } catch (err) {
        results.success = false;
        results.connectors[id] = { 
          success: false, 
          error: err.message 
        };
        
        this.emit('error', {
          source: id,
          message: `Konnektör durdurma hatası: ${err.message}`,
          details: err
        });
      }
    }
    
    this.status = 'stopped';
    this.emit('stopped', results);
    
    return results;
  }
  
  /**
   * Konnektörden gelen veriyi işler
   * @param {string} id - Konnektör ID'si
   * @param {Object} data - Konnektörden gelen veri
   * @private
   */
  _handleConnectorData(id, data) {
    this.emit('data-received', {
      source: id,
      data
    });
    
    // Veriyi önbelleğe al
    this.dataCache.set(`${id}:${data.topic || 'default'}`, {
      timestamp: new Date(),
      data
    });
    
    // Veri önbelleği boyutunu kontrol et
    if (this.dataCache.size > this.options.dataBufferSize) {
      // En eski veriyi çıkar (basitleştirilmiş yaklaşım)
      const oldestKey = [...this.dataCache.keys()][0];
      this.dataCache.delete(oldestKey);
    }
    
    // UNS'ye veriyi gönder
    if (this.unsPublisher) {
      try {
        this.unsPublisher.publish(data.topic, data.payload);
      } catch (err) {
        this.emit('error', {
          source: 'UNS Publisher',
          message: `Veri yayınlama hatası: ${err.message}`,
          details: err
        });
      }
    }
  }
  
  /**
   * Konnektör hatasını işler
   * @param {string} id - Konnektör ID'si
   * @param {Error} err - Hata nesnesi
   * @private
   */
  _handleConnectorError(id, err) {
    this.emit('connector-error', {
      source: id,
      message: err.message,
      details: err
    });
  }
  
  /**
   * Konnektör bağlantı olayını işler
   * @param {string} id - Konnektör ID'si
   * @private
   */
  _handleConnectorConnect(id) {
    this.emit('connector-connected', { id });
  }
  
  /**
   * Konnektör bağlantı kesme olayını işler
   * @param {string} id - Konnektör ID'si
   * @private
   */
  _handleConnectorDisconnect(id) {
    this.emit('connector-disconnected', { id });
    
    // Otomatik yeniden bağlanma etkinse, zamanlayıcı kur
    if (this.options.autoReconnect) {
      this._setupReconnectTimer(id);
    }
  }
  
  /**
   * Konnektör için yeniden bağlanma zamanlayıcısı kurar
   * @param {string} id - Konnektör ID'si
   * @private
   */
  _setupReconnectTimer(id) {
    const connector = this.connectors.get(id);
    if (!connector) return;
    
    // Eski zamanlayıcıyı temizle
    if (connector._reconnectTimer) {
      clearTimeout(connector._reconnectTimer);
    }
    
    // Yeni zamanlayıcı kur
    connector._reconnectTimer = setTimeout(async () => {
      try {
        this.emit('connector-reconnecting', { id });
        await connector.connect();
      } catch (err) {
        this.emit('error', {
          source: id,
          message: `Yeniden bağlantı hatası: ${err.message}`,
          details: err
        });
        // Yeniden deneme zamanlayıcısını tekrar kur
        this._setupReconnectTimer(id);
      }
    }, this.options.reconnectInterval);
  }
  
  /**
   * Tüm konnektörlerin durumunu döndürür
   * @returns {Object} Konnektör durumlarını içeren nesne
   */
  getStatus() {
    const connectorStatus = {};
    
    for (const [id, connector] of this.connectors.entries()) {
      connectorStatus[id] = connector.getStatus();
    }
    
    return {
      status: this.status,
      connectorCount: this.connectors.size,
      cacheSize: this.dataCache.size,
      connectors: connectorStatus
    };
  }
}

module.exports = ConnectorManager; 