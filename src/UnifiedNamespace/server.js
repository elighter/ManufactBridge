/**
 * ManufactBridge Unified Namespace (UNS) Sunucu
 * 
 * Bu dosya, ManufactBridge UNS sunucusunu başlatır ve yönetir.
 */

const { getInstance } = require('./index');
const winston = require('winston');
const config = require('./config');

// Winston logger konfigürasyonu
const logger = winston.createLogger({
  level: config.log_level || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'uns-server' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/uns-server.log' })
  ]
});

/**
 * Kapatma sinyallerini yönetir
 * @param {UnifiedNamespace} uns UNS örneği
 */
function handleShutdown(uns) {
  let shuttingDown = false;

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info('Sunucu kapatılıyor...');

    try {
      await uns.stop();
      logger.info('UNS sunucusu başarıyla kapatıldı');
      process.exit(0);
    } catch (error) {
      logger.error(`Sunucuyu kapatma hatası: ${error.message}`);
      process.exit(1);
    }
  }

  // Kapatma sinyallerini dinle
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGHUP', shutdown);

  // Yakalanmamış hata olursa
  process.on('uncaughtException', (error) => {
    logger.error(`Yakalanmamış istisna: ${error.stack}`);
    shutdown();
  });

  // Reddedilmiş promise'ler için
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`İşlenmeyen reddetme: ${reason}`);
    shutdown();
  });
}

/**
 * UNS sunucusunu başlatır
 */
async function startServer() {
  try {
    logger.info('ManufactBridge UNS sunucusu başlatılıyor...');

    // UNS örneğini al
    const uns = getInstance();

    // Kapatma işleyicilerini ayarla
    handleShutdown(uns);

    // UNS sunucusunu başlat
    await uns.start();

    logger.info(`ManufactBridge UNS sunucusu başarıyla başlatıldı`);
    
    // Broker tipi bilgisi
    const brokerInfo = config.broker.type === 'mqtt' 
      ? `MQTT broker: ${config.broker.mqtt.host}:${config.broker.mqtt.port}` 
      : `Kafka broker: ${config.broker.kafka.bootstrap_servers.join(', ')}`;
    
    logger.info(brokerInfo);
    
    // Temel test topic'lerine abone ol
    if (process.env.NODE_ENV === 'development') {
      logger.info('Geliştirme modunda test topic\'lerine abone olunuyor...');
      
      const testCallback = (message, topic) => {
        logger.info(`Test mesajı alındı: ${topic}`);
        logger.debug(JSON.stringify(message));
      };
      
      // Test topic'ine abone ol
      await uns.subscribe('manufactbridge/test/#', testCallback);
      
      // Test mesajı yayınla
      await uns.publish('manufactbridge/test/hello', {
        timestamp: new Date().toISOString(),
        message: 'ManufactBridge UNS sunucusu çalışıyor!'
      });
    }
  } catch (error) {
    logger.error(`UNS sunucusu başlatma hatası: ${error.message}`);
    process.exit(1);
  }
}

// Sunucuyu başlat
startServer();