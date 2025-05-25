/**
 * ManufactBridge Edge Connector Konfigürasyon Modülü
 * 
 * Bu modül, Edge Connector bileşeninin konfigürasyon ayarlarını yönetir.
 * Varsayılan değerler, çevresel değişkenler ve konfigürasyon dosyaları
 * aracılığıyla ayarların yapılandırılmasını sağlar.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dotenv = require('dotenv');

// Çevre değişkenlerini yükle
dotenv.config();

/**
 * Konfigürasyon dosyasını yükler
 * @param {string} configPath Konfigürasyon dosyası yolu
 * @returns {object|null} Yüklenen konfigürasyon veya hata durumunda null
 */
function loadConfigFile(configPath) {
  try {
    if (!configPath || !fs.existsSync(configPath)) {
      return null;
    }

    const ext = path.extname(configPath).toLowerCase();
    const content = fs.readFileSync(configPath, 'utf8');

    if (ext === '.json') {
      return JSON.parse(content);
    } else if (ext === '.yaml' || ext === '.yml') {
      return yaml.load(content);
    } else {
      console.warn(`Desteklenmeyen konfigürasyon dosya formatı: ${ext}`);
      return null;
    }
  } catch (error) {
    console.error(`Konfigürasyon dosyası yükleme hatası: ${error.message}`);
    return null;
  }
}

/**
 * Çevre değişkenlerini çözer
 * @param {object} config Konfigürasyon objesi
 * @returns {object} Çevre değişkenleri çözülmüş konfigürasyon
 */
function resolveEnvVars(config) {
  const stringified = JSON.stringify(config);
  const resolved = stringified.replace(/\${([^}]+)}/g, (match, envVar) => {
    const parts = envVar.split(':');
    const varName = parts[0];
    const defaultValue = parts.length > 1 ? parts[1] : '';
    return process.env[varName] || defaultValue;
  });
  return JSON.parse(resolved);
}

// Konfigürasyon dosya yolu
const configPath = process.env.EDGE_CONFIG_PATH || path.join(process.cwd(), 'config', 'edge-connector.yaml');

// Varsayılan konfigürasyon
const defaultConfig = {
  connector: {
    id: process.env.EDGE_CONNECTOR_ID || 'edge-connector-1',
    name: process.env.EDGE_CONNECTOR_NAME || 'Edge Connector 1',
    description: process.env.EDGE_CONNECTOR_DESC || 'ManufactBridge Edge Connector'
  },
  protocols: {
    opcua: {
      enabled: process.env.OPCUA_ENABLED !== 'false',
      module_path: './SCADA/opcua-adapter'
    },
    modbus: {
      enabled: process.env.MODBUS_ENABLED !== 'false',
      module_path: './protocols/modbus-adapter'
    },
    mqtt: {
      enabled: process.env.MQTT_ENABLED !== 'false',
      module_path: './protocols/mqtt-adapter'
    },
    ethernetip: {
      enabled: process.env.ETHERNETIP_ENABLED !== 'false',
      module_path: './protocols/ethernetip-adapter'
    },
    s7: {
      enabled: process.env.S7_ENABLED !== 'false',
      module_path: './protocols/s7-adapter'
    },
    rest: {
      enabled: process.env.REST_ENABLED !== 'false',
      module_path: './protocols/rest-adapter'
    },
    database: {
      enabled: process.env.DATABASE_ENABLED !== 'false',
      module_path: './protocols/database-adapter'
    }
  },
  device_configs_path: process.env.DEVICE_CONFIGS_PATH || path.join(process.cwd(), 'config', 'devices'),
  data_processing: {
    enabled: process.env.DATA_PROCESSING_ENABLED !== 'false',
    buffer_size: parseInt(process.env.DATA_BUFFER_SIZE, 10) || 10000,
    processing_interval: process.env.DATA_PROCESSING_INTERVAL || '1s',
    deadband_enabled: process.env.DEADBAND_ENABLED !== 'false'
  },
  edge_cache: {
    enabled: process.env.EDGE_CACHE_ENABLED !== 'false',
    type: process.env.EDGE_CACHE_TYPE || 'memory', // memory, sqlite, redis
    memory: {
      max_items: parseInt(process.env.EDGE_CACHE_MAX_ITEMS, 10) || 10000
    },
    sqlite: {
      db_path: process.env.EDGE_CACHE_DB_PATH || path.join(process.cwd(), 'data', 'edge-cache.db')
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      password: process.env.REDIS_PASSWORD
    }
  },
  uns: {
    enabled: process.env.UNS_ENABLED !== 'false',
    broker_type: process.env.UNS_BROKER_TYPE || 'mqtt', // mqtt veya kafka
    mqtt: {
      broker_url: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
      client_id: process.env.MQTT_CLIENT_ID || `edge-connector-${process.env.EDGE_CONNECTOR_ID || 'default'}`,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      topic_prefix: process.env.MQTT_TOPIC_PREFIX || 'manufactbridge'
    },
    kafka: {
      brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'],
      client_id: process.env.KAFKA_CLIENT_ID || `edge-connector-${process.env.EDGE_CONNECTOR_ID || 'default'}`,
      topic_prefix: process.env.KAFKA_TOPIC_PREFIX || 'manufactbridge'
    }
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file_enabled: process.env.LOG_FILE_ENABLED !== 'false',
    file_path: process.env.LOG_FILE_PATH || path.join(process.cwd(), 'logs', 'edge-connector.log'),
    max_file_size: process.env.LOG_MAX_FILE_SIZE || '10m',
    max_files: parseInt(process.env.LOG_MAX_FILES, 10) || 5
  },
  api: {
    enabled: process.env.API_ENABLED !== 'false',
    port: parseInt(process.env.API_PORT, 10) || 8080,
    host: process.env.API_HOST || 'localhost',
    cors_enabled: process.env.API_CORS_ENABLED !== 'false',
    auth_enabled: process.env.API_AUTH_ENABLED !== 'false',
    auth_token: process.env.API_AUTH_TOKEN
  }
};

// Konfigürasyon dosyasını yükle ve birleştir
const fileConfig = loadConfigFile(configPath);
const mergedConfig = fileConfig ? { ...defaultConfig, ...fileConfig } : defaultConfig;

// Çevre değişkenlerini çöz
const config = resolveEnvVars(mergedConfig);

module.exports = config; 