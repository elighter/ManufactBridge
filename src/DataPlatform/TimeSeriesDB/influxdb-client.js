/**
 * @fileoverview ManufactBridge - InfluxDB Time Series Database Client
 * Bu modül, InfluxDB ile veri yazma ve okuma işlemlerini yönetir.
 */

const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const { DeleteAPI } = require('@influxdata/influxdb-client-apis');
const winston = require('winston');
const EventEmitter = require('eventemitter3');

/**
 * InfluxDB Client Sınıfı
 * Time series verilerini InfluxDB'ye yazma ve okuma işlemlerini yönetir
 */
class InfluxDBClient extends EventEmitter {
  /**
   * InfluxDB Client constructor'ı
   * @param {Object} config - InfluxDB konfigürasyonu
   */
  constructor(config) {
    super();
    
    this.config = {
      url: config.url || 'http://localhost:8086',
      token: config.token,
      org: config.org || 'manufactbridge',
      bucket: config.bucket || 'manufacturing_data',
      timeout: config.timeout || 30000,
      batchSize: config.batchSize || 1000,
      flushInterval: config.flushInterval || 5000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      ...config
    };
    
    // InfluxDB client'ı oluştur
    this.influxDB = new InfluxDB({
      url: this.config.url,
      token: this.config.token,
      timeout: this.config.timeout
    });
    
    // Write ve Query API'lerini oluştur
    this.writeApi = this.influxDB.getWriteApi(this.config.org, this.config.bucket);
    this.queryApi = this.influxDB.getQueryApi(this.config.org);
    this.deleteApi = new DeleteAPI(this.influxDB);
    
    // Batch writing konfigürasyonu
    this.writeApi.useDefaultTags({ source: 'manufactbridge' });
    
    // Batch buffer
    this.pointBuffer = [];
    this.flushTimer = null;
    this.connected = false;
    this.writing = false;
    
    // Logger konfigürasyonu
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'influxdb-client' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/influxdb-client.log' })
      ]
    });
    
    this._setupEventHandlers();
    this.logger.info('InfluxDB Client oluşturuldu');
  }
  
  /**
   * Event handler'ları ayarlar
   * @private
   */
  _setupEventHandlers() {
    // Write API olayları
    this.writeApi.on('error', (error) => {
      this.logger.error(`InfluxDB yazma hatası: ${error.message}`);
      this.emit('error', error);
    });
    
    this.writeApi.on('finish', () => {
      this.logger.info('InfluxDB yazma işlemi tamamlandı');
      this.emit('writeFinished');
    });
    
    // Flush timer'ı başlat
    this._startFlushTimer();
  }
  
  /**
   * InfluxDB bağlantısını test eder
   * @returns {Promise<boolean>} Bağlantı başarılı ise true döner
   */
  async connect() {
    try {
      this.logger.info(`InfluxDB'ye bağlanılıyor: ${this.config.url}`);
      
      // Health check
      const health = await this.influxDB.health();
      
      if (health.status === 'pass') {
        this.connected = true;
        this.logger.info('InfluxDB bağlantısı başarılı');
        this.emit('connected');
        return true;
      } else {
        throw new Error(`InfluxDB health check başarısız: ${health.message}`);
      }
    } catch (error) {
      this.connected = false;
      this.logger.error(`InfluxDB bağlantı hatası: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * InfluxDB bağlantısını kapatır
   * @returns {Promise<boolean>} Kapatma başarılı ise true döner
   */
  async disconnect() {
    try {
      this.logger.info('InfluxDB bağlantısı kapatılıyor...');
      
      // Flush timer'ı durdur
      this._stopFlushTimer();
      
      // Bekleyen verileri flush et
      await this.flush();
      
      // Write API'yi kapat
      await this.writeApi.close();
      
      this.connected = false;
      this.logger.info('InfluxDB bağlantısı kapatıldı');
      this.emit('disconnected');
      
      return true;
    } catch (error) {
      this.logger.error(`InfluxDB bağlantı kapatma hatası: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Tek bir veri noktası yazar
   * @param {Object} data - Yazılacak veri
   * @returns {Promise<boolean>} Yazma başarılı ise true döner
   */
  async writePoint(data) {
    try {
      const point = this._createPoint(data);
      
      if (this.config.batchSize === 1) {
        // Immediate write
        this.writeApi.writePoint(point);
        await this.writeApi.flush();
        this.logger.debug(`Veri noktası yazıldı: ${data.measurement}`);
      } else {
        // Batch write
        this.pointBuffer.push(point);
        
        if (this.pointBuffer.length >= this.config.batchSize) {
          await this.flush();
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Veri noktası yazma hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Çoklu veri noktası yazar
   * @param {Array} dataPoints - Yazılacak veri noktaları
   * @returns {Promise<boolean>} Yazma başarılı ise true döner
   */
  async writePoints(dataPoints) {
    try {
      const points = dataPoints.map(data => this._createPoint(data));
      
      if (this.config.batchSize === 1) {
        // Immediate write
        this.writeApi.writePoints(points);
        await this.writeApi.flush();
        this.logger.debug(`${points.length} veri noktası yazıldı`);
      } else {
        // Batch write
        this.pointBuffer.push(...points);
        
        if (this.pointBuffer.length >= this.config.batchSize) {
          await this.flush();
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Çoklu veri noktası yazma hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * UNS formatındaki veriyi InfluxDB formatına dönüştürür ve yazar
   * @param {Object} unsData - UNS formatındaki veri
   * @returns {Promise<boolean>} Yazma başarılı ise true döner
   */
  async writeUNSData(unsData) {
    try {
      // UNS topic'ini parse et
      const topicParts = unsData.topic.split('/');
      
      // ISA-95 hiyerarşisini çıkar
      const [namespace, enterprise, site, area, line, device, dataType, tagName] = topicParts;
      
      const data = {
        measurement: 'manufacturing_data',
        tags: {
          enterprise: enterprise || 'unknown',
          site: site || 'unknown',
          area: area || 'unknown',
          line: line || 'unknown',
          device: device || 'unknown',
          tag_name: tagName || 'unknown',
          protocol: unsData.payload.metadata?.protocol || 'unknown',
          adapter_id: unsData.payload.metadata?.adapterId || 'unknown'
        },
        fields: {
          value: unsData.payload.value,
          quality: unsData.payload.quality || 'unknown'
        },
        timestamp: new Date(unsData.payload.timestamp)
      };
      
      // Metadata'dan ek alanlar ekle
      if (unsData.payload.metadata) {
        const metadata = unsData.payload.metadata;
        
        // OPC UA spesifik alanlar
        if (metadata.opcua) {
          data.tags.node_id = metadata.opcua.nodeId;
          data.fields.status_code = metadata.opcua.statusCode;
        }
        
        // Modbus spesifik alanlar
        if (metadata.modbus) {
          data.tags.modbus_address = metadata.modbus.address;
          data.tags.register_type = metadata.modbus.registerType;
          data.fields.function_code = metadata.modbus.functionCode;
        }
        
        // Veri tipi
        if (metadata.dataType) {
          data.tags.data_type = metadata.dataType;
        }
      }
      
      return await this.writePoint(data);
    } catch (error) {
      this.logger.error(`UNS veri yazma hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Veri sorgular
   * @param {string} query - Flux query
   * @returns {Promise<Array>} Sorgu sonuçları
   */
  async query(query) {
    try {
      this.logger.debug(`InfluxDB sorgusu çalıştırılıyor: ${query}`);
      
      const results = [];
      
      await this.queryApi.queryRows(query, {
        next: (row, tableMeta) => {
          const record = tableMeta.toObject(row);
          results.push(record);
        },
        error: (error) => {
          this.logger.error(`Sorgu hatası: ${error.message}`);
          throw error;
        },
        complete: () => {
          this.logger.debug(`Sorgu tamamlandı, ${results.length} kayıt döndürüldü`);
        }
      });
      
      return results;
    } catch (error) {
      this.logger.error(`InfluxDB sorgu hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Tag değerlerini sorgular
   * @param {Object} options - Sorgu seçenekleri
   * @returns {Promise<Array>} Tag değerleri
   */
  async queryTagValues(options = {}) {
    const {
      enterprise,
      site,
      area,
      line,
      device,
      tagName,
      startTime = '-1h',
      endTime = 'now()',
      aggregateWindow = '1m',
      aggregateFunction = 'mean'
    } = options;
    
    let filters = [`r["_measurement"] == "manufacturing_data"`];
    
    if (enterprise) filters.push(`r["enterprise"] == "${enterprise}"`);
    if (site) filters.push(`r["site"] == "${site}"`);
    if (area) filters.push(`r["area"] == "${area}"`);
    if (line) filters.push(`r["line"] == "${line}"`);
    if (device) filters.push(`r["device"] == "${device}"`);
    if (tagName) filters.push(`r["tag_name"] == "${tagName}"`);
    
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => ${filters.join(' and ')})
        |> filter(fn: (r) => r["_field"] == "value")
        |> aggregateWindow(every: ${aggregateWindow}, fn: ${aggregateFunction}, createEmpty: false)
        |> yield(name: "result")
    `;
    
    return await this.query(query);
  }
  
  /**
   * Veri siler
   * @param {Object} options - Silme seçenekleri
   * @returns {Promise<boolean>} Silme başarılı ise true döner
   */
  async deleteData(options = {}) {
    try {
      const {
        startTime,
        endTime = new Date().toISOString(),
        predicate = ''
      } = options;
      
      if (!startTime) {
        throw new Error('Silme işlemi için başlangıç zamanı gereklidir');
      }
      
      await this.deleteApi.postDelete({
        org: this.config.org,
        bucket: this.config.bucket,
        body: {
          start: startTime,
          stop: endTime,
          predicate: predicate
        }
      });
      
      this.logger.info(`Veri silme işlemi tamamlandı: ${startTime} - ${endTime}`);
      return true;
    } catch (error) {
      this.logger.error(`Veri silme hatası: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Buffer'daki verileri flush eder
   * @returns {Promise<boolean>} Flush başarılı ise true döner
   */
  async flush() {
    if (this.pointBuffer.length === 0 || this.writing) {
      return true;
    }
    
    try {
      this.writing = true;
      const pointsToWrite = [...this.pointBuffer];
      this.pointBuffer = [];
      
      this.writeApi.writePoints(pointsToWrite);
      await this.writeApi.flush();
      
      this.logger.debug(`${pointsToWrite.length} veri noktası flush edildi`);
      this.emit('flushed', pointsToWrite.length);
      
      return true;
    } catch (error) {
      this.logger.error(`Flush hatası: ${error.message}`);
      throw error;
    } finally {
      this.writing = false;
    }
  }
  
  /**
   * Veri noktası oluşturur
   * @param {Object} data - Veri objesi
   * @returns {Point} InfluxDB Point objesi
   * @private
   */
  _createPoint(data) {
    const point = new Point(data.measurement);
    
    // Tags ekle
    if (data.tags) {
      Object.entries(data.tags).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          point.tag(key, String(value));
        }
      });
    }
    
    // Fields ekle
    if (data.fields) {
      Object.entries(data.fields).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (typeof value === 'number') {
            point.floatField(key, value);
          } else if (typeof value === 'boolean') {
            point.booleanField(key, value);
          } else if (typeof value === 'string') {
            point.stringField(key, value);
          } else {
            point.stringField(key, String(value));
          }
        }
      });
    }
    
    // Timestamp ekle
    if (data.timestamp) {
      point.timestamp(data.timestamp);
    }
    
    return point;
  }
  
  /**
   * Flush timer'ı başlatır
   * @private
   */
  _startFlushTimer() {
    if (this.config.flushInterval > 0) {
      this.flushTimer = setInterval(async () => {
        try {
          await this.flush();
        } catch (error) {
          this.logger.error(`Otomatik flush hatası: ${error.message}`);
        }
      }, this.config.flushInterval);
    }
  }
  
  /**
   * Flush timer'ı durdurur
   * @private
   */
  _stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
  
  /**
   * Client durumunu döndürür
   * @returns {Object} Client durumu
   */
  getStatus() {
    return {
      connected: this.connected,
      url: this.config.url,
      org: this.config.org,
      bucket: this.config.bucket,
      bufferSize: this.pointBuffer.length,
      writing: this.writing,
      batchSize: this.config.batchSize,
      flushInterval: this.config.flushInterval
    };
  }
}

module.exports = InfluxDBClient; 