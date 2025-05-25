/**
 * TLS/SSL Şifreleme Yönetimi
 * 
 * Bu modül, ManufactBridge UNS için TLS/SSL sertifika yönetimi ve şifreleme sağlar.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'tls-manager' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/tls-manager.log' })
  ]
});

class TLSManager {
  constructor(options = {}) {
    this.options = Object.assign({
      enabled: config.security.tls.enabled !== false,
      certPath: path.join(process.cwd(), 'config', 'certs'),
      keyFile: config.security.tls.key_file || 'server.key',
      certFile: config.security.tls.cert_file || 'server.crt',
      caFile: config.security.tls.ca_file || 'ca.crt',
      requireClientCert: config.security.tls.require_client_cert || false,
      cipherSuites: config.security.tls.cipher_suites || [
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-SHA256',
        'ECDHE-RSA-AES256-SHA384'
      ]
    }, options);

    this.tlsOptions = null;
    this._init();
  }

  _init() {
    try {
      logger.info('TLS Manager başlatılıyor...');

      if (!this.options.enabled) {
        logger.warn('TLS devre dışı bırakıldı - ŞİFRELENMEMİŞ BAĞLANTILAR');
        return;
      }

      this._loadCertificates();
      logger.info('TLS Manager başarıyla başlatıldı');
    } catch (error) {
      logger.error(`TLS Manager başlatma hatası: ${error.message}`);
      throw error;
    }
  }

  _loadCertificates() {
    try {
      const keyPath = path.join(this.options.certPath, this.options.keyFile);
      const certPath = path.join(this.options.certPath, this.options.certFile);
      const caPath = path.join(this.options.certPath, this.options.caFile);

      // Sertifika dosyalarını kontrol et
      if (!fs.existsSync(keyPath)) {
        throw new Error(`Private key dosyası bulunamadı: ${keyPath}`);
      }
      if (!fs.existsSync(certPath)) {
        throw new Error(`Sertifika dosyası bulunamadı: ${certPath}`);
      }

      // TLS seçeneklerini hazırla
      this.tlsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
        ciphers: this.options.cipherSuites.join(':'),
        honorCipherOrder: true,
        secureProtocol: 'TLSv1_2_method'
      };

      // CA sertifikası varsa ekle
      if (fs.existsSync(caPath)) {
        this.tlsOptions.ca = fs.readFileSync(caPath);
      }

      // Client sertifikası gerekiyorsa
      if (this.options.requireClientCert) {
        this.tlsOptions.requestCert = true;
        this.tlsOptions.rejectUnauthorized = true;
      }

      logger.info('TLS sertifikaları yüklendi');
    } catch (error) {
      logger.error(`Sertifika yükleme hatası: ${error.message}`);
      throw error;
    }
  }

  getTLSOptions() {
    return this.tlsOptions;
  }

  isEnabled() {
    return this.options.enabled;
  }

  validateClientCertificate(cert) {
    if (!cert) {
      return false;
    }

    try {
      // Sertifika geçerlilik kontrolü
      const now = new Date();
      const notBefore = new Date(cert.valid_from);
      const notAfter = new Date(cert.valid_to);

      if (now < notBefore || now > notAfter) {
        logger.warn(`Client sertifikası geçerlilik süresi dışında: ${cert.subject.CN}`);
        return false;
      }

      logger.info(`Client sertifikası geçerli: ${cert.subject.CN}`);
      return true;
    } catch (error) {
      logger.error(`Client sertifika doğrulama hatası: ${error.message}`);
      return false;
    }
  }
}

module.exports = TLSManager; 