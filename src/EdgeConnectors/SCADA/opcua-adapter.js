/**
 * @fileoverview ManufactBridge - OPC UA Protocol Adapter
 * This adapter performs data collection operations over OPC UA protocol.
 */

const BaseAdapter = require('../base-adapter');
const { OPCUAClient, MessageSecurityMode, SecurityPolicy, AttributeIds, ClientSubscription, TimestampsToReturn, MonitoringParametersOptions, ReadValueIdOptions, ClientMonitoredItem } = require('node-opcua');

/**
 * OPC UA Node ID Analysis Helper
 * Example: "ns=2;i=1001" -> { namespaceIndex: 2, identifier: 1001, identifierType: 'NUMERIC' }
 * @param {string} nodeId - OPC UA Node ID format
 * @returns {Object} Node ID components
 */
function parseOPCUANodeId(nodeId) {
  // Node ID formats:
  // ns=<namespaceIndex>;i=<numericId>     (Numeric)
  // ns=<namespaceIndex>;s=<stringId>      (String)
  // ns=<namespaceIndex>;g=<guidId>        (GUID)
  // ns=<namespaceIndex>;b=<opaqueId>      (Opaque)
  
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
    } else if (part.startsWith('g=')) {
      identifier = part.substring(2);
      identifierType = 'GUID';
    } else if (part.startsWith('b=')) {
      identifier = part.substring(2);
      identifierType = 'OPAQUE';
    }
  }
  
  return {
    namespaceIndex,
    identifier,
    identifierType
  };
}

class OPCUAAdapter extends BaseAdapter {
  /**
   * OPC UA Adapter constructor
   * @param {Object} config - OPC UA connector configuration
   */
  constructor(config) {
    super(config);
    
    this.config = config;
    this.type = 'opcua';
    this.client = null;
    this.session = null;
    this.subscription = null;
    this.monitoredItems = new Map();
    this.connected = false;
    this.reconnecting = false;
    this.reconnectTimer = null;
    this.lastValues = new Map(); // Store last values for deadband
    
    // OPC UA connection options
    this.connectionOptions = {
      applicationName: config.options?.applicationName || 'ManufactBridge OPC UA Client',
      clientName: config.options?.clientName || 'ManufactBridge Client',
      endpoint_must_exist: config.options?.endpointMustExist !== false,
      keepSessionAlive: config.options?.keepSessionAlive !== false,
      connectionStrategy: {
        initialDelay: config.options?.initialDelay || 1000,
        maxRetry: config.options?.maxRetries || 3,
        maxDelay: config.options?.maxDelay || 10000
      }
    };
    
    // Security settings
    this.securityMode = this._parseSecurityMode(config.options?.securityMode || 'None');
    this.securityPolicy = this._parseSecurityPolicy(config.options?.securityPolicy || 'None');
  }
  
  /**
   * Parses security mode
   * @param {string} mode - Security mode string
   * @returns {MessageSecurityMode} OPC UA security mode
   * @private
   */
  _parseSecurityMode(mode) {
    switch (mode.toLowerCase()) {
      case 'none':
        return MessageSecurityMode.None;
      case 'sign':
        return MessageSecurityMode.Sign;
      case 'signandencrypt':
        return MessageSecurityMode.SignAndEncrypt;
      default:
        this.logger.warn(`Unknown security mode: ${mode}, using 'None'`);
        return MessageSecurityMode.None;
    }
  }
  
  /**
   * Parses security policy
   * @param {string} policy - Security policy string
   * @returns {SecurityPolicy} OPC UA security policy
   * @private
   */
  _parseSecurityPolicy(policy) {
    switch (policy.toLowerCase()) {
      case 'none':
        return SecurityPolicy.None;
      case 'basic128':
        return SecurityPolicy.Basic128;
      case 'basic128rsa15':
        return SecurityPolicy.Basic128Rsa15;
      case 'basic256':
        return SecurityPolicy.Basic256;
      case 'basic256sha256':
        return SecurityPolicy.Basic256Sha256;
      default:
        this.logger.warn(`Unknown security policy: ${policy}, using 'None'`);
        return SecurityPolicy.None;
    }
  }
  
