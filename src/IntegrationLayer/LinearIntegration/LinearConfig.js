const path = require('path');
const fs = require('fs');

/**
 * Linear Integration Configuration
 * ManufactBridge Linear entegrasyonu için konfigürasyon yönetimi
 */
class LinearConfig {
  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Konfigürasyonu yükle
   */
  loadConfig() {
    const defaultConfig = {
      apiKey: process.env.LINEAR_API_KEY || '',
      teamId: process.env.LINEAR_TEAM_ID || '',
      projectId: process.env.LINEAR_PROJECT_ID || '',
      webhookSecret: process.env.LINEAR_WEBHOOK_SECRET || '',
      autoCreateIssues: process.env.LINEAR_AUTO_CREATE_ISSUES === 'true' || false,
      logLevel: process.env.LINEAR_LOG_LEVEL || 'info',
      retryAttempts: parseInt(process.env.LINEAR_RETRY_ATTEMPTS) || 3,
      retryDelay: parseInt(process.env.LINEAR_RETRY_DELAY) || 1000,
      issueLabels: {
        manufacturing: process.env.LINEAR_MANUFACTURING_LABEL || 'manufacturing',
        critical: process.env.LINEAR_CRITICAL_LABEL || 'critical',
        maintenance: process.env.LINEAR_MAINTENANCE_LABEL || 'maintenance',
        quality: process.env.LINEAR_QUALITY_LABEL || 'quality'
      },
      eventMapping: {
        'machine_error': {
          priority: 1, // Urgent
          labels: ['manufacturing', 'critical']
        },
        'quality_issue': {
          priority: 2, // High
          labels: ['manufacturing', 'quality']
        },
        'maintenance_required': {
          priority: 3, // Normal
          labels: ['manufacturing', 'maintenance']
        },
        'production_delay': {
          priority: 2, // High
          labels: ['manufacturing']
        },
        'sensor_failure': {
          priority: 1, // Urgent
          labels: ['manufacturing', 'critical']
        }
      }
    };

    // Özel konfigürasyon dosyası varsa yükle
    const configPath = path.join(process.cwd(), 'config', 'linear.json');
    if (fs.existsSync(configPath)) {
      try {
        const customConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return { ...defaultConfig, ...customConfig };
      } catch (error) {
        console.warn('Linear konfigürasyon dosyası okunamadı, varsayılan ayarlar kullanılıyor:', error.message);
      }
    }

    return defaultConfig;
  }

  /**
   * API Key'i al
   */
  getApiKey() {
    if (!this.config.apiKey) {
      throw new Error('LINEAR_API_KEY environment variable gerekli');
    }
    return this.config.apiKey;
  }

  /**
   * Team ID'yi al
   */
  getTeamId() {
    if (!this.config.teamId) {
      throw new Error('LINEAR_TEAM_ID environment variable gerekli');
    }
    return this.config.teamId;
  }

  /**
   * Project ID'yi al
   */
  getProjectId() {
    return this.config.projectId;
  }

  /**
   * Webhook secret'ını al
   */
  getWebhookSecret() {
    return this.config.webhookSecret;
  }

  /**
   * Otomatik issue oluşturma durumunu al
   */
  isAutoCreateEnabled() {
    return this.config.autoCreateIssues;
  }

  /**
   * Log seviyesini al
   */
  getLogLevel() {
    return this.config.logLevel;
  }

  /**
   * Retry ayarlarını al
   */
  getRetryConfig() {
    return {
      attempts: this.config.retryAttempts,
      delay: this.config.retryDelay
    };
  }

  /**
   * Issue etiketlerini al
   */
  getIssueLabels() {
    return this.config.issueLabels;
  }

  /**
   * Olay tipi için mapping al
   */
  getEventMapping(eventType) {
    return this.config.eventMapping[eventType] || {
      priority: 3, // Normal
      labels: ['manufacturing']
    };
  }

  /**
   * Tüm konfigürasyonu al
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Konfigürasyonu güncelle
   */
  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Konfigürasyonu dosyaya kaydet
   */
  saveConfig() {
    const configDir = path.join(process.cwd(), 'config');
    const configPath = path.join(configDir, 'linear.json');

    try {
      // Config dizini yoksa oluştur
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Hassas bilgileri çıkar
      const configToSave = { ...this.config };
      delete configToSave.apiKey;
      delete configToSave.webhookSecret;

      fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2));
      console.log('Linear konfigürasyonu kaydedildi:', configPath);
    } catch (error) {
      console.error('Linear konfigürasyonu kaydedilemedi:', error.message);
      throw error;
    }
  }

  /**
   * Konfigürasyonu doğrula
   */
  validate() {
    const errors = [];

    if (!this.config.apiKey) {
      errors.push('LINEAR_API_KEY gerekli');
    }

    if (!this.config.teamId) {
      errors.push('LINEAR_TEAM_ID gerekli');
    }

    if (this.config.retryAttempts < 0 || this.config.retryAttempts > 10) {
      errors.push('LINEAR_RETRY_ATTEMPTS 0-10 arasında olmalı');
    }

    if (this.config.retryDelay < 100 || this.config.retryDelay > 10000) {
      errors.push('LINEAR_RETRY_DELAY 100-10000ms arasında olmalı');
    }

    if (errors.length > 0) {
      throw new Error(`Linear konfigürasyon hataları: ${errors.join(', ')}`);
    }

    return true;
  }

  /**
   * Örnek konfigürasyon dosyası oluştur
   */
  static createSampleConfig() {
    const sampleConfig = {
      "teamId": "your-linear-team-id",
      "projectId": "your-linear-project-id",
      "autoCreateIssues": true,
      "logLevel": "info",
      "retryAttempts": 3,
      "retryDelay": 1000,
      "issueLabels": {
        "manufacturing": "manufacturing",
        "critical": "critical",
        "maintenance": "maintenance",
        "quality": "quality"
      },
      "eventMapping": {
        "machine_error": {
          "priority": 1,
          "labels": ["manufacturing", "critical"]
        },
        "quality_issue": {
          "priority": 2,
          "labels": ["manufacturing", "quality"]
        },
        "maintenance_required": {
          "priority": 3,
          "labels": ["manufacturing", "maintenance"]
        }
      }
    };

    const configDir = path.join(process.cwd(), 'config');
    const configPath = path.join(configDir, 'linear.sample.json');

    try {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(configPath, JSON.stringify(sampleConfig, null, 2));
      console.log('Örnek Linear konfigürasyonu oluşturuldu:', configPath);
      return configPath;
    } catch (error) {
      console.error('Örnek konfigürasyon oluşturulamadı:', error.message);
      throw error;
    }
  }
}

module.exports = LinearConfig; 