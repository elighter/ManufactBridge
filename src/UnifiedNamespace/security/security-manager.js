/**
 * Ana Güvenlik Yöneticisi
 * 
 * Bu modül, tüm güvenlik bileşenlerini (kimlik doğrulama, yetkilendirme, TLS) 
 * birleştirerek ManufactBridge UNS için kapsamlı güvenlik sağlar.
 */

const AuthManager = require('./auth-manager');
const AuthorizationManager = require('./authorization-manager');
const TLSManager = require('./tls-manager');
const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'security-manager' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/security-manager.log' })
  ]
});

class SecurityManager {
  constructor(options = {}) {
    this.options = Object.assign({
      enabled: config.security.enabled !== false,
      auditLog: config.security.audit_log || true
    }, options);

    // Güvenlik bileşenleri
    this.authManager = null;
    this.authorizationManager = null;
    this.tlsManager = null;

    // Audit log
    this.auditEvents = [];

    this._init();
  }

  /**
   * Güvenlik yöneticisini başlatır
   * @private
   */
  _init() {
    try {
      logger.info('Güvenlik Yöneticisi başlatılıyor...');

      if (!this.options.enabled) {
        logger.warn('GÜVENLİK TAMAMEN DEVRE DIŞI - ÜRETİM ORTAMI İÇİN ÖNERİLMEZ!');
        return;
      }

      // Alt bileşenleri başlat
      this.authManager = new AuthManager();
      this.authorizationManager = new AuthorizationManager();
      this.tlsManager = new TLSManager();

      logger.info('Güvenlik Yöneticisi başarıyla başlatıldı');
    } catch (error) {
      logger.error(`Güvenlik Yöneticisi başlatma hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * MQTT client kimlik doğrulama ve yetkilendirme
   * @param {Object} client MQTT client
   * @param {string} username Kullanıcı adı
   * @param {string|Buffer} password Şifre/token
   * @param {Function} callback Sonuç callback
   */
  authenticateClient(client, username, password, callback) {
    if (!this.options.enabled) {
      return callback(null, true);
    }

    // Kimlik doğrulama
    this.authManager.authenticate(client, username, password, (authError, isAuthenticated) => {
      if (authError || !isAuthenticated) {
        this._logAuditEvent('authentication_failed', {
          clientId: client.id,
          username: username,
          ip: client.connection?.remoteAddress,
          error: authError?.message
        });
        return callback(authError, false);
      }

      this._logAuditEvent('authentication_success', {
        clientId: client.id,
        username: username,
        ip: client.connection?.remoteAddress
      });

      callback(null, true);
    });
  }

  /**
   * Topic erişim yetkilendirmesi
   * @param {Object} client MQTT client
   * @param {string} topic Topic yolu
   * @param {string} action Eylem ('publish', 'subscribe')
   * @param {Function} callback Sonuç callback
   */
  authorizeClient(client, topic, action, callback) {
    if (!this.options.enabled) {
      return callback(null, true);
    }

    this.authorizationManager.authorizeClient(client, topic, action, (authzError, isAuthorized) => {
      const eventType = isAuthorized ? 'authorization_success' : 'authorization_failed';
      
      this._logAuditEvent(eventType, {
        clientId: client.id,
        username: client.username,
        topic: topic,
        action: action,
        ip: client.connection?.remoteAddress,
        error: authzError?.message
      });

      callback(authzError, isAuthorized);
    });
  }

  /**
   * TLS seçeneklerini döndürür
   * @returns {Object|null} TLS seçenekleri veya null
   */
  getTLSOptions() {
    if (!this.options.enabled || !this.tlsManager) {
      return null;
    }

    return this.tlsManager.getTLSOptions();
  }

  /**
   * Client sertifikası doğrulama
   * @param {Object} cert Client sertifikası
   * @returns {boolean} Geçerliyse true
   */
  validateClientCertificate(cert) {
    if (!this.options.enabled || !this.tlsManager) {
      return true;
    }

    const isValid = this.tlsManager.validateClientCertificate(cert);
    
    this._logAuditEvent('certificate_validation', {
      subject: cert?.subject?.CN,
      issuer: cert?.issuer?.CN,
      valid: isValid,
      serialNumber: cert?.serialNumber
    });

    return isValid;
  }

  /**
   * Kullanıcı yönetimi - kullanıcı ekleme
   * @param {string} username Kullanıcı adı
   * @param {string} password Şifre
   * @param {Array} roles Roller
   * @returns {boolean} Başarılıysa true
   */
  addUser(username, password, roles = []) {
    if (!this.authManager) {
      return false;
    }

    const result = this.authManager.addUser(username, password, roles);
    
    if (result) {
      // Rolleri de ata
      roles.forEach(role => {
        this.authorizationManager.assignRole(username, role);
      });

      this._logAuditEvent('user_added', {
        username: username,
        roles: roles,
        admin: 'system'
      });
    }

    return result;
  }

  /**
   * Kullanıcı yönetimi - kullanıcı silme
   * @param {string} username Kullanıcı adı
   * @returns {boolean} Başarılıysa true
   */
  removeUser(username) {
    if (!this.authManager) {
      return false;
    }

    const result = this.authManager.removeUser(username);
    
    if (result) {
      this._logAuditEvent('user_removed', {
        username: username,
        admin: 'system'
      });
    }

    return result;
  }

  /**
   * Rol yönetimi - rol atama
   * @param {string} username Kullanıcı adı
   * @param {string} roleName Rol adı
   * @returns {boolean} Başarılıysa true
   */
  assignRole(username, roleName) {
    if (!this.authorizationManager) {
      return false;
    }

    const result = this.authorizationManager.assignRole(username, roleName);
    
    if (result) {
      this._logAuditEvent('role_assigned', {
        username: username,
        role: roleName,
        admin: 'system'
      });
    }

    return result;
  }

  /**
   * Rol yönetimi - rol kaldırma
   * @param {string} username Kullanıcı adı
   * @param {string} roleName Rol adı
   * @returns {boolean} Başarılıysa true
   */
  removeRole(username, roleName) {
    if (!this.authorizationManager) {
      return false;
    }

    const result = this.authorizationManager.removeRole(username, roleName);
    
    if (result) {
      this._logAuditEvent('role_removed', {
        username: username,
        role: roleName,
        admin: 'system'
      });
    }

    return result;
  }

  /**
   * Kullanıcı izinlerini getir
   * @param {string} username Kullanıcı adı
   * @returns {Object|null} İzinler veya null
   */
  getUserPermissions(username) {
    if (!this.authorizationManager) {
      return null;
    }

    return this.authorizationManager.getUserPermissions(username);
  }

  /**
   * Güvenlik yapılandırmasını yeniden yükle
   * @returns {boolean} Başarılıysa true
   */
  reloadConfiguration() {
    try {
      if (this.authManager) {
        this.authManager.reloadUsers();
      }
      
      if (this.authorizationManager) {
        this.authorizationManager.reloadACL();
      }

      this._logAuditEvent('configuration_reloaded', {
        admin: 'system'
      });

      logger.info('Güvenlik yapılandırması yeniden yüklendi');
      return true;
    } catch (error) {
      logger.error(`Yapılandırma yeniden yükleme hatası: ${error.message}`);
      return false;
    }
  }

  /**
   * Audit olayı kaydet
   * @param {string} eventType Olay tipi
   * @param {Object} details Olay detayları
   * @private
   */
  _logAuditEvent(eventType, details) {
    if (!this.options.auditLog) {
      return;
    }

    const auditEvent = {
      timestamp: new Date().toISOString(),
      type: eventType,
      details: details
    };

    this.auditEvents.push(auditEvent);

    // Son 1000 olayı tut
    if (this.auditEvents.length > 1000) {
      this.auditEvents = this.auditEvents.slice(-1000);
    }

    logger.info(`Audit: ${eventType}`, details);
  }

  /**
   * Audit loglarını getir
   * @param {number} limit Maksimum kayıt sayısı
   * @returns {Array} Audit olayları
   */
  getAuditLogs(limit = 100) {
    return this.auditEvents.slice(-limit);
  }

  /**
   * Güvenlik durumu raporu
   * @returns {Object} Güvenlik durumu
   */
  getSecurityStatus() {
    return {
      enabled: this.options.enabled,
      authentication: {
        enabled: this.authManager?.options.enabled || false,
        type: this.authManager?.options.type || 'none'
      },
      authorization: {
        enabled: this.authorizationManager?.options.enabled || false,
        userCount: this.authorizationManager?.acl.size || 0,
        roleCount: this.authorizationManager?.rolePermissions.size || 0
      },
      tls: {
        enabled: this.tlsManager?.options.enabled || false,
        requireClientCert: this.tlsManager?.options.requireClientCert || false
      },
      audit: {
        enabled: this.options.auditLog,
        eventCount: this.auditEvents.length
      }
    };
  }
}

module.exports = SecurityManager; 