const { LinearService, LinearConfig, LinearWebhookHandler } = require('./index');

describe('Linear Integration Tests', () => {
  let linearService;
  let mockConfig;

  beforeEach(() => {
    // Mock environment variables
    process.env.LINEAR_API_KEY = 'test-api-key';
    process.env.LINEAR_TEAM_ID = 'test-team-id';
    process.env.LINEAR_PROJECT_ID = 'test-project-id';
    process.env.LINEAR_WEBHOOK_SECRET = 'test-webhook-secret';
    process.env.LINEAR_AUTO_CREATE_ISSUES = 'true';

    mockConfig = new LinearConfig();
  });

  afterEach(async () => {
    if (linearService && linearService.isInitialized) {
      await linearService.shutdown();
    }
    
    // Clean up environment variables
    delete process.env.LINEAR_API_KEY;
    delete process.env.LINEAR_TEAM_ID;
    delete process.env.LINEAR_PROJECT_ID;
    delete process.env.LINEAR_WEBHOOK_SECRET;
    delete process.env.LINEAR_AUTO_CREATE_ISSUES;
  });

  describe('LinearConfig', () => {
    test('should load configuration from environment variables', () => {
      expect(mockConfig.getApiKey()).toBe('test-api-key');
      expect(mockConfig.getTeamId()).toBe('test-team-id');
      expect(mockConfig.getProjectId()).toBe('test-project-id');
      expect(mockConfig.isAutoCreateEnabled()).toBe(true);
    });

    test('should validate configuration', () => {
      expect(() => mockConfig.validate()).not.toThrow();
    });

    test('should throw error for missing required config', () => {
      delete process.env.LINEAR_API_KEY;
      const invalidConfig = new LinearConfig();
      
      expect(() => invalidConfig.validate()).toThrow('LINEAR_API_KEY gerekli');
    });

    test('should get event mapping for known event types', () => {
      const mapping = mockConfig.getEventMapping('machine_error');
      expect(mapping.priority).toBe(1);
      expect(mapping.labels).toContain('manufacturing');
      expect(mapping.labels).toContain('critical');
    });

    test('should return default mapping for unknown event types', () => {
      const mapping = mockConfig.getEventMapping('unknown_event');
      expect(mapping.priority).toBe(3);
      expect(mapping.labels).toContain('manufacturing');
    });
  });

  describe('LinearWebhookHandler', () => {
    let webhookHandler;

    beforeEach(() => {
      webhookHandler = new LinearWebhookHandler('test-secret');
    });

    test('should verify webhook signature correctly', () => {
      const payload = JSON.stringify({ test: 'data' });
      const crypto = require('crypto');
      const signature = 'sha256=' + crypto
        .createHmac('sha256', 'test-secret')
        .update(payload, 'utf8')
        .digest('hex');

      expect(webhookHandler.verifySignature(payload, signature)).toBe(true);
    });

    test('should reject invalid webhook signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const invalidSignature = 'sha256=invalid-signature';

      expect(webhookHandler.verifySignature(payload, invalidSignature)).toBe(false);
    });

    test('should handle issue webhook events', async () => {
      const mockIssueData = {
        id: 'test-issue-id',
        title: 'Test Issue',
        state: { name: 'In Progress' },
        assignee: { name: 'Test User' },
        priority: 1,
        labels: { nodes: [{ name: 'manufacturing' }] }
      };

      const eventPromise = new Promise((resolve) => {
        webhookHandler.once('issue:created', resolve);
      });

      await webhookHandler.handleIssueWebhook('create', mockIssueData);
      
      const eventData = await eventPromise;
      expect(eventData.issueId).toBe('test-issue-id');
      expect(eventData.title).toBe('Test Issue');
    });

    test('should identify manufacturing issues correctly', () => {
      const manufacturingIssue = {
        labels: ['manufacturing', 'critical']
      };

      const nonManufacturingIssue = {
        labels: ['bug', 'frontend']
      };

      expect(webhookHandler.isManufacturingIssue(manufacturingIssue)).toBe(true);
      expect(webhookHandler.isManufacturingIssue(nonManufacturingIssue)).toBe(false);
    });
  });

  describe('LinearService', () => {
    beforeEach(() => {
      linearService = new LinearService();
    });

    test('should throw error when not initialized', () => {
      expect(() => linearService.ensureInitialized()).toThrow(
        'Linear service henüz başlatılmamış'
      );
    });

    test('should handle manufacturing events', async () => {
      // Mock the client to avoid actual API calls
      linearService.client = {
        createManufacturingIssue: jest.fn().mockResolvedValue({
          id: 'test-issue-id',
          title: 'Test Manufacturing Issue'
        })
      };
      linearService.config = mockConfig;
      linearService.isInitialized = true;

      const eventData = {
        eventType: 'machine_error',
        severity: 'critical',
        machineId: 'machine-001',
        description: 'Test machine error',
        timestamp: new Date().toISOString()
      };

      const eventPromise = new Promise((resolve) => {
        linearService.once('manufacturing:issue:created', resolve);
      });

      await linearService.handleManufacturingEvent(eventData);
      
      const result = await eventPromise;
      expect(result.issueId).toBe('test-issue-id');
      expect(linearService.client.createManufacturingIssue).toHaveBeenCalledWith(eventData);
    });

    test('should handle manufacturing alerts', async () => {
      // Mock the client
      linearService.client = {
        createManufacturingIssue: jest.fn().mockResolvedValue({
          id: 'test-alert-issue-id',
          title: 'Test Alert Issue'
        }),
        getTeamMembers: jest.fn().mockResolvedValue([
          { id: 'user-1', name: 'Test User', active: true }
        ]),
        updateIssue: jest.fn().mockResolvedValue({})
      };
      linearService.config = mockConfig;
      linearService.isInitialized = true;

      const alertData = {
        type: 'critical_system_failure',
        severity: 'critical',
        machineId: 'system-001',
        message: 'Critical system failure detected',
        timestamp: new Date().toISOString()
      };

      const alertPromise = new Promise((resolve) => {
        linearService.once('manufacturing:alert:processed', resolve);
      });

      await linearService.handleManufacturingAlert(alertData);
      
      const result = await alertPromise;
      expect(result.issueId).toBe('test-alert-issue-id');
      expect(linearService.client.createManufacturingIssue).toHaveBeenCalled();
    });

    test('should get service status', () => {
      linearService.config = mockConfig;
      linearService.isInitialized = true;

      const status = linearService.getStatus();
      
      expect(status.initialized).toBe(true);
      expect(status.config.teamId).toBe('test-team-id');
      expect(status.config.autoCreateEnabled).toBe(true);
      expect(status.timestamp).toBeDefined();
    });

    test('should retry failed operations', async () => {
      linearService.retryConfig = { attempts: 3, delay: 100 };
      
      let attemptCount = 0;
      const failingOperation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await linearService.retryOperation(failingOperation);
      
      expect(result).toBe('success');
      expect(failingOperation).toHaveBeenCalledTimes(3);
    });

    test('should fail after max retry attempts', async () => {
      linearService.retryConfig = { attempts: 2, delay: 10 };
      
      const alwaysFailingOperation = jest.fn().mockRejectedValue(new Error('Permanent failure'));

      await expect(linearService.retryOperation(alwaysFailingOperation))
        .rejects.toThrow('Permanent failure');
      
      expect(alwaysFailingOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration Tests', () => {
    test('should handle end-to-end manufacturing event flow', async () => {
      // Mock all external dependencies
      const mockLinearClient = {
        testConnection: jest.fn().mockResolvedValue({ success: true, user: { id: 'user-1', name: 'Test User' } }),
        createManufacturingIssue: jest.fn().mockResolvedValue({
          id: 'integration-test-issue',
          title: '[machine_error] machine-001 - critical'
        })
      };

      linearService = new LinearService();
      linearService.config = mockConfig;
      
      // Override client creation
      linearService.client = mockLinearClient;
      linearService.webhookHandler = new LinearWebhookHandler('test-secret');
      linearService.isInitialized = true;
      linearService.setupEventListeners();

      const manufacturingEvent = {
        eventType: 'machine_error',
        severity: 'critical',
        machineId: 'machine-001',
        description: 'Hydraulic system failure detected',
        timestamp: new Date().toISOString(),
        additionalData: {
          temperature: 85.5,
          pressure: 120.3,
          vibration: 'high'
        }
      };

      const issueCreatedPromise = new Promise((resolve) => {
        linearService.once('manufacturing:issue:created', resolve);
      });

      // Trigger the manufacturing event
      linearService.emit('manufacturing:event', manufacturingEvent);

      const result = await issueCreatedPromise;
      
      expect(result.issueId).toBe('integration-test-issue');
      expect(mockLinearClient.createManufacturingIssue).toHaveBeenCalledWith(manufacturingEvent);
    });

    test('should handle webhook to manufacturing system flow', async () => {
      const webhookHandler = new LinearWebhookHandler('test-secret');
      webhookHandler.setupManufacturingEventListeners();

      const manufacturingEventPromise = new Promise((resolve) => {
        webhookHandler.once('manufacturing:issue:updated', resolve);
      });

      const mockIssueData = {
        id: 'webhook-test-issue',
        title: 'Manufacturing Issue from Webhook',
        state: { name: 'In Progress' },
        assignee: { name: 'Manufacturing Engineer' },
        priority: 1,
        labels: [{ name: 'manufacturing' }, { name: 'critical' }]
      };

      await webhookHandler.handleIssueWebhook('update', mockIssueData);

      const result = await manufacturingEventPromise;
      
      expect(result.issueId).toBe('webhook-test-issue');
      expect(result.state).toBe('In Progress');
      expect(result.priority).toBe(1);
    });
  });
}); 