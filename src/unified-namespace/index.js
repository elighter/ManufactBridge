/**
 * ManufactBridge Unified Namespace (UNS) Ana Modülü
 * 
 * Bu modül, ManufactBridge platformunun temel bileşeni olan Unified Namespace (UNS) yapısının
 * ana giriş noktasıdır. UNS, farklı sistemlerden gelen verilerin paylaşıldığı merkezi bir veri
 * alanı sağlar ve pub/sub mesajlaşma modeli üzerine kurulmuştur.
 */

const MQTTBroker = require('./broker/mqtt-broker');
const KafkaBroker = require('./broker/kafka-broker');
const TopicValidator = require('./schema/topic-validator');
const SchemaValidator = require('./schema/schema-validator');
const ACLManager = require('./security/acl-manager');
const AuthManager = require('./security/auth-manager');
const config = require('./config');
const winston = require('winston');

// Winston logger konfigürasyonu
const logger = winston.createLogger({
  level: config.log_level || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'uns-main' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/uns.log' })
  ]
});

class UnifiedNamespace {
  constructor(options = {}) {
    this.options = Object.assign({
      broker: {
        type: config.broker.type || 'mqtt', // 'mqtt' veya 'kafka'
        mqtt: config.broker.mqtt || {},
        kafka: config.broker.kafka || {}
      },
      enableSchemaValidation: config.schema_validation.enabled !== false,
      enableACL: config.security.acl_enabled !== false,
      enableAuth: config.security.authentication.enabled !== false
    }, options);

    logger.info('ManufactBridge Unified Namespace başlatılıyor...');
    logger.info(`Broker tipi: ${this.options.broker.type}`);

    // Bileşenleri oluştur
    this._initComponents();
  }