  /**
   * Configuration validation method
   * @throws {Error} Throws error if configuration is invalid
   */
  validateConfig() {
    super.validateConfig();
    
    if (!this.config.connection || !this.config.connection.endpoint) {
      throw new Error('A valid endpoint is required for OPC UA connection');
    }
    
    // Check endpoint URL format
    const endpoint = this.config.connection.endpoint;
    if (!endpoint.startsWith('opc.tcp://')) {
      throw new Error('OPC UA endpoint URL must start with opc.tcp://');
    }
    
    // Set default values
    if (!this.config.options) {
      this.config.options = {};
    }
  }
  
  /**
   * Connects to OPC UA server
   * @returns {Promise<boolean>} Returns true if connection is successful
   */
  async connect() {
    if (this.connected) {
      return true;
    }
    
    try {
      this.logger.info(`Connecting to OPC UA server: ${this.config.connection.endpoint}`);
      
      // OPC UA Client oluştur
      this.client = OPCUAClient.create(this.connectionOptions);
      
      // Listen to client events
      this._setupClientEvents();
      
      // Connect to server
      await this.client.connect(this.config.connection.endpoint);
      this.logger.info('Connected to OPC UA server');
      
      // Create session
      const userIdentity = this._createUserIdentity();
      this.session = await this.client.createSession(userIdentity);
      this.logger.info('OPC UA session created');
      
      // Listen to session events
      this._setupSessionEvents();
      
      this.connected = true;
      this.status = 'connected';
      this.lastError = null;
      
      // Trigger successful connection event
      this.emit('connect', { timestamp: new Date() });
      
      // Define tags and start subscription
      if (this.config.tags && Array.isArray(this.config.tags)) {
        await this.defineTags(this.config.tags);
        await this._createSubscription();
      }
      
      return true;
    } catch (err) {
      this.connected = false;
      this.status = 'error';
      this.lastError = err.message;
      
      this.logger.error(`OPC UA connection error: ${err.message}`);
      this.emit('error', {
        message: `OPC UA connection error: ${err.message}`,
        details: err
      });
      
      // Automatic reconnection
      this._scheduleReconnect();
      
      throw err;
    }
  }
  
  /**
   * Creates user identity credentials
   * @returns {Object} User identity credentials
   * @private
   */
  _createUserIdentity() {
    const auth = this.config.connection.authentication;
    
    if (!auth) {
      return {}; // Anonymous
    }
    
    if (auth.type === 'username') {
      return {
        userName: auth.username,
        password: auth.password
      };
    }
    
    if (auth.type === 'certificate') {
      return {
        certificateFile: auth.certificateFile,
        privateKeyFile: auth.privateKeyFile
      };
    }
    
    return {}; // Anonymous
  }
  
  /**
   * Sets up client events
   * @private
   */
  _setupClientEvents() {
    this.client.on('connection_reestablished', () => {
      this.logger.info('OPC UA connection re-established');
      this.connected = true;
      this.status = 'connected';
      this.emit('reconnect', { timestamp: new Date() });
    });
    
    this.client.on('connection_lost', () => {
      this.logger.warn('OPC UA connection lost');
      this.connected = false;
      this.status = 'disconnected';
      this.emit('disconnect', { timestamp: new Date() });
      this._scheduleReconnect();
    });
    
    this.client.on('close', () => {
      this.logger.info('OPC UA client closed');
      this.connected = false;
      this.status = 'disconnected';
    });
  }
  
  /**
   * Sets up session events
   * @private
   */
  _setupSessionEvents() {
    this.session.on('session_closed', (statusCode) => {
      this.logger.warn(`OPC UA session closed: ${statusCode}`);
      this.connected = false;
      this.status = 'disconnected';
      this.emit('disconnect', { timestamp: new Date() });
    });
  }
  
  /**
   * Creates subscription and adds monitored items
   * @private
   */
  async _createSubscription() {
    try {
      // Create subscription
      this.subscription = ClientSubscription.create(this.session, {
        requestedPublishingInterval: this.config.options?.publishingInterval || 1000,
        requestedLifetimeCount: this.config.options?.lifetimeCount || 60,
        requestedMaxKeepAliveCount: this.config.options?.maxKeepAliveCount || 10,
        maxNotificationsPerPublish: this.config.options?.maxNotificationsPerPublish || 1000,
        publishingEnabled: true,
        priority: this.config.options?.priority || 10
      });
      
      this.logger.info('OPC UA subscription created');
      
      // Listen to subscription events
      this.subscription.on('started', () => {
        this.logger.info('OPC UA subscription started');
      });
      
      this.subscription.on('terminated', () => {
        this.logger.warn('OPC UA subscription terminated');
      });
      
      // Create monitored item for each tag
      for (const [tagName, tag] of this.tags.entries()) {
        await this._createMonitoredItem(tagName, tag);
      }
      
    } catch (err) {
      this.logger.error(`Subscription creation error: ${err.message}`);
      throw err;
    }
  }
  
