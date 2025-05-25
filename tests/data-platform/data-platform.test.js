/**
 * @fileoverview Data Platform Test Suite
 * Data Platform ana sınıfının birim testleri
 */

const DataPlatform = require('../../src/DataPlatform/data-platform');

// Mock InfluxDBClient
jest.mock('../../src/DataPlatform/TimeSeriesDB/influxdb-client', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    writeUNSData: jest.fn().mockResolvedValue(true),
    queryTagValues: jest.fn().mockResolvedValue([]),
    query: jest.fn().mockResolvedValue([]),
    deleteData: jest.fn().mockResolvedValue(true),
    flush: jest.fn().mockResolvedValue(true),
    getStatus: jest.fn().mockReturnValue({
      connected: true,
      url: 'http://localhost:8086',
      bufferSize: 0
    }),
    on: jest.fn()
  }));
});

describe('DataPlatform', () => {
  let platform;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      influxdb: {
        url: 'http://localhost:8086',
        token: 'test-token',
        org: 'test-org',
        bucket: 'test-bucket'
      },
      processing: {
        enabled: true,
        aggregationInterval: '1m'
      }
    };

    platform = new DataPlatform(mockConfig);
    
    // Timer'ları mock'la
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('varsayılan konfigürasyonla oluşturulabilir', () => {
      const defaultPlatform = new DataPlatform();
      
      expect(defaultPlatform.config.influxdb.url).toBe('http://localhost:8086');
      expect(defaultPlatform.config.influxdb.org).toBe('manufactbridge');
      expect(defaultPlatform.config.influxdb.bucket).toBe('manufacturing_data');
      expect(defaultPlatform.config.processing.enabled).toBe(true);
    });

    test('özel konfigürasyonla oluşturulabilir', () => {
      expect(platform.config.influxdb.url).toBe(mockConfig.influxdb.url);
      expect(platform.config.influxdb.token).toBe(mockConfig.influxdb.token);
      expect(platform.config.influxdb.org).toBe(mockConfig.influxdb.org);
      expect(platform.config.influxdb.bucket).toBe(mockConfig.influxdb.bucket);
    });

    test('başlangıç durumu doğru ayarlanır', () => {
      expect(platform.connected).toBe(false);
      expect(platform.influxClient).toBeNull();
      expect(platform.dataBuffer).toEqual([]);
      expect(platform.stats.pointsWritten).toBe(0);
      expect(platform.stats.errors).toBe(0);
    });
  });

  describe('start()', () => {
    test('başarılı başlatma', async () => {
      const result = await platform.start();
      
      expect(result).toBe(true);
      expect(platform.connected).toBe(true);
      expect(platform.influxClient).toBeDefined();
      expect(platform.influxClient.connect).toHaveBeenCalled();
    });

    test('InfluxDB bağlantı hatası', async () => {
      // Yeni platform instance oluştur ve mock'ı ayarla
      const failingPlatform = new DataPlatform(mockConfig);
      failingPlatform.influxClient = {
        connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
        on: jest.fn(),
        disconnect: jest.fn()
      };

      await expect(failingPlatform.start()).rejects.toThrow('Connection failed');
      expect(failingPlatform.connected).toBe(false);
    });

    test('processing timer başlatılır', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      await platform.start();
      
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        60000 // 1m = 60000ms
      );
      
      setIntervalSpy.mockRestore();
    });

    test('processing disabled ise timer başlatılmaz', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      platform.config.processing.enabled = false;
      
      await platform.start();
      
      expect(setIntervalSpy).not.toHaveBeenCalled();
      
      setIntervalSpy.mockRestore();
    });
  });

  describe('stop()', () => {
    beforeEach(async () => {
      await platform.start();
    });

    test('başarılı durdurma', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      const result = await platform.stop();
      
      expect(result).toBe(true);
      expect(platform.connected).toBe(false);
      expect(platform.influxClient.disconnect).toHaveBeenCalled();
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });

    test('InfluxDB kapatma hatası', async () => {
      platform.influxClient.disconnect.mockRejectedValue(new Error('Disconnect failed'));
      
      const result = await platform.stop();
      expect(result).toBe(false);
    });
  });

  describe('processUNSData()', () => {
    beforeEach(async () => {
      await platform.start();
    });

    test('geçerli UNS verisi işleme', async () => {
      const unsData = {
        topic: 'manufactbridge/enterprise1/site1/area1/line1/device1/data/temperature',
        payload: {
          value: 25.5,
          quality: 'good',
          timestamp: new Date().toISOString(),
          metadata: {
            protocol: 'opcua',
            adapterId: 'adapter1'
          }
        }
      };

      const result = await platform.processUNSData(unsData);
      
      expect(result).toBe(true);
      expect(platform.influxClient.writeUNSData).toHaveBeenCalledWith(unsData);
      expect(platform.stats.pointsWritten).toBe(1);
      expect(platform.stats.lastWrite).toBeDefined();
    });

    test('geçersiz UNS verisi', async () => {
      const invalidData = {
        topic: 'test-topic'
        // payload eksik
      };

      await expect(platform.processUNSData(invalidData)).rejects.toThrow('Geçersiz UNS veri formatı');
      expect(platform.stats.errors).toBe(1);
    });

    test('bağlantı olmadan veri işleme', async () => {
      platform.connected = false;

      const unsData = {
        topic: 'test-topic',
        payload: {
          value: 25.5,
          timestamp: new Date().toISOString()
        }
      };

      await expect(platform.processUNSData(unsData)).rejects.toThrow('Data Platform bağlı değil');
    });

    test('InfluxDB yazma hatası', async () => {
      platform.influxClient.writeUNSData.mockRejectedValue(new Error('Write failed'));

      const unsData = {
        topic: 'test-topic',
        payload: {
          value: 25.5,
          timestamp: new Date().toISOString()
        }
      };

      await expect(platform.processUNSData(unsData)).rejects.toThrow('Write failed');
      expect(platform.stats.errors).toBe(1);
    });
  });

  describe('processUNSDataBatch()', () => {
    beforeEach(async () => {
      await platform.start();
    });

    test('geçerli batch veri işleme', async () => {
      const unsDataArray = [
        {
          topic: 'test-topic-1',
          payload: {
            value: 25.5,
            timestamp: new Date().toISOString()
          }
        },
        {
          topic: 'test-topic-2',
          payload: {
            value: 30.0,
            timestamp: new Date().toISOString()
          }
        }
      ];

      const result = await platform.processUNSDataBatch(unsDataArray);
      
      expect(result).toBe(true);
      expect(platform.influxClient.writeUNSData).toHaveBeenCalledTimes(2);
      expect(platform.stats.pointsWritten).toBe(2);
    });

    test('array olmayan veri', async () => {
      await expect(platform.processUNSDataBatch('not-an-array')).rejects.toThrow('UNS veri dizisi bekleniyor');
    });

    test('geçersiz veriler filtrelenir', async () => {
      const unsDataArray = [
        {
          topic: 'test-topic-1',
          payload: {
            value: 25.5,
            timestamp: new Date().toISOString()
          }
        },
        {
          // geçersiz veri - payload eksik
          topic: 'test-topic-2'
        }
      ];

      const result = await platform.processUNSDataBatch(unsDataArray);
      
      expect(result).toBe(true);
      expect(platform.influxClient.writeUNSData).toHaveBeenCalledTimes(1);
      expect(platform.stats.pointsWritten).toBe(1);
    });

    test('hiç geçerli veri yok', async () => {
      const unsDataArray = [
        { topic: 'test-topic-1' }, // geçersiz
        { topic: 'test-topic-2' }  // geçersiz
      ];

      const result = await platform.processUNSDataBatch(unsDataArray);
      
      expect(result).toBe(false);
      expect(platform.influxClient.writeUNSData).not.toHaveBeenCalled();
    });
  });

  describe('queryData()', () => {
    beforeEach(async () => {
      await platform.start();
    });

    test('başarılı veri sorgusu', async () => {
      const mockResults = [
        { _time: '2024-01-01T00:00:00Z', _value: 25.5 },
        { _time: '2024-01-01T00:01:00Z', _value: 26.0 }
      ];

      platform.influxClient.queryTagValues.mockResolvedValue(mockResults);

      const queryOptions = {
        enterprise: 'test-enterprise',
        device: 'test-device',
        tagName: 'temperature'
      };

      const results = await platform.queryData(queryOptions);
      
      expect(results).toEqual(mockResults);
      expect(platform.influxClient.queryTagValues).toHaveBeenCalledWith(queryOptions);
    });

    test('bağlantı olmadan sorgu', async () => {
      platform.connected = false;

      await expect(platform.queryData({})).rejects.toThrow('Data Platform bağlı değil');
    });

    test('sorgu hatası', async () => {
      platform.influxClient.queryTagValues.mockRejectedValue(new Error('Query failed'));

      await expect(platform.queryData({})).rejects.toThrow('Query failed');
    });
  });

  describe('executeFluxQuery()', () => {
    beforeEach(async () => {
      await platform.start();
    });

    test('başarılı Flux sorgusu', async () => {
      const mockResults = [{ result: 'test' }];
      platform.influxClient.query.mockResolvedValue(mockResults);

      const fluxQuery = 'from(bucket: "test") |> range(start: -1h)';
      const results = await platform.executeFluxQuery(fluxQuery);
      
      expect(results).toEqual(mockResults);
      expect(platform.influxClient.query).toHaveBeenCalledWith(fluxQuery);
    });

    test('bağlantı olmadan Flux sorgusu', async () => {
      platform.connected = false;

      await expect(platform.executeFluxQuery('test query')).rejects.toThrow('Data Platform bağlı değil');
    });
  });

  describe('deleteData()', () => {
    beforeEach(async () => {
      await platform.start();
    });

    test('başarılı veri silme', async () => {
      const deleteOptions = {
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-02T00:00:00Z'
      };

      const result = await platform.deleteData(deleteOptions);
      
      expect(result).toBe(true);
      expect(platform.influxClient.deleteData).toHaveBeenCalledWith(deleteOptions);
    });

    test('bağlantı olmadan veri silme', async () => {
      platform.connected = false;

      await expect(platform.deleteData({})).rejects.toThrow('Data Platform bağlı değil');
    });
  });

  describe('flush()', () => {
    beforeEach(async () => {
      await platform.start();
    });

    test('başarılı flush', async () => {
      const result = await platform.flush();
      
      expect(result).toBe(true);
      expect(platform.influxClient.flush).toHaveBeenCalled();
    });

    test('InfluxDB client olmadan flush', async () => {
      platform.influxClient = null;
      
      const result = await platform.flush();
      expect(result).toBe(true);
    });
  });

  describe('_validateUNSData()', () => {
    test('geçerli UNS verisi', () => {
      const validData = {
        topic: 'test-topic',
        payload: {
          value: 25.5,
          timestamp: new Date().toISOString()
        }
      };

      const result = platform._validateUNSData(validData);
      expect(result).toBe(true);
    });

    test('null/undefined veri', () => {
      expect(platform._validateUNSData(null)).toBe(false);
      expect(platform._validateUNSData(undefined)).toBe(false);
      expect(platform._validateUNSData('string')).toBe(false);
    });

    test('topic eksik', () => {
      const invalidData = {
        payload: {
          value: 25.5,
          timestamp: new Date().toISOString()
        }
      };

      expect(platform._validateUNSData(invalidData)).toBe(false);
    });

    test('payload eksik', () => {
      const invalidData = {
        topic: 'test-topic'
      };

      expect(platform._validateUNSData(invalidData)).toBe(false);
    });

    test('value eksik', () => {
      const invalidData = {
        topic: 'test-topic',
        payload: {
          timestamp: new Date().toISOString()
        }
      };

      expect(platform._validateUNSData(invalidData)).toBe(false);
    });

    test('timestamp eksik', () => {
      const invalidData = {
        topic: 'test-topic',
        payload: {
          value: 25.5
        }
      };

      expect(platform._validateUNSData(invalidData)).toBe(false);
    });
  });

  describe('getStatus()', () => {
    test('platform durumu', () => {
      const status = platform.getStatus();
      
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('influxdb');
      expect(status).toHaveProperty('stats');
      expect(status).toHaveProperty('config');
      expect(status.stats).toHaveProperty('uptime');
    });

    test('InfluxDB client olmadan durum', () => {
      platform.influxClient = null;
      
      const status = platform.getStatus();
      expect(status.influxdb).toBeNull();
    });
  });

  describe('getStats()', () => {
    test('platform istatistikleri', () => {
      platform.stats.pointsWritten = 100;
      platform.stats.errors = 5;
      
      const stats = platform.getStats();
      
      expect(stats).toHaveProperty('pointsWritten', 100);
      expect(stats).toHaveProperty('errors', 5);
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('pointsPerSecond');
      expect(stats).toHaveProperty('errorRate');
      expect(stats.errorRate).toBeCloseTo(4.76, 1); // 5/(100+5)*100
    });
  });

  describe('_parseInterval()', () => {
    test('milisaniye parsing', () => {
      expect(platform._parseInterval('500ms')).toBe(500);
      expect(platform._parseInterval('1s')).toBe(1000);
      expect(platform._parseInterval('2m')).toBe(120000);
      expect(platform._parseInterval('1h')).toBe(3600000);
    });

    test('geçersiz format', () => {
      expect(platform._parseInterval('invalid')).toBe(60000);
      expect(platform._parseInterval('')).toBe(60000);
    });
  });

  describe('Processing Timer', () => {
    test('aggregation timer çalışır', async () => {
      await platform.start();
      
      // Timer'ın başlatıldığını doğrula
      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        60000
      );
      
      // Processing timer'ın ayarlandığını doğrula
      expect(platform.processingTimer).toBeDefined();
    });

    test('processing durdurulduğunda timer temizlenir', async () => {
      await platform.start();
      await platform.stop();
      
      expect(global.clearInterval).toHaveBeenCalled();
      expect(platform.processingTimer).toBeNull();
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await platform.start();
    });

    test('InfluxDB event\'leri dinlenir', () => {
      expect(platform.influxClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(platform.influxClient.on).toHaveBeenCalledWith('flushed', expect.any(Function));
      expect(platform.influxClient.on).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(platform.influxClient.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
    });
  });
}); 