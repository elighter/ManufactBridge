/**
 * @fileoverview InfluxDB Client Test Suite
 * InfluxDB client sınıfının birim testleri
 */

const InfluxDBClient = require('../../src/DataPlatform/TimeSeriesDB/influxdb-client');

// Mock InfluxDB
jest.mock('@influxdata/influxdb-client', () => {
  const mockWriteApi = {
    writePoint: jest.fn(),
    writePoints: jest.fn(),
    flush: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    useDefaultTags: jest.fn(),
    on: jest.fn()
  };

  const mockQueryApi = {
    queryRows: jest.fn()
  };

  const mockInfluxDB = {
    getWriteApi: jest.fn().mockReturnValue(mockWriteApi),
    getQueryApi: jest.fn().mockReturnValue(mockQueryApi),
    health: jest.fn().mockResolvedValue({ status: 'pass' })
  };

  return {
    InfluxDB: jest.fn().mockImplementation(() => mockInfluxDB),
    Point: jest.fn().mockImplementation((measurement) => ({
      measurement,
      tag: jest.fn().mockReturnThis(),
      floatField: jest.fn().mockReturnThis(),
      stringField: jest.fn().mockReturnThis(),
      booleanField: jest.fn().mockReturnThis(),
      timestamp: jest.fn().mockReturnThis()
    }))
  };
});

jest.mock('@influxdata/influxdb-client-apis', () => ({
  DeleteAPI: jest.fn().mockImplementation(() => ({
    postDelete: jest.fn().mockResolvedValue(undefined)
  }))
}));

