# Linear Integration - ManufactBridge

ManufactBridge projesi için Linear entegrasyonu, üretim süreçlerindeki olayları otomatik olarak Linear issue'larına dönüştürür ve proje yönetimini kolaylaştırır.

## Özellikler

- 🔄 **Otomatik Issue Oluşturma**: Üretim olayları otomatik olarak Linear issue'larına dönüştürülür
- 📊 **Webhook Entegrasyonu**: Linear'dan gelen güncellemeler ManufactBridge sistemine aktarılır
- 🏷️ **Akıllı Etiketleme**: Olay tipine göre otomatik etiketleme ve öncelik belirleme
- 📈 **İstatistikler**: Manufacturing dashboard için Linear istatistikleri
- 🔄 **Retry Mekanizması**: Hata durumlarında otomatik yeniden deneme
- 🔐 **Güvenli Webhook**: İmza doğrulaması ile güvenli webhook işleme

## Kurulum

### 1. Bağımlılık Yükleme

```bash
npm install @linear/sdk
```

### 2. Environment Variables

`.env` dosyasını oluşturun ve aşağıdaki değerleri ekleyin:

```bash
# Linear API Key (Gerekli)
LINEAR_API_KEY=your_linear_api_key_here

# Linear Team ID (Gerekli)
LINEAR_TEAM_ID=your_linear_team_id_here

# Linear Project ID (Opsiyonel)
LINEAR_PROJECT_ID=your_linear_project_id_here

# Webhook Secret (Opsiyonel)
LINEAR_WEBHOOK_SECRET=your_webhook_secret_here

# Otomatik Issue Oluşturma
LINEAR_AUTO_CREATE_ISSUES=true

# Log Seviyesi
LINEAR_LOG_LEVEL=info
```

### 3. Linear API Key Alma

1. Linear'a giriş yapın
2. Settings > API > Personal API keys'e gidin
3. Yeni bir API key oluşturun
4. Key'i `LINEAR_API_KEY` environment variable'ına ekleyin

### 4. Team ID Bulma

1. Linear workspace'inizde herhangi bir sayfaya gidin
2. URL'den team ID'yi alın: `https://linear.app/[TEAM_ID]/...`
3. Team ID'yi `LINEAR_TEAM_ID` environment variable'ına ekleyin

## Konfigürasyon

### Ana Konfigürasyon

```javascript
const config = {
  linear: {
    enabled: true,
    teamId: "your-team-id",
    projectId: "your-project-id", // opsiyonel
    autoCreateIssues: true,
    logLevel: "info",
    retryAttempts: 3,
    retryDelay: 1000
  }
};
```

### Event Mapping

Farklı olay tipleri için özel ayarlar:

```javascript
const eventMapping = {
  "machine_error": {
    "priority": 1, // Urgent
    "labels": ["manufacturing", "critical"]
  },
  "quality_issue": {
    "priority": 2, // High
    "labels": ["manufacturing", "quality"]
  },
  "maintenance_required": {
    "priority": 3, // Normal
    "labels": ["manufacturing", "maintenance"]
  }
};
```

## Kullanım

### Temel Kullanım

```javascript
const { LinearService } = require('./src/IntegrationLayer/LinearIntegration');

// Service oluştur ve başlat
const linearService = new LinearService();
await linearService.initialize();

// Manufacturing event gönder
linearService.emit('manufacturing:event', {
  eventType: 'machine_error',
  severity: 'critical',
  machineId: 'machine-001',
  description: 'Hydraulic system failure',
  timestamp: new Date().toISOString()
});
```

### Express.js ile API Entegrasyonu

```javascript
const express = require('express');
const { createExpressRoutes } = require('./src/IntegrationLayer/LinearIntegration');

const app = express();
const linearService = new LinearService();

// Linear API route'larını ekle
createExpressRoutes(app, linearService);

// Webhook endpoint: POST /api/webhooks/linear
// API endpoints: /api/linear/*
```

### Manufacturing Sistemi Entegrasyonu

