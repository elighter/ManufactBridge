/**
 * @fileoverview ManufactBridge - Protokol Dönüşüm Mekanizması
 * Bu modül, farklı endüstriyel protokollerden gelen verileri UNS formatına dönüştürür.
 */

const winston = require('winston');
const config = require('./config');

// Winston logger konfigürasyonu
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'protocol-transformer' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/protocol-transformer.log' })
  ]
});

/**
 * Veri kalitesi enum'u
 */
const DataQuality = {
  GOOD: 'good',
  BAD: 'bad',
  UNCERTAIN: 'uncertain',
  STALE: 'stale'
};

/**
 * Protokol Dönüştürücü Sınıfı
 * Farklı protokollerden gelen ham verileri UNS formatına dönüştürür
 */
class ProtocolTransformer {
  constructor(options = {}) {
    this.options = Object.assign({
      enableSparkplugB: true,
      enableISA95: true,
      defaultNamespace: 'manufactbridge',
      timestampFormat: 'iso',
      qualityMapping: true
    }, options);

    // Protokol-spesifik dönüştürücüler
    this.transformers = new Map();
    this._initializeTransformers();

    logger.info('Protokol Dönüştürücü başlatıldı');
  }

  /**
   * Protokol-spesifik dönüştürücüleri başlatır
   * @private
   */
  _initializeTransformers() {
    // OPC UA dönüştürücü
    this.transformers.set('opcua', {
      transformData: this._transformOPCUAData.bind(this),
      transformTopic: this._transformOPCUATopic.bind(this),
      parseNodeId: this._parseOPCUANodeId.bind(this)
    });

    // Modbus dönüştürücü
    this.transformers.set('modbus', {
      transformData: this._transformModbusData.bind(this),
      transformTopic: this._transformModbusTopic.bind(this),
      parseAddress: this._parseModbusAddress.bind(this)
    });

    // MQTT dönüştürücü
    this.transformers.set('mqtt', {
      transformData: this._transformMQTTData.bind(this),
      transformTopic: this._transformMQTTTopic.bind(this)
    });

    // Sparkplug B dönüştürücü
    this.transformers.set('sparkplugb', {
      transformData: this._transformSparkplugBData.bind(this),
      transformTopic: this._transformSparkplugBTopic.bind(this),
      parseSparkplugTopic: this._parseSparkplugBTopic.bind(this)
    });

    logger.info(`${this.transformers.size} protokol dönüştürücü yüklendi`);
  }

