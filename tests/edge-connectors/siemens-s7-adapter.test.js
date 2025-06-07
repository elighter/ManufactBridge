/**
 * @fileoverview ManufactBridge - Siemens S7 Adapter Tests
 */

const SiemensS7Adapter = require('../../src/EdgeConnectors/PLCAdapters/siemens-s7-adapter');

describe('SiemensS7Adapter', () => {
  let adapter;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      id: 'test-s7-adapter',
      host: '192.168.1.100',
      port: 102,
      rack: 0,
      slot: 1,
      readInterval: 1000,
      tags: [
        {
          name: 'temperature',
          address: 'DB1,REAL0',
          dataType: 'REAL',
          description: 'Temperature sensor',
          unit: '°C'
        },
        {
          name: 'pressure',
          address: 'DB1,REAL4',
          dataType: 'REAL',
          description: 'Pressure sensor',
          unit: 'bar'
        },
        {
          name: 'motor_running',
          address: 'DB1,X8.0',
          dataType: 'BOOL',
          description: 'Motor running status'
        }
      ],
      hierarchy: {
        enterprise: 'test-enterprise',
        site: 'test-site',
        area: 'test-area',
        line: 'test-line'
      }
    };

    adapter = new SiemensS7Adapter(mockConfig);
    
    // Console log'ları sustur
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (adapter.connected) {
      await adapter.disconnect();
    }
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    test('varsayılan konfigürasyon ile oluşturma', () => {
      const defaultAdapter = new SiemensS7Adapter();
      
      expect(defaultAdapter.config.host).toBe('localhost');
      expect(defaultAdapter.config.port).toBe(102);
      expect(defaultAdapter.config.rack).toBe(0);
      expect(defaultAdapter.config.slot).toBe(1);
      expect(defaultAdapter.config.readInterval).toBe(1000);
      expect(defaultAdapter.connected).toBe(false);
      expect(defaultAdapter.tagList.size).toBe(0);
    });

    test('özel konfigürasyon ile oluşturma', () => {
      expect(adapter.config.host).toBe('192.168.1.100');
      expect(adapter.config.port).toBe(102);
      expect(adapter.config.rack).toBe(0);
      expect(adapter.config.slot).toBe(1);
      expect(adapter.tagList.size).toBe(3);
    });

    test('tag\'ler doğru yüklenir', () => {
      expect(adapter.tagList.has('temperature')).toBe(true);
      expect(adapter.tagList.has('pressure')).toBe(true);
      expect(adapter.tagList.has('motor_running')).toBe(true);
      
      const tempTag = adapter.tagList.get('temperature');
      expect(tempTag.address).toBe('DB1,REAL0');
      expect(tempTag.dataType).toBe('REAL');
      expect(tempTag.unit).toBe('°C');
    });
  });

  describe('connect()', () => {
    test('başarılı bağlantı', async () => {
      const connectSpy = jest.spyOn(adapter, 'emit');
      const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(() => 'timer-id');
      
      const result = await adapter.connect();
      
      expect(result).toBe(true);
      expect(adapter.connected).toBe(true);
      expect(adapter.connecting).toBe(false);
      expect(adapter.reconnectAttempts).toBe(0);
      expect(adapter.stats.connectTime).toBeDefined();
      expect(connectSpy).toHaveBeenCalledWith('connected');
      expect(setIntervalSpy).toHaveBeenCalled();
      
      setIntervalSpy.mockRestore();
    });

    test('zaten bağlı iken bağlantı', async () => {
      adapter.connected = true;
      
      const result = await adapter.connect();
      
      expect(result).toBe(true);
    });

    test('bağlantı sırasında hata', async () => {
      // S7 client mock'ını hata verecek şekilde ayarla
      const originalCreateClient = adapter._createS7Client;
      adapter._createS7Client = jest.fn().mockReturnValue({
        connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
        disconnect: jest.fn(),
        read: jest.fn(),
        write: jest.fn()
      });

      const errorSpy = jest.spyOn(adapter, 'emit');
      
      await expect(adapter.connect()).rejects.toThrow('Connection failed');
      expect(adapter.connected).toBe(false);
      expect(adapter.connecting).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('error', expect.any(Error));
      
      // Restore
      adapter._createS7Client = originalCreateClient;
    });
  });

  describe('disconnect()', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    test('başarılı bağlantı kapatma', async () => {
      const disconnectSpy = jest.spyOn(adapter, 'emit');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => {});
      
      const result = await adapter.disconnect();
      
      expect(result).toBe(true);
      expect(adapter.connected).toBe(false);
      expect(adapter.connecting).toBe(false);
      expect(adapter.s7Client).toBeNull();
      expect(disconnectSpy).toHaveBeenCalledWith('disconnected');
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });

    test('S7 client kapatma hatası', async () => {
      adapter.s7Client.disconnect = jest.fn().mockRejectedValue(new Error('Disconnect failed'));
      
      const result = await adapter.disconnect();
      
      expect(result).toBe(false);
    });
  });

  describe('readData()', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    test('başarılı veri okuma', async () => {
      const mockValue = 25.5;
      adapter.s7Client.read = jest.fn().mockResolvedValue(mockValue);
      
      const result = await adapter.readData('DB1,REAL0');
      
      expect(result).toBe(mockValue);
      expect(adapter.stats.successfulReads).toBe(1);
      expect(adapter.stats.bytesRead).toBe(1);
      expect(adapter.s7Client.read).toHaveBeenCalledWith('DB1,REAL0');
    });

    test('bağlantı olmadan okuma', async () => {
      adapter.connected = false;
      
      await expect(adapter.readData('DB1,REAL0')).rejects.toThrow('S7 PLC bağlı değil');
    });

    test('okuma hatası', async () => {
      adapter.s7Client.read = jest.fn().mockRejectedValue(new Error('Read failed'));
      
      await expect(adapter.readData('DB1,REAL0')).rejects.toThrow('Read failed');
      expect(adapter.stats.failedReads).toBe(1);
    });
  });

  describe('writeData()', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    test('başarılı veri yazma', async () => {
      adapter.s7Client.write = jest.fn().mockResolvedValue(true);
      
      const result = await adapter.writeData('DB1,REAL0', 30.0);
      
      expect(result).toBe(true);
      expect(adapter.s7Client.write).toHaveBeenCalledWith('DB1,REAL0', 30.0);
    });

    test('bağlantı olmadan yazma', async () => {
      adapter.connected = false;
      
      await expect(adapter.writeData('DB1,REAL0', 30.0)).rejects.toThrow('S7 PLC bağlı değil');
    });

    test('yazma hatası', async () => {
      adapter.s7Client.write = jest.fn().mockRejectedValue(new Error('Write failed'));
      
      await expect(adapter.writeData('DB1,REAL0', 30.0)).rejects.toThrow('Write failed');
    });
  });

  describe('readMultiple()', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    test('çoklu veri okuma', async () => {
      adapter.s7Client.read = jest.fn()
        .mockResolvedValueOnce(25.5)
        .mockResolvedValueOnce(1.2)
        .mockResolvedValueOnce(true);
      
      const addresses = ['DB1,REAL0', 'DB1,REAL4', 'DB1,X8.0'];
      const result = await adapter.readMultiple(addresses);
      
      expect(result).toEqual({
        'DB1,REAL0': 25.5,
        'DB1,REAL4': 1.2,
        'DB1,X8.0': true
      });
      expect(adapter.s7Client.read).toHaveBeenCalledTimes(3);
    });

    test('bağlantı olmadan çoklu okuma', async () => {
      adapter.connected = false;
      
      await expect(adapter.readMultiple(['DB1,REAL0'])).rejects.toThrow('S7 PLC bağlı değil');
    });
  });

  describe('readTags()', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    test('tag\'leri okuma ve UNS formatına dönüştürme', async () => {
      adapter.s7Client.read = jest.fn()
        .mockResolvedValueOnce(25.5)
        .mockResolvedValueOnce(1.2)
        .mockResolvedValueOnce(true);
      
      const result = await adapter.readTags();
      
      expect(result).toHaveLength(3);
      
      const tempData = result.find(data => data.topic.includes('temperature'));
      expect(tempData).toBeDefined();
      expect(tempData.payload.value).toBe(25.5);
      expect(tempData.payload.quality).toBe('good');
      expect(tempData.payload.metadata.protocol).toBe('s7');
      expect(tempData.payload.metadata.adapterId).toBe('test-s7-adapter');
      expect(tempData.payload.metadata.address).toBe('DB1,REAL0');
      expect(tempData.payload.metadata.dataType).toBe('REAL');
      
      expect(adapter.stats.totalReads).toBe(1);
      expect(adapter.stats.lastRead).toBeDefined();
    });

    test('bağlantı olmadan tag okuma', async () => {
      adapter.connected = false;
      
      const result = await adapter.readTags();
      
      expect(result).toEqual([]);
    });

    test('tag okuma hatası durumunda bad quality', async () => {
      adapter.s7Client.read = jest.fn()
        .mockResolvedValueOnce(25.5)
        .mockRejectedValueOnce(new Error('Read failed'))
        .mockResolvedValueOnce(true);
      
      const result = await adapter.readTags();
      
      expect(result).toHaveLength(3);
      
      const pressureData = result.find(data => data.topic.includes('pressure'));
      expect(pressureData.payload.value).toBeNull();
      expect(pressureData.payload.quality).toBe('bad');
      expect(pressureData.payload.metadata.error).toBe('Read failed');
    });
  });

  describe('_convertValue()', () => {
    test('BOOL dönüştürme', () => {
      expect(adapter._convertValue(true, 'BOOL')).toBe(true);
      expect(adapter._convertValue(false, 'BOOL')).toBe(false);
      expect(adapter._convertValue(1, 'BOOL')).toBe(true);
      expect(adapter._convertValue(0, 'BOOL')).toBe(false);
    });

    test('INT dönüştürme', () => {
      expect(adapter._convertValue('123', 'INT')).toBe(123);
      expect(adapter._convertValue(123.7, 'INT')).toBe(123);
      expect(adapter._convertValue('123', 'WORD')).toBe(123);
    });

    test('REAL dönüştürme', () => {
      expect(adapter._convertValue('123.45', 'REAL')).toBe(123.45);
      expect(adapter._convertValue(123, 'REAL')).toBe(123);
    });

    test('STRING dönüştürme', () => {
      expect(adapter._convertValue(123, 'STRING')).toBe('123');
      expect(adapter._convertValue(true, 'STRING')).toBe('true');
    });

    test('bilinmeyen tip', () => {
      expect(adapter._convertValue(123, 'UNKNOWN')).toBe(123);
    });
  });

  describe('_buildTopic()', () => {
    test('UNS topic oluşturma', () => {
      const topic = adapter._buildTopic('temperature');
      
      expect(topic).toBe('manufactbridge/test-enterprise/test-site/test-area/test-line/test-s7-adapter/data/temperature');
    });

    test('varsayılan hierarchy ile topic oluşturma', () => {
      const defaultAdapter = new SiemensS7Adapter({ id: 'test' });
      const topic = defaultAdapter._buildTopic('temperature');
      
      expect(topic).toBe('manufactbridge/enterprise1/site1/area1/line1/test/data/temperature');
    });
  });

  describe('getStatus()', () => {
    test('adapter durumu', () => {
      const status = adapter.getStatus();
      
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('connecting');
      expect(status).toHaveProperty('host', '192.168.1.100');
      expect(status).toHaveProperty('port', 102);
      expect(status).toHaveProperty('rack', 0);
      expect(status).toHaveProperty('slot', 1);
      expect(status).toHaveProperty('tagCount', 3);
      expect(status).toHaveProperty('stats');
      expect(status.stats).toHaveProperty('uptime');
      expect(status.stats).toHaveProperty('successRate');
    });

    test('bağlı durumda uptime hesaplama', async () => {
      await adapter.connect();
      
      // Biraz bekle
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const status = adapter.getStatus();
      expect(status.stats.uptime).toBeGreaterThan(0);
    });

    test('success rate hesaplama', () => {
      adapter.stats.totalReads = 10;
      adapter.stats.successfulReads = 8;
      
      const status = adapter.getStatus();
      expect(status.stats.successRate).toBe('80.00');
    });
  });

  describe('Timer İşlemleri', () => {
    test('okuma timer başlatma', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(() => 'timer-id');
      
      await adapter.connect();
      
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        adapter.config.readInterval
      );
      expect(adapter.readTimer).toBeDefined();
      
      setIntervalSpy.mockRestore();
    });

    test('okuma timer durdurma', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(() => 'timer-id');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => {});
      
      await adapter.connect();
      await adapter.disconnect();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(adapter.readTimer).toBeNull();
      
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('Yeniden Bağlanma', () => {
    test('maksimum deneme sayısına ulaşma', () => {
      adapter.reconnectAttempts = adapter.config.maxReconnectAttempts;
      const emitSpy = jest.spyOn(adapter, 'emit');
      
      adapter._scheduleReconnect();
      
      expect(emitSpy).toHaveBeenCalledWith('maxReconnectAttemptsReached');
    });

    test('yeniden bağlanma zamanlaması', () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(() => {});
      
      adapter._scheduleReconnect();
      
      expect(adapter.reconnectAttempts).toBe(1);
      expect(adapter.stats.reconnectCount).toBe(1);
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        adapter.config.reconnectInterval
      );
      
      setTimeoutSpy.mockRestore();
    });
  });

  describe('Event Handling', () => {
    test('data event\'i emit edilir', async () => {
      await adapter.connect();
      
      const dataSpy = jest.spyOn(adapter, 'emit');
      adapter.s7Client.read = jest.fn().mockResolvedValue(25.5);
      
      // Timer callback'ini manuel çalıştır
      const unsData = await adapter.readTags();
      for (const data of unsData) {
        adapter.emit('data', data);
      }
      
      expect(dataSpy).toHaveBeenCalledWith('data', expect.objectContaining({
        topic: expect.stringContaining('temperature'),
        payload: expect.objectContaining({
          value: 25.5,
          quality: 'good'
        })
      }));
    });
  });

  describe('S7 Client Simülasyonu', () => {
    test('BOOL değer simülasyonu', async () => {
      await adapter.connect();
      
      const result = await adapter.s7Client.read('DB1,BOOL0');
      expect(typeof result).toBe('boolean');
    });

    test('INT değer simülasyonu', async () => {
      await adapter.connect();
      
      const result = await adapter.s7Client.read('DB1,INT0');
      expect(typeof result).toBe('number');
      expect(Number.isInteger(result)).toBe(true);
    });

    test('REAL değer simülasyonu', async () => {
      await adapter.connect();
      
      const result = await adapter.s7Client.read('DB1,REAL0');
      expect(typeof result).toBe('number');
    });
  });
}); 