```javascript
const { setupManufacturingIntegration } = require('./src/IntegrationLayer/LinearIntegration');

// Manufacturing sistemi ile entegrasyon kur
setupManufacturingIntegration(linearService, manufacturingSystem);

// Artık manufacturing event'leri otomatik olarak Linear'a gönderilir
manufacturingSystem.emit('machine:error', {
  machineId: 'cnc-001',
  description: 'Spindle motor overheating',
  timestamp: new Date().toISOString()
});
```

## API Endpoints

### Linear Status
```
GET /api/linear/status
```

### Manufacturing İstatistikleri
```
GET /api/linear/stats
```

### Issue'lar
```
GET /api/linear/issues
POST /api/linear/issues
GET /api/linear/issues/:id
PUT /api/linear/issues/:id
```

### Yorumlar
```
POST /api/linear/issues/:id/comments
```

### Takım
```
GET /api/linear/team/members
GET /api/linear/project/states
```

### Manufacturing Events
```
POST /api/linear/manufacturing/event
POST /api/linear/manufacturing/alert
```

## Webhook Kurulumu

### 1. Linear'da Webhook Oluşturma

1. Linear Settings > API > Webhooks'a gidin
2. "Create webhook" butonuna tıklayın
3. URL: `https://your-domain.com/api/webhooks/linear`
4. Secret: Environment variable'daki webhook secret
5. Events: Issue, Comment, Project seçin

### 2. Webhook İşleme

```javascript
// Webhook otomatik olarak işlenir
// Manufacturing ile ilgili issue'lar için özel işlemler yapılır
```

## Event Tipleri

### Manufacturing Events

- `machine_error`: Makine hataları (Priority: Urgent)
- `quality_issue`: Kalite sorunları (Priority: High)
- `maintenance_required`: Bakım gereksinimleri (Priority: Normal)
- `production_delay`: Üretim gecikmeleri (Priority: High)
- `sensor_failure`: Sensör arızaları (Priority: Urgent)

### Linear Events

- `issue:created`: Yeni issue oluşturuldu
- `issue:updated`: Issue güncellendi
- `comment:created`: Yorum eklendi
- `project:updated`: Proje güncellendi

## İstatistikler

Manufacturing dashboard için Linear istatistikleri:

```javascript
const stats = await linearService.getManufacturingStats();

console.log(stats);
// {
//   totalIssues: 45,
//   openIssues: 12,
//   criticalIssues: 3,
//   highPriorityIssues: 8,
//   byState: { "In Progress": 5, "Todo": 7 },
//   byPriority: { "1": 3, "2": 8, "3": 15 },
//   recentIssues: [...]
// }
```

## Hata Yönetimi

### Retry Mekanizması

```javascript
// Otomatik retry
const result = await linearService.retryOperation(async () => {
  return await linearService.createIssue(issueData);
});
```

### Hata Loglama

Tüm hatalar Winston logger ile loglanır:

```
logs/linear-service.log
logs/linear-integration.log
logs/linear-webhooks.log
```

## Test

```bash
# Tüm testleri çalıştır
npm test

# Sadece Linear testleri
npm test -- --testPathPattern=Linear
```

## Güvenlik

- API key'leri environment variable'larda saklayın
- Webhook secret kullanın
- HTTPS kullanın
- Rate limiting uygulayın

## Sorun Giderme

### Yaygın Sorunlar

1. **API Key Hatası**
   - Linear API key'in doğru olduğundan emin olun
   - Key'in gerekli izinlere sahip olduğunu kontrol edin

2. **Team ID Hatası**
   - Team ID'nin doğru olduğundan emin olun
   - URL'den doğru team ID'yi aldığınızı kontrol edin

3. **Webhook İmza Hatası**
   - Webhook secret'ın doğru olduğundan emin olun
   - Linear'da aynı secret'ı kullandığınızı kontrol edin

### Debug Modu

```bash
LINEAR_LOG_LEVEL=debug npm start
```

## Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun
3. Testleri yazın
4. Pull request gönderin

## Lisans

MIT License - Detaylar için LICENSE dosyasına bakın. 