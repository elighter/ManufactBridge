/**
 * ManufactBridge Edge Connector - Base Protocol Adapter
 * 
 * Bu sınıf, tüm protokol adaptörleri için temel sınıf olarak hizmet verir.
 * Protokol adaptörleri bu sınıfı genişleterek kendi özel işlevlerini eklerken
 * temel protokol fonksiyonlarını miras alır.
 */

const EventEmitter = require('eventemitter3');
const winston = require('winston');
const config = require('./config');

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
   * Konfigürasyon doğrulama metodu
   * @throws {Error} Konfigürasyon geçerli değilse hata fırlatır
   */
  validateConfig() {
    if (!this.options) {
      throw new Error('Adaptör konfigürasyonu gereklidir');
    }
    
    if (!this.options.name) {
      this.logger.warn('Adaptör adı belirtilmemiş, varsayılan ad kullanılıyor');
    }
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
   * Tag'leri tanımlar (alias for addTags)
   * @param {Array|Object} tags Eklenecek tag'ler
   * @returns {Promise<boolean>} İşlemin başarı durumu
   */
  async defineTags(tags) {
    return this.addTags(tags);
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
      
      // Değerleri güncelle
      tag.lastValue = value;
      tag.lastTimestamp = timestamp;
      tag.quality = quality;
      tag.statusCode = statusCode;
      
      // Veri objesi hazırla
      const dataObject = {
        name: tagName,
        value: value,
        timestamp: timestamp instanceof Date ? timestamp : new Date(timestamp),
        quality: quality,
        statusCode: statusCode,
        tag: { ...tag }
      };
      
      // Olayı yayınla
      this.emit('data', dataObject);
      this.logger.debug(`Veri olayı yayınlandı: ${tagName} = ${value}`);
    } else {
      this.logger.warn(`Tanımsız tag için veri olayı oluşturulamadı: ${tagName}`);
    }
  }
  
  /**
   * Değişiklik tabanlı yayınlama için değer kontrolü yapar
   * @param {Object} tag Tag objesi
   * @param {*} newValue Yeni değer
   * @returns {boolean} Değerin yayınlanıp yayınlanmaması gerektiği
   * @private
   */
  _shouldEmitValue(tag, newValue) {
    // İlk değer her zaman yayınlanır
    if (tag.lastValue === null) {
      return true;
    }
    
    // Değer tipine göre kontrol
    const valueType = typeof newValue;
    const oldValue = tag.lastValue;
    
    // Değişiklik kontrolü (deadband)
    if (tag.deadband && valueType === 'number' && typeof oldValue === 'number') {
      const diff = Math.abs(newValue - oldValue);
      // Değişiklik farkı deadband değerinden küçükse yayınlama
      if (diff < tag.deadband) {
        return false;
      }
    } else if (newValue === oldValue) {
      // String, boolean vb. türler için sadece farklı değerleri yayınla
      return false;
    }
    
    return true;
  }
  
  /**
   * Hata olayı oluşturur
   * @param {Error|string} error Hata objesi veya mesajı
   * @param {string} tagName İsteğe bağlı tag ismi
   * @private
   */
  _emitError(error, tagName = null) {
    const errorObj = error instanceof Error ? error : new Error(error);
    
    const errorData = {
      message: errorObj.message,
      name: errorObj.name,
      stack: errorObj.stack,
      adapterId: this.id,
      adapterName: this.name,
      tagName: tagName
    };
    
    this.emit('error', errorData);
    this.logger.error(`Hata: ${errorObj.message}`, errorData);
  }
}

module.exports = BaseAdapter; 