  /**
   * Creates monitored item
   * @param {string} tagName - Tag name
   * @param {Object} tag - Tag configuration
   * @private
   */
  async _createMonitoredItem(tagName, tag) {
    try {
      const nodeId = tag.nodeId || tag.address;
      const samplingInterval = this._parseScanRate(tag.scanRate || '1s');
      
      const itemToMonitor = {
        nodeId: nodeId,
        attributeId: AttributeIds.Value
      };
      
      const monitoringParameters = {
        samplingInterval: samplingInterval,
        discardOldest: true,
        queueSize: tag.queueSize || 1
      };
      
      // Deadband settings
      if (tag.deadband && tag.deadband > 0) {
        monitoringParameters.filter = {
          deadbandType: 1, // Absolute deadband
          deadbandValue: tag.deadband
        };
      }
      
      const monitoredItem = ClientMonitoredItem.create(
        this.subscription,
        itemToMonitor,
        monitoringParameters,
        TimestampsToReturn.Both
      );
      
      // Listen to monitored item events
      monitoredItem.on('changed', (dataValue) => {
        this._handleDataChange(tagName, tag, dataValue);
      });
      
      monitoredItem.on('err', (err) => {
        this.logger.error(`Monitored item error (${tagName}): ${err.message}`);
      });
      
      this.monitoredItems.set(tagName, monitoredItem);
      this.logger.debug(`Monitored item created: ${tagName} (${nodeId})`);
      
    } catch (err) {
      this.logger.error(`Monitored item creation error (${tagName}): ${err.message}`);
    }
  }
  
  /**
   * Handles data change
   * @param {string} tagName - Tag name
   * @param {Object} tag - Tag configuration
   * @param {Object} dataValue - OPC UA data value
   * @private
   */
  _handleDataChange(tagName, tag, dataValue) {
    try {
      // Check data quality
      if (!dataValue.statusCode.isGood()) {
        this.logger.warn(`Bad data quality (${tagName}): ${dataValue.statusCode.toString()}`);
        return;
      }
      
      let value = dataValue.value.value;
      const timestamp = dataValue.sourceTimestamp || dataValue.serverTimestamp || new Date();
      
      // Data type conversion
      value = this._convertDataType(value, tag.dataType);
      
      // Deadband control (if local deadband exists)
      if (tag.deadband && this._shouldApplyDeadband(tagName, value, tag.deadband)) {
        return; // Within deadband, data change not published
      }
      
      // Trigger data event
      this.emit('data', {
        name: tagName,
        value: value,
        timestamp: timestamp,
        quality: 'good',
        tag: tag
      });
      
      // Save last value (for deadband)
      this._updateLastValue(tagName, value);
      
    } catch (err) {
      this.logger.error(`Data processing error (${tagName}): ${err.message}`);
    }
  }
  
  /**
   * Closes OPC UA connection
   * @returns {Promise<boolean>} Returns true if closing is successful
   */
  async disconnect() {
    try {
      this.logger.info('Closing OPC UA connection...');
      
      // Clear reconnection timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      
      // Clear monitored items
      this.monitoredItems.clear();
      
      // Close subscription
      if (this.subscription) {
        await this.subscription.terminate();
        this.subscription = null;
      }
      
      // Close session
      if (this.session) {
        await this.session.close();
        this.session = null;
      }
      
      // Close client
      if (this.client) {
        await this.client.disconnect();
        this.client = null;
      }
      
      this.connected = false;
      this.status = 'disconnected';
      
      this.logger.info('OPC UA connection closed');
      this.emit('disconnect', { timestamp: new Date() });
      
      return true;
    } catch (err) {
      this.logger.error(`OPC UA connection closing error: ${err.message}`);
      return false;
    }
  }
  
