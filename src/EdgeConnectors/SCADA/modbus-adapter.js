/**
 * @fileoverview ManufactBridge - Modbus TCP Protokol Adaptörü
 * Bu adaptör, Modbus TCP protokolü üzerinden veri toplama işlemlerini gerçekleştirir.
 */

const BaseAdapter = require('../base-adapter');
const ModbusRTU = require('modbus-serial');

/**
 * Modbus Adresi Analiz Yardımcısı
 * Örnek: "HR100" -> { type: "holding", address: 100 }
 * @param {string} address - Modbus adres formatı
 * @returns {Object} Adres tipi ve numarası
 */
function parseModbusAddress(address) {
  // Adres prefix tanımları
  const prefixMap = {
    'C': 'coil',
    'I': 'input',
    'HR': 'holding',
    'IR': 'inputRegister'
  };
  
  // Regex ile adres ayrıştırma
  let type = 'holding'; // Varsayılan
  let numericAddress = address;
  
  // Prefix kontrolü
  for (const [prefix, addrType] of Object.entries(prefixMap)) {
    if (address.startsWith(prefix)) {
      type = addrType;
      numericAddress = address.substring(prefix.length);
      break;
    }
  }
  
  // Sayısal adres
  const addressNum = parseInt(numericAddress, 10);
  
  if (isNaN(addressNum)) {
    throw new Error(`Geçersiz Modbus adres formatı: ${address}`);
  }
  
  return {
    type,
    address: addressNum
  };
}

class ModbusAdapter extends BaseAdapter {
  /**
   * Modbus Adapter constructor'ı
   * @param {Object} config - Modbus konnektör konfigürasyonu
   */
  constructor(config) {
    super(config);
    
    this.client = new ModbusRTU();
    this.pollingIntervals = {};
    this.connected = false;
    this.reconnecting = false;
  }
  
  /**
   * Konfigürasyon doğrulama metodu
   * @throws {Error} Konfigürasyon geçerli değilse hata fırlatır
   */
  validateConfig() {
    super.validateConfig();
    
    if (!this.config.connection || !this.config.connection.host) {
      throw new Error('Modbus bağlantısı için geçerli bir host gereklidir');
    }
    
    if (!this.config.connection.port) {
      this.config.connection.port = 502; // Varsayılan Modbus TCP portu
    }
    
    // Opsiyonel olarak UnitID kontrolü
    if (!this.config.options) {
      this.config.options = {};
    }
    
    if (this.config.options.unitId === undefined) {
      this.config.options.unitId = 1; // Varsayılan UnitID
    }
  }
  
  /**
   * Modbus cihazına bağlanır
   * @returns {Promise<boolean>} Bağlantı başarılı ise true döner
   */
  async connect() {
    if (this.connected) {
      return true;
    }
    
    try {
      // Önce bağlantıyı kapat (eğer varsa)
      try {
        await this.client.close();
      } catch (err) {
        // Bağlantı zaten kapalı olabilir, hatayı yok say
      }
      
      // Modbus TCP bağlantısı oluştur
      await this.client.connectTCP(
        this.config.connection.host, 
        { 
          port: this.config.connection.port,
          timeout: this.config.connection.timeout || 5000
        }
      );
      
      // UnitID ayarla
      this.client.setID(this.config.options.unitId);
      
      this.connected = true;
      this.status = 'connected';
      this.lastError = null;
      
      // Başarılı bağlantı olayını tetikle
      this.emit('connect', { timestamp: new Date() });
      
      // Tag'leri tanımlayıp polling'i başlat
      if (this.config.tags && Array.isArray(this.config.tags)) {
        await this.defineTags(this.config.tags);
        this._startPolling();
      }
      
      return true;
    } catch (err) {
      this.connected = false;
      this.status = 'error';
      this.lastError = err.message;
      
      // Hata olayını tetikle
      this.emit('error', {
        message: `Modbus bağlantı hatası: ${err.message}`,
        details: err
      });
      
      throw err;
    }
  }
  
  /**
   * Modbus bağlantısını kapatır
   * @returns {Promise<boolean>} Bağlantı başarıyla kapatıldıysa true döner
   */
  async disconnect() {
    if (!this.connected) {
      return true;
    }
    
    try {
      // Tüm polling aralıklarını temizle
      this._stopPolling();
      
      // Bağlantıyı kapat
      await this.client.close();
      
      this.connected = false;
      this.status = 'disconnected';
      
      // Bağlantı kesme olayını tetikle
      this.emit('disconnect', { timestamp: new Date() });
      
      return true;
    } catch (err) {
      this.status = 'error';
      this.lastError = err.message;
      
      // Hata olayını tetikle
      this.emit('error', {
        message: `Modbus bağlantı kesme hatası: ${err.message}`,
        details: err
      });
      
      throw err;
    }
  }
  
