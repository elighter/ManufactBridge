/**
 * @fileoverview ManufactBridge - Stream Processing Engine
 * Bu modül, gerçek zamanlı veri işleme ve aggregation işlemlerini yönetir.
 */

const EventEmitter = require('eventemitter3');
const winston = require('winston');

/**
 * Stream Processor Sınıfı
 * Gerçek zamanlı veri akışlarını işler ve aggregation yapar
 */
class StreamProcessor extends EventEmitter {
  /**
   * StreamProcessor constructor'ı
   * @param {Object} config - Stream processor konfigürasyonu
   */
  constructor(config = {}) {
    super();
    
    this.config = {
      windowSize: config.windowSize || 60000, // 1 dakika
      aggregationInterval: config.aggregationInterval || 30000, // 30 saniye
      alertThresholds: config.alertThresholds || {},
      enableAlerting: config.enableAlerting !== false,
      maxBufferSize: config.maxBufferSize || 10000,
      ...config
    };
    
    // Veri buffer'ları
    this.dataStreams = new Map(); // topic -> data array
    this.aggregatedData = new Map(); // topic -> aggregated values
    this.alertStates = new Map(); // topic -> alert state
    
    // Timer'lar
    this.aggregationTimer = null;
    this.cleanupTimer = null;
    
    // İstatistikler
    this.stats = {
      processedPoints: 0,
      aggregatedPoints: 0,
      alertsTriggered: 0,
      droppedPoints: 0,
      startTime: new Date()
    };
    
    // Logger konfigürasyonu
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'stream-processor' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/stream-processor.log' })
      ]
    });
    
    this.logger.info('Stream Processor oluşturuldu');
  }
  
  /**
   * Stream processor'ı başlatır
   * @returns {Promise<boolean>} Başlatma başarılı ise true döner
   */
  async start() {
    try {
      this.logger.info('Stream Processor başlatılıyor...');
      
      // Aggregation timer'ı başlat
      this._startAggregationTimer();
      
      // Cleanup timer'ı başlat
      this._startCleanupTimer();
      
      this.logger.info('Stream Processor başarıyla başlatıldı');
      this.emit('started');
      
      return true;
    } catch (error) {
      this.logger.error(`Stream Processor başlatma hatası: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Stream processor'ı durdurur
   * @returns {Promise<boolean>} Durdurma başarılı ise true döner
   */
  async stop() {
    try {
      this.logger.info('Stream Processor durduruluyor...');
      
      // Timer'ları durdur
      this._stopAggregationTimer();
      this._stopCleanupTimer();
      
      // Son aggregation'ı yap
      await this._performAggregation();
      
      this.logger.info('Stream Processor durduruldu');
      this.emit('stopped');
      
      return true;
    } catch (error) {
      this.logger.error(`Stream Processor durdurma hatası: ${error.message}`);
      return false;
    }
  }
  
  /**
   * UNS verisini stream'e ekler
   * @param {Object} unsData - UNS formatındaki veri
   * @returns {boolean} İşlem başarılı ise true döner
   */
  processUNSData(unsData) {
    try {
      if (!this._validateUNSData(unsData)) {
        this.stats.droppedPoints++;
        return false;
      }
      
      const topic = unsData.topic;
      const timestamp = new Date(unsData.payload.timestamp);
      const value = unsData.payload.value;
      
      // Stream buffer'ına ekle
      if (!this.dataStreams.has(topic)) {
        this.dataStreams.set(topic, []);
      }
      
      const stream = this.dataStreams.get(topic);
      
      // Buffer boyutu kontrolü
      if (stream.length >= this.config.maxBufferSize) {
        stream.shift(); // En eski veriyi çıkar
        this.stats.droppedPoints++;
      }
      
      stream.push({
        timestamp,
        value,
        quality: unsData.payload.quality || 'unknown',
        metadata: unsData.payload.metadata || {}
      });
      
      this.stats.processedPoints++;
      
      // Alert kontrolü
      if (this.config.enableAlerting) {
        this._checkAlerts(topic, value, timestamp);
      }
      
      this.emit('dataProcessed', { topic, value, timestamp });
      
      return true;
    } catch (error) {
      this.logger.error(`Stream processing hatası: ${error.message}`);
      this.stats.droppedPoints++;
      return false;
    }
  }
  
  /**
   * Belirli bir topic için aggregated veri döndürür
   * @param {string} topic - Topic adı
   * @param {Object} options - Aggregation seçenekleri
   * @returns {Object|null} Aggregated veri
   */
  getAggregatedData(topic, options = {}) {
    const {
      startTime,
      endTime = new Date(),
      aggregationType = 'all'
    } = options;
    
    if (!this.aggregatedData.has(topic)) {
      return null;
    }
    
    const data = this.aggregatedData.get(topic);
    
    // Zaman filtresi uygula
    if (startTime) {
      const filteredData = data.filter(item => 
        item.timestamp >= startTime && item.timestamp <= endTime
      );
      
      if (aggregationType === 'latest') {
        return filteredData[filteredData.length - 1] || null;
      }
      
      return filteredData;
    }
    
    if (aggregationType === 'latest') {
      return data[data.length - 1] || null;
    }
    
    return data;
  }
  
  /**
   * Topic'ler için real-time istatistikleri döndürür
   * @param {string} topic - Topic adı (opsiyonel)
   * @returns {Object} İstatistikler
   */
  getStreamStats(topic = null) {
    if (topic) {
      const stream = this.dataStreams.get(topic);
      const aggregated = this.aggregatedData.get(topic);
      
      return {
        topic,
        bufferSize: stream ? stream.length : 0,
        aggregatedPoints: aggregated ? aggregated.length : 0,
        lastUpdate: stream && stream.length > 0 ? 
          stream[stream.length - 1].timestamp : null
      };
    }
    
    // Tüm topic'ler için genel istatistikler
    const topicStats = {};
    for (const [topicName] of this.dataStreams) {
      topicStats[topicName] = this.getStreamStats(topicName);
    }
    
    return {
      general: {
        ...this.stats,
        uptime: Date.now() - this.stats.startTime.getTime(),
        activeTopics: this.dataStreams.size,
        totalBufferSize: Array.from(this.dataStreams.values())
          .reduce((sum, stream) => sum + stream.length, 0)
      },
      topics: topicStats
    };
  }
  
  /**
   * Alert threshold'larını ayarlar
   * @param {string} topic - Topic adı
   * @param {Object} thresholds - Threshold değerleri
   */
  setAlertThresholds(topic, thresholds) {
    this.config.alertThresholds[topic] = {
      min: thresholds.min,
      max: thresholds.max,
      enabled: thresholds.enabled !== false,
      ...thresholds
    };
    
    this.logger.info(`Alert threshold'ları ayarlandı: ${topic}`, thresholds);
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
   * Aggregation timer'ı başlatır
   * @private
   */
  _startAggregationTimer() {
    this.aggregationTimer = setInterval(async () => {
      try {
        await this._performAggregation();
      } catch (error) {
        this.logger.error(`Aggregation hatası: ${error.message}`);
      }
    }, this.config.aggregationInterval);
    
    this.logger.info(`Aggregation timer başlatıldı: ${this.config.aggregationInterval}ms`);
  }
  
  /**
   * Aggregation timer'ı durdurur
   * @private
   */
  _stopAggregationTimer() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
      this.logger.info('Aggregation timer durduruldu');
    }
  }
  
  /**
   * Cleanup timer'ı başlatır
   * @private
   */
  _startCleanupTimer() {
    // Her 5 dakikada bir eski verileri temizle
    this.cleanupTimer = setInterval(() => {
      this._cleanupOldData();
    }, 300000);
    
    this.logger.info('Cleanup timer başlatıldı');
  }
  
  /**
   * Cleanup timer'ı durdurur
   * @private
   */
  _stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      this.logger.info('Cleanup timer durduruldu');
    }
  }
  
  /**
   * Aggregation işlemini gerçekleştirir
   * @private
   */
  async _performAggregation() {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.windowSize);
    
    for (const [topic, stream] of this.dataStreams) {
      if (stream.length === 0) continue;
      
      // Window içindeki verileri filtrele
      const windowData = stream.filter(item => item.timestamp >= windowStart);
      
      if (windowData.length === 0) continue;
      
      // Aggregation hesapla
      const values = windowData.map(item => item.value).filter(v => typeof v === 'number');
      
      if (values.length === 0) continue;
      
      const aggregated = {
        timestamp: now,
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((sum, val) => sum + val, 0) / values.length,
        sum: values.reduce((sum, val) => sum + val, 0),
        first: windowData[0].value,
        last: windowData[windowData.length - 1].value,
        quality: this._calculateQuality(windowData)
      };
      
      // Aggregated data'ya ekle
      if (!this.aggregatedData.has(topic)) {
        this.aggregatedData.set(topic, []);
      }
      
      const aggregatedStream = this.aggregatedData.get(topic);
      aggregatedStream.push(aggregated);
      
      // Eski aggregated verileri temizle (son 24 saat)
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const filteredAggregated = aggregatedStream.filter(item => item.timestamp >= cutoff);
      this.aggregatedData.set(topic, filteredAggregated);
      
      this.stats.aggregatedPoints++;
      
      this.emit('aggregated', { topic, data: aggregated });
    }
  }
  
  /**
   * Veri kalitesini hesaplar
   * @param {Array} windowData - Window içindeki veriler
   * @returns {string} Kalite değeri
   * @private
   */
  _calculateQuality(windowData) {
    const qualities = windowData.map(item => item.quality);
    const goodCount = qualities.filter(q => q === 'good').length;
    const totalCount = qualities.length;
    
    const goodRatio = goodCount / totalCount;
    
    if (goodRatio >= 0.9) return 'good';
    if (goodRatio >= 0.7) return 'uncertain';
    return 'bad';
  }
  
  /**
   * Alert kontrolü yapar
   * @param {string} topic - Topic adı
   * @param {number} value - Değer
   * @param {Date} timestamp - Zaman damgası
   * @private
   */
  _checkAlerts(topic, value, timestamp) {
    const thresholds = this.config.alertThresholds[topic];
    
    if (!thresholds || !thresholds.enabled) {
      return;
    }
    
    const currentState = this.alertStates.get(topic) || { active: false, type: null };
    let alertTriggered = false;
    let alertType = null;
    
    // Min threshold kontrolü
    if (thresholds.min !== undefined && value < thresholds.min) {
      alertTriggered = true;
      alertType = 'min';
    }
    
    // Max threshold kontrolü
    if (thresholds.max !== undefined && value > thresholds.max) {
      alertTriggered = true;
      alertType = 'max';
    }
    
    // Alert durumu değişti mi?
    if (alertTriggered && (!currentState.active || currentState.type !== alertType)) {
      // Yeni alert
      this.alertStates.set(topic, { active: true, type: alertType, startTime: timestamp });
      this.stats.alertsTriggered++;
      
      const alert = {
        topic,
        type: alertType,
        value,
        threshold: alertType === 'min' ? thresholds.min : thresholds.max,
        timestamp,
        severity: thresholds.severity || 'warning'
      };
      
      this.logger.warn(`Alert tetiklendi: ${topic}`, alert);
      this.emit('alert', alert);
      
    } else if (!alertTriggered && currentState.active) {
      // Alert sona erdi
      this.alertStates.set(topic, { active: false, type: null });
      
      const alertCleared = {
        topic,
        type: 'cleared',
        value,
        timestamp,
        previousAlert: currentState.type
      };
      
      this.logger.info(`Alert temizlendi: ${topic}`, alertCleared);
      this.emit('alertCleared', alertCleared);
    }
  }
  
  /**
   * Eski verileri temizler
   * @private
   */
  _cleanupOldData() {
    const cutoff = new Date(Date.now() - this.config.windowSize * 2);
    let cleanedCount = 0;
    
    for (const [topic, stream] of this.dataStreams) {
      const originalLength = stream.length;
      const filteredStream = stream.filter(item => item.timestamp >= cutoff);
      
      if (filteredStream.length < originalLength) {
        this.dataStreams.set(topic, filteredStream);
        cleanedCount += originalLength - filteredStream.length;
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.debug(`${cleanedCount} eski veri noktası temizlendi`);
    }
  }
}

module.exports = StreamProcessor; 