  /**
   * Reads a single tag
   * @param {string} tagName - Tag name to read
   * @returns {Promise<*>} Tag value
   */
  async readTag(tagName) {
    if (!this.connected || !this.session) {
      throw new Error('OPC UA connection not available');
    }
    
    const tag = this.tags.get(tagName);
    if (!tag) {
      throw new Error(`Tag not found: ${tagName}`);
    }
    
    try {
      const nodeId = tag.nodeId || tag.address;
      const dataValue = await this.session.readVariableValue(nodeId);
      
      if (!dataValue.statusCode.isGood()) {
        throw new Error(`Bad data quality: ${dataValue.statusCode.toString()}`);
      }
      
      let value = dataValue.value.value;
      value = this._convertDataType(value, tag.dataType);
      
      return value;
    } catch (err) {
      this.logger.error(`Tag read error (${tagName}): ${err.message}`);
      throw err;
    }
  }
  
  /**
   * Writes to a single tag
   * @param {string} tagName - Tag name to write
   * @param {*} value - Value to write
   * @returns {Promise<boolean>} Returns true if writing is successful
   */
  async writeTag(tagName, value) {
    if (!this.connected || !this.session) {
      throw new Error('OPC UA connection not available');
    }
    
    const tag = this.tags.get(tagName);
    if (!tag) {
      throw new Error(`Tag not found: ${tagName}`);
    }
    
    try {
      const nodeId = tag.nodeId || tag.address;
      
      // Convert data type
      const convertedValue = this._convertDataType(value, tag.dataType);
      
      const statusCode = await this.session.writeSingleNode(nodeId, convertedValue);
      
      if (!statusCode.isGood()) {
        throw new Error(`Write error: ${statusCode.toString()}`);
      }
      
      this.logger.debug(`Tag written: ${tagName} = ${convertedValue}`);
      return true;
    } catch (err) {
      this.logger.error(`Tag write error (${tagName}): ${err.message}`);
      throw err;
    }
  }
  
  /**
   * Schedules reconnection
   * @private
   */
  _scheduleReconnect() {
    if (this.reconnecting || this.reconnectTimer) {
      return;
    }
    
    const reconnectInterval = this.config.connection?.reconnectInterval || 10000;
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      
      if (!this.connected) {
        this.logger.info('Attempting OPC UA reconnection...');
        this.reconnecting = true;
        
        try {
          await this.connect();
          this.reconnecting = false;
        } catch (err) {
          this.reconnecting = false;
          this.logger.error(`Reconnection failed: ${err.message}`);
          this._scheduleReconnect(); // Try again
        }
      }
    }, reconnectInterval);
  }
  
  /**
   * Data type conversion
   * @param {*} value - Raw value
   * @param {string} dataType - Data type
   * @returns {*} Converted value
   */
  _convertDataType(value, dataType) {
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
   * Converts scan rate to milliseconds
   * @param {string|number} scanRate - Scan rate
   * @returns {number} Scan rate in milliseconds
   */
  _parseScanRate(scanRate) {
    if (typeof scanRate === 'number') {
      return scanRate;
    }
    
    if (typeof scanRate === 'string') {
      const match = scanRate.match(/^(\d+)(ms|s|m|h)?$/i);
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = (match[2] || 'ms').toLowerCase();
        
        switch (unit) {
          case 'ms':
            return value;
          case 's':
            return value * 1000;
          case 'm':
            return value * 60 * 1000;
          case 'h':
            return value * 60 * 60 * 1000;
          default:
            return value;
        }
      }
    }
    
    return 1000; // Default 1 second
  }

  /**
   * Performs deadband control
   * @param {string} tagName - Tag name
   * @param {*} value - New value
   * @param {number} deadband - Deadband value
   * @returns {boolean} Should deadband be applied
   */
  _shouldApplyDeadband(tagName, value, deadband) {
    if (!this.lastValues.has(tagName)) {
      return false;
    }
    
    const lastValue = this.lastValues.get(tagName);
    if (typeof value === 'number' && typeof lastValue === 'number') {
      const diff = Math.abs(value - lastValue);
      return diff < deadband;
    }
    
    return false;
  }

  /**
   * Updates last value
   * @param {string} tagName - Tag name
   * @param {*} value - Value
   */
  _updateLastValue(tagName, value) {
    this.lastValues.set(tagName, value);
  }

  /**
   * Returns adapter status
   * @returns {Object} Adapter status
   */
  getStatus() {
    return {
      ...super.getStatus(),
      connected: this.connected,
      endpoint: this.config?.connection?.endpoint,
      sessionId: this.session?.sessionId?.toString(),
      subscriptionId: this.subscription?.subscriptionId,
      monitoredItemCount: this.monitoredItems.size,
      securityMode: this.securityMode,
      securityPolicy: this.securityPolicy
    };
  }
}

module.exports = OPCUAAdapter; 