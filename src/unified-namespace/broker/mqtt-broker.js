/**
 * MQTT Broker Yönetim Modülü
 * 
 * Bu modül, ManufactBridge UNS sistemi için MQTT broker bağlantısını yönetir.
 * Aeon Labs MQTT (https://github.com/moscajs/aedes) kütüphanesi kullanılarak
 * yüksek performanslı bir MQTT broker uygulaması sağlar.
 */

const aedes = require('aedes')();
const fs = require('fs');
const path = require('path');
const mqtt = require('mqtt');
const { createServer } = require('net');
const { createServer: createTLSServer } = require('tls');
const winston = require('winston');
const config = require('../config');

// Winston logger konfigürasyonu
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'mqtt-broker' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/mqtt-broker.log' })
  ]
});

class MQTTBroker {
  constructor(options = {}) {
    this.options = Object.assign({
      host: config.broker.mqtt.host || 'localhost',
      port: config.broker.mqtt.port || 1883,
      tls: config.broker.mqtt.use_tls || false,
      tlsOptions: config.broker.mqtt.tls_options || null,
      authenticator: null,
      aclManager: null,
      topicValidator: null,
      schemaValidator: null
    }, options);

    this.aedes = aedes({
      authenticate: this._authenticate.bind(this),
      authorizePublish: this._authorizePublish.bind(this),
      authorizeSubscribe: this._authorizeSubscribe.bind(this)
    });

    this.server = null;
    this.tlsServer = null;
    this.clients = new Map();
  }

  /**
   * MQTT Broker'ı başlatır
   */
  start() {
    // Standart MQTT Server başlatma
    this.server = createServer(this.aedes.handle);
    this.server.listen(this.options.port, this.options.host, () => {
      logger.info(`MQTT Broker başladı: mqtt://${this.options.host}:${this.options.port}`);
    });

    // TLS isteniyorsa, TLS ile ayrı bir port açılır
    if (this.options.tls) {
      const tlsOptions = this._loadTLSOptions();
      if (tlsOptions) {
        this.tlsServer = createTLSServer(tlsOptions, this.aedes.handle);
        const tlsPort = this.options.port + 7000; // 8883 standart MQTT TLS portudur (1883 + 7000)
        this.tlsServer.listen(tlsPort, this.options.host, () => {
          logger.info(`MQTT Broker (TLS) başladı: mqtts://${this.options.host}:${tlsPort}`);
        });
      }
    }

    // Broker olaylarını dinle
    this._setupEventListeners();
  }

  /**
   * MQTT Broker'ı durdurur
   */
  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('MQTT Broker durduruldu');
          this.server = null;
          
