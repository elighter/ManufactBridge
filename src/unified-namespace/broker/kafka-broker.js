/**
 * Kafka Broker Yönetim Modülü
 * 
 * Bu modül, ManufactBridge UNS sistemi için Kafka broker bağlantısını yönetir.
 * Kafka-node kütüphanesi kullanılarak Kafka ile entegrasyon sağlar.
 */

const { Kafka, logLevel } = require('kafkajs');
const winston = require('winston');
const config = require('../config');

// Winston logger konfigürasyonu
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'kafka-broker' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/kafka-broker.log' })
  ]
});

class KafkaBroker {
  constructor(options = {}) {
    this.options = Object.assign({
      clientId: config.broker.kafka.client_id || 'manufactbridge-uns',
      brokers: config.broker.kafka.bootstrap_servers || ['localhost:9092'],
      authenticator: null,
      aclManager: null,
      topicValidator: null,
      schemaValidator: null,
      defaultNumPartitions: 3,
      defaultReplicationFactor: 1
    }, options);

    this.kafka = new Kafka({
      clientId: this.options.clientId,
      brokers: Array.isArray(this.options.brokers) ? this.options.brokers : [this.options.brokers],
      ssl: this.options.ssl,
      sasl: this.options.sasl,
      connectionTimeout: 3000,
      requestTimeout: 30000,
      retry: {
        initialRetryTime: 100,
        retries: 10
      },
      logLevel: logLevel.INFO
    });

    this.admin = this.kafka.admin();
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000
    });

    this.consumers = new Map();
    this.topics = new Set();
    this.isRunning = false;
  }

  /**
   * Kafka broker bağlantısını başlatır
   */
  async start() {
    try {
      logger.info('Kafka broker başlatılıyor...');
      await this.admin.connect();
      await this.producer.connect();
      
      // Tüm mevcut topic'leri getir
      const existingTopics = await this.admin.listTopics();
      existingTopics.forEach(topic => this.topics.add(topic));
      
      this.isRunning = true;
      logger.info('Kafka broker başarıyla başlatıldı');
    } catch (error) {
      logger.error(`Kafka broker başlatma hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kafka broker bağlantısını durdurur
   */
  async stop() {
    try {
      logger.info('Kafka broker durduruluyor...');
      
      // Tüm consumer'ları durdur
      const disconnectPromises = [];
      for (const [groupId, consumer] of this.consumers.entries()) {
        disconnectPromises.push(consumer.disconnect()
          .then(() => {
            logger.info(`Consumer grubu durduruldu: ${groupId}`);
          })
          .catch(error => {
            logger.error(`Consumer grubu durdurma hatası (${groupId}): ${error.message}`);
          }));
      }
      
      // Bağlantıları kapat
      await Promise.all(disconnectPromises);
      await this.producer.disconnect();
      await this.admin.disconnect();
      
      this.consumers.clear();
      this.isRunning = false;
      logger.info('Kafka broker başarıyla durduruldu');
    } catch (error) {
      logger.error(`Kafka broker durdurma hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Topic oluşturur (yoksa)
   * @param {string} topic Oluşturulacak topic adı
   * @param {number} numPartitions Partition sayısı (default: 3)
   * @param {number} replicationFactor Replikasyon faktörü (default: 1)
   */
  async createTopic(topic, numPartitions = null, replicationFactor = null) {
    try {
      // Topic formatını doğrula
      if (this.options.topicValidator && !this.options.topicValidator.validateTopic(topic)) {
        throw new Error(`Geçersiz topic formatı: ${topic}`);
      }
      
      // Topic zaten varsa tekrar oluşturmaya gerek yok
      if (this.topics.has(topic)) {
        logger.debug(`Topic zaten mevcut: ${topic}`);
        return true;
      }
      
      const partitions = numPartitions || this.options.defaultNumPartitions;
      const replications = replicationFactor || this.options.defaultReplicationFactor;
      
      await this.admin.createTopics({
        topics: [{
          topic,
          numPartitions: partitions,
          replicationFactor: replications
        }]
      });
      
      this.topics.add(topic);
      logger.info(`Topic oluşturuldu: ${topic} (partitions: ${partitions}, replication: ${replications})`);
      return true;
    } catch (error) {
      if (error.message.includes('already exists')) {
        this.topics.add(topic);
        logger.warn(`Topic oluşturma uyarısı: ${topic} zaten var`);
        return true;
      }
      
      logger.error(`Topic oluşturma hatası (${topic}): ${error.message}`);
      throw error;
    }
  }

  /**
   * Topic için mesaj yayınlar
   * @param {string} topic Topic yolu
   * @param {string|Buffer|Object} message Mesaj içeriği
   * @param {Object} options Yayın seçenekleri
   */
  async publish(topic, message, options = {}) {
    try {
      if (!this.isRunning) {
        throw new Error('Kafka broker çalışmıyor');
      }
      
      // Topic formatını doğrula
      if (this.options.topicValidator && !this.options.topicValidator.validateTopic(topic)) {
        throw new Error(`Geçersiz topic formatı: ${topic}`);
      }
      
      // Veri şemasını doğrula
      if (this.options.schemaValidator) {
        const validationResult = this.options.schemaValidator.validateMessage(topic, message);
        if (!validationResult.valid) {
          throw new Error(`Şema doğrulama hatası: ${validationResult.errors}`);
        }
      }
      
      // Mesajı JSON string'e dönüştür (gerekirse)
      let value = message;
      if (typeof message === 'object' && !(message instanceof Buffer)) {
        value = JSON.stringify(message);
      }
      
      // Topic oluştur (yoksa) - allowAutoTopicCreation etkinleştirilse bile
      // topic'leri önceden yönetmek daha iyi kontrolü sağlar
      if (!this.topics.has(topic)) {
        await this.createTopic(topic);
      }
      
      // Mesajı yayınla
      const result = await this.producer.send({
        topic,
        messages: [{
          value,
          key: options.key || null,
          headers: options.headers || {}
        }]
      });
      
      logger.debug(`Mesaj yayınlandı: ${topic}`);
      return result;
    } catch (error) {
      logger.error(`Yayınlama hatası (${topic}): ${error.message}`);
      throw error;
    }
  }

  /**
   * Topic için bir consumer oluşturur ve belirtilen callback ile mesajları tüketir
   * @param {string|array} topics Abone olunacak topic(ler)
   * @param {string} groupId Consumer grup ID'si
   * @param {function} callback Mesaj geldiğinde çağrılacak fonksiyon (message, topic, partition, offset)
   * @param {Object} options Abone olma seçenekleri
   */
  async subscribe(topics, groupId, callback, options = {}) {
    try {
      if (!this.isRunning) {
        throw new Error('Kafka broker çalışmıyor');
      }
      
      // Önceden aynı grup ID ile bir consumer var mı kontrol et
      if (this.consumers.has(groupId)) {
        throw new Error(`Bu grup ID ile zaten bir consumer bulunuyor: ${groupId}`);
      }
      
      // Topic formatlarını doğrula
      const topicList = Array.isArray(topics) ? topics : [topics];
      if (this.options.topicValidator) {
        for (const topic of topicList) {
          if (!this.options.topicValidator.validateTopic(topic, true)) {
            throw new Error(`Geçersiz topic formatı (subscribe): ${topic}`);
          }
        }
      }
      
      // ACL kontrolü
      if (this.options.aclManager) {
        for (const topic of topicList) {
          const canSubscribe = await new Promise((resolve, reject) => {
            this.options.aclManager.canSubscribe({ id: groupId }, topic, (error, authorized) => {
              if (error) reject(error);
              else resolve(authorized);
            });
          });
          
          if (!canSubscribe) {
            throw new Error(`Abone olma yetkisi reddedildi: ${groupId} - ${topic}`);
          }
        }
      }
      
      // Consumer oluştur
      const consumer = this.kafka.consumer({
        groupId,
        maxWaitTimeInMs: 1000,
        ...options
      });
      
      await consumer.connect();
      
      // Topic'lere abone ol
      for (const topic of topicList) {
        await consumer.subscribe({
          topic,
          fromBeginning: options.fromBeginning || false
        });
      }
      
      // Mesajları işle
      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            let messageContent = message.value.toString();
            
            // JSON parse (mümkünse)
            try {
              messageContent = JSON.parse(messageContent);
            } catch (e) {
              // JSON değilse, string olarak bırak
            }
            
            callback(messageContent, topic, partition, message.offset, message.headers);
          } catch (error) {
            logger.error(`Mesaj işleme hatası (${topic}): ${error.message}`);
          }
        }
      });
      
      this.consumers.set(groupId, consumer);
      logger.info(`Consumer oluşturuldu: ${groupId}, topics: ${topicList.join(', ')}`);
      
      return {
        unsubscribe: async () => {
          if (this.consumers.has(groupId)) {
            const consumerToStop = this.consumers.get(groupId);
            await consumerToStop.disconnect();
            this.consumers.delete(groupId);
            logger.info(`Consumer durduruldu: ${groupId}`);
          }
        }
      };
    } catch (error) {
      logger.error(`Abone olma hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mevcut topic listesini getirir
   */
  async getTopics() {
    try {
      const topics = await this.admin.listTopics();
      return topics;
    } catch (error) {
      logger.error(`Topic listesi getirme hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bir topic'in metadata bilgisini getirir
   * @param {string} topic Topic adı
   */
  async getTopicMetadata(topic) {
    try {
      const metadata = await this.admin.fetchTopicMetadata({ topics: [topic] });
      return metadata;
    } catch (error) {
      logger.error(`Topic metadata getirme hatası (${topic}): ${error.message}`);
      throw error;
    }
  }
}

module.exports = KafkaBroker;