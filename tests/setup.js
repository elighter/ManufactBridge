/**
 * Jest Test Setup
 * 
 * Bu dosya tüm testlerden önce çalışır ve test ortamını hazırlar.
 */

// Test timeout'unu artır (async işlemler için)
jest.setTimeout(30000);

// Console log'ları test sırasında gizle (gerekirse açılabilir)
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Test ortamı için environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock config for tests
global.mockConfig = {
  security: {
    enabled: true,
    authentication: {
      enabled: true,
      type: 'basic',
      oauth2: {
        issuer_url: 'https://test-issuer.com',
        audience: 'test-audience',
        jwks_uri: 'https://test-issuer.com/.well-known/jwks.json'
      }
    },
    authorization: {
      enabled: true,
      default_policy: 'deny',
      admin_users: ['admin']
    },
    tls: {
      enabled: false,
      key_file: 'test.key',
      cert_file: 'test.crt',
      ca_file: 'test-ca.crt',
      require_client_cert: false
    },
    audit_log: true
  },
  mqtt: {
    broker: {
      host: 'localhost',
      port: 1883,
      secure: false
    }
  },
  kafka: {
    brokers: ['localhost:9092'],
    clientId: 'test-client'
  },
  influxdb: {
    url: 'http://localhost:8086',
    token: 'test-token',
    org: 'test-org',
    bucket: 'test-bucket'
  },
  logging: {
    level: 'error',
    file_enabled: false,
    file_path: '/tmp/test.log',
    max_file_size: '10m',
    max_files: 5
  }
};

// Test helper functions
global.testHelpers = {
  /**
   * Async işlemleri beklemek için yardımcı fonksiyon
   * @param {number} ms Bekleme süresi (milisaniye)
   */
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Mock MQTT client oluştur
   */
  createMockMQTTClient: () => ({
    id: 'test-client-' + Math.random().toString(36).substr(2, 9),
    username: 'test-user',
    connection: {
      remoteAddress: '127.0.0.1'
    },
    certificate: null
  }),

  /**
   * Mock topic oluştur
   */
  createMockTopic: (enterprise = 'test', site = 'factory1', area = 'production', line = 'line1', device = 'sensor1') => {
    return `manufactbridge/${enterprise}/${site}/${area}/${line}/${device}`;
  },

  /**
   * Test verisi oluştur
   */
  createTestData: () => ({
    timestamp: new Date().toISOString(),
    temperature: 25.5 + Math.random() * 10,
    pressure: 1.0 + Math.random() * 0.5,
    status: 'running'
  })
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global cleanup
afterAll(() => {
  // Restore console
  global.console = originalConsole;
}); 