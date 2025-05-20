/**
 * ManufactBridge Edge Connector - Temel Protokol Adaptörü
 * 
 * Bu sınıf, tüm protokol adaptörleri için temel sınıf olarak hizmet verir.
 * Protokol adaptörleri bu sınıfı genişleterek kendi özel işlevlerini eklerken
 * temel protokol fonksiyonlarını miras alır.
 */

const EventEmitter = require('eventemitter3');
const winston = require('winston');
const config = require('../config');

class BaseAdapter extends EventEmitter {
  /**
   * Temel Adaptör sınıfı
   * @param {Object} options Adaptör seçenekleri
   */
  constructor(options = {}) {
    super();
    
    this.options = options;
    this.name = options.name || 'unnamed-adapter';
    this.id = options.id || `adapter-${Date.now()}`;
    this.type = 'base';
    this.connected = false;
    this.tags = new Map();
    this.connection = null;
    
    // Logger yapılandırması
    this.logger = winston.createLogger({
      level: config.logging.level || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { 
        service: 'edge-connector',
        adapter: this.name,
        adapterId: this.id 
      },
      transports: [
        new winston.transports.Console(),
        config.logging.file_enabled ? 
          new winston.transports.File({ 
            filename: config.logging.file_path,
            maxsize: this._parseFileSize(config.logging.max_file_size),
            maxFiles: config.logging.max_files
          }) : null
      ].filter(Boolean)
    });
    
    this.logger.info(`${this.name} (${this.type}) adaptör oluşturuldu`);
  }
  
  /**
   * Boyut string'ini byte'a çevirir (örn: "10m" -> 10485760)
   * @param {string} sizeStr Boyut string'i
   * @returns {number} Byte cinsinden boyut
   * @private
   */
  _parseFileSize(sizeStr) {
    if (typeof sizeStr !== 'string') return sizeStr;
    
    const units = {
      'k': 1024,
      'm': 1024 * 1024,
      'g': 1024 * 1024 * 1024
    };
    
    const match = sizeStr.match(/^(\d+)([kmg])$/i);
    if (match) {
      const size = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      return size * units[unit];
    }
    
    return parseInt(sizeStr, 10);
  }
  
  /**
   * Adaptörü başlatır ve bağlantıyı kurar
   * @returns {Promise} Başarılıysa resolve olan Promise
   */
  async connect() {
    this.logger.info(`${this.name} adaptörü bağlanıyor...`);
    throw new Error('connect() metodu alt sınıfta uygulanmalıdır');
  }
  
  /**
   * Adaptörü durdurur ve bağlantıyı kapatır
   * @returns {Promise} Başarılıysa resolve olan Promise
   */
  async disconnect() {
    this.logger.info(`${this.name} adaptörü bağlantısı kesiliyor...`);
    throw new Error('disconnect() metodu alt sınıfta uygulanmalıdır');
  }
  