  /**
   * UNS bileşenlerini başlatır
   * @private
   */
  _initComponents() {
    try {
      // Topic doğrulama modülünü oluştur
      this.topicValidator = new TopicValidator();
      logger.info('Topic Validator başlatıldı');

      // Şema doğrulama modülünü oluştur (eğer etkinse)
      if (this.options.enableSchemaValidation) {
        this.schemaValidator = new SchemaValidator();
        logger.info('Schema Validator başlatıldı');
      }

      // Güvenlik bileşenlerini oluştur
      if (this.options.enableACL) {
        this.aclManager = new ACLManager();
        logger.info('ACL Manager başlatıldı');
      }

      if (this.options.enableAuth) {
        this.authManager = new AuthManager();
        logger.info('Auth Manager başlatıldı');
      }

      // Broker bileşenini oluştur
      this._initBroker();
    } catch (error) {
      logger.error(`Bileşenleri başlatma hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Broker bileşenini başlatır
   * @private
   */
  _initBroker() {
    try {
      const brokerConfig = {
        topicValidator: this.topicValidator,
        schemaValidator: this.options.enableSchemaValidation ? this.schemaValidator : null,
        aclManager: this.options.enableACL ? this.aclManager : null,
        authenticator: this.options.enableAuth ? this.authManager : null
      };

      if (this.options.broker.type === 'kafka') {
        this.broker = new KafkaBroker({
          ...this.options.broker.kafka,
          ...brokerConfig
        });
        logger.info('Kafka Broker başlatıldı');
      } else {
        this.broker = new MQTTBroker({
          ...this.options.broker.mqtt,
          ...brokerConfig
        });
        logger.info('MQTT Broker başlatıldı');
      }
    } catch (error) {
      logger.error(`Broker başlatma hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * UNS'yi başlatır
   */
  async start() {
    try {
      logger.info('Unified Namespace başlatılıyor...');
      await this.broker.start();
      logger.info('Unified Namespace başarıyla başlatıldı');
    } catch (error) {
      logger.error(`UNS başlatma hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * UNS'yi durdurur
   */
  async stop() {
    try {
      logger.info('Unified Namespace durduruluyor...');
      await this.broker.stop();
      logger.info('Unified Namespace başarıyla durduruldu');
    } catch (error) {
      logger.error(`UNS durdurma hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bir topic'e mesaj yayınlar
   * @param {string} topic Mesajın yayınlanacağı topic
   * @param {object|string} message Mesaj içeriği
   * @param {object} options Yayınlama seçenekleri
   */
  async publish(topic, message, options = {}) {
    try {
      await this.broker.publish(topic, message, options);
      return true;
    } catch (error) {
      logger.error(`Mesaj yayınlama hatası (${topic}): ${error.message}`);
      throw error;
    }
  }

  /**
   * Bir topic'e abone olur
   * @param {string} topic Abone olunacak topic
   * @param {function} callback Mesaj alındığında çağrılacak fonksiyon (message, topic)
   * @param {object} options Abone olma seçenekleri
   */
  async subscribe(topic, callback, options = {}) {
    try {
      // Broker tipine göre subscribe işlemini çağır
      if (this.options.broker.type === 'kafka') {
        const groupId = options.groupId || `manufactbridge-consumer-${Date.now()}`;
        return await this.broker.subscribe(topic, groupId, callback, options);
      } else {
        return await this.broker.subscribe(topic, callback, options);
      }
    } catch (error) {
      logger.error(`Abone olma hatası (${topic}): ${error.message}`);
      throw error;
    }
  }

  /**
   * Bir topic'i oluşturur (Kafka için)
   * @param {string} topic Oluşturulacak topic
   * @param {object} options Topic oluşturma seçenekleri
   */
  async createTopic(topic, options = {}) {
    try {
      if (this.options.broker.type !== 'kafka') {
        logger.warn('Topic oluşturma yalnızca Kafka broker için geçerlidir');
        return true;
      }

      return await this.broker.createTopic(topic, options.numPartitions, options.replicationFactor);
    } catch (error) {
      logger.error(`Topic oluşturma hatası (${topic}): ${error.message}`);
      throw error;
    }
  }

  /**
   * Mevcut topic listesini getirir (Kafka için)
   */
  async getTopics() {
    try {
      if (this.options.broker.type !== 'kafka') {
        logger.warn('Topic listesi getirme yalnızca Kafka broker için geçerlidir');
        return [];
      }

      return await this.broker.getTopics();
    } catch (error) {
      logger.error(`Topic listesi getirme hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mevcut istemci listesini getirir (MQTT için)
   */
  getClients() {
    try {
      if (this.options.broker.type !== 'mqtt') {
        logger.warn('İstemci listesi getirme yalnızca MQTT broker için geçerlidir');
        return [];
      }

      return this.broker.getClients();
    } catch (error) {
      logger.error(`İstemci listesi getirme hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Şema doğrulamasını etkinleştirir veya devre dışı bırakır
   * @param {boolean} enabled Etkin olup olmadığı
   */
  setSchemaValidation(enabled) {
    try {
      if (!this.schemaValidator) {
        if (enabled) {
          this.schemaValidator = new SchemaValidator();
          this.broker.options.schemaValidator = this.schemaValidator;
          this.options.enableSchemaValidation = true;
          logger.info('Şema doğrulama etkinleştirildi');
        }
      } else if (!enabled) {
        this.broker.options.schemaValidator = null;
        this.options.enableSchemaValidation = false;
        logger.info('Şema doğrulama devre dışı bırakıldı');
      }
    } catch (error) {
      logger.error(`Şema doğrulama ayarlama hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * ACL kontrolünü etkinleştirir veya devre dışı bırakır
   * @param {boolean} enabled Etkin olup olmadığı
   */
  setACLEnabled(enabled) {
    try {
      if (!this.aclManager) {
        if (enabled) {
          this.aclManager = new ACLManager();
          this.broker.options.aclManager = this.aclManager;
          this.options.enableACL = true;
          logger.info('ACL kontrolü etkinleştirildi');
        }
      } else if (!enabled) {
        this.broker.options.aclManager = null;
        this.options.enableACL = false;
        logger.info('ACL kontrolü devre dışı bırakıldı');
      }
    } catch (error) {
      logger.error(`ACL kontrolü ayarlama hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kimlik doğrulamayı etkinleştirir veya devre dışı bırakır
   * @param {boolean} enabled Etkin olup olmadığı
   */
  setAuthEnabled(enabled) {
    try {
      if (!this.authManager) {
        if (enabled) {
          this.authManager = new AuthManager();
          this.broker.options.authenticator = this.authManager;
          this.options.enableAuth = true;
          logger.info('Kimlik doğrulama etkinleştirildi');
        }
      } else if (!enabled) {
        this.broker.options.authenticator = null;
        this.options.enableAuth = false;
        logger.info('Kimlik doğrulama devre dışı bırakıldı');
      }
    } catch (error) {
      logger.error(`Kimlik doğrulama ayarlama hatası: ${error.message}`);
      throw error;
    }
  }
}

// Tek örnek (Singleton) pattern
let instance = null;

/**
 * UNS örneğini döndürür veya oluşturur
 * @param {object} options UNS seçenekleri
 * @returns {UnifiedNamespace} UNS örneği
 */
function getInstance(options = {}) {
  if (!instance) {
    instance = new UnifiedNamespace(options);
  }
  return instance;
}

module.exports = {
  getInstance,
  UnifiedNamespace
};