  /**
   * Tag verisi okuma
   * @param {string} tagName - Okunacak tag'in adı
   * @returns {Promise<Object>} Tag değeri, zaman damgası ve kalite bilgisini içeren nesne
   */
  async readTag(tagName) {
    if (!this.connected) {
      throw new Error('Modbus okuma öncesi bağlantı gereklidir');
    }
    
    const tag = this.tags.get(tagName);
    if (!tag) {
      throw new Error(`Tag bulunamadı: ${tagName}`);
    }
    
    try {
      const address = parseModbusAddress(tag.address);
      let value = null;
      
      // Veri türüne göre okuma işlemi
      switch (address.type) {
        case 'coil':
          value = await this.client.readCoils(address.address, 1);
          value = value.data[0];
          break;
          
        case 'input':
          value = await this.client.readDiscreteInputs(address.address, 1);
          value = value.data[0];
          break;
          
        case 'holding':
          // Veri türüne göre okuma
          if (tag.dataType === 'float') {
            // 32-bit float değerini okuma (2 register)
            value = await this.client.readHoldingRegisters(address.address, 2);
            const buf = Buffer.allocUnsafe(4);
            buf.writeUInt16BE(value.data[0], 0);
            buf.writeUInt16BE(value.data[1], 2);
            value = buf.readFloatBE(0);
          } else if (tag.dataType === 'integer') {
            // 16-bit integer değerini okuma
            value = await this.client.readHoldingRegisters(address.address, 1);
            value = value.data[0];
          } else if (tag.dataType === 'boolean') {
            // Boolean değerini bit olarak okuma
            const registerAddr = Math.floor(address.address);
            const bitOffset = (address.address % 1) * 16;
            value = await this.client.readHoldingRegisters(registerAddr, 1);
            value = (value.data[0] & (1 << bitOffset)) !== 0;
          } else {
            // Varsayılan olarak ham değerini okuma
            value = await this.client.readHoldingRegisters(address.address, 1);
            value = value.data[0];
          }
          break;
          
        case 'inputRegister':
          // Veri türüne göre okuma
          if (tag.dataType === 'float') {
            // 32-bit float değerini okuma (2 register)
            value = await this.client.readInputRegisters(address.address, 2);
            const buf = Buffer.allocUnsafe(4);
            buf.writeUInt16BE(value.data[0], 0);
            buf.writeUInt16BE(value.data[1], 2);
            value = buf.readFloatBE(0);
          } else if (tag.dataType === 'integer') {
            // 16-bit integer değerini okuma
            value = await this.client.readInputRegisters(address.address, 1);
            value = value.data[0];
          } else {
            // Varsayılan olarak ham değerini okuma
            value = await this.client.readInputRegisters(address.address, 1);
            value = value.data[0];
          }
          break;
          
        default:
          throw new Error(`Desteklenmeyen Modbus adres tipi: ${address.type}`);
      }
      
      const timestamp = new Date();
      
      // Tag değerini güncelle
      tag.lastValue = value;
      tag.lastUpdate = timestamp;
      tag.quality = 'good';
      
      // UNS formatında veri döndür
      return this.formatTagForUNS(tagName, value);
    } catch (err) {
      const timestamp = new Date();
      
      // Tag kalitesini güncelle
      if (tag) {
        tag.quality = 'bad';
        tag.lastUpdate = timestamp;
      }
      
      // Hata olayını tetikle
      this.emit('error', {
        message: `Modbus okuma hatası (${tagName}): ${err.message}`,
        details: err,
        tag: tagName
      });
      
      throw err;
    }
  }
  
  /**
   * Çoklu tag verisi okuma
   * @param {Array<string>} tagNames - Okunacak tag'lerin adları
   * @returns {Promise<Object>} Tag değerleri, zaman damgaları ve kalite bilgilerini içeren nesne
   */
  async readTags(tagNames) {
    if (!this.connected) {
      throw new Error('Modbus okuma öncesi bağlantı gereklidir');
    }
    
    const results = {};
    const timestamp = new Date();
    
    // Her tag için
    for (const tagName of tagNames) {
      try {
        results[tagName] = await this.readTag(tagName);
      } catch (err) {
        results[tagName] = {
          topic: this.generateTopicForTag(tagName),
          payload: {
            timestamp: timestamp.toISOString(),
            value: null,
            quality: 'bad',
            metadata: {
              error: err.message,
              source: this.config.id
            }
          }
        };
      }
    }
    
    return results;
  }
  