describe('InfluxDBClient', () => {
  let client;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      url: 'http://localhost:8086',
      token: 'test-token',
      org: 'test-org',
      bucket: 'test-bucket',
      batchSize: 10,
      flushInterval: 1000
    };

    client = new InfluxDBClient(mockConfig);
    
    // Timer'ları mock'la
    jest.useFakeTimers();
    
    // InfluxDB health check'ı başarılı olarak ayarla
    client.influxDB.health.mockResolvedValue({ status: 'pass' });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('varsayılan konfigürasyonla oluşturulabilir', () => {
      const defaultClient = new InfluxDBClient({});
      
      expect(defaultClient.config.url).toBe('http://localhost:8086');
      expect(defaultClient.config.org).toBe('manufactbridge');
      expect(defaultClient.config.bucket).toBe('manufacturing_data');
      expect(defaultClient.config.batchSize).toBe(1000);
    });

    test('özel konfigürasyonla oluşturulabilir', () => {
      expect(client.config.url).toBe(mockConfig.url);
      expect(client.config.token).toBe(mockConfig.token);
      expect(client.config.org).toBe(mockConfig.org);
      expect(client.config.bucket).toBe(mockConfig.bucket);
    });

    test('InfluxDB client ve API\'leri oluşturur', () => {
      expect(client.influxDB).toBeDefined();
      expect(client.writeApi).toBeDefined();
      expect(client.queryApi).toBeDefined();
      expect(client.deleteApi).toBeDefined();
    });
  });

  describe('connect()', () => {
    test('başarılı bağlantı', async () => {
      const result = await client.connect();
      
      expect(result).toBe(true);
      expect(client.connected).toBe(true);
      expect(client.influxDB.health).toHaveBeenCalled();
    });

    test('bağlantı hatası', async () => {
      client.influxDB.health.mockRejectedValue(new Error('Connection failed'));
      
      await expect(client.connect()).rejects.toThrow('Connection failed');
      expect(client.connected).toBe(false);
    });

    test('health check başarısız', async () => {
      client.influxDB.health.mockResolvedValue({ status: 'fail', message: 'Service unavailable' });
      
      await expect(client.connect()).rejects.toThrow('InfluxDB health check başarısız');
      expect(client.connected).toBe(false);
    });
  });

  describe('disconnect()', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('başarılı bağlantı kapatma', async () => {
      const result = await client.disconnect();
      
      expect(result).toBe(true);
      expect(client.connected).toBe(false);
      expect(client.writeApi.close).toHaveBeenCalled();
    });

    test('bağlantı kapatma hatası', async () => {
      client.writeApi.close.mockRejectedValue(new Error('Close failed'));
      
      const result = await client.disconnect();
      expect(result).toBe(false);
    });
  });

  describe('writePoint()', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('tek veri noktası yazma (immediate)', async () => {
      client.config.batchSize = 1;
      
      const data = {
        measurement: 'test_measurement',
        tags: { device: 'sensor1' },
        fields: { value: 25.5 },
        timestamp: new Date()
      };

      const result = await client.writePoint(data);
      
      expect(result).toBe(true);
      expect(client.writeApi.writePoint).toHaveBeenCalled();
      expect(client.writeApi.flush).toHaveBeenCalled();
    });

    test('tek veri noktası yazma (batch)', async () => {
      client.config.batchSize = 10;
      
      const data = {
        measurement: 'test_measurement',
        tags: { device: 'sensor1' },
        fields: { value: 25.5 }
      };

      const result = await client.writePoint(data);
      
      expect(result).toBe(true);
      expect(client.pointBuffer.length).toBe(1);
    });

    test('batch size aşıldığında otomatik flush', async () => {
      client.config.batchSize = 2;
      
      const data = {
        measurement: 'test_measurement',
        tags: { device: 'sensor1' },
        fields: { value: 25.5 }
      };

      await client.writePoint(data);
      await client.writePoint(data);
      
      expect(client.writeApi.writePoints).toHaveBeenCalled();
      expect(client.pointBuffer.length).toBe(0);
    });
  });

  describe('writePoints()', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('çoklu veri noktası yazma', async () => {
      const dataPoints = [
        {
          measurement: 'test_measurement',
          tags: { device: 'sensor1' },
          fields: { value: 25.5 }
        },
        {
          measurement: 'test_measurement',
          tags: { device: 'sensor2' },
          fields: { value: 30.0 }
        }
      ];

      const result = await client.writePoints(dataPoints);
      
      expect(result).toBe(true);
      expect(client.pointBuffer.length).toBe(2);
    });
  });

  describe('writeUNSData()', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('UNS verisi yazma', async () => {
      const unsData = {
        topic: 'manufactbridge/enterprise1/site1/area1/line1/device1/data/temperature',
        payload: {
          value: 25.5,
          quality: 'good',
          timestamp: new Date().toISOString(),
          metadata: {
            protocol: 'opcua',
            adapterId: 'adapter1',
            opcua: {
              nodeId: 'ns=2;s=Temperature',
              statusCode: 0
            }
          }
        }
      };

      const result = await client.writeUNSData(unsData);
      
      expect(result).toBe(true);
      expect(client.pointBuffer.length).toBe(1);
    });

    test('eksik metadata ile UNS verisi yazma', async () => {
      const unsData = {
        topic: 'manufactbridge/enterprise1/site1/area1/line1/device1/data/temperature',
        payload: {
          value: 25.5,
          timestamp: new Date().toISOString()
        }
      };

      const result = await client.writeUNSData(unsData);
      
      expect(result).toBe(true);
      expect(client.pointBuffer.length).toBe(1);
    });
  });

  describe('query()', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('başarılı sorgu', async () => {
      const mockResults = [
        { _time: '2024-01-01T00:00:00Z', _value: 25.5 },
        { _time: '2024-01-01T00:01:00Z', _value: 26.0 }
      ];

      client.queryApi.queryRows.mockImplementation((query, callbacks) => {
        mockResults.forEach(result => {
          callbacks.next(result, { toObject: () => result });
        });
        callbacks.complete();
        return Promise.resolve();
      });

      const results = await client.query('test query');
      
      expect(results).toEqual(mockResults);
      expect(client.queryApi.queryRows).toHaveBeenCalledWith('test query', expect.any(Object));
    });

    test('sorgu hatası', async () => {
      client.queryApi.queryRows.mockImplementation((query, callbacks) => {
        callbacks.error(new Error('Query failed'));
        return Promise.resolve();
      });

      await expect(client.query('test query')).rejects.toThrow('Query failed');
    });
  });

  describe('queryTagValues()', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('tag değerleri sorgusu', async () => {
      client.queryApi.queryRows.mockImplementation((query, callbacks) => {
        callbacks.complete();
        return Promise.resolve();
      });

      const options = {
        enterprise: 'test-enterprise',
        site: 'test-site',
        device: 'test-device',
        tagName: 'temperature'
      };

      await client.queryTagValues(options);
      
      expect(client.queryApi.queryRows).toHaveBeenCalled();
      const queryCall = client.queryApi.queryRows.mock.calls[0][0];
      expect(queryCall).toContain('test-enterprise');
      expect(queryCall).toContain('test-site');
      expect(queryCall).toContain('test-device');
      expect(queryCall).toContain('temperature');
    });
  });

  describe('deleteData()', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('veri silme', async () => {
      const options = {
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-02T00:00:00Z'
      };

      const result = await client.deleteData(options);
      
      expect(result).toBe(true);
      expect(client.deleteApi.postDelete).toHaveBeenCalledWith({
        org: client.config.org,
        bucket: client.config.bucket,
        body: {
          start: options.startTime,
          stop: options.endTime,
          predicate: ''
        }
      });
    });

    test('başlangıç zamanı olmadan silme hatası', async () => {
      await expect(client.deleteData({})).rejects.toThrow('Silme işlemi için başlangıç zamanı gereklidir');
    });
  });

  describe('flush()', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('buffer flush', async () => {
      // Buffer'a veri ekle
      client.pointBuffer = [{ measurement: 'test' }];
      
      const result = await client.flush();
      
      expect(result).toBe(true);
      expect(client.writeApi.writePoints).toHaveBeenCalled();
      expect(client.writeApi.flush).toHaveBeenCalled();
      expect(client.pointBuffer.length).toBe(0);
    });

    test('boş buffer flush', async () => {
      const result = await client.flush();
      
      expect(result).toBe(true);
      expect(client.writeApi.writePoints).not.toHaveBeenCalled();
    });

    test('yazma sırasında flush', async () => {
      client.writing = true;
      
      const result = await client.flush();
      
      expect(result).toBe(true);
      expect(client.writeApi.writePoints).not.toHaveBeenCalled();
    });
  });

  describe('_createPoint()', () => {
    test('Point objesi oluşturma', () => {
      const data = {
        measurement: 'test_measurement',
        tags: {
          device: 'sensor1',
          location: 'factory'
        },
        fields: {
          temperature: 25.5,
          humidity: 60,
          active: true,
          status: 'running'
        },
        timestamp: new Date()
      };

      const point = client._createPoint(data);
      
      expect(point.measurement).toBe('test_measurement');
      expect(point.tag).toHaveBeenCalledWith('device', 'sensor1');
      expect(point.tag).toHaveBeenCalledWith('location', 'factory');
      expect(point.floatField).toHaveBeenCalledWith('temperature', 25.5);
      expect(point.floatField).toHaveBeenCalledWith('humidity', 60);
      expect(point.booleanField).toHaveBeenCalledWith('active', true);
      expect(point.stringField).toHaveBeenCalledWith('status', 'running');
      expect(point.timestamp).toHaveBeenCalledWith(data.timestamp);
    });

    test('null/undefined değerlerle Point oluşturma', () => {
      const data = {
        measurement: 'test_measurement',
        tags: {
          device: 'sensor1',
          location: null,
          area: undefined
        },
        fields: {
          temperature: 25.5,
          humidity: null,
          pressure: undefined
        }
      };

      const point = client._createPoint(data);
      
      expect(point.tag).toHaveBeenCalledWith('device', 'sensor1');
      expect(point.tag).not.toHaveBeenCalledWith('location', null);
      expect(point.tag).not.toHaveBeenCalledWith('area', undefined);
      expect(point.floatField).toHaveBeenCalledWith('temperature', 25.5);
      expect(point.floatField).not.toHaveBeenCalledWith('humidity', null);
      expect(point.floatField).not.toHaveBeenCalledWith('pressure', undefined);
    });
  });

  describe('getStatus()', () => {
    test('client durumu', () => {
      const status = client.getStatus();
      
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('url');
      expect(status).toHaveProperty('org');
      expect(status).toHaveProperty('bucket');
      expect(status).toHaveProperty('bufferSize');
      expect(status).toHaveProperty('writing');
      expect(status).toHaveProperty('batchSize');
      expect(status).toHaveProperty('flushInterval');
    });
  });

  describe('Timer İşlemleri', () => {
    test('flush timer başlatma', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      client._startFlushTimer();
      
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        client.config.flushInterval
      );
      
      setIntervalSpy.mockRestore();
    });

    test('flush timer durdurma', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      client._startFlushTimer();
      client._stopFlushTimer();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(client.flushTimer).toBeNull();
      
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });

    test('otomatik flush timer ayarlanır', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      await client.connect();
      
      // Timer'ın başlatıldığını doğrula
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        client.config.flushInterval
      );
      
      setIntervalSpy.mockRestore();
    });
  });
}); 