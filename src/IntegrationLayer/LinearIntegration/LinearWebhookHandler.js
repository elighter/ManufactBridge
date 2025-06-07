const crypto = require('crypto');
const winston = require('winston');
const EventEmitter = require('eventemitter3');

/**
 * Linear Webhook Handler
 * Linear'dan gelen webhook'ları işler ve ManufactBridge sistemine entegre eder
 */
class LinearWebhookHandler extends EventEmitter {
  constructor(webhookSecret, options = {}) {
    super();
    this.webhookSecret = webhookSecret;
    this.logger = winston.createLogger({
      level: options.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/linear-webhooks.log' })
      ]
    });
  }

  /**
   * Webhook imzasını doğrula
   */
  verifySignature(payload, signature) {
    if (!this.webhookSecret) {
      this.logger.warn('Webhook secret tanımlanmamış, imza doğrulaması atlanıyor');
      return true;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload, 'utf8')
        .digest('hex');

      const providedSignature = signature.replace('sha256=', '');
      
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );

      if (!isValid) {
        this.logger.error('Webhook imza doğrulaması başarısız');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Webhook imza doğrulama hatası', { error: error.message });
      return false;
    }
  }

  /**
   * Webhook'u işle
   */
  async handleWebhook(payload, signature) {
    try {
      // İmza doğrulaması
      if (!this.verifySignature(JSON.stringify(payload), signature)) {
        throw new Error('Geçersiz webhook imzası');
      }

      const { action, data, type } = payload;
      
      this.logger.info('Linear webhook alındı', { 
        action, 
        type, 
        dataType: data?.constructor?.name 
      });

      // Webhook tipine göre işlem yap
      switch (type) {
        case 'Issue':
          await this.handleIssueWebhook(action, data);
          break;
        case 'Comment':
          await this.handleCommentWebhook(action, data);
          break;
        case 'Project':
          await this.handleProjectWebhook(action, data);
          break;
        default:
          this.logger.info('Desteklenmeyen webhook tipi', { type });
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Webhook işleme hatası', { error: error.message });
      throw error;
    }
  }

  /**
   * Issue webhook'larını işle
   */
  async handleIssueWebhook(action, issueData) {
    try {
      const { id, title, state, assignee, priority, labels } = issueData;

      switch (action) {
        case 'create':
          this.logger.info('Yeni Linear issue oluşturuldu', { 
            issueId: id, 
            title 
          });
          this.emit('issue:created', {
            issueId: id,
            title,
            state: state?.name,
            assignee: assignee?.name,
            priority,
            labels: labels?.nodes?.map(l => l.name) || []
          });
          break;

        case 'update':
          this.logger.info('Linear issue güncellendi', { 
            issueId: id, 
            title 
          });
          this.emit('issue:updated', {
            issueId: id,
            title,
            state: state?.name,
            assignee: assignee?.name,
            priority,
            labels: labels?.nodes?.map(l => l.name) || []
          });
          break;

        case 'remove':
          this.logger.info('Linear issue silindi', { 
            issueId: id 
          });
          this.emit('issue:deleted', {
            issueId: id
          });
          break;

        default:
          this.logger.info('Desteklenmeyen issue action', { action });
      }
    } catch (error) {
      this.logger.error('Issue webhook işleme hatası', { 
        error: error.message,
        action,
        issueId: issueData?.id 
      });
      throw error;
    }
  }

  /**
   * Comment webhook'larını işle
   */
  async handleCommentWebhook(action, commentData) {
    try {
      const { id, body, issue, user } = commentData;

      switch (action) {
        case 'create':
          this.logger.info('Linear issue\'ya yorum eklendi', { 
            commentId: id,
            issueId: issue?.id,
            user: user?.name 
          });
          this.emit('comment:created', {
            commentId: id,
            issueId: issue?.id,
            body,
            user: user?.name,
            userEmail: user?.email
          });
          break;

        case 'update':
          this.logger.info('Linear yorum güncellendi', { 
            commentId: id,
            issueId: issue?.id 
          });
          this.emit('comment:updated', {
            commentId: id,
            issueId: issue?.id,
            body,
            user: user?.name
          });
          break;

        case 'remove':
          this.logger.info('Linear yorum silindi', { 
            commentId: id 
          });
          this.emit('comment:deleted', {
            commentId: id,
            issueId: issue?.id
          });
          break;

        default:
          this.logger.info('Desteklenmeyen comment action', { action });
      }
    } catch (error) {
      this.logger.error('Comment webhook işleme hatası', { 
        error: error.message,
        action,
        commentId: commentData?.id 
      });
      throw error;
    }
  }

  /**
   * Project webhook'larını işle
   */
  async handleProjectWebhook(action, projectData) {
    try {
      const { id, name, state, progress } = projectData;

      switch (action) {
        case 'create':
          this.logger.info('Yeni Linear proje oluşturuldu', { 
            projectId: id, 
            name 
          });
          this.emit('project:created', {
            projectId: id,
            name,
            state,
            progress
          });
          break;

        case 'update':
          this.logger.info('Linear proje güncellendi', { 
            projectId: id, 
            name 
          });
          this.emit('project:updated', {
            projectId: id,
            name,
            state,
            progress
          });
          break;

        case 'remove':
          this.logger.info('Linear proje silindi', { 
            projectId: id 
          });
          this.emit('project:deleted', {
            projectId: id
          });
          break;

        default:
          this.logger.info('Desteklenmeyen project action', { action });
      }
    } catch (error) {
      this.logger.error('Project webhook işleme hatası', { 
        error: error.message,
        action,
        projectId: projectData?.id 
      });
      throw error;
    }
  }

  /**
   * Manufacturing event'leri için Linear webhook dinleyicileri kur
   */
  setupManufacturingEventListeners() {
    // Issue durumu değiştiğinde manufacturing sistemine bildir
    this.on('issue:updated', (issueData) => {
      if (this.isManufacturingIssue(issueData)) {
        this.handleManufacturingIssueUpdate(issueData);
      }
    });

    // Yorum eklendiğinde manufacturing takımına bildir
    this.on('comment:created', (commentData) => {
      this.handleManufacturingComment(commentData);
    });

    // Proje güncellendiğinde manufacturing dashboard'u güncelle
    this.on('project:updated', (projectData) => {
      this.handleManufacturingProjectUpdate(projectData);
    });
  }

  /**
   * Issue'nun manufacturing ile ilgili olup olmadığını kontrol et
   */
  isManufacturingIssue(issueData) {
    const manufacturingLabels = ['manufacturing', 'production', 'quality', 'maintenance'];
    return issueData.labels?.some(label => 
      manufacturingLabels.includes(label.toLowerCase())
    );
  }

  /**
   * Manufacturing issue güncellemesini işle
   */
  async handleManufacturingIssueUpdate(issueData) {
    try {
      this.logger.info('Manufacturing issue güncellendi', { 
        issueId: issueData.issueId,
        state: issueData.state 
      });

      // Manufacturing sistemine event gönder
      this.emit('manufacturing:issue:updated', {
        issueId: issueData.issueId,
        title: issueData.title,
        state: issueData.state,
        assignee: issueData.assignee,
        priority: issueData.priority,
        timestamp: new Date().toISOString()
      });

      // Kritik durumlar için alarm gönder
      if (issueData.priority === 1 && issueData.state === 'In Progress') {
        this.emit('manufacturing:alert', {
          type: 'critical_issue_in_progress',
          issueId: issueData.issueId,
          title: issueData.title,
          message: `Kritik üretim sorunu işleme alındı: ${issueData.title}`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error('Manufacturing issue güncelleme işleme hatası', { 
        error: error.message,
        issueData 
      });
    }
  }

  /**
   * Manufacturing yorum işlemesini yap
   */
  async handleManufacturingComment(commentData) {
    try {
      this.logger.info('Manufacturing issue\'ya yorum eklendi', { 
        commentId: commentData.commentId,
        issueId: commentData.issueId 
      });

      // Manufacturing takımına bildirim gönder
      this.emit('manufacturing:comment:added', {
        commentId: commentData.commentId,
        issueId: commentData.issueId,
        body: commentData.body,
        user: commentData.user,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Manufacturing yorum işleme hatası', { 
        error: error.message,
        commentData 
      });
    }
  }

  /**
   * Manufacturing proje güncellemesini işle
   */
  async handleManufacturingProjectUpdate(projectData) {
    try {
      this.logger.info('Manufacturing projesi güncellendi', { 
        projectId: projectData.projectId,
        progress: projectData.progress 
      });

      // Manufacturing dashboard'una güncelleme gönder
      this.emit('manufacturing:project:updated', {
        projectId: projectData.projectId,
        name: projectData.name,
        state: projectData.state,
        progress: projectData.progress,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Manufacturing proje güncelleme işleme hatası', { 
        error: error.message,
        projectData 
      });
    }
  }

  /**
   * Express middleware olarak kullanım için wrapper
   */
  getExpressMiddleware() {
    return async (req, res, next) => {
      try {
        const signature = req.headers['linear-signature'] || req.headers['x-linear-signature'];
        
        if (!signature) {
          return res.status(400).json({ 
            error: 'Linear signature header eksik' 
          });
        }

        const result = await this.handleWebhook(req.body, signature);
        res.json(result);
      } catch (error) {
        this.logger.error('Express webhook middleware hatası', { 
          error: error.message 
        });
        res.status(500).json({ 
          error: 'Webhook işleme hatası' 
        });
      }
    };
  }
}

module.exports = LinearWebhookHandler; 