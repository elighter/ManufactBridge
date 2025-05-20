/**
 * @fileoverview ManufactBridge - Edge Connector Konfigürasyon Yöneticisi
 * Bu modül, Edge Connector'ları için yapılandırma yönetiminden sorumludur.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Ajv = require('ajv');

class ConfigManager {
  /**
   * Konfigürasyon Yöneticisi constructor'ı
   * @param {Object} options - Opsiyonel konfigürasyon seçenekleri
   */
  constructor(options = {}) {
    this.options = {
      configDir: options.configDir || './config',
      connectorsDir: options.connectorsDir || './config/connectors',
      schemaPath: options.schemaPath || './config/schemas/connector-schema.json',
      ...options
    };
    
    this.configs = new Map();
    this.validator = new Ajv({ allErrors: true });
    this.schema = null;
    
    // Konfigürasyon dizinlerini oluştur
    this._ensureDirectories();
    
    // Şema yükle
    this._loadSchema();
  }
  
  /**
   * Gerekli dizinlerin varlığını kontrol eder, yoksa oluşturur
   * @private
   */
  _ensureDirectories() {
    const dirs = [this.options.configDir, this.options.connectorsDir];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch (err) {
          console.error(`Konfigürasyon dizini oluşturulamadı: ${dir} - ${err.message}`);
        }
      }
    }
  }
  
  /**
   * Şema dosyasını yükler
   * @private
   */
  _loadSchema() {
    // Şema dosyası varsa yükle
    if (fs.existsSync(this.options.schemaPath)) {
      try {
        const schemaContent = fs.readFileSync(this.options.schemaPath, 'utf8');
        this.schema = JSON.parse(schemaContent);
        this.validator.compile(this.schema);
      } catch (err) {
        console.error(`Şema yüklenemedi: ${err.message}`);
      }
    } else {
      // Şema dosyası yoksa varsayılan şemayı oluştur
      this._createDefaultSchema();
    }
  }
  
  /**
   * Varsayılan şema dosyasını oluşturur
   * @private
   */
  _createDefaultSchema() {
    const defaultSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Edge Connector Configuration Schema",
      type: "object",
      required: ["connector", "connection"],
      properties: {
        connector: {
          type: "object",
          required: ["id", "type", "protocol"],
          properties: {
            id: {
              type: "string",
              description: "Konnektör benzersiz kimliği"
            },
            type: {
              type: "string",
              enum: ["plc", "scada", "dcs", "historian", "erp"],
              description: "Konnektör tipi"
            },
            protocol: {
              type: "string",
              description: "Kullanılan iletişim protokolü"
            },
            description: {
              type: "string",
              description: "Konnektör açıklaması"
            }
          }
        },
        connection: {
          type: "object",
          required: ["host"],
          properties: {
            host: {
              type: "string",
              description: "Hedef sistem ana bilgisayar adresi"
            },
            port: {
              type: "integer",
              description: "Hedef sistem port numarası"
            },
            timeout: {
              type: "integer",
              description: "Bağlantı zaman aşımı (ms)"
            },
            retryInterval: {
              type: "integer",
              description: "Yeniden bağlanma aralığı (ms)"
            },
            maxRetries: {
              type: "integer",
              description: "Maksimum yeniden bağlanma denemesi"
            },
            credentials: {
              type: "object",
              properties: {
                username: {
                  type: "string"
                },
                password: {
                  type: "string"
                },
                keyFile: {
                  type: "string"
                }
              }
            }
          }
        },
        tags: {
          type: "array",
          items: {
            type: "object",
            required: ["name", "address"],
            properties: {
              name: {
                type: "string",
                description: "Tag adı"
              },
              address: {
                type: "string",
                description: "Tag adresi veya yolu"
              },
              dataType: {
                type: "string",
                enum: ["boolean", "integer", "float", "string", "array", "object"],
                description: "Tag veri tipi"
              },
              scanRate: {
                type: "string",
                description: "Veri okuma aralığı (ör. '1s', '500ms')"
              },
              deadband: {
                type: "number",
                description: "Değer değişikliği için deadband"
              }
            }
          }
        },
        mapping: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "UNS topic formatı"
            },
            metadata: {
              type: "object",
              description: "Ek metadata bilgileri"
            }
          }
        },
        options: {
          type: "object",
          description: "Protokole özgü ek seçenekler"
        }
      }
    };
    
    try {
      // Şema dizinini oluştur
      const schemaDir = path.dirname(this.options.schemaPath);
      if (!fs.existsSync(schemaDir)) {
        fs.mkdirSync(schemaDir, { recursive: true });
      }
      
      // Şema dosyasını yaz
      fs.writeFileSync(
        this.options.schemaPath,
        JSON.stringify(defaultSchema, null, 2),
        'utf8'
      );
      
      this.schema = defaultSchema;
      this.validator.compile(defaultSchema);
    } catch (err) {
      console.error(`Varsayılan şema oluşturulamadı: ${err.message}`);
    }
  }
  
  /**
   * Tüm konnektör konfigürasyonlarını yükler
   * @returns {Map<string, Object>} Konfigürasyonları içeren Map
   */
  loadAllConfigs() {
    try {
      const files = fs.readdirSync(this.options.connectorsDir);
      
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          const configId = path.basename(file, path.extname(file));
          this.loadConfig(configId);
        }
      }
      
      return this.configs;
    } catch (err) {
      console.error(`Konfigürasyonlar yüklenemedi: ${err.message}`);
      return new Map();
    }
  }
  
  /**
   * Belirli bir konnektör konfigürasyonunu yükler
   * @param {string} configId - Konfigürasyon ID'si
   * @returns {Object} Konfigürasyon nesnesi
   */
  loadConfig(configId) {
    const configPath = path.join(
      this.options.connectorsDir,
      `${configId}.yaml`
    );
    
    if (!fs.existsSync(configPath)) {
      console.error(`Konfigürasyon dosyası bulunamadı: ${configPath}`);
      return null;
    }
    
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(configContent);
      
      // Konfigürasyonu doğrula
      if (this.schema) {
        const validate = this.validator.compile(this.schema);
        const valid = validate(config);
        
        if (!valid) {
          console.error(
            `Konfigürasyon şema doğrulaması başarısız: ${JSON.stringify(validate.errors)}`
          );
        }
      }
      
      this.configs.set(configId, config);
      return config;
    } catch (err) {
      console.error(`Konfigürasyon yüklenemedi: ${err.message}`);
      return null;
    }
  }
  
  /**
   * Konfigürasyonu kaydeder
   * @param {string} configId - Konfigürasyon ID'si
   * @param {Object} config - Kaydedilecek konfigürasyon nesnesi
   * @returns {boolean} İşlem başarılı ise true döner
   */
  saveConfig(configId, config) {
    if (!config) {
      console.error('Geçerli bir konfigürasyon nesnesi gereklidir');
      return false;
    }
    
    // Konfigürasyonu doğrula
    if (this.schema) {
      const validate = this.validator.compile(this.schema);
      const valid = validate(config);
      
      if (!valid) {
        console.error(
          `Konfigürasyon şema doğrulaması başarısız: ${JSON.stringify(validate.errors)}`
        );
      }
    }
    
    const configPath = path.join(
      this.options.connectorsDir,
      `${configId}.yaml`
    );
    
    try {
      const yamlContent = yaml.dump(config, {
        indent: 2,
        lineWidth: -1, // Satır kesmeden önce karakter sınırı yok
        noRefs: true   // Döngüsel başvuruları yok say
      });
      
      fs.writeFileSync(configPath, yamlContent, 'utf8');
      
      // Konfigürasyonu önbelleğe kaydet
      this.configs.set(configId, config);
      
      return true;
    } catch (err) {
      console.error(`Konfigürasyon kaydedilemedi: ${err.message}`);
      return false;
    }
  }
  
  /**
   * Konfigürasyonu siler
   * @param {string} configId - Silinecek konfigürasyon ID'si
   * @returns {boolean} İşlem başarılı ise true döner
   */
  deleteConfig(configId) {
    const configPath = path.join(
      this.options.connectorsDir,
      `${configId}.yaml`
    );
    
    if (!fs.existsSync(configPath)) {
      console.error(`Konfigürasyon dosyası bulunamadı: ${configPath}`);
      return false;
    }
    
    try {
      fs.unlinkSync(configPath);
      
      // Önbellekten kaldır
      this.configs.delete(configId);
      
      return true;
    } catch (err) {
      console.error(`Konfigürasyon silinemedi: ${err.message}`);
      return false;
    }
  }
  
  /**
   * Örnek bir konfigürasyon dosyası oluşturur
   * @param {string} configId - Konfigürasyon ID'si
   * @param {string} type - Konnektör tipi (plc, scada, vb.)
   * @param {string} protocol - Konnektör protokolü
   * @returns {Object} Oluşturulan konfigürasyon nesnesi
   */
  createSampleConfig(configId, type, protocol) {
    const sampleConfig = {
      connector: {
        id: configId,
        type: type || 'plc',
        protocol: protocol || 's7',
        description: `${type} konnektörü için örnek konfigürasyon`
      },
      connection: {
        host: '192.168.1.100',
        port: type === 'plc' ? 102 : 502,
        timeout: 5000,
        retryInterval: 10000,
        maxRetries: 3,
        credentials: {
          username: 'user',
          password: 'password'
        }
      },
      tags: [
        {
          name: 'temperature',
          address: type === 'plc' ? 'DB1.DBD0' : 'HR100',
          dataType: 'float',
          scanRate: '1s',
          deadband: 0.5
        },
        {
          name: 'pressure',
          address: type === 'plc' ? 'DB1.DBD4' : 'HR102',
          dataType: 'float',
          scanRate: '1s'
        },
        {
          name: 'status',
          address: type === 'plc' ? 'DB1.DBX8.0' : 'C001',
          dataType: 'boolean',
          scanRate: '500ms'
        }
      ],
      mapping: {
        topic: `manufactbridge/factory1/area1/line1/${type}1/data`,
        metadata: {
          location: 'main-hall',
          equipmentType: 'processing-unit'
        }
      },
      options: {
        // Protokole özgü opsiyonel seçenekler
      }
    };
    
    // Modbus TCP için özel seçenekler
    if (protocol === 'modbus-tcp') {
      sampleConfig.options = {
        unitId: 1,
        endianness: 'big',
        registerPrefix: {
          coil: 'C',
          input: 'I',
          holdingRegister: 'HR',
          inputRegister: 'IR'
        }
      };
    }
    
    // OPC UA için özel seçenekler
    if (protocol === 'opcua') {
      sampleConfig.connection.port = 4840;
      sampleConfig.options = {
        securityMode: 'None',
        securityPolicy: 'None',
        clientName: 'ManufactBridge Client',
        applicationName: 'ManufactBridge OPC UA Client',
        endpointMustExist: false
      };
    }
    
    try {
      this.saveConfig(configId, sampleConfig);
      return sampleConfig;
    } catch (err) {
      console.error(`Örnek konfigürasyon oluşturulamadı: ${err.message}`);
      return null;
    }
  }
  
  /**
   * Belirli bir konfigürasyonu alır
   * @param {string} configId - Konfigürasyon ID'si
   * @returns {Object} Konfigürasyon nesnesi
   */
  getConfig(configId) {
    // Önbellekte varsa oradan al
    if (this.configs.has(configId)) {
      return this.configs.get(configId);
    }
    
    // Yoksa dosyadan yükle
    return this.loadConfig(configId);
  }
  
  /**
   * Tüm konfigürasyonların listesini döndürür
   * @returns {Array<string>} Konfigürasyon ID'lerinin listesi
   */
  listConfigs() {
    try {
      const files = fs.readdirSync(this.options.connectorsDir);
      
      return files
        .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
        .map(file => path.basename(file, path.extname(file)));
    } catch (err) {
      console.error(`Konfigürasyon listesi alınamadı: ${err.message}`);
      return [];
    }
  }
}

module.exports = ConfigManager; 