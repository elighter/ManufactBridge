/**
 * @fileoverview ManufactBridge - Data Platform Ana Sınıfı
 * Bu modül, veri platformunun ana yönetim sınıfıdır.
 */

const EventEmitter = require('eventemitter3');
const winston = require('winston');
const InfluxDBClient = require('./TimeSeriesDB/influxdb-client');
const StreamProcessor = require('./StreamProcessing/stream-processor');

/**
 * Data Platform Ana Sınıfı
 * Veri platformunun tüm bileşenlerini yönetir
 */
class DataPlatform extends EventEmitter {
  /**
   * DataPlatform constructor'ı
   * @param {Object} config - Platform konfigürasyonu
   */
  constructor(config = {}) {
    super();
    
    this.config = {
      influxdb: {
        url: config.influxdb?.url || 'http://localhost:8086',
        token: config.influxdb?.token,
        org: config.influxdb?.org || 'manufactbridge',
        bucket: config.influxdb?.bucket || 'manufacturing_data',
        batchSize: config.influxdb?.batchSize || 1000,
        flushInterval: config.influxdb?.flushInterval || 5000,
        ...config.influxdb
      },
      retention: {
        defaultPolicy: config.retention?.defaultPolicy || '30d',
        policies: config.retention?.policies || {},
        ...config.retention
      },
      processing: {
        enabled: config.processing?.enabled !== false,
        aggregationInterval: config.processing?.aggregationInterval || '1m',
        alerting: config.processing?.alerting !== false,
        windowSize: config.processing?.windowSize || 60000,
        maxBufferSize: config.processing?.maxBufferSize || 10000,
        alertThresholds: config.processing?.alertThresholds || {},
        ...config.processing
      },
      ...config
    };
    
    // Bileşenler
    this.influxClient = null;
    this.streamProcessor = null;
    this.connected = false;
    this.dataBuffer = [];
    this.processingTimer = null;
    
    // İstatistikler
    this.stats = {
      pointsWritten: 0,
      pointsBuffered: 0,
      errors: 0,
      lastWrite: null,
      startTime: new Date()
    };
    
    // Logger konfigürasyonu
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'data-platform' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/data-platform.log' })
      ]
    });
    
    this.logger.info('Data Platform oluşturuldu');
  }
  
  /**
   * Data Platform'u başlatır
   * @returns {Promise<boolean>} Başlatma başarılı ise true döner
   */
  async start() {
    try {
      this.logger.info('Data Platform başlatılıyor...');
      
      // InfluxDB client'ı oluştur ve bağlan
      await this._initializeInfluxDB();
      
      // Stream processor'ı başlat
      await this._initializeStreamProcessor();
      
      // Event handler'ları ayarla
      this._setupEventHandlers();
      
      // Processing timer'ı başlat
      if (this.config.processing.enabled) {
        this._startProcessing();
      }
      
      this.connected = true;
      this.logger.info('Data Platform başarıyla başlatıldı');
      this.emit('started');
      
      return true;
    } catch (error) {
      this.logger.error(`Data Platform başlatma hatası: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Data Platform'u durdurur
   * @returns {Promise<boolean>} Durdurma başarılı ise true döner
   */
  async stop() {
    try {
      this.logger.info('Data Platform durduruluyor...');
      
      // Processing timer'ı durdur
      this._stopProcessing();
      
      // Buffer'daki verileri flush et
      await this.flush();
      
      // Stream processor'ı durdur
      if (this.streamProcessor) {
        await this.streamProcessor.stop();
      }
      
      // InfluxDB bağlantısını kapat
      if (this.influxClient) {
        await this.influxClient.disconnect();
      }
      
      this.connected = false;
      this.logger.info('Data Platform durduruldu');
      this.emit('stopped');
      
      return true;
    } catch (error) {
      this.logger.error(`Data Platform durdurma hatası: ${error.message}`);
      return false;
    }
  }
  
  /**
   * UNS formatındaki veriyi işler ve depolar
   * @param {Object} unsData - UNS formatındaki veri
   * @returns {Promise<boolean>} İşlem başarılı ise true döner
   */
  async processUNSData(unsData) {
    try {
      if (!this.connected) {
        throw new Error('Data Platform bağlı değil');
      }
      
      // Veri doğrulama
      if (!this._validateUNSData(unsData)) {
        throw new Error('Geçersiz UNS veri formatı');
      }
      
      // InfluxDB'ye yaz
      await this.influxClient.writeUNSData(unsData);
      
      // Stream processor'a gönder
      if (this.streamProcessor) {
        this.streamProcessor.processUNSData(unsData);
      }
      
      // İstatistikleri güncelle
      this.stats.pointsWritten++;
      this.stats.lastWrite = new Date();
      
      this.logger.debug(`UNS verisi işlendi: ${unsData.topic}`);
      this.emit('dataProcessed', unsData);
      
      return true;
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`UNS veri işleme hatası: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Çoklu UNS verilerini işler
   * @param {Array} unsDataArray - UNS veri dizisi
   * @returns {Promise<boolean>} İşlem başarılı ise true döner
   */
  async processUNSDataBatch(unsDataArray) {
    try {
      if (!Array.isArray(unsDataArray)) {
        throw new Error('UNS veri dizisi bekleniyor');
      }
      
      const validData = unsDataArray.filter(data => this._validateUNSData(data));
      
      if (validData.length === 0) {
        this.logger.warn('Batch içinde geçerli veri bulunamadı');
        return false;
      }
      
      // Batch olarak işle
      const promises = validData.map(data => this.influxClient.writeUNSData(data));
      await Promise.all(promises);
      
      // İstatistikleri güncelle
      this.stats.pointsWritten += validData.length;
      this.stats.lastWrite = new Date();
      
      this.logger.info(`${validData.length} UNS verisi batch olarak işlendi`);
      this.emit('batchProcessed', validData.length);
      
      return true;
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`Batch UNS veri işleme hatası: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Veri sorgular
   * @param {Object} queryOptions - Sorgu seçenekleri
   * @returns {Promise<Array>} Sorgu sonuçları
   */
  async queryData(queryOptions = {}) {
    try {
      if (!this.connected) {
        throw new Error('Data Platform bağlı değil');
      }
      
      const results = await this.influxClient.queryTagValues(queryOptions);
      
      this.logger.debug(`Veri sorgusu tamamlandı: ${results.length} kayıt`);
      this.emit('queryCompleted', { options: queryOptions, resultCount: results.length });
      
      return results;
    } catch (error) {
      this.logger.error(`Veri sorgu hatası: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Özel Flux sorgusu çalıştırır
   * @param {string} fluxQuery - Flux sorgusu
   * @returns {Promise<Array>} Sorgu sonuçları
   */
  async executeFluxQuery(fluxQuery) {
    try {
      if (!this.connected) {
        throw new Error('Data Platform bağlı değil');
      }
      
      const results = await this.influxClient.query(fluxQuery);
      
      this.logger.debug(`Flux sorgusu tamamlandı: ${results.length} kayıt`);
      this.emit('fluxQueryCompleted', { query: fluxQuery, resultCount: results.length });
      
      return results;
    } catch (error) {
      this.logger.error(`Flux sorgu hatası: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Veri siler
   * @param {Object} deleteOptions - Silme seçenekleri
   * @returns {Promise<boolean>} Silme başarılı ise true döner
   */
  async deleteData(deleteOptions = {}) {
    try {
      if (!this.connected) {
        throw new Error('Data Platform bağlı değil');
      }
      
      await this.influxClient.deleteData(deleteOptions);
      
      this.logger.info('Veri silme işlemi tamamlandı');
      this.emit('dataDeleted', deleteOptions);
      
      return true;
    } catch (error) {
      this.logger.error(`Veri silme hatası: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Buffer'daki verileri flush eder
   * @returns {Promise<boolean>} Flush başarılı ise true döner
   */
  async flush() {
    try {
      if (this.influxClient) {
        await this.influxClient.flush();
        this.logger.debug('Data Platform flush tamamlandı');
        this.emit('flushed');
      }
      return true;
    } catch (error) {
      this.logger.error(`Flush hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Platform durumunu döndürür
   * @returns {Object} Platform durumu
   */
  getStatus() {
    return {
      connected: this.connected,
      influxdb: this.influxClient ? this.influxClient.getStatus() : null,
      stats: {
        ...this.stats,
        uptime: Date.now() - this.stats.startTime.getTime()
      },
      config: {
        influxdb: {
          url: this.config.influxdb.url,
          org: this.config.influxdb.org,
          bucket: this.config.influxdb.bucket
        },
        processing: this.config.processing
      }
    };
  }
  
  /**
   * Platform istatistiklerini döndürür
   * @returns {Object} Platform istatistikleri
   */
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime.getTime(),
      pointsPerSecond: this.stats.pointsWritten / ((Date.now() - this.stats.startTime.getTime()) / 1000),
      errorRate: this.stats.errors / (this.stats.pointsWritten + this.stats.errors) * 100,
      streamProcessor: this.streamProcessor ? this.streamProcessor.getStreamStats() : null
    };
  }
  
  /**
   * Stream processing için aggregated veri döndürür
   * @param {string} topic - Topic adı
   * @param {Object} options - Aggregation seçenekleri
   * @returns {Object|null} Aggregated veri
   */
  getAggregatedData(topic, options = {}) {
    if (!this.streamProcessor) {
      throw new Error('Stream processor aktif değil');
    }
    
    return this.streamProcessor.getAggregatedData(topic, options);
  }
  
  /**
   * Alert threshold'larını ayarlar
   * @param {string} topic - Topic adı
   * @param {Object} thresholds - Threshold değerleri
   */
  setAlertThresholds(topic, thresholds) {
    if (!this.streamProcessor) {
      throw new Error('Stream processor aktif değil');
    }
    
    this.streamProcessor.setAlertThresholds(topic, thresholds);
    this.logger.info(`Alert threshold'ları ayarlandı: ${topic}`, thresholds);
  }
  
  /**
   * Stream processing istatistiklerini döndürür
   * @param {string} topic - Topic adı (opsiyonel)
   * @returns {Object} Stream istatistikleri
   */
  getStreamStats(topic = null) {
    if (!this.streamProcessor) {
      return null;
    }
    
    return this.streamProcessor.getStreamStats(topic);
  }
  
  /**
   * InfluxDB'yi başlatır
   * @private
   */
  async _initializeInfluxDB() {
    try {
      this.influxClient = new InfluxDBClient(this.config.influxdb);
      await this.influxClient.connect();
      this.logger.info('InfluxDB bağlantısı kuruldu');
    } catch (error) {
      this.logger.error(`InfluxDB başlatma hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Stream Processor'ı başlatır
   * @private
   */
  async _initializeStreamProcessor() {
    try {
      if (this.config.processing.enabled) {
        this.streamProcessor = new StreamProcessor({
          windowSize: this.config.processing.windowSize,
          aggregationInterval: this._parseInterval(this.config.processing.aggregationInterval),
          enableAlerting: this.config.processing.alerting,
          maxBufferSize: this.config.processing.maxBufferSize,
          alertThresholds: this.config.processing.alertThresholds
        });
        
        await this.streamProcessor.start();
        this.logger.info('Stream Processor başlatıldı');
      }
    } catch (error) {
      this.logger.error(`Stream Processor başlatma hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Event handler'ları ayarlar
   * @private
   */
  _setupEventHandlers() {
    if (this.influxClient) {
      this.influxClient.on('error', (error) => {
        this.logger.error(`InfluxDB hatası: ${error.message}`);
        this.emit('influxError', error);
      });
      
      this.influxClient.on('flushed', (pointCount) => {
        this.logger.debug(`InfluxDB flush: ${pointCount} nokta`);
        this.emit('influxFlushed', pointCount);
      });
      
      this.influxClient.on('connected', () => {
        this.logger.info('InfluxDB bağlantısı kuruldu');
        this.emit('influxConnected');
      });
      
      this.influxClient.on('disconnected', () => {
        this.logger.warn('InfluxDB bağlantısı kesildi');
        this.emit('influxDisconnected');
      });
    }
    
    // Stream processor event'leri
    if (this.streamProcessor) {
      this.streamProcessor.on('alert', (alert) => {
        this.logger.warn(`Stream alert: ${alert.topic}`, alert);
        this.emit('streamAlert', alert);
      });
      
      this.streamProcessor.on('alertCleared', (alertCleared) => {
        this.logger.info(`Stream alert cleared: ${alertCleared.topic}`, alertCleared);
        this.emit('streamAlertCleared', alertCleared);
      });
      
      this.streamProcessor.on('aggregated', (aggregated) => {
        this.logger.debug(`Stream aggregated: ${aggregated.topic}`);
        this.emit('streamAggregated', aggregated);
      });
      
      this.streamProcessor.on('error', (error) => {
        this.logger.error(`Stream processor hatası: ${error.message}`);
        this.emit('streamError', error);
      });
    }
  }
  
  /**
   * UNS veri formatını doğrular
   * @param {Object} unsData - UNS verisi
   * @returns {boolean} Geçerli ise true döner
   * @private
   */
  _validateUNSData(unsData) {
    if (!unsData || typeof unsData !== 'object') {
      return false;
    }
    
    if (!unsData.topic || typeof unsData.topic !== 'string') {
      return false;
    }
    
    if (!unsData.payload || typeof unsData.payload !== 'object') {
      return false;
    }
    
    if (unsData.payload.value === undefined || unsData.payload.value === null) {
      return false;
    }
    
    if (!unsData.payload.timestamp) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Processing timer'ı başlatır
   * @private
   */
  _startProcessing() {
    if (this.config.processing.aggregationInterval) {
      const interval = this._parseInterval(this.config.processing.aggregationInterval);
      
      this.processingTimer = setInterval(async () => {
        try {
          await this._performAggregation();
        } catch (error) {
          this.logger.error(`Aggregation hatası: ${error.message}`);
        }
      }, interval);
      
      this.logger.info(`Processing timer başlatıldı: ${this.config.processing.aggregationInterval}`);
    }
  }
  
  /**
   * Processing timer'ı durdurur
   * @private
   */
  _stopProcessing() {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
      this.logger.info('Processing timer durduruldu');
    }
  }
  
  /**
   * Aggregation işlemini gerçekleştirir
   * @private
   */
  async _performAggregation() {
    try {
      // Temel aggregation işlemleri
      // Bu kısım gelecekte genişletilebilir
      this.logger.debug('Aggregation işlemi gerçekleştirildi');
      this.emit('aggregationCompleted');
    } catch (error) {
      this.logger.error(`Aggregation hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Interval string'ini milisaniyeye çevirir
   * @param {string} interval - Interval string'i (örn: "1m", "30s")
   * @returns {number} Milisaniye cinsinden interval
   * @private
   */
  _parseInterval(interval) {
    const match = interval.match(/^(\d+)(ms|s|m|h)$/);
    if (!match) {
      return 60000; // Varsayılan 1 dakika
    }
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    switch (unit) {
      case 'ms':
        return value;
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      default:
        return 60000;
    }
  }
}

module.exports = DataPlatform; 