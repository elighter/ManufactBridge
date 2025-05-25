/**
 * ManufactBridge Unified Namespace (UNS) Modülü
 * 
 * Bu modül, ManufactBridge platformunun Unified Namespace bileşenlerini dışa aktarır.
 * Farklı sistemler arasında standarize edilmiş veri paylaşımı için gerekli
 * broker, şema doğrulama ve protokol bileşenlerini sağlar.
 */

const path = require('path');
const config = require('./config');

// Broker bileşenleri
const MqttBroker = require('./broker/mqtt-broker');
const KafkaBroker = require('./broker/kafka-broker');

// Şema doğrulama bileşenleri
const SchemaValidator = require('./schema/schema-validator');
const TopicValidator = require('./schema/topic-validator');

/**
 * Broker tipine göre broker nesnesini oluşturur
 * 
 * @param {string} type - Broker tipi ('mqtt' veya 'kafka')
 * @param {object} options - Broker seçenekleri
 * @returns {object} Broker nesnesi
 */
function createBroker(type, options = {}) {
  switch (type.toLowerCase()) {
    case 'mqtt':
      return new MqttBroker(options);
    case 'kafka':
      return new KafkaBroker(options);
    default:
      throw new Error(`Desteklenmeyen broker tipi: ${type}`);
  }
}

/**
 * UNS Modülünü başlatır
 * 
 * @param {object} options - Başlangıç seçenekleri 
 * @returns {object} UNS API'si
 */
function createUNS(options = {}) {
  // Yapılandırmayı birleştir
  const mergedConfig = {
    ...config,
    ...options
  };
  
  // Broker oluştur
  const broker = createBroker(
    mergedConfig.broker.type, 
    mergedConfig.broker[mergedConfig.broker.type]
  );
  
  // Şema doğrulayıcı
  const schemaValidator = new SchemaValidator({
    schemaDir: mergedConfig.schema.dir || path.join(__dirname, 'schema'),
    defaultSchema: mergedConfig.schema.defaultSchema
  });
  
  // Konu doğrulayıcı
  const topicValidator = new TopicValidator({
    rules: mergedConfig.topic.rules
  });
  
  // Broker'ı başlat
  broker.start();
  
  // API
  return {
    // Ana bileşenler
    broker,
    schemaValidator,
    topicValidator,
    config: mergedConfig,
    
    // Veri yayınlama
    publish: (topic, payload, options) => {
      if (mergedConfig.validation.topics) {
        topicValidator.validate(topic);
      }
      
      if (mergedConfig.validation.schema) {
        schemaValidator.validate(payload);
      }
      
      return broker.publish(topic, payload, options);
    },
    
    // Veri dinleme
    subscribe: (topic, callback, options) => {
      return broker.subscribe(topic, callback, options);
    },
    
    // Bağlantı yönetimi
    isConnected: () => broker.isConnected(),
    disconnect: () => broker.stop(),
    
    // Yardımcı metotlar
    generateTopic: (parts) => {
      const {
        enterprise = 'default',
        site = 'default',
        area = 'default',
        line = 'default',
        device = 'default',
        dataType = 'data'
      } = parts;
      
      return `manufactbridge/${enterprise}/${site}/${area}/${line}/${device}/${dataType}/${parts.tag || ''}`;
    }
  };
}

// Dışa aktarılan bileşenler
module.exports = {
  createUNS,
  MqttBroker,
  KafkaBroker,
  SchemaValidator,
  TopicValidator,
  config
};