const LinearIntegrationClient = require('./LinearClient');
const LinearConfig = require('./LinearConfig');
const LinearWebhookHandler = require('./LinearWebhookHandler');
const winston = require('winston');
const EventEmitter = require('eventemitter3');

/**
 * Linear Integration Service
 * ManufactBridge için Linear entegrasyonu ana service sınıfı
 */
class LinearService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = new LinearConfig();
    this.logger = winston.createLogger({
      level: this.config.getLogLevel(),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/linear-service.log' })
      ]
    });

    this.client = null;
    this.webhookHandler = null;
    this.isInitialized = false;
    this.retryConfig = this.config.getRetryConfig();
  }

  /**
   * Linear service'i başlat
   */
  async initialize() {
    try {
      this.logger.info('Linear service başlatılıyor...');

      // Konfigürasyonu doğrula
      this.config.validate();

      // Linear client'ı başlat
      this.client = new LinearIntegrationClient(
        this.config.getApiKey(),
        {
          teamId: this.config.getTeamId(),
          projectId: this.config.getProjectId(),
          logLevel: this.config.getLogLevel()
        }
      );

      // Bağlantıyı test et
      await this.client.testConnection();

      // Webhook handler'ı başlat
      this.webhookHandler = new LinearWebhookHandler(
        this.config.getWebhookSecret(),
        { logLevel: this.config.getLogLevel() }
      );

      // Event listener'ları kur
      this.setupEventListeners();

      this.isInitialized = true;
      this.logger.info('Linear service başarıyla başlatıldı');

      this.emit('service:initialized');
      return true;
    } catch (error) {
      this.logger.error('Linear service başlatma hatası', { error: error.message });
      throw error;
    }
  }

  /**
   * Event listener'ları kur
   */
  setupEventListeners() {
    // Webhook handler event'lerini dinle
    this.webhookHandler.setupManufacturingEventListeners();

    // Manufacturing event'lerini Linear'a aktar
    this.on('manufacturing:event', (eventData) => {
      this.handleManufacturingEvent(eventData);
    });

    // Manufacturing alert'lerini Linear issue'ya çevir
    this.on('manufacturing:alert', (alertData) => {
      this.handleManufacturingAlert(alertData);
    });

    // Linear webhook event'lerini manufacturing sistemine aktar
    this.webhookHandler.on('manufacturing:issue:updated', (data) => {
      this.emit('linear:issue:updated', data);
    });

    this.webhookHandler.on('manufacturing:alert', (data) => {
      this.emit('linear:alert', data);
    });
  }

  /**
   * Manufacturing event'ini işle ve Linear issue oluştur
   */
  async handleManufacturingEvent(eventData) {
    try {
      if (!this.config.isAutoCreateEnabled()) {
        this.logger.info('Otomatik issue oluşturma devre dışı', { eventData });
        return;
      }

      this.logger.info('Manufacturing event işleniyor', { 
        eventType: eventData.eventType,
        machineId: eventData.machineId 
      });

      const issue = await this.client.createManufacturingIssue(eventData);
      
      this.emit('manufacturing:issue:created', {
        issueId: issue.id,
        eventData,
        timestamp: new Date().toISOString()
      });

      return issue;
    } catch (error) {
      this.logger.error('Manufacturing event işleme hatası', { 
        error: error.message,
        eventData 
      });
      
      // Retry mekanizması
      await this.retryOperation(() => 
        this.client.createManufacturingIssue(eventData)
      );
    }
  }

  /**
   * Manufacturing alert'ini işle
   */
  async handleManufacturingAlert(alertData) {
    try {
      this.logger.info('Manufacturing alert işleniyor', { 
        alertType: alertData.type,
        severity: alertData.severity 
      });

      // Alert'i Linear issue'ya çevir
      const eventData = {
        eventType: alertData.type,
        severity: alertData.severity || 'high',
        machineId: alertData.machineId || 'system',
        description: alertData.message,
        timestamp: alertData.timestamp || new Date().toISOString(),
        additionalData: alertData
      };

      const issue = await this.client.createManufacturingIssue(eventData);
      
      // Kritik alert'ler için takım üyelerine assign et
      if (alertData.severity === 'critical') {
        await this.assignCriticalIssue(issue.id);
      }

      this.emit('manufacturing:alert:processed', {
        issueId: issue.id,
        alertData,
        timestamp: new Date().toISOString()
      });

      return issue;
    } catch (error) {
      this.logger.error('Manufacturing alert işleme hatası', { 
        error: error.message,
        alertData 
      });
      throw error;
    }
  }

  /**
   * Kritik issue'yu uygun takım üyesine assign et
   */
  async assignCriticalIssue(issueId) {
    try {
      const teamMembers = await this.client.getTeamMembers();
      
      // Aktif takım üyelerini filtrele
      const activeMembers = teamMembers.filter(member => member.active);
      
      if (activeMembers.length > 0) {
        // İlk uygun üyeye assign et (daha gelişmiş logic eklenebilir)
        const assignee = activeMembers[0];
        
        await this.client.updateIssue(issueId, {
          assigneeId: assignee.id
        });

        this.logger.info('Kritik issue assign edildi', { 
          issueId,
          assignee: assignee.name 
        });
      }
    } catch (error) {
      this.logger.error('Kritik issue assign etme hatası', { 
        error: error.message,
        issueId 
      });
    }
  }

  /**
   * Retry mekanizması
   */
  async retryOperation(operation, attempts = this.retryConfig.attempts) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await operation();
      } catch (error) {
        this.logger.warn(`İşlem başarısız, tekrar deneniyor (${i + 1}/${attempts})`, { 
          error: error.message 
        });
        
        if (i === attempts - 1) {
          throw error;
        }
        
        await this.delay(this.retryConfig.delay * (i + 1));
      }
    }
  }

  /**
   * Delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Issue oluştur
   */
  async createIssue(issueData) {
    this.ensureInitialized();
    return await this.client.createIssue(issueData);
  }

  /**
   * Issue güncelle
   */
  async updateIssue(issueId, updateData) {
    this.ensureInitialized();
    return await this.client.updateIssue(issueId, updateData);
  }

  /**
   * Issue detaylarını getir
   */
  async getIssue(issueId) {
    this.ensureInitialized();
    return await this.client.getIssue(issueId);
  }

  /**
   * Proje issue'larını listele
   */
  async listProjectIssues(filters = {}) {
    this.ensureInitialized();
    return await this.client.listProjectIssues(filters);
  }

  /**
   * Issue'ya yorum ekle
   */
  async addComment(issueId, comment) {
    this.ensureInitialized();
    return await this.client.addComment(issueId, comment);
  }

  /**
   * Takım üyelerini getir
   */
  async getTeamMembers() {
    this.ensureInitialized();
    return await this.client.getTeamMembers();
  }

  /**
   * Proje durumlarını getir
   */
  async getProjectStates() {
    this.ensureInitialized();
    return await this.client.getProjectStates();
  }

  /**
   * Webhook handler'ı getir
   */
  getWebhookHandler() {
    this.ensureInitialized();
    return this.webhookHandler;
  }

  /**
   * Manufacturing dashboard için istatistikler
   */
  async getManufacturingStats() {
    try {
      this.ensureInitialized();

      const issues = await this.listProjectIssues();
      const manufacturingIssues = issues.filter(issue => 
        issue.labels?.some(label => 
          ['manufacturing', 'production', 'quality', 'maintenance'].includes(label.name.toLowerCase())
        )
      );

      const stats = {
        totalIssues: manufacturingIssues.length,
        openIssues: manufacturingIssues.filter(issue => !issue.state?.name?.toLowerCase().includes('done')).length,
        criticalIssues: manufacturingIssues.filter(issue => issue.priority === 1).length,
        highPriorityIssues: manufacturingIssues.filter(issue => issue.priority === 2).length,
        byState: {},
        byPriority: {},
        recentIssues: manufacturingIssues
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 10)
      };

      // State'e göre grupla
      manufacturingIssues.forEach(issue => {
        const state = issue.state?.name || 'Unknown';
        stats.byState[state] = (stats.byState[state] || 0) + 1;
      });

      // Priority'ye göre grupla
      manufacturingIssues.forEach(issue => {
        const priority = issue.priority || 0;
        stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
      });

      this.logger.info('Manufacturing istatistikleri oluşturuldu', { 
        totalIssues: stats.totalIssues,
        openIssues: stats.openIssues 
      });

      return stats;
    } catch (error) {
      this.logger.error('Manufacturing istatistikleri alma hatası', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Service'in başlatılıp başlatılmadığını kontrol et
   */
  ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('Linear service henüz başlatılmamış. initialize() metodunu çağırın.');
    }
  }

  /**
   * Service'i durdur
   */
  async shutdown() {
    try {
      this.logger.info('Linear service durduruluyor...');
      
      this.removeAllListeners();
      
      if (this.webhookHandler) {
        this.webhookHandler.removeAllListeners();
      }

      this.isInitialized = false;
      this.logger.info('Linear service durduruldu');
    } catch (error) {
      this.logger.error('Linear service durdurma hatası', { error: error.message });
      throw error;
    }
  }

  /**
   * Service durumunu getir
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      config: {
        teamId: this.config.getTeamId(),
        projectId: this.config.getProjectId(),
        autoCreateEnabled: this.config.isAutoCreateEnabled(),
        logLevel: this.config.getLogLevel()
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = LinearService; 