/**
 * ManufactBridge Edge Connector - Connector Manager
 * 
 * Bu sınıf, Edge Connector yönetimini sağlar. Yapılandırma dosyalarından 
 * cihaz konfigürasyonlarını yükler, uygun adaptörleri başlatır ve yönetir.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const EventEmitter = require('eventemitter3');
const winston = require('winston');
const config = require('./config');

class ConnectorManager extends EventEmitter {
  /**
   * Connector Manager sınıfı
   * @param {Object} options Yönetici seçenekleri
   */
  constructor(options = {}) {
    super();
    
    this.options = { ...options };
    this.adapters = new Map();
    this.protocolModules = new Map();
    this.deviceConfigs = new Map();
    this.unsPublisher = options.unsPublisher || null;
    
    // UNS Publisher'ı yapılandır
    if (this.unsPublisher) {
      this._setupUnsPublisher();
    }
    
    // Logger yapılandırması
    this.logger = winston.createLogger({
      level: config.logging.level || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'connector-manager' },
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
    
    this.logger.info('Edge Connector Manager oluşturuldu');
  }
  
  /**
   * UNS Publisher'ı yapılandırır
   * @private
   */
  _setupUnsPublisher() {
    // UNS Publisher olaylarını dinleme
    this.unsPublisher.on('error', (err) => {
      this.logger.error(`UNS Publisher hatası: ${err.message}`, err);
      this.emit('error', {
        source: 'UNS Publisher',
        message: err.message,
        details: err
      });
    });
    
    this.unsPublisher.on('published', (data) => {
      this.logger.debug(`UNS'ye veri gönderildi: ${JSON.stringify(data)}`);
      this.emit('data-published', data);
    });
    
    this.logger.info('UNS Publisher yapılandırıldı');
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
   * Protokol adaptörlerini yükler
   * @returns {Promise<boolean>} Yükleme başarılı olursa true
   */
  async loadProtocolAdapters() {
    try {
      this.logger.info('Protokol adaptörleri yükleniyor...');
      
      // Hazır protokolleri yükle
      const protocols = config.protocols;
      
      for (const [protocolName, protocolConfig] of Object.entries(protocols)) {
        if (!protocolConfig.enabled) {
          this.logger.info(`Protokol devre dışı: ${protocolName}`);
          continue;
        }
        
        try {
          const modulePath = protocolConfig.module_path;
          
          // Modülü yükle
          const AdapterClass = require(modulePath);
          this.protocolModules.set(protocolName, AdapterClass);
          
          this.logger.info(`Protokol adaptörü yüklendi: ${protocolName} (${modulePath})`);
        } catch (error) {
          this.logger.error(`Protokol adaptörü yükleme hatası (${protocolName}): ${error.message}`);
        }
      }
      
      this.logger.info(`Toplam ${this.protocolModules.size} protokol adaptörü yüklendi`);
      return true;
    } catch (error) {
      this.logger.error(`Protokol adaptörleri yüklenirken hata: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Cihaz yapılandırmalarını yükler
   * @returns {Promise<boolean>} Yükleme başarılı olursa true
   */
  async loadDeviceConfigs() {
    try {
      const deviceConfigsPath = config.device_configs_path;
      this.logger.info(`Cihaz yapılandırmaları yükleniyor: ${deviceConfigsPath}`);
      
      // Dizin mevcut değilse oluştur
      if (!fs.existsSync(deviceConfigsPath)) {
        fs.mkdirSync(deviceConfigsPath, { recursive: true });
        this.logger.info(`Cihaz yapılandırma dizini oluşturuldu: ${deviceConfigsPath}`);
        return true;
      }
      
      // Tüm yapılandırma dosyalarını yükle
      const files = fs.readdirSync(deviceConfigsPath);
      
      const configFiles = files.filter(file => 
        file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.json')
      );
      
      this.logger.info(`${configFiles.length} cihaz yapılandırma dosyası bulundu`);
      
      for (const file of configFiles) {
        try {
          const filePath = path.join(deviceConfigsPath, file);
          const content = fs.readFileSync(filePath, 'utf8');
          
          let deviceConfig;
          if (file.endsWith('.json')) {
            deviceConfig = JSON.parse(content);
          } else {
            deviceConfig = yaml.load(content);
          }
          
          // Temel doğrulamaları yap
          if (!deviceConfig.connector || !deviceConfig.connector.id) {
            this.logger.warn(`Geçersiz cihaz yapılandırması (connector.id gerekli): ${file}`);
            continue;
          }
          
          if (!deviceConfig.connector.protocol) {
            this.logger.warn(`Geçersiz cihaz yapılandırması (connector.protocol gerekli): ${file}`);
            continue;
          }
          
          // Yapılandırmayı kaydet
          this.deviceConfigs.set(deviceConfig.connector.id, {
            config: deviceConfig,
            filePath
          });
          
          this.logger.info(`Cihaz yapılandırması yüklendi: ${deviceConfig.connector.id} (${deviceConfig.connector.protocol})`);
        } catch (error) {
          this.logger.error(`Cihaz yapılandırması yükleme hatası (${file}): ${error.message}`);
        }
      }
      
      this.logger.info(`Toplam ${this.deviceConfigs.size} cihaz yapılandırması yüklendi`);
      return true;
    } catch (error) {
      this.logger.error(`Cihaz yapılandırmaları yüklenirken hata: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Adaptörleri başlatır
   * @returns {Promise<boolean>} Başlatma başarılı olursa true
   */
  async startAdapters() {
    try {
      this.logger.info('Adaptörler başlatılıyor...');
      
      // Protokoller yüklü değilse yükle
      if (this.protocolModules.size === 0) {
        await this.loadProtocolAdapters();
      }
      
      // Yapılandırmalar yüklü değilse yükle
      if (this.deviceConfigs.size === 0) {
        await this.loadDeviceConfigs();
      }
      
      // Her yapılandırma için adaptör oluştur ve başlat
      for (const [deviceId, { config }] of this.deviceConfigs.entries()) {
        try {
          const protocol = config.connector.protocol;
          
          // Protokol modülü mevcut mu?
          if (!this.protocolModules.has(protocol)) {
            this.logger.error(`${deviceId} için protokol adaptörü bulunamadı: ${protocol}`);
            continue;
          }
          
          // Adaptör zaten çalışıyor mu?
          if (this.adapters.has(deviceId)) {
            this.logger.info(`${deviceId} adaptörü zaten çalışıyor`);
            continue;
          }
          
          // Adaptör oluştur
          const AdapterClass = this.protocolModules.get(protocol);
          const adapter = new AdapterClass(config.connector);
          
          // Adaptör olaylarını dinle
          this._setupAdapterEvents(adapter);
          
          // Adaptörü başlat
          await adapter.connect();
          
          // Adaptörü kaydet
          this.adapters.set(deviceId, adapter);
          
          this.logger.info(`${deviceId} (${protocol}) adaptörü başlatıldı`);
        } catch (error) {
          this.logger.error(`${deviceId} adaptörü başlatılırken hata: ${error.message}`);
        }
      }
      
      this.logger.info(`Toplam ${this.adapters.size} adaptör başlatıldı`);
      return true;
    } catch (error) {
      this.logger.error(`Adaptörler başlatılırken hata: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Adaptör olaylarını dinler
   * @param {BaseAdapter} adapter Adaptör
   * @private
   */
  _setupAdapterEvents(adapter) {
    adapter.on('data', (data) => {
      this.logger.debug(`Veri alındı: ${data.name} = ${data.value}`);
      
      // UNS Publisher varsa, veriyi UNS'ye gönder
      if (this.unsPublisher) {
        try {
          // Veriyi UNS formatına dönüştür
          const unsData = {
            topic: this._generateTopicForTag(adapter, data.name),
            payload: {
              timestamp: data.timestamp.toISOString(),
              value: data.value,
              quality: data.quality,
              metadata: {
                adapterId: adapter.id,
                adapterName: adapter.name,
                adapterType: adapter.type,
                ...data.tag
              }
            }
          };
          
          // UNS'ye gönder
          this.unsPublisher.publish(unsData.topic, unsData.payload);
        } catch (error) {
          this.logger.error(`UNS'ye veri gönderilirken hata: ${error.message}`);
        }
      }
      
      // 'data' olayını dışarıya ilet
      this.emit('data', {
        adapterId: adapter.id,
        adapterName: adapter.name,
        ...data
      });
    });
    
    adapter.on('error', (error) => {
      this.logger.error(`Adaptör hatası (${adapter.id}): ${error.message}`);
      this.emit('adapter-error', {
        adapterId: adapter.id,
        adapterName: adapter.name,
        ...error
      });
    });
  }
  
  /**
   * Tag için UNS konu yolunu oluşturur
   * @param {BaseAdapter} adapter Adaptör
   * @param {string} tagName Tag ismi
   * @returns {string} UNS konu yolu
   * @private
   */
  _generateTopicForTag(adapter, tagName) {
    // Varsayılan konu formatı
    const baseTopic = 'manufactbridge';
    
    // Adaptör yapılandırmasından konu bilgilerini al
    const mapping = adapter.options.mapping || {};
    const enterprise = mapping.enterprise || 'default';
    const site = mapping.site || 'default';
    const area = mapping.area || 'default';
    const line = mapping.line || 'default';
    const device = mapping.device || adapter.name;
    
    // ISA-95 temelli konu yolu oluştur
    return `${baseTopic}/${enterprise}/${site}/${area}/${line}/${device}/data/${tagName}`;
  }
  
  /**
   * Adaptörleri durdurur
   * @returns {Promise<boolean>} İşlem başarılıysa true
   */
  async stopAdapters() {
    try {
      this.logger.info('Adaptörler durduruluyor...');
      
      const promises = [];
      
      for (const [deviceId, adapter] of this.adapters.entries()) {
        promises.push(
          adapter.disconnect()
            .then(() => {
              this.logger.info(`${deviceId} adaptörü durduruldu`);
              return true;
            })
            .catch(error => {
              this.logger.error(`${deviceId} adaptörü durdurulurken hata: ${error.message}`);
              return false;
            })
        );
      }
      
      const results = await Promise.all(promises);
      const success = results.every(result => result === true);
      
      if (success) {
        this.adapters.clear();
        this.logger.info('Tüm adaptörler durduruldu');
      } else {
        this.logger.warn('Bazı adaptörler durdurulamadı');
      }
      
      return success;
    } catch (error) {
      this.logger.error(`Adaptörler durdurulurken hata: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Tek bir adaptörü başlatır
   * @param {string} adapterId Adaptör ID'si
   * @returns {Promise<boolean>} İşlem başarılıysa true
   */
  async startAdapter(adapterId) {
    try {
      // Adaptör yapılandırması mevcut mu?
      if (!this.deviceConfigs.has(adapterId)) {
        this.logger.error(`${adapterId} için yapılandırma bulunamadı`);
        return false;
      }
      
      // Adaptör zaten çalışıyor mu?
      if (this.adapters.has(adapterId)) {
        this.logger.info(`${adapterId} adaptörü zaten çalışıyor`);
        return true;
      }
      
      const { config } = this.deviceConfigs.get(adapterId);
      const protocol = config.connector.protocol;
      
      // Protokol modülü mevcut mu?
      if (!this.protocolModules.has(protocol)) {
        this.logger.error(`${adapterId} için protokol adaptörü bulunamadı: ${protocol}`);
        return false;
      }
      
      // Adaptör oluştur
      const AdapterClass = this.protocolModules.get(protocol);
      const adapter = new AdapterClass(config.connector);
      
      // Adaptör olaylarını dinle
      this._setupAdapterEvents(adapter);
      
      // Adaptörü başlat
      await adapter.connect();
      
      // Adaptörü kaydet
      this.adapters.set(adapterId, adapter);
      
      this.logger.info(`${adapterId} (${protocol}) adaptörü başlatıldı`);
      return true;
    } catch (error) {
      this.logger.error(`${adapterId} adaptörü başlatılırken hata: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Tek bir adaptörü durdurur
   * @param {string} adapterId Adaptör ID'si
   * @returns {Promise<boolean>} İşlem başarılıysa true
   */
  async stopAdapter(adapterId) {
    try {
      // Adaptör çalışıyor mu?
      if (!this.adapters.has(adapterId)) {
        this.logger.warn(`${adapterId} adaptörü zaten çalışmıyor`);
        return true;
      }
      
      const adapter = this.adapters.get(adapterId);
      
      // Adaptörü durdur
      await adapter.disconnect();
      
      // Adaptörü kaldır
      this.adapters.delete(adapterId);
      
      this.logger.info(`${adapterId} adaptörü durduruldu`);
      return true;
    } catch (error) {
      this.logger.error(`${adapterId} adaptörü durdurulurken hata: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Tüm adaptörlerin durumunu döndürür
   * @returns {Array} Adaptör durumları
   */
  getAdapters() {
    const adapters = [];
    
    // Yapılandırılmış tüm adaptörleri gez
    for (const [deviceId, { config }] of this.deviceConfigs.entries()) {
      const isRunning = this.adapters.has(deviceId);
      
      adapters.push({
        id: deviceId,
        protocol: config.connector.protocol,
        running: isRunning,
        status: isRunning ? this.adapters.get(deviceId).getStatus() : null,
        config: config
      });
    }
    
    return adapters;
  }
  
  /**
   * Cihaz yapılandırmasını günceller veya ekler
   * @param {Object} deviceConfig Cihaz yapılandırması
   * @param {boolean} restart Yapılandırmadan sonra adaptörü yeniden başlat
   * @returns {Promise<boolean>} İşlem başarılıysa true
   */
  async setDeviceConfig(deviceConfig, restart = true) {
    try {
      // Temel doğrulamaları yap
      if (!deviceConfig.connector || !deviceConfig.connector.id) {
        throw new Error('Geçersiz cihaz yapılandırması (connector.id gerekli)');
      }
      
      if (!deviceConfig.connector.protocol) {
        throw new Error('Geçersiz cihaz yapılandırması (connector.protocol gerekli)');
      }
      
      const deviceId = deviceConfig.connector.id;
      const deviceConfigsPath = config.device_configs_path;
      
      // Dizin mevcut değilse oluştur
      if (!fs.existsSync(deviceConfigsPath)) {
        fs.mkdirSync(deviceConfigsPath, { recursive: true });
      }
      
      // Yapılandırma dosyasını oluştur/güncelle
      const filePath = path.join(deviceConfigsPath, `${deviceId}.yaml`);
      const yamlContent = yaml.dump(deviceConfig);
      
      fs.writeFileSync(filePath, yamlContent, 'utf8');
      
      // Yapılandırmayı kaydet
      this.deviceConfigs.set(deviceId, {
        config: deviceConfig,
        filePath
      });
      
      this.logger.info(`Cihaz yapılandırması kaydedildi: ${deviceId}`);
      
      // Adaptör zaten çalışıyorsa, yeniden başlat
      if (restart && this.adapters.has(deviceId)) {
        await this.stopAdapter(deviceId);
        await this.startAdapter(deviceId);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Cihaz yapılandırması güncellenirken hata: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Cihaz yapılandırmasını siler
   * @param {string} adapterId Adaptör ID'si
   * @param {boolean} stopRunning Çalışıyorsa adaptörü durdur
   * @returns {Promise<boolean>} İşlem başarılıysa true
   */
  async deleteDeviceConfig(adapterId, stopRunning = true) {
    try {
      // Yapılandırma mevcut mu?
      if (!this.deviceConfigs.has(adapterId)) {
        this.logger.warn(`${adapterId} için yapılandırma bulunamadı`);
        return false;
      }
      
      // Adaptör çalışıyorsa durdur
      if (stopRunning && this.adapters.has(adapterId)) {
        await this.stopAdapter(adapterId);
      }
      
      // Yapılandırma dosyasını sil
      const { filePath } = this.deviceConfigs.get(adapterId);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      // Yapılandırmayı kaldır
      this.deviceConfigs.delete(adapterId);
      
      this.logger.info(`Cihaz yapılandırması silindi: ${adapterId}`);
      return true;
    } catch (error) {
      this.logger.error(`Cihaz yapılandırması silinirken hata: ${error.message}`);
      return false;
    }
  }
}

module.exports = ConnectorManager; 