  /**
   * Tag'leri tanımlar ve ekler
   * @param {Array|Object} tags Eklenecek tag'ler (array veya tekil obje)
   * @returns {boolean} İşlemin başarı durumu
   */
  addTags(tags) {
    try {
      const tagList = Array.isArray(tags) ? tags : [tags];
      
      tagList.forEach(tag => {
        // Tag doğrulama
        if (!tag.name) {
          throw new Error('Tag name gereklidir');
        }
        
        // Tag'i ekle veya güncelle
        this.tags.set(tag.name, {
          ...tag,
          lastValue: null,
          lastTimestamp: null,
          quality: 'unknown',
          statusCode: 0
        });
        
        this.logger.debug(`Tag eklendi: ${tag.name}`);
      });
      
      this.logger.info(`${tagList.length} tag eklendi`);
      return true;
    } catch (error) {
      this.logger.error(`Tag ekleme hatası: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Tag'leri kaldırır
   * @param {Array|string} tagNames Kaldırılacak tag isimleri (array veya tekil string)
   * @returns {boolean} İşlemin başarı durumu
   */
  removeTags(tagNames) {
    try {
      const tagList = Array.isArray(tagNames) ? tagNames : [tagNames];
      
      let removedCount = 0;
      tagList.forEach(tagName => {
        if (this.tags.has(tagName)) {
          this.tags.delete(tagName);
          removedCount++;
          this.logger.debug(`Tag kaldırıldı: ${tagName}`);
        } else {
          this.logger.warn(`Tag bulunamadı: ${tagName}`);
        }
      });
      
      this.logger.info(`${removedCount} tag kaldırıldı`);
      return true;
    } catch (error) {
      this.logger.error(`Tag kaldırma hatası: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Tanımlı tag'leri döndürür
   * @returns {Array} Tag listesi
   */
  getTags() {
    return Array.from(this.tags.entries()).map(([name, tag]) => ({
      name,
      ...tag
    }));
  }
  
  /**
   * Tek bir tag'i döndürür
   * @param {string} tagName Tag ismi
   * @returns {Object|null} Tag objesi veya bulunamazsa null
   */
  getTag(tagName) {
    if (this.tags.has(tagName)) {
      const tag = this.tags.get(tagName);
      return {
        name: tagName,
        ...tag
      };
    }
    return null;
  }
  
  /**
   * Aktif okuma yapar (polling)
   * @param {Array|string} tagNames Okunacak tag isimleri (array, tekil string veya tümü için null/undefined)
   * @returns {Promise<Object>} Tag değerleri objesi
   */
  async read(tagNames) {
    this.logger.debug(`read() metodu çağrıldı: ${tagNames}`);
    throw new Error('read() metodu alt sınıfta uygulanmalıdır');
  }
  
  /**
   * Tag'e değer yazar
   * @param {string} tagName Yazılacak tag ismi
   * @param {*} value Yazılacak değer
   * @returns {Promise<boolean>} İşlemin başarı durumu
   */
  async write(tagName, value) {
    this.logger.debug(`write() metodu çağrıldı: ${tagName} = ${value}`);
    throw new Error('write() metodu alt sınıfta uygulanmalıdır');
  }
  
  /**
   * Çoklu tag'e değer yazar
   * @param {Object} tagValues Tag isimleri ve değerleri içeren obje
   * @returns {Promise<Object>} Her tag için başarı durumu içeren obje
   */
  async writeMultiple(tagValues) {
    this.logger.debug(`writeMultiple() metodu çağrıldı: ${JSON.stringify(tagValues)}`);
    throw new Error('writeMultiple() metodu alt sınıfta uygulanmalıdır');
  }
  
  /**
   * Adaptör durumunu döndürür
   * @returns {Object} Durum objesi
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      connected: this.connected,
      tagCount: this.tags.size,
      options: { ...this.options }
    };
  }
  
  /**
   * Yeni değer alındığında veri olayı oluşturur
   * @param {string} tagName Tag ismi
   * @param {*} value Tag değeri
   * @param {Date|string} timestamp Zaman damgası
   * @param {string} quality Veri kalitesi
   * @param {number} statusCode İsteğe bağlı durum kodu
   * @private
   */
  _emitData(tagName, value, timestamp = new Date(), quality = 'good', statusCode = 0) {
    // Tag'i güncelle
    if (this.tags.has(tagName)) {
      const tag = this.tags.get(tagName);
      
      // Değişiklik tabanlı yayınlama kontrolü
      const shouldEmit = this._shouldEmitValue(tag, value);
      if (!shouldEmit) {
        return;
      }
      
      // Tag'i güncelle
      this.tags.set(tagName, {
        ...tag,
        lastValue: value,
        lastTimestamp: timestamp,
        quality,
        statusCode
      });
      
      // Veriyi yayınla
      this.emit('data', tagName, value, timestamp, quality, statusCode);
      this.logger.debug(`Veri alındı: ${tagName} = ${value} [${quality}]`);
    } else {
      this.logger.warn(`Bilinmeyen tag için veri alındı: ${tagName}`);
    }
  }
  
  /**
   * Değerin yayınlanması gerekip gerekmediğini kontrol eder
   * @param {Object} tag Tag objesi
   * @param {*} newValue Yeni değer
   * @returns {boolean} Yayınlanacaksa true
   * @private
   */
  _shouldEmitValue(tag, newValue) {
    // İlk değer her zaman yayınlanır
    if (tag.lastValue === null) {
      return true;
    }
    
    // Değişiklik tabanlı filtreleme (deadband)
    if (tag.deadband && typeof tag.lastValue === 'number' && typeof newValue === 'number') {
      const diff = Math.abs(newValue - tag.lastValue);
      return diff >= tag.deadband;
    }
    
    // Değer değişimi kontrolü
    if (tag.emitOnChange !== false) {
      // String, number gibi basit tipler için === operatörü
      if (typeof tag.lastValue !== 'object' && typeof newValue !== 'object') {
        return tag.lastValue !== newValue;
      }
      
      // Obje karşılaştırması
      return JSON.stringify(tag.lastValue) !== JSON.stringify(newValue);
    }
    
    // Her değer yayınlanacak
    return true;
  }
  
  /**
   * Hata durumunu raporlar
   * @param {Error|string} error Hata objesi veya mesajı
   * @param {string} tagName İsteğe bağlı - etkilenen tag ismi
   * @private
   */
  _emitError(error, tagName = null) {
    const errorMsg = error instanceof Error ? error.message : error;
    this.logger.error(`Hata: ${errorMsg}${tagName ? ` (tag: ${tagName})` : ''}`);
    
    this.emit('error', {
      message: errorMsg,
      tagName,
      timestamp: new Date(),
      adapter: this.name,
      adapterId: this.id
    });
  }
}

module.exports = BaseAdapter;