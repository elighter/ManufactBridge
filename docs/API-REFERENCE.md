# ManufactBridge API Reference

## Overview

ManufactBridge provides a comprehensive REST API for managing industrial data integration, monitoring system status, and configuring adapters and connectors.

**Base URL:** `http://localhost:3000/api/v1`

**Authentication:** Bearer Token (JWT) or API Key

## Table of Contents

- [Authentication](#authentication)
- [UNS (Unified Namespace)](#uns-unified-namespace)
- [Edge Connectors](#edge-connectors)
- [ERP Integration](#erp-integration)
- [Data Platform](#data-platform)
- [Analytics](#analytics)
- [System Management](#system-management)

## Authentication

### POST /auth/login
Authenticate and receive access token.

**Request:**
```json
{
  "username": "admin",
  "password": "password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "id": "user123",
    "username": "admin",
    "roles": ["admin"]
  }
}
```

### POST /auth/refresh
Refresh access token.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

## UNS (Unified Namespace)

### GET /uns/topics
List all UNS topics.

**Query Parameters:**
- `filter` (string): Filter topics by pattern
- `limit` (number): Maximum number of results (default: 100)
- `offset` (number): Pagination offset (default: 0)

**Response:**
```json
{
  "topics": [
    {
      "topic": "manufactbridge/enterprise1/site1/area1/line1/device1/data/temperature",
      "lastUpdate": "2024-12-19T21:00:00Z",
      "quality": "good",
      "dataType": "REAL"
    }
  ],
  "total": 150,
  "limit": 100,
  "offset": 0
}
```

### GET /uns/topics/{topic}/data
Get current data for a specific topic.

**Path Parameters:**
- `topic` (string): URL-encoded topic name

**Query Parameters:**
- `from` (string): Start time (ISO 8601)
- `to` (string): End time (ISO 8601)
- `limit` (number): Maximum number of data points

**Response:**
```json
{
  "topic": "manufactbridge/enterprise1/site1/area1/line1/device1/data/temperature",
  "data": [
    {
      "value": 25.5,
      "quality": "good",
      "timestamp": "2024-12-19T21:00:00Z",
      "metadata": {
        "protocol": "opcua",
        "adapterId": "plc-line1"
      }
    }
  ]
}
```

### POST /uns/publish
Publish data to UNS topic.

**Request:**
```json
{
  "topic": "manufactbridge/enterprise1/site1/area1/line1/device1/data/temperature",
  "payload": {
    "value": 26.0,
    "quality": "good",
    "timestamp": "2024-12-19T21:00:00Z",
    "metadata": {
      "source": "manual"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "msg-12345"
}
```

## Edge Connectors

### GET /edge/adapters
List all edge adapters.

**Response:**
```json
{
  "adapters": [
    {
      "id": "plc-line1",
      "type": "siemens-s7",
      "status": "connected",
      "host": "192.168.1.100",
      "tagCount": 25,
      "lastRead": "2024-12-19T21:00:00Z",
      "stats": {
        "totalReads": 1000,
        "successfulReads": 995,
        "failedReads": 5,
        "successRate": "99.50"
      }
    }
  ]
}
```

### GET /edge/adapters/{adapterId}
Get specific adapter details.

**Path Parameters:**
- `adapterId` (string): Adapter identifier

**Response:**
```json
{
  "id": "plc-line1",
  "type": "siemens-s7",
  "config": {
    "host": "192.168.1.100",
    "port": 102,
    "rack": 0,
    "slot": 1,
    "readInterval": 1000
  },
  "status": {
    "connected": true,
    "connecting": false,
    "lastConnected": "2024-12-19T20:00:00Z",
    "uptime": 3600000
  },
  "tags": [
    {
      "name": "temperature",
      "address": "DB1,REAL0",
      "dataType": "REAL",
      "lastValue": 25.5,
      "lastUpdate": "2024-12-19T21:00:00Z"
    }
  ]
}
```

### POST /edge/adapters
Create new edge adapter.

**Request:**
```json
{
  "id": "plc-line2",
  "type": "siemens-s7",
  "config": {
    "host": "192.168.1.101",
    "port": 102,
    "rack": 0,
    "slot": 1,
    "readInterval": 1000,
    "tags": [
      {
        "name": "pressure",
        "address": "DB1,REAL4",
        "dataType": "REAL"
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "adapterId": "plc-line2",
  "message": "Adapter created successfully"
}
```

### PUT /edge/adapters/{adapterId}
Update adapter configuration.

### DELETE /edge/adapters/{adapterId}
Delete adapter.

### POST /edge/adapters/{adapterId}/start
Start adapter.

### POST /edge/adapters/{adapterId}/stop
Stop adapter.

### POST /edge/adapters/{adapterId}/read
Manual read from adapter.

**Request:**
```json
{
  "tags": ["temperature", "pressure"]
}
```

**Response:**
```json
{
  "data": [
    {
      "tag": "temperature",
      "value": 25.5,
      "quality": "good",
      "timestamp": "2024-12-19T21:00:00Z"
    }
  ]
}
```

## ERP Integration

### GET /erp/connectors
List all ERP connectors.

**Response:**
```json
{
  "connectors": [
    {
      "id": "odoo-main",
      "type": "odoo",
      "status": "connected",
      "baseUrl": "http://odoo.company.com:8069",
      "database": "production",
      "lastSync": "2024-12-19T21:00:00Z",
      "stats": {
        "totalRequests": 500,
        "successfulRequests": 495,
        "failedRequests": 5,
        "avgResponseTime": 250
      }
    }
  ]
}
```

### GET /erp/connectors/{connectorId}
Get specific connector details.

### POST /erp/connectors/{connectorId}/sync
Trigger manual synchronization.

**Request:**
```json
{
  "entities": ["production_orders", "products"],
  "filters": {
    "dateFrom": "2024-12-19T00:00:00Z",
    "dateTo": "2024-12-19T23:59:59Z"
  }
}
```

### GET /erp/production-orders
Get production orders from ERP.

**Query Parameters:**
- `connectorId` (string): ERP connector ID
- `state` (string): Filter by state
- `dateFrom` (string): Start date
- `dateTo` (string): End date

**Response:**
```json
{
  "productionOrders": [
    {
      "id": "PO-001",
      "name": "Production Order 001",
      "productId": "PROD-123",
      "productName": "Widget A",
      "quantity": 100,
      "state": "in_progress",
      "startDate": "2024-12-19T08:00:00Z",
      "endDate": "2024-12-19T16:00:00Z"
    }
  ]
}
```

### POST /erp/production-data
Send production data to ERP.

**Request:**
```json
{
  "connectorId": "odoo-main",
  "productionOrderId": "PO-001",
  "quantityProduced": 50,
  "startTime": "2024-12-19T08:00:00Z",
  "endTime": "2024-12-19T12:00:00Z",
  "qualityData": [
    {
      "productId": "PROD-123",
      "measure": 25.5,
      "result": "pass",
      "testType": "temperature"
    }
  ]
}
```

## Data Platform

### GET /data/status
Get data platform status.

**Response:**
```json
{
  "connected": true,
  "influxdb": {
    "connected": true,
    "url": "http://localhost:8086",
    "bucket": "manufacturing_data"
  },
  "stats": {
    "pointsWritten": 10000,
    "pointsBuffered": 50,
    "errors": 2,
    "uptime": 3600000
  }
}
```

### GET /data/query
Query time series data.

**Query Parameters:**
- `measurement` (string): Measurement name
- `tags` (string): Tag filters (JSON)
- `from` (string): Start time
- `to` (string): End time
- `aggregation` (string): Aggregation function (mean, max, min, sum)
- `interval` (string): Aggregation interval (1m, 5m, 1h)

**Response:**
```json
{
  "results": [
    {
      "time": "2024-12-19T21:00:00Z",
      "value": 25.5,
      "tags": {
        "device": "sensor1",
        "location": "line1"
      }
    }
  ]
}
```

### POST /data/write
Write data points to time series database.

**Request:**
```json
{
  "points": [
    {
      "measurement": "temperature",
      "tags": {
        "device": "sensor1",
        "location": "line1"
      },
      "fields": {
        "value": 25.5
      },
      "timestamp": "2024-12-19T21:00:00Z"
    }
  ]
}
```

## Analytics

### GET /analytics/dashboards
List available dashboards.

**Response:**
```json
{
  "dashboards": [
    {
      "id": "manufacturing-overview",
      "name": "Manufacturing Overview",
      "description": "Real-time manufacturing metrics",
      "url": "http://grafana:3000/d/manufacturing"
    }
  ]
}
```

### GET /analytics/metrics
Get real-time metrics.

**Query Parameters:**
- `metric` (string): Metric name
- `timeRange` (string): Time range (1h, 24h, 7d)

**Response:**
```json
{
  "metrics": {
    "oee": 85.5,
    "availability": 92.0,
    "performance": 88.5,
    "quality": 95.0,
    "totalProduction": 1250,
    "defectRate": 2.1
  },
  "timestamp": "2024-12-19T21:00:00Z"
}
```

## System Management

### GET /system/health
System health check.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.1.0",
  "uptime": 3600000,
  "components": {
    "uns": "healthy",
    "dataplatform": "healthy",
    "edgeconnectors": "healthy",
    "erpintegration": "healthy"
  },
  "timestamp": "2024-12-19T21:00:00Z"
}
```

### GET /system/info
System information.

**Response:**
```json
{
  "version": "1.1.0",
  "nodeVersion": "18.17.0",
  "platform": "linux",
  "architecture": "x64",
  "memory": {
    "total": 8589934592,
    "used": 2147483648,
    "free": 6442450944
  },
  "cpu": {
    "cores": 8,
    "model": "Intel(R) Core(TM) i7-9700K"
  }
}
```

### GET /system/logs
Get system logs.

**Query Parameters:**
- `level` (string): Log level (error, warn, info, debug)
- `service` (string): Service name
- `from` (string): Start time
- `to` (string): End time
- `limit` (number): Maximum number of logs

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2024-12-19T21:00:00Z",
      "level": "info",
      "service": "siemens-s7-adapter",
      "message": "S7 PLC connection established",
      "metadata": {
        "adapterId": "plc-line1",
        "host": "192.168.1.100"
      }
    }
  ]
}
```

## Error Responses

All API endpoints return consistent error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "host",
      "reason": "Required field missing"
    }
  },
  "timestamp": "2024-12-19T21:00:00Z",
  "requestId": "req-12345"
}
```

### Common Error Codes

- `AUTHENTICATION_REQUIRED`: Missing or invalid authentication
- `AUTHORIZATION_FAILED`: Insufficient permissions
- `VALIDATION_ERROR`: Invalid request parameters
- `RESOURCE_NOT_FOUND`: Requested resource not found
- `INTERNAL_ERROR`: Internal server error
- `SERVICE_UNAVAILABLE`: Service temporarily unavailable

## Rate Limiting

API requests are rate limited:
- **Default**: 1000 requests per hour per API key
- **Burst**: 100 requests per minute
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Webhooks

ManufactBridge supports webhooks for real-time notifications:

### POST /webhooks
Register webhook endpoint.

**Request:**
```json
{
  "url": "https://your-app.com/webhook",
  "events": ["adapter.connected", "adapter.disconnected", "data.alert"],
  "secret": "webhook-secret"
}
```

### Webhook Events

- `adapter.connected`: Edge adapter connected
- `adapter.disconnected`: Edge adapter disconnected
- `adapter.error`: Edge adapter error
- `erp.sync.completed`: ERP synchronization completed
- `data.alert`: Data quality or threshold alert
- `system.error`: System error

## SDKs and Examples

### Node.js SDK
```bash
npm install @manufactbridge/sdk
```

```javascript
const ManufactBridge = require('@manufactbridge/sdk');

const client = new ManufactBridge({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Get adapter status
const adapters = await client.edge.getAdapters();

// Publish UNS data
await client.uns.publish('topic/path', {
  value: 25.5,
  quality: 'good'
});
```

### Python SDK
```bash
pip install manufactbridge-sdk
```

```python
from manufactbridge import ManufactBridge

client = ManufactBridge(
    base_url='http://localhost:3000',
    api_key='your-api-key'
)

# Query data
data = client.data.query(
    measurement='temperature',
    time_range='1h'
)
```

---

For more examples and detailed guides, see the [Documentation](../docs/) directory. 