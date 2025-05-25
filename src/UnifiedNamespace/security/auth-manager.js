/**
 * Kimlik Doğrulama (Authentication) Yönetimi
 * 
 * Bu modül, ManufactBridge UNS bağlantıları için kimlik doğrulama işlemlerini yönetir.
 * Temel kimlik doğrulama, OAuth2 ve sertifika tabanlı kimlik doğrulama desteklenir.
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const winston = require('winston');
const config = require('../config');

// Winston logger konfigürasyonu
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'auth-manager' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/auth-manager.log' })
  ]
});

class AuthManager {
  constructor(options = {}) {
    this.options = Object.assign({
      enabled: config.security.authentication.enabled !== false,
      type: config.security.authentication.type || 'basic',
      usersFile: path.join(process.cwd(), 'config', 'users.json'),
      oauth: {
        issuerUrl: config.security.authentication.oauth2.issuer_url,
        audience: config.security.authentication.oauth2.audience,
        jwksUri: config.security.authentication.oauth2.jwks_uri
      },
      certPath: path.join(process.cwd(), 'config', 'certs')
    }, options);

    // Kullanıcı veritabanı
    this.users = new Map();

    // Kimlik doğrulama tipi ve kullanıcıları yükle
    this._init();
  }

  /**
   * Modülü başlatır
   * @private
   */
  _init() {
    try {
      logger.info(`Kimlik doğrulama modülü başlatılıyor (tip: ${this.options.type})...`);

      // Authentication devre dışı bırakılmışsa bildir
      if (!this.options.enabled) {
        logger.warn('Kimlik doğrulama devre dışı bırakıldı - TÜM BAĞLANTILAR İZİN VERİLECEK');
        return;
      }

      // Kimlik doğrulama tipine göre işlem yap
      switch (this.options.type) {
        case 'basic':
          this._loadUsers();
          break;
        case 'oauth2':
          this._setupOAuth();
          break;
        case 'certificate':
          this._setupCertificateAuth();
          break;
        default:
          logger.error(`Desteklenmeyen kimlik doğrulama tipi: ${this.options.type}`);
          throw new Error(`Desteklenmeyen kimlik doğrulama tipi: ${this.options.type}`);
      }

      logger.info('Kimlik doğrulama modülü başarıyla başlatıldı');
    } catch (error) {
      logger.error(`Kimlik doğrulama modülü başlatma hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kullanıcı bilgilerini dosyadan yükler (basic auth için)
   * @private
   */
  _loadUsers() {
    try {
      if (!fs.existsSync(this.options.usersFile)) {
        logger.warn(`Kullanıcı dosyası bulunamadı: ${this.options.usersFile}`);
        return;
      }

      const userContent = fs.readFileSync(this.options.usersFile, 'utf8');
      const userList = JSON.parse(userContent);

      userList.forEach(user => {
        this.users.set(user.username, {
          password: user.password,
          roles: user.roles || []
        });
      });

      logger.info(`${this.users.size} kullanıcı yüklendi`);
    } catch (error) {
      logger.error(`Kullanıcı yükleme hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * OAuth2 doğrulama ayarlarını yapar
   * @private
   */
  _setupOAuth() {
    // OAuth2 gereksinimleri kontrol et
    if (!this.options.oauth.issuerUrl || !this.options.oauth.audience) {
      logger.error('OAuth2 konfigürasyonu eksik: issuerUrl ve audience gereklidir');
      throw new Error('OAuth2 konfigürasyonu eksik: issuerUrl ve audience gereklidir');
    }

    logger.info(`OAuth2 kimlik doğrulama ayarlandı (issuer: ${this.options.oauth.issuerUrl})`);
  }

  /**
   * Sertifika tabanlı doğrulama ayarlarını yapar
   * @private
   */
  _setupCertificateAuth() {
    // Sertifika dizinini kontrol et
    if (!fs.existsSync(this.options.certPath)) {
      logger.error(`Sertifika dizini bulunamadı: ${this.options.certPath}`);
      throw new Error(`Sertifika dizini bulunamadı: ${this.options.certPath}`);
    }

    logger.info(`Sertifika tabanlı kimlik doğrulama ayarlandı`);
  }

  /**
   * Temel kimlik doğrulama (kullanıcı adı/şifre)
   * @param {string} username Kullanıcı adı
   * @param {string} password Şifre
   * @returns {Promise<boolean>} Doğrulama başarılıysa true
   * @private
   */
  async _authenticateBasic(username, password) {
    if (!username || !password) {
      logger.warn('Boş kullanıcı adı veya şifre ile kimlik doğrulama denemesi');
      return false;
    }

    const user = this.users.get(username);
    if (!user) {
      logger.warn(`Kullanıcı bulunamadı: ${username}`);
      return false;
    }

    // Basit şifre kontrolü - gerçek uygulamada hash kullanılmalıdır
    return user.password === password;
  }

  /**
   * OAuth2 token doğrulama
   * @param {string} token JWT token
   * @returns {Promise<boolean>} Doğrulama başarılıysa true
   * @private
   */
  async _authenticateOAuth(token) {
    try {
      if (!token) {
        logger.warn('Boş token ile kimlik doğrulama denemesi');
        return false;
      }

      // Bu kısımda normalde tam bir JWT doğrulama işlemi yapılır
      // Örnek olarak basit bir doğrulama yapıyoruz

      // JWT denemesi
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded) {
        logger.warn('Geçersiz JWT formatı');
        return false;
      }

      // İssuer kontrolü
      if (decoded.payload.iss !== this.options.oauth.issuerUrl) {
        logger.warn(`JWT issuer uyuşmazlığı: ${decoded.payload.iss}`);
        return false;
      }

      // Audience kontrolü
      if (!decoded.payload.aud || 
          (Array.isArray(decoded.payload.aud) && !decoded.payload.aud.includes(this.options.oauth.audience)) ||
          (typeof decoded.payload.aud === 'string' && decoded.payload.aud !== this.options.oauth.audience)) {
        logger.warn(`JWT audience uyuşmazlığı`);
        return false;
      }

      // Geçerlilik süresi kontrolü
      const now = Math.floor(Date.now() / 1000);
      if (decoded.payload.exp && decoded.payload.exp < now) {
        logger.warn('JWT süresi dolmuş');
        return false;
      }

      // Gerçek uygulamada token imzası doğrulanır
      logger.info(`OAuth2 doğrulaması başarılı: ${decoded.payload.sub}`);
      return true;
    } catch (error) {
      logger.error(`OAuth2 doğrulama hatası: ${error.message}`);
      return false;
    }
  }

  /**
   * Sertifika doğrulama
   * @param {Object} certificate Sertifika bilgileri
   * @returns {Promise<boolean>} Doğrulama başarılıysa true
   * @private
   */
  async _authenticateCertificate(certificate) {
    try {
      if (!certificate) {
        logger.warn('Sertifika bulunamadı');
        return false;
      }

      // Bu kısımda normalde tam bir sertifika doğrulama işlemi yapılır
      // Örnek olarak basit bir kontrol yapıyoruz
      logger.info(`Sertifika doğrulaması: ${certificate.subject.CN}`);
      return true;
    } catch (error) {
      logger.error(`Sertifika doğrulama hatası: ${error.message}`);
      return false;
    }
  }

  /**
   * Client kimlik doğrulama işlemi (MQTT ve Kafka entegrasyonu için)
   * @param {Object} client Bağlanan client
   * @param {string} username Kullanıcı adı
   * @param {string|Buffer} password Şifre (Buffer olabilir)
   * @param {Function} callback Sonuç callback (err, isAuthenticated)
   */
  authenticate(client, username, password, callback) {
    // Kimlik doğrulama devre dışı bırakılmışsa, herkese izin ver
    if (!this.options.enabled) {
      return callback(null, true);
    }

    // Kimlik doğrulama tipine göre işlem yap
    (async () => {
      try {
        let authenticated = false;

        switch (this.options.type) {
          case 'basic':
            // Şifre Buffer ise string'e çevir
            const passwordStr = password instanceof Buffer ? password.toString() : password;
            authenticated = await this._authenticateBasic(username, passwordStr);
            break;

          case 'oauth2':
            // Buffer'ı token olarak çözümle
            const token = password instanceof Buffer ? password.toString() : password;
            authenticated = await this._authenticateOAuth(token);
            break;

          case 'certificate':
            // Client sertifikasını doğrula
            authenticated = await this._authenticateCertificate(client.certificate);
            break;

          default:
            logger.error(`Desteklenmeyen kimlik doğrulama tipi: ${this.options.type}`);
            return callback(new Error(`Desteklenmeyen kimlik doğrulama tipi`), false);
        }

        if (authenticated) {
          logger.info(`Kimlik doğrulama başarılı: ${client.id} (${username || 'anonim'})`);
          return callback(null, true);
        }

        logger.warn(`Kimlik doğrulama başarısız: ${client.id} (${username || 'anonim'})`);
        return callback(null, false);
      } catch (error) {
        logger.error(`Kimlik doğrulama hatası: ${error.message}`);
        return callback(error, false);
      }
    })();
  }

  /**
   * Yeni kullanıcı ekler (basic auth için)
   * @param {string} username Kullanıcı adı
   * @param {string} password Şifre
   * @param {Array} roles Roller
   * @returns {boolean} İşlem başarılıysa true
   */
  addUser(username, password, roles = []) {
    try {
      if (this.options.type !== 'basic') {
        logger.warn('Kullanıcı ekleme yalnızca basic auth modunda kullanılabilir');
        return false;
      }

      this.users.set(username, {
        password,
        roles
      });

      logger.info(`Kullanıcı eklendi: ${username}`);
      return true;
    } catch (error) {
      logger.error(`Kullanıcı ekleme hatası: ${error.message}`);
      return false;
    }
  }

  /**
   * Kullanıcı siler (basic auth için)
   * @param {string} username Silinecek kullanıcı adı
   * @returns {boolean} İşlem başarılıysa true
   */
  removeUser(username) {
    try {
      if (this.options.type !== 'basic') {
        logger.warn('Kullanıcı silme yalnızca basic auth modunda kullanılabilir');
        return false;
      }

      const result = this.users.delete(username);
      if (result) {
        logger.info(`Kullanıcı silindi: ${username}`);
      } else {
        logger.warn(`Kullanıcı bulunamadı: ${username}`);
      }

      return result;
    } catch (error) {
      logger.error(`Kullanıcı silme hatası: ${error.message}`);
      return false;
    }
  }

  /**
   * Kullanıcı listesini diskten yeniden yükler
   * @returns {boolean} İşlem başarılıysa true
   */
  reloadUsers() {
    try {
      if (this.options.type !== 'basic') {
        logger.warn('Kullanıcı yeniden yükleme yalnızca basic auth modunda kullanılabilir');
        return false;
      }

      this.users.clear();
      this._loadUsers();
      logger.info('Kullanıcılar yeniden yüklendi');
      return true;
    } catch (error) {
      logger.error(`Kullanıcı yeniden yükleme hatası: ${error.message}`);
      return false;
    }
  }
}

module.exports = AuthManager;