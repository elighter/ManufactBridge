const { LinearClient } = require('@linear/sdk');
const winston = require('winston');

/**
 * Linear Integration Client
 * ManufactBridge projesi için Linear API entegrasyonu
 */
class LinearIntegrationClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.client = new LinearClient({ apiKey });
    this.logger = winston.createLogger({
      level: options.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/linear-integration.log' })
      ]
    });
    
    this.teamId = options.teamId;
    this.projectId = options.projectId;
  }

  /**
   * Linear bağlantısını test et
   */
  async testConnection() {
    try {
      const viewer = await this.client.viewer;
      this.logger.info('Linear bağlantısı başarılı', { 
        userId: viewer.id, 
        userName: viewer.name 
      });
      return { success: true, user: viewer };
    } catch (error) {
      this.logger.error('Linear bağlantı hatası', { error: error.message });
      throw new Error(`Linear bağlantı hatası: ${error.message}`);
    }
  }

  /**
   * Yeni issue oluştur
   */
  async createIssue(issueData) {
    try {
      const { title, description, priority = 0, assigneeId, labelIds = [] } = issueData;
      
      const issuePayload = {
        title,
        description,
        teamId: this.teamId,
        priority,
        projectId: this.projectId
      };

      if (assigneeId) {
        issuePayload.assigneeId = assigneeId;
      }

      if (labelIds.length > 0) {
        issuePayload.labelIds = labelIds;
      }

      const issueResponse = await this.client.createIssue(issuePayload);
      
      if (issueResponse.success) {
        this.logger.info('Linear issue oluşturuldu', { 
          issueId: issueResponse.issue.id,
          title: title 
        });
        return issueResponse.issue;
      } else {
        throw new Error('Issue oluşturulamadı');
      }
    } catch (error) {
      this.logger.error('Issue oluşturma hatası', { 
        error: error.message,
        issueData 
      });
      throw error;
    }
  }

  /**
   * Issue güncelle
   */
  async updateIssue(issueId, updateData) {
    try {
      const issueResponse = await this.client.updateIssue(issueId, updateData);
      
      if (issueResponse.success) {
        this.logger.info('Linear issue güncellendi', { 
          issueId,
          updateData 
        });
        return issueResponse.issue;
      } else {
        throw new Error('Issue güncellenemedi');
      }
    } catch (error) {
      this.logger.error('Issue güncelleme hatası', { 
        error: error.message,
        issueId,
        updateData 
      });
      throw error;
    }
  }

  /**
   * Issue detaylarını getir
   */
  async getIssue(issueId) {
    try {
      const issue = await this.client.issue(issueId);
      this.logger.info('Linear issue detayları alındı', { issueId });
      return issue;
    } catch (error) {
      this.logger.error('Issue detayları alma hatası', { 
        error: error.message,
        issueId 
      });
      throw error;
    }
  }

  /**
   * Proje issue'larını listele
   */
  async listProjectIssues(filters = {}) {
    try {
      const issuesQuery = {
        filter: {
          project: { id: { eq: this.projectId } },
          ...filters
        }
      };

      const issues = await this.client.issues(issuesQuery);
      this.logger.info('Proje issue\'ları listelendi', { 
        projectId: this.projectId,
        count: issues.nodes.length 
      });
      return issues.nodes;
    } catch (error) {
      this.logger.error('Issue listeleme hatası', { 
        error: error.message,
        projectId: this.projectId 
      });
      throw error;
    }
  }

  /**
   * Issue'ya yorum ekle
   */
  async addComment(issueId, comment) {
    try {
      const commentResponse = await this.client.createComment({
        issueId,
        body: comment
      });

      if (commentResponse.success) {
        this.logger.info('Linear issue\'ya yorum eklendi', { 
          issueId,
          commentId: commentResponse.comment.id 
        });
        return commentResponse.comment;
      } else {
        throw new Error('Yorum eklenemedi');
      }
    } catch (error) {
      this.logger.error('Yorum ekleme hatası', { 
        error: error.message,
        issueId 
      });
      throw error;
    }
  }

  /**
   * Takım üyelerini listele
   */
  async getTeamMembers() {
    try {
      const team = await this.client.team(this.teamId);
      const members = await team.members();
      
      this.logger.info('Takım üyeleri listelendi', { 
        teamId: this.teamId,
        memberCount: members.nodes.length 
      });
      return members.nodes;
    } catch (error) {
      this.logger.error('Takım üyeleri listeleme hatası', { 
        error: error.message,
        teamId: this.teamId 
      });
      throw error;
    }
  }

  /**
   * Proje durumlarını getir
   */
  async getProjectStates() {
    try {
      const team = await this.client.team(this.teamId);
      const states = await team.states();
      
      this.logger.info('Proje durumları alındı', { 
        teamId: this.teamId,
        stateCount: states.nodes.length 
      });
      return states.nodes;
    } catch (error) {
      this.logger.error('Proje durumları alma hatası', { 
        error: error.message,
        teamId: this.teamId 
      });
      throw error;
    }
  }

  /**
   * ManufactBridge olayları için otomatik issue oluşturma
   */
  async createManufacturingIssue(eventData) {
    try {
      const { 
        eventType, 
        severity, 
        machineId, 
        description, 
        timestamp,
        additionalData = {} 
      } = eventData;

      const title = `[${eventType}] ${machineId} - ${severity}`;
      const issueDescription = `
## Üretim Olayı Detayları

**Olay Tipi:** ${eventType}
**Makine ID:** ${machineId}
**Önem Derecesi:** ${severity}
**Zaman:** ${new Date(timestamp).toLocaleString('tr-TR')}

**Açıklama:**
${description}

**Ek Veriler:**
\`\`\`json
${JSON.stringify(additionalData, null, 2)}
\`\`\`

---
*Bu issue ManufactBridge sistemi tarafından otomatik olarak oluşturulmuştur.*
      `;

      // Önem derecesine göre Linear priority belirleme
      let priority = 0; // No priority
      switch (severity.toLowerCase()) {
        case 'critical':
        case 'kritik':
          priority = 1; // Urgent
          break;
        case 'high':
        case 'yüksek':
          priority = 2; // High
          break;
        case 'medium':
        case 'orta':
          priority = 3; // Normal
          break;
        case 'low':
        case 'düşük':
          priority = 4; // Low
          break;
      }

      const issue = await this.createIssue({
        title,
        description: issueDescription,
        priority
      });

      this.logger.info('Üretim olayı için Linear issue oluşturuldu', {
        issueId: issue.id,
        eventType,
        machineId,
        severity
      });

      return issue;
    } catch (error) {
      this.logger.error('Üretim olayı issue oluşturma hatası', { 
        error: error.message,
        eventData 
      });
      throw error;
    }
  }
}

module.exports = LinearIntegrationClient; 