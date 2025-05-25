/**
 * @fileoverview ManufactBridge - Data Platform Modülü
 * Bu modül, veri platformu bileşenlerini export eder.
 */

const DataPlatform = require('./data-platform');
const InfluxDBClient = require('./TimeSeriesDB/influxdb-client');
const StreamProcessor = require('./StreamProcessing/stream-processor');

module.exports = {
  DataPlatform,
  InfluxDBClient,
  StreamProcessor
}; 