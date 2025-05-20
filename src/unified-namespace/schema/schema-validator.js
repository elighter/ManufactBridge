/**
 * Şema Doğrulama Modülü
 * 
 * Bu modül, ManufactBridge UNS içindeki mesajların şema doğrulamasını
 * gerçekleştirir. Sparkplug B, JSON Schema ve özel şema doğrulama
 * mekanizmaları desteklenir.
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Winston logger konfigürasyonu
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'schema-validator' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/schema-validator.log' })
  ]
});

class SchemaValidator {
  constructor(options = {}) {
    this.options = Object.assign({
      enabled: config.schema_validation.enabled !== false,
      sparkplugCompatible: config.schema_validation.sparkplug_compatible !== false,
      customSchemasPath: config.schema_validation.custom_schemas_path || './schemas',
      strictValidation: config.schema_validation.strict_validation || false,
      cacheSchemas: true
    }, options);

    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      validateFormats: true
    });

    // AJV formatlarını ekle
    addFormats(this.ajv);

    // Topicler için şema eşleştirmeleri
    this.schemaMap = new Map();
    
    // Şema önbellekleme
    this.schemaCache = new Map();
    
    // Sparkplug B şeması
    if (this.options.sparkplugCompatible) {
      this._initSparkplugSchemas();
    }
    
    // Özel şemaları yükle
    this._loadCustomSchemas();
  }

  /**
   * Sparkplug B şemalarını başlatır
   * @private
   */
  _initSparkplugSchemas() {
    try {
      // Temel Sparkplug B şeması
      const sparkplugBSchema = {
        type: 'object',
        required: ['timestamp'],
        properties: {
          timestamp: { type: 'string', format: 'date-time' },
          metrics: {
            type: 'object',
            additionalProperties: true
          },
          seq: { type: 'integer' },
          uuid: { type: 'string' },
          body: { type: 'string' }
        },
        additionalProperties: true
      };
      
      // Kompleks datatype'lar için ek şemalar eklenebilir
      
      // Sparkplug şemasını kaydet
      this.ajv.addSchema(sparkplugBSchema, 'sparkplugB');
      
      logger.info('Sparkplug B şemaları başarıyla yüklendi');
    } catch (error) {
      logger.error(`Sparkplug B şemaları yüklenemedi: ${error.message}`);
    }
  }

  /**
   * Özel şemaları yükler
   * @private
   */
  _loadCustomSchemas() {
    try {
      if (!this.options.customSchemasPath || !fs.existsSync(this.options.customSchemasPath)) {
        logger.warn(`Özel şema dizini bulunamadı: ${this.options.customSchemasPath}`);
        return;
      }
      
      const schemaFiles = fs.readdirSync(this.options.customSchemasPath)
        .filter(file => file.endsWith('.json'));
      
      for (const file of schemaFiles) {
        try {
          const filePath = path.join(this.options.customSchemasPath, file);
          const schemaContent = fs.readFileSync(filePath, 'utf8');
          const schema = JSON.parse(schemaContent);
          
          // Gerekli şema bilgilerini kontrol et
          if (!schema.id || !schema.schema) {
            logger.warn(`Geçersiz şema formatı: ${file}`);
            continue;
          }
          
          // Şemayı AJV'ye ekle
          this.ajv.addSchema(schema.schema, schema.id);
          
          // Topic eşleştirmelerini ayarla
          if (schema.topicPatterns && Array.isArray(schema.topicPatterns)) {
            for (const pattern of schema.topicPatterns) {
              this.schemaMap.set(pattern, schema.id);
            }
          }
          
          logger.info(`Şema yüklendi: ${schema.id} (${file})`);
        } catch (error) {
          logger.error(`Şema yükleme hatası (${file}): ${error.message}`);
        }
      }
      
      logger.info(`Toplam ${this.schemaMap.size} topic-şema eşleştirmesi yüklendi`);
    } catch (error) {
      logger.error(`Özel şemaları yükleme hatası: ${error.message}`);
    }
  }

  /**
   * Bir topic için uygun şema ID'sini bulur
   * @param {string} topic Doğrulanacak mesajın topic'i
   * @returns {string|null} Şema ID veya bulunamazsa null
   * @private
   */
  _findSchemaIdForTopic(topic) {
    // Önce tam eşleşme kontrol et
    if (this.schemaMap.has(topic)) {
      return this.schemaMap.get(topic);
    }
    
    // Topic pattern eşleşmelerini kontrol et
    for (const [pattern, schemaId] of this.schemaMap.entries()) {
      // # ve + joker karakterleri içeren pattern eşleşmeleri için
      if (this._topicMatchesPattern(topic, pattern)) {
        return schemaId;
      }
    }
    
    // Sparkplug B uyumluluğu etkinse varsayılan şema
    if (this.options.sparkplugCompatible) {
      return 'sparkplugB';
    }
    
    return null;
  }

  /**
   * Bir topic'in belirli bir pattern'a uyup uymadığını kontrol eder
   * @param {string} topic Kontrol edilecek topic
   * @param {string} pattern Kontrol edilecek pattern
   * @returns {boolean} Eşleşiyorsa true, değilse false
   * @private
   */
  _topicMatchesPattern(topic, pattern) {
    const topicParts = topic.split('/');
    const patternParts = pattern.split('/');
    
    // # joker karakteri tek başınaysa her şeyi eşleştirir
    if (patternParts.length === 1 && patternParts[0] === '#') {
      return true;
    }
    
    for (let i = 0; i < patternParts.length; i++) {
      // Topic daha kısaysa ve pattern'da # yoksa eşleşme olmaz
      if (i >= topicParts.length) {
        return patternParts[i] === '#' && i === patternParts.length - 1;
      }
      
      const patternPart = patternParts[i];
      const topicPart = topicParts[i];
      
      // # joker karakteri: Kalan tüm seviyeleri eşleştirir
      if (patternPart === '#') {
        return true;
      }
      
      // + joker karakteri: Tek bir seviyeyi eşleştirir
      if (patternPart !== '+' && patternPart !== topicPart) {
        return false;
      }
    }
    
    // Pattern tüm topic segmentlerini kapsamalı
    return topicParts.length === patternParts.length;
  }

  /**
   * Mesajın içeriğini JSON'a dönüştürür
   * @param {string|object|Buffer} message Mesaj içeriği
   * @returns {object} JSON formatında mesaj
   * @private
   */
  _parseMessage(message) {
    try {
      if (typeof message === 'string') {
        return JSON.parse(message);
      } else if (message instanceof Buffer) {
        return JSON.parse(message.toString('utf8'));
      } else if (typeof message === 'object') {
        return message;
      }
      
      throw new Error('Desteklenmeyen mesaj formatı');
    } catch (error) {
      throw new Error(`Mesaj ayrıştırma hatası: ${error.message}`);
    }
  }

  /**
   * Bir mesajın şemasını doğrular
   * @param {string} topic Mesajın topic'i
   * @param {string|object|Buffer} message Mesaj içeriği
   * @returns {object} Doğrulama sonucu {valid: boolean, errors: array}
   */
  validateMessage(topic, message) {
    // Doğrulama devre dışı bırakılmışsa her zaman geçerli kabul et
    if (!this.options.enabled) {
      return { valid: true, errors: null };
    }
    
    try {
      // Şema ID'sini bul
      const schemaId = this._findSchemaIdForTopic(topic);
      
      // Eğer topic için bir şema yoksa
      if (!schemaId) {
        // Sıkı doğrulama modunda hata döndür
        if (this.options.strictValidation) {
          return {
            valid: false,
            errors: ['Bu topic için tanımlı bir şema bulunamadı']
          };
        }
        
        // Sıkı doğrulama modu değilse geçerli kabul et
        logger.debug(`Topic için şema bulunamadı, doğrulama atlanıyor: ${topic}`);
        return { valid: true, errors: null };
      }
      
      // Mesajı JSON'a dönüştür
      const messageObj = this._parseMessage(message);
      
      // Şema doğrulama fonksiyonunu önbellekten al veya oluştur
      let validate;
      if (this.options.cacheSchemas && this.schemaCache.has(schemaId)) {
        validate = this.schemaCache.get(schemaId);
      } else {
        validate = this.ajv.getSchema(schemaId);
        
        if (!validate) {
          logger.error(`Şema bulunamadı: ${schemaId}`);
          return {
            valid: false,
            errors: [`Şema bulunamadı: ${schemaId}`]
          };
        }
        
        if (this.options.cacheSchemas) {
          this.schemaCache.set(schemaId, validate);
        }
      }
      
      // Şema doğrulamasını gerçekleştir
      const valid = validate(messageObj);
      
      if (!valid) {
        const errors = validate.errors.map(err => 
          `${err.instancePath} ${err.message}`
        );
        
        logger.warn(`Şema doğrulama hatası (${topic}): ${errors.join(', ')}`);
        
        return {
          valid: false,
          errors
        };
      }
      
      return { valid: true, errors: null };
    } catch (error) {
      logger.error(`Şema doğrulama hatası: ${error.message}`);
      
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Yeni bir şema ekler veya mevcut bir şemayı günceller
   * @param {string} schemaId Şema ID
   * @param {object} schema JSON Schema formatında şema tanımı
   * @param {array} topicPatterns Bu şemayla eşleşecek topic desenleri
   * @returns {boolean} İşlem başarılıysa true
   */
  addSchema(schemaId, schema, topicPatterns = []) {
    try {
      // Şemayı AJV'ye ekle/güncelle
      this.ajv.addSchema(schema, schemaId);
      
      // Önceki eşleşmeleri temizle
      for (const [pattern, id] of this.schemaMap.entries()) {
        if (id === schemaId) {
          this.schemaMap.delete(pattern);
        }
      }
      
      // Yeni eşleşmeleri ekle
      for (const pattern of topicPatterns) {
        this.schemaMap.set(pattern, schemaId);
      }
      
      // Önbelleği temizle
      if (this.options.cacheSchemas) {
        this.schemaCache.delete(schemaId);
      }
      
      logger.info(`Şema eklendi/güncellendi: ${schemaId} (${topicPatterns.length} topic pattern)`);
      return true;
    } catch (error) {
      logger.error(`Şema ekleme hatası (${schemaId}): ${error.message}`);
      return false;
    }
  }

  /**
   * Bir şemayı sistemden kaldırır
   * @param {string} schemaId Kaldırılacak şema ID
   * @returns {boolean} İşlem başarılıysa true
   */
  removeSchema(schemaId) {
    try {
      // Şemayı AJV'den kaldır
      this.ajv.removeSchema(schemaId);
      
      // Eşleşmeleri temizle
      for (const [pattern, id] of this.schemaMap.entries()) {
        if (id === schemaId) {
          this.schemaMap.delete(pattern);
        }
      }
      
      // Önbelleği temizle
      if (this.options.cacheSchemas) {
        this.schemaCache.delete(schemaId);
      }
      
      logger.info(`Şema kaldırıldı: ${schemaId}`);
      return true;
    } catch (error) {
      logger.error(`Şema kaldırma hatası (${schemaId}): ${error.message}`);
      return false;
    }
  }

  /**
   * Mevcut tüm şemaları ve eşleşmeleri listeler
   * @returns {object} Şema listesi ve eşleşmeler
   */
  listSchemas() {
    const schemas = this.ajv.getSchemas();
    const mappings = {};
    
    for (const [pattern, schemaId] of this.schemaMap.entries()) {
      if (!mappings[schemaId]) {
        mappings[schemaId] = [];
      }
      mappings[schemaId].push(pattern);
    }
    
    return {
      schemas: Object.keys(schemas),
      mappings
    };
  }
}

module.exports = SchemaValidator;