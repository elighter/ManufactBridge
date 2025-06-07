/**
 * Linear Integration Module
 * ManufactBridge Linear entegrasyonu ana modülü
 */

const LinearService = require('./LinearService');
const LinearIntegrationClient = require('./LinearClient');
const LinearConfig = require('./LinearConfig');
const LinearWebhookHandler = require('./LinearWebhookHandler');

module.exports = {
  LinearService,
  LinearIntegrationClient,
  LinearConfig,
  LinearWebhookHandler,
  
  /**
   * Linear entegrasyonu için hızlı başlatma fonksiyonu
   */
  async createLinearService(options = {}) {
    const service = new LinearService(options);
    await service.initialize();
    return service;
  },

  /**
   * Örnek konfigürasyon dosyası oluştur
   */
  createSampleConfig() {
    return LinearConfig.createSampleConfig();
  },

  /**
   * Linear entegrasyonu için Express route'ları
   */
  createExpressRoutes(app, linearService) {
    // Linear webhook endpoint'i
    app.post('/api/webhooks/linear', 
      linearService.getWebhookHandler().getExpressMiddleware()
    );

    // Linear API endpoint'leri
    app.get('/api/linear/status', async (req, res) => {
      try {
        const status = linearService.getStatus();
        res.json(status);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/linear/stats', async (req, res) => {
      try {
        const stats = await linearService.getManufacturingStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/linear/issues', async (req, res) => {
      try {
        const issues = await linearService.listProjectIssues(req.query);
        res.json(issues);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/linear/issues', async (req, res) => {
      try {
        const issue = await linearService.createIssue(req.body);
        res.json(issue);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/linear/issues/:id', async (req, res) => {
      try {
        const issue = await linearService.getIssue(req.params.id);
        res.json(issue);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.put('/api/linear/issues/:id', async (req, res) => {
      try {
        const issue = await linearService.updateIssue(req.params.id, req.body);
        res.json(issue);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/linear/issues/:id/comments', async (req, res) => {
      try {
        const comment = await linearService.addComment(req.params.id, req.body.comment);
        res.json(comment);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/linear/team/members', async (req, res) => {
      try {
        const members = await linearService.getTeamMembers();
        res.json(members);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/linear/project/states', async (req, res) => {
      try {
        const states = await linearService.getProjectStates();
        res.json(states);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Manufacturing event'i Linear'a gönder
    app.post('/api/linear/manufacturing/event', async (req, res) => {
      try {
        linearService.emit('manufacturing:event', req.body);
        res.json({ success: true, message: 'Manufacturing event Linear\'a gönderildi' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Manufacturing alert'i Linear'a gönder
    app.post('/api/linear/manufacturing/alert', async (req, res) => {
      try {
        linearService.emit('manufacturing:alert', req.body);
        res.json({ success: true, message: 'Manufacturing alert Linear\'a gönderildi' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    return app;
  },

  /**
   * Manufacturing sistemi için Linear event listener'ları kur
   */
  setupManufacturingIntegration(linearService, manufacturingSystem) {
    // Linear'dan gelen event'leri manufacturing sistemine aktar
    linearService.on('linear:issue:updated', (data) => {
      manufacturingSystem.emit('linear:issue:updated', data);
    });

    linearService.on('linear:alert', (data) => {
      manufacturingSystem.emit('linear:alert', data);
    });

    linearService.on('manufacturing:issue:created', (data) => {
      manufacturingSystem.emit('linear:issue:created', data);
    });

    // Manufacturing sisteminden gelen event'leri Linear'a aktar
    manufacturingSystem.on('machine:error', (data) => {
      linearService.emit('manufacturing:event', {
        eventType: 'machine_error',
        severity: 'critical',
        machineId: data.machineId,
        description: data.description,
        timestamp: data.timestamp,
        additionalData: data
      });
    });

    manufacturingSystem.on('quality:issue', (data) => {
      linearService.emit('manufacturing:event', {
        eventType: 'quality_issue',
        severity: 'high',
        machineId: data.machineId || 'quality_system',
        description: data.description,
        timestamp: data.timestamp,
        additionalData: data
      });
    });

    manufacturingSystem.on('maintenance:required', (data) => {
      linearService.emit('manufacturing:event', {
        eventType: 'maintenance_required',
        severity: 'medium',
        machineId: data.machineId,
        description: data.description,
        timestamp: data.timestamp,
        additionalData: data
      });
    });

    manufacturingSystem.on('production:delay', (data) => {
      linearService.emit('manufacturing:event', {
        eventType: 'production_delay',
        severity: 'high',
        machineId: data.machineId || 'production_system',
        description: data.description,
        timestamp: data.timestamp,
        additionalData: data
      });
    });

    manufacturingSystem.on('sensor:failure', (data) => {
      linearService.emit('manufacturing:event', {
        eventType: 'sensor_failure',
        severity: 'critical',
        machineId: data.machineId,
        description: data.description,
        timestamp: data.timestamp,
        additionalData: data
      });
    });

    return { linearService, manufacturingSystem };
  }
};