  /**
   * Ana dönüşüm metodu - protokol tipine göre uygun dönüştürücüyü çağırır
   * @param {Object} rawData - Ham veri
   * @param {string} protocol - Protokol tipi
   * @param {Object} adapter - Adaptör referansı
   * @returns {Object} UNS formatında dönüştürülmüş veri
   */
  transform(rawData, protocol, adapter) {
    try {
      const transformer = this.transformers.get(protocol.toLowerCase());
      if (!transformer) {
        throw new Error(`Desteklenmeyen protokol: ${protocol}`);
      }

      // Temel UNS veri yapısı
      const unsData = {
        timestamp: this._normalizeTimestamp(rawData.timestamp || new Date()),
        value: rawData.value,
        quality: this._normalizeQuality(rawData.quality || 'good'),
        metadata: {
          protocol: protocol,
          adapterId: adapter.id,
          adapterName: adapter.name,
          sourceAddress: rawData.address || rawData.nodeId,
          dataType: rawData.dataType || 'unknown'
        }
      };

      // Protokol-spesifik dönüşüm
      const transformedData = transformer.transformData(rawData, unsData, adapter);

      // Topic oluştur
      const topic = transformer.transformTopic(rawData, adapter);

      return {
        topic: topic,
        payload: transformedData,
        qos: this._determineQoS(rawData, protocol),
        retain: this._shouldRetain(rawData, protocol)
      };

    } catch (error) {
      logger.error(`Veri dönüşüm hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * OPC UA verilerini dönüştürür
   * @param {Object} rawData - Ham OPC UA verisi
   * @param {Object} unsData - Temel UNS veri yapısı
   * @param {Object} adapter - Adaptör referansı
   * @returns {Object} Dönüştürülmüş veri
   * @private
   */
  _transformOPCUAData(rawData, unsData, adapter) {
    // OPC UA spesifik metadata ekle
    unsData.metadata.opcua = {
      nodeId: rawData.nodeId || rawData.address,
      statusCode: rawData.statusCode,
      sourceTimestamp: rawData.sourceTimestamp,
      serverTimestamp: rawData.serverTimestamp
    };

    // OPC UA veri tipini normalize et
    if (rawData.dataType) {
      unsData.metadata.opcuaDataType = rawData.dataType;
      unsData.value = this._convertOPCUAValue(rawData.value, rawData.dataType);
    }

    // Sparkplug B uyumluluğu
    if (this.options.enableSparkplugB) {
      unsData.sparkplugB = this._createSparkplugBMetrics(rawData, 'opcua');
    }

    return unsData;
  }

  /**
   * OPC UA topic'ini dönüştürür
   * @param {Object} rawData - Ham veri
   * @param {Object} adapter - Adaptör referansı
   * @returns {string} UNS topic
   * @private
   */
  _transformOPCUATopic(rawData, adapter) {
    const mapping = adapter.options.mapping || {};
    const baseTopic = this.options.defaultNamespace;

    // ISA-95 hiyerarşisi
    const enterprise = mapping.enterprise || 'default';
    const site = mapping.site || 'default';
    const area = mapping.area || 'default';
    const line = mapping.line || 'default';
    const device = mapping.device || adapter.name;

    // Tag adını al
    const tagName = rawData.name || this._extractTagFromNodeId(rawData.nodeId);

    return `${baseTopic}/${enterprise}/${site}/${area}/${line}/${device}/data/${tagName}`;
  }

  /**
   * Modbus verilerini dönüştürür
   * @param {Object} rawData - Ham Modbus verisi
   * @param {Object} unsData - Temel UNS veri yapısı
   * @param {Object} adapter - Adaptör referansı
   * @returns {Object} Dönüştürülmüş veri
   * @private
   */
  _transformModbusData(rawData, unsData, adapter) {
    // Modbus spesifik metadata ekle
    unsData.metadata.modbus = {
      address: rawData.address,
      functionCode: rawData.functionCode,
      unitId: adapter.options?.unitId || 1,
      registerType: this._getModbusRegisterType(rawData.address)
    };

    // Modbus veri tipini normalize et
    if (rawData.dataType) {
      unsData.value = this._convertModbusValue(rawData.value, rawData.dataType);
    }

    // Sparkplug B uyumluluğu
    if (this.options.enableSparkplugB) {
      unsData.sparkplugB = this._createSparkplugBMetrics(rawData, 'modbus');
    }

    return unsData;
  }

  /**
   * Modbus topic'ini dönüştürür
   * @param {Object} rawData - Ham veri
   * @param {Object} adapter - Adaptör referansı
   * @returns {string} UNS topic
   * @private
   */
  _transformModbusTopic(rawData, adapter) {
    const mapping = adapter.options.mapping || {};
    const baseTopic = this.options.defaultNamespace;

    // ISA-95 hiyerarşisi
    const enterprise = mapping.enterprise || 'default';
    const site = mapping.site || 'default';
    const area = mapping.area || 'default';
    const line = mapping.line || 'default';
    const device = mapping.device || adapter.name;

    // Tag adını al
    const tagName = rawData.name || `register_${rawData.address}`;

    return `${baseTopic}/${enterprise}/${site}/${area}/${line}/${device}/data/${tagName}`;
  }

  /**
   * MQTT verilerini dönüştürür
   * @param {Object} rawData - Ham MQTT verisi
   * @param {Object} unsData - Temel UNS veri yapısı
   * @param {Object} adapter - Adaptör referansı
   * @returns {Object} Dönüştürülmüş veri
   * @private
   */
  _transformMQTTData(rawData, unsData, adapter) {
    // MQTT spesifik metadata ekle
    unsData.metadata.mqtt = {
      originalTopic: rawData.topic,
      qos: rawData.qos || 0,
      retain: rawData.retain || false
    };

    // JSON payload'ı parse et
    if (typeof rawData.value === 'string') {
      try {
        unsData.value = JSON.parse(rawData.value);
      } catch (e) {
        // String olarak bırak
        unsData.value = rawData.value;
      }
    }

    return unsData;
  }

  /**
   * MQTT topic'ini dönüştürür
   * @param {Object} rawData - Ham veri
   * @param {Object} adapter - Adaptör referansı
   * @returns {string} UNS topic
   * @private
   */
  _transformMQTTTopic(rawData, adapter) {
    // MQTT topic'ini UNS formatına dönüştür
    const originalTopic = rawData.topic || '';
    const mapping = adapter.options.mapping || {};

    // Eğer mapping varsa kullan
    if (mapping.topicMapping && mapping.topicMapping[originalTopic]) {
      return mapping.topicMapping[originalTopic];
    }

    // Otomatik dönüşüm
    const baseTopic = this.options.defaultNamespace;
    const cleanTopic = originalTopic.replace(/[^a-zA-Z0-9/_-]/g, '_');

    return `${baseTopic}/mqtt/${cleanTopic}`;
  }

  /**
   * Sparkplug B verilerini dönüştürür
   * @param {Object} rawData - Ham Sparkplug B verisi
   * @param {Object} unsData - Temel UNS veri yapısı
   * @param {Object} adapter - Adaptör referansı
   * @returns {Object} Dönüştürülmüş veri
   * @private
   */
  _transformSparkplugBData(rawData, unsData, adapter) {
    // Sparkplug B metadata'sını koru
    unsData.metadata.sparkplugB = {
      groupId: rawData.groupId,
      edgeNodeId: rawData.edgeNodeId,
      deviceId: rawData.deviceId,
      messageType: rawData.messageType,
      seq: rawData.seq
    };

    // Metrics'i dönüştür
    if (rawData.metrics && Array.isArray(rawData.metrics)) {
      unsData.metrics = rawData.metrics.map(metric => ({
        name: metric.name,
        value: metric.value,
        timestamp: metric.timestamp,
        dataType: metric.dataType,
        properties: metric.properties
      }));
    }

    return unsData;
  }

  /**
   * Sparkplug B topic'ini dönüştürür
   * @param {Object} rawData - Ham veri
   * @param {Object} adapter - Adaptör referansı
   * @returns {string} UNS topic
   * @private
   */
  _transformSparkplugBTopic(rawData, adapter) {
    const baseTopic = this.options.defaultNamespace;
    
    // Sparkplug B topic'ini parse et
    const sparkplugTopic = this._parseSparkplugBTopic(rawData.topic);
    
    if (sparkplugTopic) {
      return `${baseTopic}/sparkplug/${sparkplugTopic.groupId}/${sparkplugTopic.edgeNodeId}/${sparkplugTopic.deviceId || 'node'}`;
    }

    return `${baseTopic}/sparkplug/unknown`;
  }

  /**
   * Sparkplug B topic'ini parse eder
   * @param {string} topic - Sparkplug B topic
   * @returns {Object|null} Parse edilmiş topic bileşenleri
   * @private
   */
  _parseSparkplugBTopic(topic) {
    // spBv1.0/[group_id]/[message_type]/[edge_node_id]/[device_id]
    const parts = topic.split('/');
    
    if (parts.length >= 4 && parts[0] === 'spBv1.0') {
      return {
        namespace: parts[0],
        groupId: parts[1],
        messageType: parts[2],
        edgeNodeId: parts[3],
        deviceId: parts[4] || null
      };
    }

    return null;
  }

  /**
   * Timestamp'i normalize eder
   * @param {Date|string|number} timestamp - Ham timestamp
   * @returns {string} ISO formatında timestamp
   * @private
   */
  _normalizeTimestamp(timestamp) {
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return new Date().toISOString();
      }
      return date.toISOString();
    }
    
    if (typeof timestamp === 'number') {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return new Date().toISOString();
      }
      return date.toISOString();
    }
    
    return new Date().toISOString();
  }

  /**
   * Veri kalitesini normalize eder
   * @param {string|number} quality - Ham kalite değeri
   * @returns {string} Normalize edilmiş kalite
   * @private
   */
  _normalizeQuality(quality) {
    if (typeof quality === 'string') {
      const lowerQuality = quality.toLowerCase();
      if (Object.values(DataQuality).includes(lowerQuality)) {
        return lowerQuality;
      }
    }
    
    // OPC UA status code'larını dönüştür
    if (typeof quality === 'number') {
      if (quality === 0) return DataQuality.GOOD;
      if (quality >= 0x80000000) return DataQuality.BAD;
      return DataQuality.UNCERTAIN;
    }
    
    return DataQuality.GOOD;
  }

  /**
   * QoS seviyesini belirler
   * @param {Object} rawData - Ham veri
   * @param {string} protocol - Protokol tipi
   * @returns {number} QoS seviyesi (0, 1, 2)
   * @private
   */
  _determineQoS(rawData, protocol) {
    // Protokol bazlı varsayılan QoS
    const defaultQoS = {
      'opcua': 1,
      'modbus': 0,
      'mqtt': rawData.qos || 0,
      'sparkplugb': 1
    };

    // Kritik veriler için yüksek QoS
    if (rawData.critical || rawData.alarm) {
      return 2;
    }

    return defaultQoS[protocol.toLowerCase()] || 0;
  }

  /**
   * Mesajın retain edilip edilmeyeceğini belirler
   * @param {Object} rawData - Ham veri
   * @param {string} protocol - Protokol tipi
   * @returns {boolean} Retain flag
   * @private
   */
  _shouldRetain(rawData, protocol) {
    // Status ve configuration mesajları retain edilir
    if (rawData.type === 'status' || rawData.type === 'config') {
      return true;
    }

    // MQTT retain flag'ini koru
    if (protocol.toLowerCase() === 'mqtt' && rawData.retain) {
      return true;
    }

    return false;
  }

  /**
   * OPC UA Node ID'den tag adını çıkarır
   * @param {string} nodeId - OPC UA Node ID
   * @returns {string} Tag adı
   * @private
   */
  _extractTagFromNodeId(nodeId) {
    if (!nodeId) return 'unknown';
    
    // ns=2;s=Temperature -> Temperature
    const match = nodeId.match(/;s=([^;]+)/);
    if (match) {
      return match[1];
    }
    
    // ns=2;i=1001 -> node_1001
    const numMatch = nodeId.match(/;i=(\d+)/);
    if (numMatch) {
      return `node_${numMatch[1]}`;
    }
    
    return nodeId.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Modbus register tipini belirler
   * @param {string} address - Modbus adresi
   * @returns {string} Register tipi
   * @private
   */
  _getModbusRegisterType(address) {
    if (typeof address === 'string') {
      if (address.startsWith('C')) return 'coil';
      if (address.startsWith('IR')) return 'inputRegister';
      if (address.startsWith('I')) return 'input';
      if (address.startsWith('HR')) return 'holding';
    }
    
    return 'unknown';
  }

  /**
   * OPC UA değerini dönüştürür
   * @param {*} value - Ham değer
   * @param {string} dataType - Veri tipi
   * @returns {*} Dönüştürülmüş değer
   * @private
   */
  _convertOPCUAValue(value, dataType) {
    switch (dataType?.toLowerCase()) {
      case 'boolean':
        return Boolean(value);
      case 'int16':
      case 'int32':
      case 'uint16':
      case 'uint32':
        return parseInt(value, 10);
      case 'float':
      case 'double':
        return parseFloat(value);
      case 'string':
        return String(value);
      default:
        return value;
    }
  }

  /**
   * Modbus değerini dönüştürür
   * @param {*} value - Ham değer
   * @param {string} dataType - Veri tipi
   * @returns {*} Dönüştürülmüş değer
   * @private
   */
  _convertModbusValue(value, dataType) {
    switch (dataType?.toLowerCase()) {
      case 'boolean':
        return Boolean(value);
      case 'integer':
      case 'int16':
      case 'uint16':
        return parseInt(value, 10);
      case 'float':
      case 'float32':
        return parseFloat(value);
      default:
        return value;
    }
  }

  /**
   * Sparkplug B metrics oluşturur
   * @param {Object} rawData - Ham veri
   * @param {string} sourceProtocol - Kaynak protokol
   * @returns {Object} Sparkplug B metrics
   * @private
   */
  _createSparkplugBMetrics(rawData, sourceProtocol) {
    return {
      name: rawData.name || 'unknown',
      value: rawData.value,
      timestamp: new Date(rawData.timestamp || Date.now()).getTime(),
      dataType: this._mapToSparkplugBDataType(rawData.dataType),
      properties: {
        sourceProtocol: sourceProtocol,
        sourceAddress: rawData.address || rawData.nodeId
      }
    };
  }

  /**
   * Veri tipini Sparkplug B formatına dönüştürür
   * @param {string} dataType - Orijinal veri tipi
   * @returns {string} Sparkplug B veri tipi
   * @private
   */
  _mapToSparkplugBDataType(dataType) {
    const mapping = {
      'boolean': 'Boolean',
      'int16': 'Int16',
      'int32': 'Int32',
      'uint16': 'UInt16',
      'uint32': 'UInt32',
      'float': 'Float',
      'double': 'Double',
      'string': 'String'
    };

    return mapping[dataType?.toLowerCase()] || 'String';
  }

  /**
   * OPC UA Node ID'yi parse eder
   * @param {string} nodeId - OPC UA Node ID
   * @returns {Object} Parse edilmiş Node ID
   * @private
   */
  _parseOPCUANodeId(nodeId) {
    const parts = nodeId.split(';');
    let namespaceIndex = 0;
    let identifier = nodeId;
    let identifierType = 'STRING';

    for (const part of parts) {
      if (part.startsWith('ns=')) {
        namespaceIndex = parseInt(part.substring(3), 10);
      } else if (part.startsWith('i=')) {
        identifier = parseInt(part.substring(2), 10);
        identifierType = 'NUMERIC';
      } else if (part.startsWith('s=')) {
        identifier = part.substring(2);
        identifierType = 'STRING';
      }
    }

    return { namespaceIndex, identifier, identifierType };
  }

  /**
   * Modbus adresini parse eder
   * @param {string} address - Modbus adresi
   * @returns {Object} Parse edilmiş adres
   * @private
   */
  _parseModbusAddress(address) {
    const prefixMap = {
      'C': 'coil',
      'I': 'input',
      'HR': 'holding',
      'IR': 'inputRegister'
    };

    let type = 'holding';
    let numericAddress = address;

    for (const [prefix, addrType] of Object.entries(prefixMap)) {
      if (address.startsWith(prefix)) {
        type = addrType;
        numericAddress = address.substring(prefix.length);
        break;
      }
    }

    return {
      type,
      address: parseInt(numericAddress, 10)
    };
  }
}

module.exports = ProtocolTransformer; 