          if (this.tlsServer) {
            this.tlsServer.close(() => {
              logger.info('MQTT TLS Broker durduruldu');
              this.tlsServer = null;
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * TLS ayarlarını yükler
   * @private
   */
  _loadTLSOptions() {
    try {
      const tlsOptions = this.options.tlsOptions || {};
      
      // Sertifika ve anahtar dosyalarını yükle
      if (tlsOptions.keyPath && tlsOptions.certPath) {
        return {
          key: fs.readFileSync(path.resolve(tlsOptions.keyPath)),
          cert: fs.readFileSync(path.resolve(tlsOptions.certPath)),
          ca: tlsOptions.caPath ? [fs.readFileSync(path.resolve(tlsOptions.caPath))] : undefined,
          requestCert: tlsOptions.requestCert || false,
          rejectUnauthorized: tlsOptions.rejectUnauthorized || false
        };
      }
      
      logger.error('TLS için gerekli sertifika veya anahtar dosyaları bulunamadı');
      return null;
    } catch (error) {
      logger.error(`TLS ayarları yüklenirken hata oluştu: ${error.message}`);
      return null;
    }
  }

  /**
   * Broker olaylarını dinlemek için olay dinleyicilerini ayarlar
   * @private
   */
  _setupEventListeners() {
    // İstemci bağlandığında
    this.aedes.on('client', (client) => {
      logger.info(`İstemci bağlandı: ${client.id}`);
      this.clients.set(client.id, client);
    });

    // İstemci bağlantısı kesildiğinde
    this.aedes.on('clientDisconnect', (client) => {
      logger.info(`İstemci bağlantısı kesildi: ${client.id}`);
      this.clients.delete(client.id);
    });

    // İstemci kimlik doğrulaması başarısız olduğunda
    this.aedes.on('clientError', (client, error) => {
      logger.error(`İstemci hatası (${client ? client.id : 'unknown'}): ${error.message}`);
    });

    // Yeni bir publish olayı gerçekleştiğinde
    this.aedes.on('publish', (packet, client) => {
      if (client && packet.topic !== '$SYS/#') {
        logger.debug(`Yayın: ${client.id} - ${packet.topic}`);
      }
    });

    // Yeni bir abone olayı gerçekleştiğinde
    this.aedes.on('subscribe', (subscriptions, client) => {
      if (client) {
        const topics = subscriptions.map(s => s.topic).join(', ');
        logger.debug(`Abone: ${client.id} - ${topics}`);
      }
    });

    // Broker bir mesaj gönderdiğinde
    this.aedes.on('pingReq', (client) => {
      logger.debug(`Ping isteği: ${client.id}`);
    });
  }

  /**
   * Kimlik doğrulama işlemi
   * @private
   */
  _authenticate(client, username, password, callback) {
    if (this.options.authenticator) {
      this.options.authenticator.authenticate(client, username, password, callback);
    } else {
      // Kimlik doğrulama modülü yoksa herkese izin ver
      callback(null, true);
    }
  }

  /**
   * Yayın yetkisi kontrol işlemi
   * @private
   */
  _authorizePublish(client, packet, callback) {
    try {
      // Topic formatını doğrula
      if (this.options.topicValidator && !this.options.topicValidator.validateTopic(packet.topic)) {
        logger.warn(`Geçersiz topic formatı: ${client.id} - ${packet.topic}`);
        return callback(new Error('Geçersiz topic formatı'));
      }

      // Şema doğrulama
      if (this.options.schemaValidator) {
        const validationResult = this.options.schemaValidator.validateMessage(packet.topic, packet.payload);
        if (!validationResult.valid) {
          logger.warn(`Şema doğrulama hatası: ${client.id} - ${packet.topic} - ${validationResult.errors}`);
          return callback(new Error(`Şema doğrulama hatası: ${validationResult.errors}`));
        }
      }

      // ACL kontrolü
      if (this.options.aclManager) {
        this.options.aclManager.canPublish(client, packet.topic, (error, authorized) => {
          if (error || !authorized) {
            logger.warn(`Yayın yetkisi reddedildi: ${client.id} - ${packet.topic}`);
            return callback(new Error('Yayın yetkisi reddedildi'));
          }
          callback(null);
        });
      } else {
        callback(null);
      }
    } catch (error) {
      logger.error(`Yayın yetkilendirme hatası: ${error.message}`);
      callback(error);
    }
  }

  /**
   * Abone olma yetkisi kontrol işlemi
   * @private
   */
  _authorizeSubscribe(client, subscription, callback) {
    try {
      // Topic formatını doğrula
      if (this.options.topicValidator && !this.options.topicValidator.validateTopic(subscription.topic, true)) {
        logger.warn(`Geçersiz abone topic formatı: ${client.id} - ${subscription.topic}`);
        return callback(new Error('Geçersiz abone topic formatı'));
      }

      // ACL kontrolü
      if (this.options.aclManager) {
        this.options.aclManager.canSubscribe(client, subscription.topic, (error, authorized) => {
          if (error || !authorized) {
            logger.warn(`Abone olma yetkisi reddedildi: ${client.id} - ${subscription.topic}`);
            return callback(new Error('Abone olma yetkisi reddedildi'));
          }
          callback(null, subscription);
        });
      } else {
        callback(null, subscription);
      }
    } catch (error) {
      logger.error(`Abone olma yetkilendirme hatası: ${error.message}`);
      callback(error);
    }
  }

  /**
   * İstemci listesini döndürür
   */
  getClients() {
    return Array.from(this.clients.keys());
  }

  /**
   * Topic için mesaj yayınlar
   * @param {string} topic Topic yolu
   * @param {string|Buffer|Object} message Mesaj içeriği
   * @param {Object} options Yayın seçenekleri
   */
  publish(topic, message, options = {}) {
    let payload = message;
    if (typeof message === 'object' && !(message instanceof Buffer)) {
      payload = JSON.stringify(message);
    }

    const packet = {
      topic,
      payload,
      qos: options.qos || 0,
      retain: options.retain || false
    };

    this.aedes.publish(packet, (error) => {
      if (error) {
        logger.error(`Yayınlama hatası: ${topic} - ${error.message}`);
      } else {
        logger.debug(`Mesaj yayınlandı: ${topic}`);
      }
    });
  }
}

module.exports = MQTTBroker;