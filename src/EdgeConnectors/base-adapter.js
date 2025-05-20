/**
 * @fileoverview ManufactBridge - Temel Protokol Adaptör Sınıfı
 * Bu sınıf, tüm protokol adaptörleri için temel fonksiyonelliği sağlar.
 */

class BaseAdapter {
  /**
   * Temel adaptör sınıfı constructor'ı
   * @param {Object} config - Adaptör konfigürasyonu
   */
  constructor(config) {
    if (this.constructor === BaseAdapter) {
      throw new Error('BaseAdapter sınıfı doğrudan örneklenemez. Lütfen alt sınıf kullanın.');
    }
    
    this.config = config || {};
    this.status = 'disconnected';
    this.connected = false;
    this.lastError = null;
    this.tags = new Map();
    this.eventHandlers = {};
    
    // Konfigürasyon doğrulama
    this.validateConfig();
  }
  
  /**
   * Konfigürasyon doğrulama metodu - alt sınıflar tarafından uygulanmalıdır
   * @throws {Error} Konfigürasyon geçerli değilse hata fırlatır
   */
  validateConfig() {
    if (!this.config) {
      throw new Error('Geçerli bir konfigürasyon gereklidir');
    }
    
    // Alt sınıflar tarafından genişletilecek temel doğrulama
    if (!this.config.id) {
      throw new Error('Adaptör ID değeri gereklidir');
    }
  }
  
  /**
   * Cihaz/sistem bağlantısını başlatır
   * @returns {Promise<boolean>} Bağlantı başarılı ise true döner
   */
  async connect() {
    throw new Error('connect() metodu alt sınıflar tarafından uygulanmalıdır');
  }
  
  /**
   * Cihaz/sistem bağlantısını kapatır
   * @returns {Promise<boolean>} Bağlantı başarıyla kapatıldıysa true döner
   */
  async disconnect() {
    throw new Error('disconnect() metodu alt sınıflar tarafından uygulanmalıdır');
  }
  
  /**
   * Tag tanımlama ve listeleme
   * @param {Array<Object>} tags - Tag listesi, her tag bir nesne olarak tanımlanır
   * @returns {Promise<boolean>} Tag'ler başarıyla tanımlandıysa true döner
   */
  async defineTags(tags) {
    if (!Array.isArray(tags)) {
      throw new Error('tags parametresi bir dizi olmalıdır');
    }
    
    for (const tag of tags) {
      if (!tag.name || !tag.address) {
        throw new Error('Her tag için name ve address alanları gereklidir');
      }
      
      this.tags.set(tag.name, {
        address: tag.address,
        dataType: tag.dataType || 'string',
        scanRate: tag.scanRate || '1s',
        deadband: tag.deadband || 0,
        lastValue: null,
        lastUpdate: null,
        quality: 'unknown'
      });
    }
    
    return true;
  }
  
  /**
   * Tekli tag verisi okuma
   * @param {string} tagName - Okunacak tag'in adı
   * @returns {Promise<Object>} Tag değeri, zaman damgası ve kalite bilgisini içeren nesne
   */
  async readTag(tagName) {
    throw new Error('readTag() metodu alt sınıflar tarafından uygulanmalıdır');
  }
  
  /**
   * Çoklu tag verisi okuma
   * @param {Array<string>} tagNames - Okunacak tag'lerin adları
   * @returns {Promise<Object>} Tag değerleri, zaman damgası ve kalite bilgilerini içeren nesne
   */
  async readTags(tagNames) {
    throw new Error('readTags() metodu alt sınıflar tarafından uygulanmalıdır');
  }
  
  /**
   * Yazma işlemini destekleyen adaptörler için tag değeri yazma
   * @param {string} tagName - Yazılacak tag'in adı
   * @param {*} value - Yazılacak değer
   * @returns {Promise<boolean>} Yazma başarılı ise true döner
   */
  async writeTag(tagName, value) {
    throw new Error('writeTag() metodu alt sınıflar tarafından uygulanmalıdır');
  }
  
  /**
   * Tag değerini UNS formatına dönüştürme
   * @param {string} tagName - Tag adı
   * @param {*} value - Tag değeri
   * @param {string} quality - Veri kalitesi
   * @returns {Object} UNS formatında veri nesnesi
   */
  formatTagForUNS(tagName, value, quality = 'good') {
    const tag = this.tags.get(tagName);
    if (!tag) {
      throw new Error(`Tag bulunamadı: ${tagName}`);
    }
    
    const timestamp = new Date().toISOString();
    
    return {
      topic: this.generateTopicForTag(tagName),
      payload: {
        timestamp: timestamp,
        value: value,
        quality: quality,
        metadata: {
          dataType: tag.dataType,
          source: this.config.id,
          tagAddress: tag.address
        }
      }
    };
  }
  
  /**
   * Tag için UNS topic yolu oluşturma
   * @param {string} tagName - Tag adı
   * @returns {string} UNS topic yolu
   */
  generateTopicForTag(tagName) {
    // Alt sınıflar tarafından özelleştirilebilir
    // Varsayılan: ISA-95 temelli hiyerarşi
    
    const mapping = this.config.mapping || {};
    const baseTopic = mapping.topic || `manufactbridge/default/default/default/default/default/data`;
    
    return `${baseTopic}/${tagName}`;
  }
  
  /**
   * Olay dinleyici ekler
   * @param {string} event - Olay adı ('data', 'error', 'connect', 'disconnect')
   * @param {Function} callback - Olay gerçekleştiğinde çağrılacak fonksiyon
   */
  on(event, callback) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(callback);
  }
  
  /**
   * Olay tetikler
   * @param {string} event - Tetiklenecek olay adı
   * @param {*} data - Olay ile ilgili veri
   */
  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(callback => callback(data));
    }
  }
  
  /**
   * Durumu al
   * @returns {Object} Adaptörün mevcut durumunu içeren nesne
   */
  getStatus() {
    return {
      id: this.config.id,
      type: this.config.type,
      protocol: this.config.protocol,
      status: this.status,
      connected: this.connected,
      lastError: this.lastError,
      tagCount: this.tags.size
    };
  }
}

module.exports = BaseAdapter; 