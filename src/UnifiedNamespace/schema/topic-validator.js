/**
 * Topic Validasyon Modülü
 * 
 * Bu modül, ManufactBridge UNS içindeki topic formatlarının ISA-95 standardına
 * uygun olmasını sağlar ve topic yapısının doğruluğunu kontrol eder.
 */

const winston = require('winston');
const config = require('../config');

// Winston logger konfigürasyonu
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'topic-validator' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/topic-validator.log' })
  ]
});

class TopicValidator {
  constructor(options = {}) {
    this.options = Object.assign({
      rootNamespace: config.topic_management.root_namespace || 'manufactbridge',
      enforceHierarchy: config.topic_management.enforce_hierarchy !== false,
      maxTopicDepth: config.topic_management.max_topic_depth || 8,
      minTopicDepth: config.topic_management.min_topic_depth || 3,
      allowWildcards: true,
      reservedTopics: ['$SYS', 'SYS', '$internal', 'internal']
    }, options);

    // ISA-95 topic yapısı
    // {namespace}/{enterprise}/{site}/{area}/{line}/{workcell}/{equipment}/{messageType}
    this.topicHierarchy = [
      'namespace',    // ManufactBridge
      'enterprise',   // Şirket adı
      'site',         // Tesis/fabrika
      'area',         // Üretim alanı
      'line',         // Üretim hattı
      'workcell',     // İş hücresi
      'equipment',    // Ekipman
      'messageType'   // Mesaj tipi
    ];
  }

