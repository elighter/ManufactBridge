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
const config = require('../config');

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
          // Protokol adaptörünü al
          const protocolName = config.connector.protocol;
          const AdapterClass = this.protocolModules.get(protocolName);
          
          if (!AdapterClass) {
            this.logger.error(`Protokol adaptörü bulunamadı: ${protocolName} (${deviceId})`);
            continue;
          }
          
          // Eğer aynı id ile bir adaptör zaten varsa atla
          if (this.adapters.has(deviceId)) {
            this.logger.warn(`Bu id ile bir adaptör zaten çalışıyor: ${deviceId}`);
            continue;
          }
          
          // Adaptör örneği oluştur
          const adapter = new AdapterClass({
            ...config.connector,
            id: deviceId
          });
          
          // Tag'leri ekle
          if (config.tags && Array.isArray(config.tags)) {
            adapter.addTags(config.tags);
          }
          
          // Adaptör olaylarını dinle
          this._setupAdapterEvents(adapter);
          
          // Adaptörü başlat
          await adapter.connect();
          
          // Adaptörü kaydet
          this.adapters.set(deviceId, adapter);
          
          this.logger.info(`Adaptör başlatıldı: ${deviceId} (${protocolName})`);
        } catch (error) {
          this.logger.error(`Adaptör başlatma hatası (${deviceId}): ${error.message}`);
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
   * @param {BaseAdapter} adapter Dinlenecek adaptör
   * @private
   */
  _setupAdapterEvents(adapter) {
    // Veri olayı
    adapter.on('data', (tagName, value, timestamp, quality, statusCode) => {
      this.emit('data', {
        adapterId: adapter.id,
        adapterName: adapter.name,
        adapterType: adapter.type,
        tagName,
        value,
        timestamp,
        quality,
        statusCode
      });
    });
    
    // Hata olayı
    adapter.on('error', (error) => {
      this.emit('error', {
        ...error,
        adapterId: adapter.id,
        adapterName: adapter.name,
        adapterType: adapter.type
      });
    });
    
    // Bağlantı olayları
    adapter.on('connected', () => {
      this.emit('adapterConnected', {
        adapterId: adapter.id,
        adapterName: adapter.name,
        adapterType: adapter.type
      });
    });
    
    adapter.on('disconnected', () => {
      this.emit('adapterDisconnected', {
        adapterId: adapter.id,
        adapterName: adapter.name,
        adapterType: adapter.type
      });
    });
  }
  
  /**
   * Tüm adaptörleri durdurur
   * @returns {Promise<boolean>} Durdurma başarılı olursa true
   */
  async stopAdapters() {
    try {
      this.logger.info('Adaptörler durduruluyor...');
      
      const stopPromises = [];
      
      for (const [adapterId, adapter] of this.adapters.entries()) {
        try {
          this.logger.info(`Adaptör durduruluyor: ${adapterId}`);
          stopPromises.push(adapter.disconnect());
        } catch (error) {
          this.logger.error(`Adaptör durdurma hatası (${adapterId}): ${error.message}`);
        }
      }
      
      await Promise.all(stopPromises);
      
      this.adapters.clear();
      this.logger.info('Tüm adaptörler durduruldu');
      return true;
    } catch (error) {
      this.logger.error(`Adaptörler durdurulurken hata: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Tek bir adaptörü başlatır
   * @param {string} adapterId Başlatılacak adaptör id'si
   * @returns {Promise<boolean>} Başlatma başarılı olursa true
   */
  async startAdapter(adapterId) {
    try {
      // Adaptör zaten çalışıyorsa
      if (this.adapters.has(adapterId)) {
        this.logger.warn(`Adaptör zaten çalışıyor: ${adapterId}`);
        return true;
      }
      
      // Yapılandırmayı kontrol et
      if (!this.deviceConfigs.has(adapterId)) {
        this.logger.error(`Adaptör yapılandırması bulunamadı: ${adapterId}`);
        return false;
      }
      
      const { config } = this.deviceConfigs.get(adapterId);
      const protocolName = config.connector.protocol;
      
      // Protokolü kontrol et
      const AdapterClass = this.protocolModules.get(protocolName);
      if (!AdapterClass) {
        this.logger.error(`Protokol adaptörü bulunamadı: ${protocolName} (${adapterId})`);
        return false;
      }
      
      // Adaptör örneği oluştur
      const adapter = new AdapterClass({
        ...config.connector,
        id: adapterId
      });
      
      // Tag'leri ekle
      if (config.tags && Array.isArray(config.tags)) {
        adapter.addTags(config.tags);
      }
      
      // Adaptör olaylarını dinle
      this._setupAdapterEvents(adapter);
      
      // Adaptörü başlat
      await adapter.connect();
      
      // Adaptörü kaydet
      this.adapters.set(adapterId, adapter);
      
      this.logger.info(`Adaptör başlatıldı: ${adapterId} (${protocolName})`);
      return true;
    } catch (error) {
      this.logger.error(`Adaptör başlatma hatası (${adapterId}): ${error.message}`);
      return false;
    }
  }
  
  /**
   * Tek bir adaptörü durdurur
   * @param {string} adapterId Durdurulacak adaptör id'si
   * @returns {Promise<boolean>} Durdurma başarılı olursa true
   */
  async stopAdapter(adapterId) {
    try {
      if (!this.adapters.has(adapterId)) {
        this.logger.warn(`Adaptör çalışmıyor: ${adapterId}`);
        return false;
      }
      
      const adapter = this.adapters.get(adapterId);
      await adapter.disconnect();
      
      this.adapters.delete(adapterId);
      this.logger.info(`Adaptör durduruldu: ${adapterId}`);
      return true;
    } catch (error) {
      this.logger.error(`Adaptör durdurma hatası (${adapterId}): ${error.message}`);
      return false;
    }
  }
  
  /**
   * Adaptör listesini döndürür
   * @returns {Array} Adaptör listesi
   */
  getAdapters() {
    const adapterList = [];
    
    for (const [adapterId, adapter] of this.adapters.entries()) {
      adapterList.push({
        id: adapterId,
        name: adapter.name,
        type: adapter.type,
        connected: adapter.connected,
        tagCount: adapter.tags.size
      });
    }
    
    return adapterList;
  }
  
  /**
   * Cihaz yapılandırması ekler veya günceller
   * @param {Object} deviceConfig Cihaz yapılandırması
   * @param {boolean} restart Varsa adaptörü yeniden başlat
   * @returns {Promise<boolean>} İşlem başarılı olursa true
   */
  async setDeviceConfig(deviceConfig, restart = true) {
    try {
      if (!deviceConfig.connector || !deviceConfig.connector.id) {
        this.logger.error('Geçersiz cihaz yapılandırması: connector.id gerekli');
        return false;
      }
      
      const adapterId = deviceConfig.connector.id;
      const protocolName = deviceConfig.connector.protocol;
      
      // Protokolü kontrol et
      if (!this.protocolModules.has(protocolName)) {
        this.logger.error(`Protokol desteklenmiyor: ${protocolName}`);
        return false;
      }
      
      // Yapılandırmayı kaydet
      const configPath = path.join(config.device_configs_path, `${adapterId}.yaml`);
      
      // Dizin mevcut değilse oluştur
      if (!fs.existsSync(config.device_configs_path)) {
        fs.mkdirSync(config.device_configs_path, { recursive: true });
      }
      
      // Yapılandırmayı YAML olarak kaydet
      const yamlContent = yaml.dump(deviceConfig);
      fs.writeFileSync(configPath, yamlContent, 'utf8');
      
      // Yapılandırmayı güncelle
      this.deviceConfigs.set(adapterId, {
        config: deviceConfig,
        filePath: configPath
      });
      
      this.logger.info(`Cihaz yapılandırması güncellendi: ${adapterId}`);
      
      // Adaptör çalışıyorsa yeniden başlat
      if (restart && this.adapters.has(adapterId)) {
        await this.stopAdapter(adapterId);
        await this.startAdapter(adapterId);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Cihaz yapılandırması güncelleme hatası: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Cihaz yapılandırmasını siler
   * @param {string} adapterId Silinecek adaptör id'si
   * @param {boolean} stopRunning Çalışıyorsa adaptörü durdur
   * @returns {Promise<boolean>} İşlem başarılı olursa true
   */
  async deleteDeviceConfig(adapterId, stopRunning = true) {
    try {
      // Yapılandırmayı kontrol et
      if (!this.deviceConfigs.has(adapterId)) {
        this.logger.error(`Adaptör yapılandırması bulunamadı: ${adapterId}`);
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
      this.logger.error(`Cihaz yapılandırması silme hatası: ${error.message}`);
      return false;
    }
  }
}

module.exports = ConnectorManager;