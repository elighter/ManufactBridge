/**
 * ManufactBridge Unified Namespace (UNS) Konfigürasyon Modülü
 * 
 * Bu modül, ManufactBridge UNS bileşeninin konfigürasyon ayarlarını yönetir.
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
const configPath = process.env.UNS_CONFIG_PATH || path.join(process.cwd(), 'config', 'uns-config.yaml');

// Varsayılan konfigürasyon
const defaultConfig = {
  broker: {
    type: process.env.UNS_BROKER_TYPE || 'mqtt',
    mqtt: {
      host: process.env.MQTT_HOST || 'localhost',
      port: parseInt(process.env.MQTT_PORT, 10) || 1883,
      use_tls: process.env.MQTT_USE_TLS === 'true',
      tls_options: {
        keyPath: process.env.MQTT_TLS_KEY_PATH,
        certPath: process.env.MQTT_TLS_CERT_PATH,
        caPath: process.env.MQTT_TLS_CA_PATH
      }
    },
    kafka: {
      client_id: process.env.KAFKA_CLIENT_ID || 'manufactbridge-uns',
      bootstrap_servers: process.env.KAFKA_BOOTSTRAP_SERVERS ? process.env.KAFKA_BOOTSTRAP_SERVERS.split(',') : ['localhost:9092']
    }
  },
  topic_management: {
    root_namespace: process.env.UNS_ROOT_NAMESPACE || 'manufactbridge',
    enforce_hierarchy: process.env.UNS_ENFORCE_HIERARCHY !== 'false',
    max_topic_depth: parseInt(process.env.UNS_MAX_TOPIC_DEPTH, 10) || 8,
    min_topic_depth: parseInt(process.env.UNS_MIN_TOPIC_DEPTH, 10) || 3
  },
  schema_validation: {
    enabled: process.env.UNS_SCHEMA_VALIDATION_ENABLED !== 'false',
    sparkplug_compatible: process.env.UNS_SPARKPLUG_COMPATIBLE !== 'false',
    custom_schemas_path: process.env.UNS_CUSTOM_SCHEMAS_PATH || path.join(process.cwd(), 'config', 'schemas'),
    strict_validation: process.env.UNS_STRICT_VALIDATION === 'true'
  },
  security: {
    acl_enabled: process.env.UNS_ACL_ENABLED !== 'false',
    acl_config_path: process.env.UNS_ACL_CONFIG_PATH || path.join(process.cwd(), 'config', 'acl'),
    authentication: {
      enabled: process.env.UNS_AUTH_ENABLED !== 'false',
      type: process.env.UNS_AUTH_TYPE || 'basic',
      oauth2: {
        issuer_url: process.env.UNS_OAUTH_ISSUER_URL,
        audience: process.env.UNS_OAUTH_AUDIENCE
      }
    }
  },
  log_level: process.env.UNS_LOG_LEVEL || 'info'
};

// Konfigürasyon dosyasını yükle ve birleştir
const fileConfig = loadConfigFile(configPath);
const mergedConfig = fileConfig ? { ...defaultConfig, ...fileConfig } : defaultConfig;

// Çevre değişkenlerini çöz
const config = resolveEnvVars(mergedConfig);

module.exports = config;