  /**
   * Topic formatının geçerli olup olmadığını kontrol eder
   * @param {string} topic Kontrol edilecek topic
   * @param {boolean} allowWildcards Joker karakter kullanımına izin verilip verilmeyeceği
   * @returns {boolean} Topic geçerliyse true, değilse false
   */
  validateTopic(topic, allowWildcards = false) {
    try {
      // Sistem topic'leri kontrolü
      if (this.isSystemTopic(topic)) {
        return true;
      }

      // Boş veya geçersiz formatlar
      if (!topic || typeof topic !== 'string' || topic.trim() === '') {
        logger.warn(`Geçersiz topic formatı: Topic boş veya geçersiz bir string: ${topic}`);
        return false;
      }

      // Başlangıç ve bitiş karakterleri kontrolü
      if (topic.startsWith('/') || topic.endsWith('/')) {
        logger.warn(`Geçersiz topic formatı: Topic '/' ile başlayamaz veya bitemez: ${topic}`);
        return false;
      }

      // Topic hiyerarşisini kontrol et
      const parts = topic.split('/');

      // Topic derinliğini kontrol et
      if (this.options.enforceHierarchy) {
        if (parts.length < this.options.minTopicDepth) {
          logger.warn(`Geçersiz topic formatı: Minimum topic derinliği ${this.options.minTopicDepth} olmalıdır: ${topic}`);
          return false;
        }
        
        if (parts.length > this.options.maxTopicDepth) {
          logger.warn(`Geçersiz topic formatı: Maksimum topic derinliği ${this.options.maxTopicDepth} olmalıdır: ${topic}`);
          return false;
        }
      }

      // Root namespace kontrolü
      if (this.options.enforceHierarchy && parts[0] !== this.options.rootNamespace) {
        logger.warn(`Geçersiz topic formatı: Topic '${this.options.rootNamespace}' ile başlamalıdır: ${topic}`);
        return false;
      }

      // Topic segmentlerini kontrol et
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // Boş segment kontrolü
        if (part === '') {
          logger.warn(`Geçersiz topic formatı: Boş segment içeriyor: ${topic}`);
          return false;
        }
        
        // Joker karakterleri kontrol et
        const hasWildcard = part === '#' || part === '+';
        if (hasWildcard && !allowWildcards) {
          logger.warn(`Geçersiz topic formatı: Joker karakterlere izin verilmiyor: ${topic}`);
          return false;
        }
        
        // Çoklu seviye joker karakter (#) sadece son segment olabilir
        if (part === '#' && i < parts.length - 1) {
          logger.warn(`Geçersiz topic formatı: '#' karakteri sadece son segment olabilir: ${topic}`);
          return false;
        }
        
        // Geçersiz karakterleri kontrol et
        if (!this.isValidSegment(part)) {
          logger.warn(`Geçersiz topic formatı: Segment geçersiz karakterler içeriyor: ${part}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error(`Topic doğrulama hatası: ${error.message}`);
      return false;
    }
  }

  /**
   * Topic segmentinin geçerli karakterlerden oluşup oluşmadığını kontrol eder
   * @param {string} segment Topic segment'i
   * @returns {boolean} Segment geçerliyse true, değilse false
   */
  isValidSegment(segment) {
    // Joker karakterleri kontrolü
    if (segment === '#' || segment === '+') {
      return true;
    }
    
    // Segment sadece alfanumerik karakterler, tire, alt çizgi, nokta ve joker karakterler içerebilir
    const validCharRegex = /^[a-zA-Z0-9_\-\.]+$/;
    return validCharRegex.test(segment);
  }

  /**
   * Verilen topic'in sistem topic'i olup olmadığını kontrol eder
   * @param {string} topic Kontrol edilecek topic
   * @returns {boolean} Sistem topic'iyse true, değilse false
   */
  isSystemTopic(topic) {
    return this.options.reservedTopics.some(reserved => {
      return topic === reserved || topic.startsWith(`${reserved}/`);
    });
  }

  /**
   * Topic'i ISA-95 seviyelerine göre parçalar
   * @param {string} topic Parçalanacak topic
   * @returns {Object|null} Topic seviyeleri veya hata durumunda null
   */
  parseTopic(topic) {
    try {
      // Sistem topic'leri için parslamıyoruz
      if (this.isSystemTopic(topic)) {
        return null;
      }

      // Topic formatını doğrula
      if (!this.validateTopic(topic)) {
        return null;
      }

      const parts = topic.split('/');
      const result = {};

      // ISA-95 hiyerarşisine göre parçala
      for (let i = 0; i < Math.min(parts.length, this.topicHierarchy.length); i++) {
        result[this.topicHierarchy[i]] = parts[i];
      }

      return result;
    } catch (error) {
      logger.error(`Topic parçalama hatası: ${error.message}`);
      return null;
    }
  }

  /**
   * ISA-95 hiyerarşi seviyelerinden topic oluşturur
   * @param {Object} levels ISA-95 seviyeleri içeren obje
   * @returns {string|null} Oluşturulan topic veya hata durumunda null
   */
  buildTopic(levels) {
    try {
      const parts = [];
      
      // En azından namespace, enterprise ve site seviyeleri gerekli
      if (!levels.namespace || !levels.enterprise || !levels.site) {
        logger.warn('Topic oluşturma hatası: Minimum gerekli seviyeler eksik');
        return null;
      }

      // ISA-95 hiyerarşisine göre topic oluştur
      for (const level of this.topicHierarchy) {
        if (levels[level]) {
          // Segment geçerliliğini kontrol et
          if (!this.isValidSegment(levels[level])) {
            logger.warn(`Topic oluşturma hatası: Geçersiz segment değeri: ${level}=${levels[level]}`);
            return null;
          }
          parts.push(levels[level]);
        } else {
          // Eğer bir seviye tanımlanmamışsa ve zorunlu değilse, daha fazla devam etme
          break;
        }
      }

      // Minimum topic derinliğini kontrol et
      if (this.options.enforceHierarchy && parts.length < this.options.minTopicDepth) {
        logger.warn(`Topic oluşturma hatası: Minimum topic derinliği ${this.options.minTopicDepth} olmalıdır`);
        return null;
      }

      return parts.join('/');
    } catch (error) {
      logger.error(`Topic oluşturma hatası: ${error.message}`);
      return null;
    }
  }

  /**
   * Bir topic'in başka bir topic'e abone olmak için uygun olup olmadığını kontrol eder
   * @param {string} subscribeTopic Abone olunacak topic (wildcards içerebilir)
   * @param {string} publishTopic Yayınlanacak topic (wildcards içermemeli)
   * @returns {boolean} Abone olunabilirse true, değilse false
   */
  topicMatches(subscribeTopic, publishTopic) {
    try {
      // Her iki topic'in de geçerli olduğunu kontrol et
      if (!this.validateTopic(subscribeTopic, true) || !this.validateTopic(publishTopic)) {
        return false;
      }

      const subParts = subscribeTopic.split('/');
      const pubParts = publishTopic.split('/');

      // # karakteri: Çoklu seviye joker, kalan tüm seviyelere eşleşir
      if (subParts.length === 1 && subParts[0] === '#') {
        return true;
      }

      // Topic seviyelerini karşılaştır
      for (let i = 0; i < subParts.length; i++) {
        // Publish topic daha kısa ise eşleşmez
        if (i >= pubParts.length) {
          return false;
        }

        // # - Çoklu seviye joker: Kalan tüm seviyelere eşleşir
        if (subParts[i] === '#') {
          return true;
        }

        // + - Tek seviye joker: Herhangi bir değere eşleşir
        if (subParts[i] === '+') {
          continue;
        }

        // Birebir eşleşme kontrolü
        if (subParts[i] !== pubParts[i]) {
          return false;
        }
      }

      // Subscribe topic'in tüm seviyeleri eşleşti, ama publish topic daha uzun olabilir
      // Bu durumda subscribe topic'te # yoksa eşleşmez
      return pubParts.length === subParts.length;
    } catch (error) {
      logger.error(`Topic eşleşme hatası: ${error.message}`);
      return false;
    }
  }
}

module.exports = TopicValidator;