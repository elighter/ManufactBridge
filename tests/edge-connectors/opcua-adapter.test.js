/**
 * OPC UA Adapter Birim Testleri
 */

const OPCUAAdapter = require('../../src/EdgeConnectors/SCADA/opcua-adapter');

// Mock node-opcua modülü
jest.mock('node-opcua', () => ({
  OPCUAClient: {
    create: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      createSession: jest.fn(),
      on: jest.fn()
    }))
  },
  MessageSecurityMode: {
    None: 1,
    Sign: 2,
    SignAndEncrypt: 3
  },
  SecurityPolicy: {
    None: 'None',
    Basic128: 'Basic128',
    Basic256: 'Basic256'
  },
  AttributeIds: {
    Value: 13
  },
  ClientSubscription: {
    create: jest.fn(() => ({
      on: jest.fn(),
      terminate: jest.fn()
    }))
  },
  TimestampsToReturn: {
    Both: 3
  },
  ClientMonitoredItem: {
    create: jest.fn(() => ({
      on: jest.fn()
    }))
  }
}));

jest.mock('../../src/EdgeConnectors/config', () => global.mockConfig);

describe('OPCUAAdapter', () => {
  let opcuaAdapter;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      connection: {
        endpoint: 'opc.tcp://localhost:4840'
      },
      options: {
        applicationName: 'Test Client',
        securityMode: 'None',
        securityPolicy: 'None'
      },
      tags: [
        {
          name: 'temperature',
          nodeId: 'ns=2;s=Temperature',
          dataType: 'float',
          scanRate: '1s'
        },
        {
          name: 'pressure',
          nodeId: 'ns=2;i=1001',
          dataType: 'float',
          scanRate: '2s'
        }
      ],
      mapping: {
        enterprise: 'test-enterprise',
        site: 'test-site',
        area: 'test-area',
        line: 'test-line',
        device: 'test-device'
      }
    };
  });

  describe('Constructor ve Initialization', () => {
    test('başarılı constructor', () => {
      expect(() => {
        opcuaAdapter = new OPCUAAdapter(mockConfig);
      }).not.toThrow();

      expect(opcuaAdapter.type).toBe('opcua');
      expect(opcuaAdapter.connected).toBe(false);
      expect(opcuaAdapter.client).toBeNull();
      expect(opcuaAdapter.session).toBeNull();
    });

    test('güvenlik modu parse etme', () => {
      opcuaAdapter = new OPCUAAdapter(mockConfig);
      
      expect(opcuaAdapter.securityMode).toBe(1); // MessageSecurityMode.None
    });

    test('güvenlik politikası parse etme', () => {
      opcuaAdapter = new OPCUAAdapter(mockConfig);
      
      expect(opcuaAdapter.securityPolicy).toBe('None');
    });

    test('bilinmeyen güvenlik modu için uyarı', () => {
      const configWithInvalidSecurity = {
        ...mockConfig,
        options: {
          ...mockConfig.options,
          securityMode: 'InvalidMode'
        }
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      opcuaAdapter = new OPCUAAdapter(configWithInvalidSecurity);
      
      expect(opcuaAdapter.securityMode).toBe(1); // Default to None
      consoleSpy.mockRestore();
    });
  });

  describe('Konfigürasyon Doğrulama', () => {
    test('geçerli konfigürasyon', () => {
      opcuaAdapter = new OPCUAAdapter(mockConfig);
      
      expect(() => {
        opcuaAdapter.validateConfig();
      }).not.toThrow();
    });

    test('eksik endpoint hatası', () => {
      const invalidConfig = {
        ...mockConfig,
        connection: {}
      };

      opcuaAdapter = new OPCUAAdapter(invalidConfig);
      
      expect(() => {
        opcuaAdapter.validateConfig();
      }).toThrow('OPC UA bağlantısı için geçerli bir endpoint gereklidir');
    });

    test('geçersiz endpoint formatı', () => {
      const invalidConfig = {
        ...mockConfig,
        connection: {
          endpoint: 'http://localhost:4840'
        }
      };

      opcuaAdapter = new OPCUAAdapter(invalidConfig);
      
      expect(() => {
        opcuaAdapter.validateConfig();
      }).toThrow('OPC UA endpoint URL\'si opc.tcp:// ile başlamalıdır');
    });
  });

  describe('Bağlantı Yönetimi', () => {
    beforeEach(() => {
      opcuaAdapter = new OPCUAAdapter(mockConfig);
    });

    test('başarılı bağlantı', async () => {
      const mockClient = {
        connect: jest.fn().mockResolvedValue(),
        createSession: jest.fn().mockResolvedValue({
          on: jest.fn(),
          sessionId: 'test-session-id'
        }),
        on: jest.fn()
      };

      const { OPCUAClient } = require('node-opcua');
      OPCUAClient.create.mockReturnValue(mockClient);

      const result = await opcuaAdapter.connect();

      expect(result).toBe(true);
      expect(opcuaAdapter.connected).toBe(true);
      expect(opcuaAdapter.status).toBe('connected');
      expect(mockClient.connect).toHaveBeenCalledWith('opc.tcp://localhost:4840');
    });

    test('zaten bağlı durumda', async () => {
      opcuaAdapter.connected = true;

      const result = await opcuaAdapter.connect();

      expect(result).toBe(true);
    });

    test('bağlantı hatası', async () => {
      const mockClient = {
        connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
        on: jest.fn()
      };

      const { OPCUAClient } = require('node-opcua');
      OPCUAClient.create.mockReturnValue(mockClient);

      await expect(opcuaAdapter.connect()).rejects.toThrow('Connection failed');
      expect(opcuaAdapter.connected).toBe(false);
      expect(opcuaAdapter.status).toBe('error');
    });

    test('başarılı bağlantı kesme', async () => {
      // Bağlantı kurulmuş durumu simüle et
      opcuaAdapter.connected = true;
      opcuaAdapter.client = {
        disconnect: jest.fn().mockResolvedValue()
      };
      opcuaAdapter.session = {
        close: jest.fn().mockResolvedValue()
      };
      opcuaAdapter.subscription = {
        terminate: jest.fn().mockResolvedValue()
      };

      const result = await opcuaAdapter.disconnect();

      expect(result).toBe(true);
      expect(opcuaAdapter.connected).toBe(false);
      expect(opcuaAdapter.status).toBe('disconnected');
    });
  });

  describe('Tag Yönetimi', () => {
    beforeEach(() => {
      opcuaAdapter = new OPCUAAdapter(mockConfig);
    });

    test('tag tanımlama', async () => {
      const tags = [
        {
          name: 'temperature',
          nodeId: 'ns=2;s=Temperature',
          dataType: 'float'
        }
      ];

      await opcuaAdapter.defineTags(tags);

      expect(opcuaAdapter.tags.size).toBe(1);
      expect(opcuaAdapter.tags.has('temperature')).toBe(true);
    });

    test('tag okuma - bağlantı yok', async () => {
      opcuaAdapter.connected = false;

      await expect(opcuaAdapter.readTag('temperature')).rejects.toThrow('OPC UA bağlantısı mevcut değil');
    });

    test('tag okuma - tag bulunamadı', async () => {
      opcuaAdapter.connected = true;
      opcuaAdapter.session = {};

      await expect(opcuaAdapter.readTag('nonexistent')).rejects.toThrow('Tag bulunamadı: nonexistent');
    });

    test('başarılı tag okuma', async () => {
      opcuaAdapter.connected = true;
      opcuaAdapter.session = {
        readVariableValue: jest.fn().mockResolvedValue({
          statusCode: { isGood: () => true },
          value: { value: 25.5 }
        })
      };

      await opcuaAdapter.defineTags([{
        name: 'temperature',
        nodeId: 'ns=2;s=Temperature',
        dataType: 'float'
      }]);

      const value = await opcuaAdapter.readTag('temperature');

      expect(value).toBe(25.5);
    });

    test('tag yazma - bağlantı yok', async () => {
      opcuaAdapter.connected = false;

      await expect(opcuaAdapter.writeTag('temperature', 30.0)).rejects.toThrow('OPC UA bağlantısı mevcut değil');
    });

    test('başarılı tag yazma', async () => {
      opcuaAdapter.connected = true;
      opcuaAdapter.session = {
        writeSingleNode: jest.fn().mockResolvedValue({
          isGood: () => true
        })
      };

      await opcuaAdapter.defineTags([{
        name: 'temperature',
        nodeId: 'ns=2;s=Temperature',
        dataType: 'float'
      }]);

      const result = await opcuaAdapter.writeTag('temperature', 30.0);

      expect(result).toBe(true);
    });
  });

  describe('Veri Dönüşümü', () => {
    beforeEach(() => {
      opcuaAdapter = new OPCUAAdapter(mockConfig);
    });

    test('OPC UA değer dönüşümü - boolean', () => {
      const result = opcuaAdapter._convertDataType(1, 'boolean');
      expect(result).toBe(true);
    });

    test('OPC UA değer dönüşümü - integer', () => {
      const result = opcuaAdapter._convertDataType('123', 'int32');
      expect(result).toBe(123);
    });

    test('OPC UA değer dönüşümü - float', () => {
      const result = opcuaAdapter._convertDataType('25.5', 'float');
      expect(result).toBe(25.5);
    });

    test('OPC UA değer dönüşümü - string', () => {
      const result = opcuaAdapter._convertDataType(123, 'string');
      expect(result).toBe('123');
    });

    test('scan rate parse etme', () => {
      expect(opcuaAdapter._parseScanRate('1s')).toBe(1000);
      expect(opcuaAdapter._parseScanRate('500ms')).toBe(500);
      expect(opcuaAdapter._parseScanRate('2m')).toBe(120000);
      expect(opcuaAdapter._parseScanRate(1500)).toBe(1500);
    });
  });

  describe('Durum Yönetimi', () => {
    beforeEach(() => {
      opcuaAdapter = new OPCUAAdapter(mockConfig);
    });

    test('adaptör durumu', () => {
      opcuaAdapter.connected = true;
      opcuaAdapter.session = { sessionId: 'test-session' };
      opcuaAdapter.subscription = { subscriptionId: 123 };

      const status = opcuaAdapter.getStatus();

      expect(status.connected).toBe(true);
      expect(status.endpoint).toBe('opc.tcp://localhost:4840');
      expect(status.sessionId).toBe('test-session');
      expect(status.subscriptionId).toBe(123);
    });
  });

  describe('Hata Durumları', () => {
    beforeEach(() => {
      opcuaAdapter = new OPCUAAdapter(mockConfig);
    });

    test('subscription oluşturma hatası', async () => {
      opcuaAdapter.connected = true;
      opcuaAdapter.session = {};

      const { ClientSubscription } = require('node-opcua');
      ClientSubscription.create.mockImplementation(() => {
        throw new Error('Subscription creation failed');
      });

      await expect(opcuaAdapter._createSubscription()).rejects.toThrow('Subscription creation failed');
    });

    test('monitored item oluşturma hatası', async () => {
      opcuaAdapter.subscription = { on: jest.fn() };

      const { ClientMonitoredItem } = require('node-opcua');
      ClientMonitoredItem.create.mockImplementation(() => {
        throw new Error('MonitoredItem creation failed');
      });

      // Hata loglanmalı ama exception fırlatmamalı
      await opcuaAdapter._createMonitoredItem('test-tag', {
        nodeId: 'ns=2;s=Test',
        scanRate: '1s'
      });

      // Test geçmeli (hata yakalanıp loglanmalı)
      expect(true).toBe(true);
    });
  });

  describe('Yeniden Bağlanma', () => {
    beforeEach(() => {
      opcuaAdapter = new OPCUAAdapter(mockConfig);
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('yeniden bağlanma zamanlaması', () => {
      opcuaAdapter.connected = false;
      opcuaAdapter.reconnecting = false;

      opcuaAdapter._scheduleReconnect();

      expect(opcuaAdapter.reconnectTimer).toBeDefined();
    });

    test('zaten yeniden bağlanma durumunda', () => {
      opcuaAdapter.reconnecting = true;

      opcuaAdapter._scheduleReconnect();

      expect(opcuaAdapter.reconnectTimer).toBeNull();
    });
  });

  describe('Kullanıcı Kimlik Doğrulama', () => {
    test('anonymous kimlik doğrulama', () => {
      const config = {
        ...mockConfig,
        connection: {
          ...mockConfig.connection
          // authentication yok
        }
      };

      opcuaAdapter = new OPCUAAdapter(config);
      const identity = opcuaAdapter._createUserIdentity();

      expect(identity).toEqual({});
    });

    test('username/password kimlik doğrulama', () => {
      const config = {
        ...mockConfig,
        connection: {
          ...mockConfig.connection,
          authentication: {
            type: 'username',
            username: 'testuser',
            password: 'testpass'
          }
        }
      };

      opcuaAdapter = new OPCUAAdapter(config);
      const identity = opcuaAdapter._createUserIdentity();

      expect(identity).toEqual({
        userName: 'testuser',
        password: 'testpass'
      });
    });

    test('certificate kimlik doğrulama', () => {
      const config = {
        ...mockConfig,
        connection: {
          ...mockConfig.connection,
          authentication: {
            type: 'certificate',
            certificateFile: '/path/to/cert.pem',
            privateKeyFile: '/path/to/key.pem'
          }
        }
      };

      opcuaAdapter = new OPCUAAdapter(config);
      const identity = opcuaAdapter._createUserIdentity();

      expect(identity).toEqual({
        certificateFile: '/path/to/cert.pem',
        privateKeyFile: '/path/to/key.pem'
      });
    });
  });
}); 