  /**
   * Tag değeri yazma
   * @param {string} tagName - Yazılacak tag'in adı
   * @param {*} value - Yazılacak değer
   * @returns {Promise<boolean>} Yazma başarılı ise true döner
   */
  async writeTag(tagName, value) {
    if (!this.connected) {
      throw new Error('Modbus yazma öncesi bağlantı gereklidir');
    }
    
    const tag = this.tags.get(tagName);
    if (!tag) {
      throw new Error(`Tag bulunamadı: ${tagName}`);
    }
    
    try {
      const address = parseModbusAddress(tag.address);
      
      // Veri türüne göre yazma işlemi
      switch (address.type) {
        case 'coil':
          // Boolean değer kontrolü
          if (typeof value !== 'boolean') {
            value = Boolean(value);
          }
          await this.client.writeCoil(address.address, value);
          break;
          
        case 'holding':
          // Veri türüne göre yazma
          if (tag.dataType === 'float') {
            // 32-bit float değerini yazma (2 register)
            const buf = Buffer.allocUnsafe(4);
            buf.writeFloatBE(value, 0);
            const data = [buf.readUInt16BE(0), buf.readUInt16BE(2)];
            await this.client.writeRegisters(address.address, data);
          } else if (tag.dataType === 'boolean') {
            // Boolean değerini bit olarak yazma
            const registerAddr = Math.floor(address.address);
            const bitOffset = (address.address % 1) * 16;
            
            // Önce mevcut değeri oku
            const currentValue = await this.client.readHoldingRegisters(registerAddr, 1);
            let newValue = currentValue.data[0];
            
            // Tek biti güncelle
            if (value) {
              newValue |= (1 << bitOffset); // Biti 1 yap
            } else {
              newValue &= ~(1 << bitOffset); // Biti 0 yap
            }
            
            // Yeni değeri yaz
            await this.client.writeRegister(registerAddr, newValue);
          } else {
            // Integer değeri yazma
            if (typeof value !== 'number') {
              value = parseInt(value, 10);
              if (isNaN(value)) {
                throw new Error('Geçerli bir sayısal değer gereklidir');
              }
            }
            await this.client.writeRegister(address.address, value);
          }
          break;
          
        default:
          throw new Error(`Yazma işlemi desteklenmeyen Modbus adres tipi: ${address.type}`);
      }
      
      const timestamp = new Date();
      
      // Tag değerini güncelle
      tag.lastValue = value;
      tag.lastUpdate = timestamp;
      tag.quality = 'good';
      
      return true;
    } catch (err) {
      // Hata olayını tetikle
      this.emit('error', {
        message: `Modbus yazma hatası (${tagName}): ${err.message}`,
        details: err,
        tag: tagName
      });
      
      throw err;
    }
  }
  
  /**
   * Polling işlemini başlatır
   * @private
   */
  _startPolling() {
    // Önce mevcut polling işlemlerini durdur
    this._stopPolling();
    
    // Her tag için polling aralığı hesapla ve başlat
    for (const [tagName, tag] of this.tags.entries()) {
      // scanRate'i milisaniyeye çevir
      const scanRate = this._parseScanRate(tag.scanRate);
      
      // Polling interval oluştur
      this.pollingIntervals[tagName] = setInterval(async () => {
        try {
          if (this.connected) {
            const data = await this.readTag(tagName);
            
            // Veri olayını tetikle
            this.emit('data', data);
          }
        } catch (err) {
          // Hata zaten readTag içinde ele alınıyor
        }
      }, scanRate);
    }
  }
  
  /**
   * Polling işlemini durdurur
   * @private
   */
  _stopPolling() {
    // Tüm polling aralıklarını temizle
    for (const interval of Object.values(this.pollingIntervals)) {
      clearInterval(interval);
    }
    
    this.pollingIntervals = {};
  }
  
  /**
   * scanRate string değerini milisaniyeye çevirir
   * @param {string} scanRate - Örnek: "1s", "500ms"
   * @returns {number} Milisaniye cinsinden değer
   * @private
   */
  _parseScanRate(scanRate) {
    if (typeof scanRate === 'number') {
      return scanRate;
    }
    
    if (typeof scanRate !== 'string') {
      return 1000; // Varsayılan 1 saniye
    }
    
    // "1s", "500ms" gibi formatları ayrıştır
    const match = scanRate.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/);
    if (!match) {
      return 1000; // Varsayılan 1 saniye
    }
    
    const value = parseFloat(match[1]);
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
        return 1000;
    }
  }
}

module.exports = ModbusAdapter; 