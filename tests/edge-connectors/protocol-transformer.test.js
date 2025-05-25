/**
 * Protocol Transformer Birim Testleri
 */

const ProtocolTransformer = require('../../src/EdgeConnectors/protocol-transformer');

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

jest.mock('../../src/EdgeConnectors/config', () => global.mockConfig);

describe('ProtocolTransformer', () => {
  let transformer;
  let mockAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    
    transformer = new ProtocolTransformer({
      enableSparkplugB: true,
      enableISA95: true,
      defaultNamespace: 'test-namespace',
      timestampFormat: 'iso',
      qualityMapping: true
    });

    mockAdapter = {
      id: 'test-adapter-1',
      name: 'Test Adapter',
      type: 'opcua',
      options: {
        mapping: {
          enterprise: 'test-enterprise',
          site: 'test-site',
          area: 'test-area',
          line: 'test-line',
          device: 'test-device'
        }
      }
    };
  });

  describe('Constructor ve Initialization', () => {
    test('başarılı constructor', () => {
      expect(transformer).toBeDefined();
      expect(transformer.transformers.size).toBe(4); // opcua, modbus, mqtt, sparkplugb
    });

    test('varsayılan seçenekler', () => {
      const defaultTransformer = new ProtocolTransformer();
      
      expect(defaultTransformer.options.enableSparkplugB).toBe(true);
      expect(defaultTransformer.options.enableISA95).toBe(true);
      expect(defaultTransformer.options.defaultNamespace).toBe('manufactbridge');
    });

    test('özel seçenekler', () => {
      const customTransformer = new ProtocolTransformer({
        enableSparkplugB: false,
        defaultNamespace: 'custom-namespace'
      });
      
      expect(customTransformer.options.enableSparkplugB).toBe(false);
      expect(customTransformer.options.defaultNamespace).toBe('custom-namespace');
    });
  });

  describe('Ana Transform Metodu', () => {
    test('desteklenen protokol dönüşümü', () => {
      const rawData = {
        name: 'temperature',
        value: 25.5,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        quality: 'good',
        nodeId: 'ns=2;s=Temperature',
        dataType: 'float'
      };

      const result = transformer.transform(rawData, 'opcua', mockAdapter);

      expect(result).toHaveProperty('topic');
      expect(result).toHaveProperty('payload');
      expect(result).toHaveProperty('qos');
      expect(result).toHaveProperty('retain');
      expect(result.payload.value).toBe(25.5);
      expect(result.payload.metadata.protocol).toBe('opcua');
    });

    test('desteklenmeyen protokol hatası', () => {
      const rawData = { name: 'test', value: 123 };

      expect(() => {
        transformer.transform(rawData, 'unsupported-protocol', mockAdapter);
      }).toThrow('Desteklenmeyen protokol: unsupported-protocol');
    });
  });

  describe('OPC UA Dönüşümü', () => {
    test('OPC UA veri dönüşümü', () => {
      const rawData = {
        name: 'temperature',
        value: 25.5,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        quality: 'good',
        nodeId: 'ns=2;s=Temperature',
        dataType: 'float',
        statusCode: 0,
        sourceTimestamp: new Date('2024-01-01T10:00:00Z'),
        serverTimestamp: new Date('2024-01-01T10:00:01Z')
      };

      const result = transformer.transform(rawData, 'opcua', mockAdapter);

      expect(result.payload.metadata.opcua).toBeDefined();
      expect(result.payload.metadata.opcua.nodeId).toBe('ns=2;s=Temperature');
      expect(result.payload.metadata.opcua.statusCode).toBe(0);
      expect(result.payload.sparkplugB).toBeDefined();
    });

    test('OPC UA topic oluşturma', () => {
      const rawData = {
        name: 'temperature',
        value: 25.5,
        nodeId: 'ns=2;s=Temperature'
      };

      const result = transformer.transform(rawData, 'opcua', mockAdapter);

      expect(result.topic).toBe('test-namespace/test-enterprise/test-site/test-area/test-line/test-device/data/temperature');
    });

    test('Node ID\'den tag adı çıkarma', () => {
      // String identifier
      expect(transformer._extractTagFromNodeId('ns=2;s=Temperature')).toBe('Temperature');
      
      // Numeric identifier
      expect(transformer._extractTagFromNodeId('ns=2;i=1001')).toBe('node_1001');
      
      // Geçersiz format
      expect(transformer._extractTagFromNodeId('invalid-node-id')).toBe('invalid_node_id');
    });

    test('OPC UA veri tipi dönüşümü', () => {
      expect(transformer._convertOPCUAValue('true', 'boolean')).toBe(true);
      expect(transformer._convertOPCUAValue('123', 'int32')).toBe(123);
      expect(transformer._convertOPCUAValue('25.5', 'float')).toBe(25.5);
      expect(transformer._convertOPCUAValue(123, 'string')).toBe('123');
    });
  });

  describe('Modbus Dönüşümü', () => {
    test('Modbus veri dönüşümü', () => {
      const rawData = {
        name: 'pressure',
        value: 100.5,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        quality: 'good',
        address: 'HR100',
        dataType: 'float',
        functionCode: 3
      };

      mockAdapter.type = 'modbus';
      const result = transformer.transform(rawData, 'modbus', mockAdapter);

      expect(result.payload.metadata.modbus).toBeDefined();
      expect(result.payload.metadata.modbus.address).toBe('HR100');
      expect(result.payload.metadata.modbus.functionCode).toBe(3);
      expect(result.payload.metadata.modbus.registerType).toBe('holding');
    });

    test('Modbus topic oluşturma', () => {
      const rawData = {
        name: 'pressure',
        value: 100.5,
        address: 'HR100'
      };

      mockAdapter.type = 'modbus';
      const result = transformer.transform(rawData, 'modbus', mockAdapter);

      expect(result.topic).toBe('test-namespace/test-enterprise/test-site/test-area/test-line/test-device/data/pressure');
    });

    test('Modbus register tipi belirleme', () => {
      expect(transformer._getModbusRegisterType('C001')).toBe('coil');
      expect(transformer._getModbusRegisterType('I001')).toBe('input');
      expect(transformer._getModbusRegisterType('HR100')).toBe('holding');
      expect(transformer._getModbusRegisterType('IR100')).toBe('inputRegister');
      expect(transformer._getModbusRegisterType('unknown')).toBe('unknown');
    });

    test('Modbus adres parse etme', () => {
      const result = transformer._parseModbusAddress('HR100');
      expect(result.type).toBe('holding');
      expect(result.address).toBe(100);
    });

    test('Modbus veri tipi dönüşümü', () => {
      expect(transformer._convertModbusValue('1', 'boolean')).toBe(true);
      expect(transformer._convertModbusValue('123', 'int16')).toBe(123);
      expect(transformer._convertModbusValue('25.5', 'float')).toBe(25.5);
    });
  });

  describe('MQTT Dönüşümü', () => {
    test('MQTT veri dönüşümü', () => {
      const rawData = {
        topic: 'sensors/temperature',
        value: '{"temp": 25.5, "unit": "C"}',
        qos: 1,
        retain: true
      };

      mockAdapter.type = 'mqtt';
      const result = transformer.transform(rawData, 'mqtt', mockAdapter);

      expect(result.payload.metadata.mqtt).toBeDefined();
      expect(result.payload.metadata.mqtt.originalTopic).toBe('sensors/temperature');
      expect(result.payload.metadata.mqtt.qos).toBe(1);
      expect(result.payload.metadata.mqtt.retain).toBe(true);
      expect(typeof result.payload.value).toBe('object');
    });

    test('MQTT topic dönüşümü', () => {
      const rawData = {
        topic: 'sensors/temperature',
        value: 25.5
      };

      mockAdapter.type = 'mqtt';
      const result = transformer.transform(rawData, 'mqtt', mockAdapter);

      expect(result.topic).toBe('test-namespace/mqtt/sensors/temperature');
    });

    test('MQTT topic mapping', () => {
      const rawData = {
        topic: 'sensors/temperature',
        value: 25.5
      };

      mockAdapter.options.mapping.topicMapping = {
        'sensors/temperature': 'custom/mapped/topic'
      };

      const result = transformer.transform(rawData, 'mqtt', mockAdapter);

      expect(result.topic).toBe('custom/mapped/topic');
    });
  });

  describe('Sparkplug B Dönüşümü', () => {
    test('Sparkplug B veri dönüşümü', () => {
      const rawData = {
        topic: 'spBv1.0/Group1/DDATA/Edge1/Device1',
        groupId: 'Group1',
        edgeNodeId: 'Edge1',
        deviceId: 'Device1',
        messageType: 'DDATA',
        seq: 123,
        metrics: [
          {
            name: 'temperature',
            value: 25.5,
            timestamp: Date.now(),
            dataType: 'Float'
          }
        ]
      };

      mockAdapter.type = 'sparkplugb';
      const result = transformer.transform(rawData, 'sparkplugb', mockAdapter);

      expect(result.payload.metadata.sparkplugB).toBeDefined();
      expect(result.payload.metadata.sparkplugB.groupId).toBe('Group1');
      expect(result.payload.metrics).toBeDefined();
      expect(result.payload.metrics).toHaveLength(1);
    });

    test('Sparkplug B topic parse etme', () => {
      const topic = 'spBv1.0/Group1/DDATA/Edge1/Device1';
      const result = transformer._parseSparkplugBTopic(topic);

      expect(result.namespace).toBe('spBv1.0');
      expect(result.groupId).toBe('Group1');
      expect(result.messageType).toBe('DDATA');
      expect(result.edgeNodeId).toBe('Edge1');
      expect(result.deviceId).toBe('Device1');
    });

    test('Geçersiz Sparkplug B topic', () => {
      const topic = 'invalid/topic/format';
      const result = transformer._parseSparkplugBTopic(topic);

      expect(result).toBeNull();
    });
  });

  describe('Yardımcı Metotlar', () => {
    test('timestamp normalize etme', () => {
      const date = new Date('2024-01-01T10:00:00Z');
      
      // Date object
      expect(transformer._normalizeTimestamp(date)).toBe('2024-01-01T10:00:00.000Z');
      
      // String
      expect(transformer._normalizeTimestamp('2024-01-01T10:00:00Z')).toBe('2024-01-01T10:00:00.000Z');
      
      // Number (timestamp)
      expect(transformer._normalizeTimestamp(date.getTime())).toBe('2024-01-01T10:00:00.000Z');
    });

    test('kalite normalize etme', () => {
      // String values
      expect(transformer._normalizeQuality('good')).toBe('good');
      expect(transformer._normalizeQuality('GOOD')).toBe('good');
      expect(transformer._normalizeQuality('bad')).toBe('bad');
      
      // OPC UA status codes
      expect(transformer._normalizeQuality(0)).toBe('good');
      expect(transformer._normalizeQuality(0x80000000)).toBe('bad');
      expect(transformer._normalizeQuality(0x40000000)).toBe('uncertain');
      
      // Default
      expect(transformer._normalizeQuality('unknown')).toBe('good');
    });

    test('QoS belirleme', () => {
      const rawData = { value: 25.5 };
      
      expect(transformer._determineQoS(rawData, 'opcua')).toBe(1);
      expect(transformer._determineQoS(rawData, 'modbus')).toBe(0);
      expect(transformer._determineQoS({ qos: 2 }, 'mqtt')).toBe(2);
      
      // Kritik veri
      expect(transformer._determineQoS({ critical: true }, 'opcua')).toBe(2);
      expect(transformer._determineQoS({ alarm: true }, 'modbus')).toBe(2);
    });

    test('retain flag belirleme', () => {
      // Status mesajları
      expect(transformer._shouldRetain({ type: 'status' }, 'opcua')).toBe(true);
      expect(transformer._shouldRetain({ type: 'config' }, 'modbus')).toBe(true);
      
      // MQTT retain flag
      expect(transformer._shouldRetain({ retain: true }, 'mqtt')).toBe(true);
      expect(transformer._shouldRetain({ retain: false }, 'mqtt')).toBe(false);
      
      // Normal veri
      expect(transformer._shouldRetain({ value: 25.5 }, 'opcua')).toBe(false);
    });

    test('Sparkplug B metrics oluşturma', () => {
      const rawData = {
        name: 'temperature',
        value: 25.5,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        dataType: 'float',
        address: 'ns=2;s=Temperature'
      };

      const result = transformer._createSparkplugBMetrics(rawData, 'opcua');

      expect(result.name).toBe('temperature');
      expect(result.value).toBe(25.5);
      expect(result.dataType).toBe('Float');
      expect(result.properties.sourceProtocol).toBe('opcua');
      expect(result.properties.sourceAddress).toBe('ns=2;s=Temperature');
    });

    test('Sparkplug B veri tipi mapping', () => {
      expect(transformer._mapToSparkplugBDataType('boolean')).toBe('Boolean');
      expect(transformer._mapToSparkplugBDataType('int16')).toBe('Int16');
      expect(transformer._mapToSparkplugBDataType('float')).toBe('Float');
      expect(transformer._mapToSparkplugBDataType('string')).toBe('String');
      expect(transformer._mapToSparkplugBDataType('unknown')).toBe('String');
    });
  });

  describe('Hata Durumları', () => {
    test('dönüşüm hatası yakalama', () => {
      // Mock transformer'ı hata fırlatacak şekilde ayarla
      const faultyTransformer = new ProtocolTransformer();
      faultyTransformer.transformers.set('opcua', {
        transformData: () => { throw new Error('Transform error'); },
        transformTopic: () => 'test/topic'
      });

      const rawData = { name: 'test', value: 123 };

      expect(() => {
        faultyTransformer.transform(rawData, 'opcua', mockAdapter);
      }).toThrow('Transform error');
    });

    test('geçersiz timestamp', () => {
      const result = transformer._normalizeTimestamp('invalid-date');
      
      // Invalid date should return current time (approximately)
      const now = new Date().toISOString();
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    test('geçersiz Node ID parse', () => {
      const result = transformer._parseOPCUANodeId('');
      
      expect(result.namespaceIndex).toBe(0);
      expect(result.identifier).toBe('');
      expect(result.identifierType).toBe('STRING');
    });
  });

  describe('Mapping Olmadan Çalışma', () => {
    test('mapping olmadan OPC UA topic', () => {
      const adapterWithoutMapping = {
        ...mockAdapter,
        options: {}
      };

      const rawData = {
        name: 'temperature',
        value: 25.5,
        nodeId: 'ns=2;s=Temperature'
      };

      const result = transformer.transform(rawData, 'opcua', adapterWithoutMapping);

      expect(result.topic).toBe('test-namespace/default/default/default/default/Test Adapter/data/temperature');
    });

    test('mapping olmadan Modbus topic', () => {
      const adapterWithoutMapping = {
        ...mockAdapter,
        type: 'modbus',
        options: {}
      };

      const rawData = {
        name: 'pressure',
        value: 100.5,
        address: 'HR100'
      };

      const result = transformer.transform(rawData, 'modbus', adapterWithoutMapping);

      expect(result.topic).toBe('test-namespace/default/default/default/default/Test Adapter/data/pressure');
    });
  });
}); 