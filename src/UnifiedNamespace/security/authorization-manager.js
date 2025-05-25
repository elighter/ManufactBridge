/**
 * Yetkilendirme (Authorization) Yönetimi
 * 
 * Bu modül, ManufactBridge UNS için topic bazlı erişim kontrolü sağlar.
 * Kullanıcıların hangi topic'lere okuma/yazma yetkisi olduğunu kontrol eder.
 */

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const config = require('../config');

// Winston logger konfigürasyonu
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'authorization-manager' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/authorization-manager.log' })
  ]
});

class AuthorizationManager {
  constructor(options = {}) {
    this.options = Object.assign({
      enabled: config.security.authorization.enabled !== false,
      aclFile: path.join(process.cwd(), 'config', 'acl.json'),
      defaultPolicy: config.security.authorization.default_policy || 'deny',
      adminUsers: config.security.authorization.admin_users || []
    }, options);

    // Access Control List (ACL)
    this.acl = new Map();
    this.rolePermissions = new Map();

    this._init();
  }

  /**
   * Modülü başlatır
   * @private
   */
  _init() {
    try {
      logger.info('Yetkilendirme modülü başlatılıyor...');

      if (!this.options.enabled) {
        logger.warn('Yetkilendirme devre dışı bırakıldı - TÜM ERİŞİMLER İZİN VERİLECEK');
        return;
      }

      this._loadACL();
      logger.info('Yetkilendirme modülü başarıyla başlatıldı');
    } catch (error) {
      logger.error(`Yetkilendirme modülü başlatma hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * ACL dosyasını yükler
   * @private
   */
  _loadACL() {
    try {
      if (!fs.existsSync(this.options.aclFile)) {
        logger.warn(`ACL dosyası bulunamadı: ${this.options.aclFile}`);
        this._createDefaultACL();
        return;
      }

      const aclContent = fs.readFileSync(this.options.aclFile, 'utf8');
      const aclData = JSON.parse(aclContent);

      // Rol izinlerini yükle
      if (aclData.roles) {
        aclData.roles.forEach(role => {
          this.rolePermissions.set(role.name, {
            read: role.permissions.read || [],
            write: role.permissions.write || [],
            subscribe: role.permissions.subscribe || []
          });
        });
      }

      // Kullanıcı izinlerini yükle
      if (aclData.users) {
        aclData.users.forEach(user => {
          this.acl.set(user.username, {
            roles: user.roles || [],
            permissions: {
              read: user.permissions?.read || [],
              write: user.permissions?.write || [],
              subscribe: user.permissions?.subscribe || []
            }
          });
        });
      }

      logger.info(`ACL yüklendi: ${this.rolePermissions.size} rol, ${this.acl.size} kullanıcı`);
    } catch (error) {
      logger.error(`ACL yükleme hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Varsayılan ACL oluşturur
   * @private
   */
  _createDefaultACL() {
    const defaultACL = {
      roles: [
        {
          name: "admin",
          permissions: {
            read: ["manufactbridge/+/+/+/+/+"],
            write: ["manufactbridge/+/+/+/+/+"],
            subscribe: ["manufactbridge/+/+/+/+/+"]
          }
        },
        {
          name: "operator",
          permissions: {
            read: ["manufactbridge/+/+/+/+/status", "manufactbridge/+/+/+/+/metrics"],
            write: ["manufactbridge/+/+/+/+/commands"],
            subscribe: ["manufactbridge/+/+/+/+/status", "manufactbridge/+/+/+/+/alarms"]
          }
        },
        {
          name: "viewer",
          permissions: {
            read: ["manufactbridge/+/+/+/+/status", "manufactbridge/+/+/+/+/metrics"],
            write: [],
            subscribe: ["manufactbridge/+/+/+/+/status"]
          }
        }
      ],
      users: [
        {
          username: "admin",
          roles: ["admin"]
        },
        {
          username: "operator1",
          roles: ["operator"]
        },
        {
          username: "viewer1",
          roles: ["viewer"]
        }
      ]
    };

    try {
      fs.writeFileSync(this.options.aclFile, JSON.stringify(defaultACL, null, 2));
      logger.info(`Varsayılan ACL dosyası oluşturuldu: ${this.options.aclFile}`);
      this._loadACL();
    } catch (error) {
      logger.error(`Varsayılan ACL oluşturma hatası: ${error.message}`);
    }
  }

  /**
   * Topic pattern'inin topic ile eşleşip eşleşmediğini kontrol eder
   * @param {string} pattern Topic pattern'i (+ ve # joker karakterleri desteklenir)
   * @param {string} topic Kontrol edilecek topic
   * @returns {boolean} Eşleşiyorsa true
   * @private
   */
  _matchTopic(pattern, topic) {
    // Exact match
    if (pattern === topic) {
      return true;
    }

    // Pattern'i regex'e çevir
    const regexPattern = pattern
      .replace(/\+/g, '[^/]+')  // + -> bir seviye joker
      .replace(/#/g, '.*');     // # -> çok seviye joker

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(topic);
  }

  /**
   * Kullanıcının belirli bir topic'e erişim yetkisi olup olmadığını kontrol eder
   * @param {string} username Kullanıcı adı
   * @param {string} topic Topic yolu
   * @param {string} action Eylem tipi ('read', 'write', 'subscribe')
   * @returns {boolean} Yetki varsa true
   */
  authorize(username, topic, action) {
    try {
      // Yetkilendirme devre dışı bırakılmışsa, herkese izin ver
      if (!this.options.enabled) {
        return true;
      }

      // Admin kullanıcılar her şeye erişebilir
      if (this.options.adminUsers.includes(username)) {
        logger.debug(`Admin kullanıcı erişimi: ${username} -> ${topic} (${action})`);
        return true;
      }

      // Kullanıcı bilgilerini al
      const userInfo = this.acl.get(username);
      if (!userInfo) {
        logger.warn(`Kullanıcı ACL'de bulunamadı: ${username}`);
        return this.options.defaultPolicy === 'allow';
      }

      // Doğrudan kullanıcı izinlerini kontrol et
      const userPermissions = userInfo.permissions[action] || [];
      for (const pattern of userPermissions) {
        if (this._matchTopic(pattern, topic)) {
          logger.debug(`Kullanıcı izni ile erişim: ${username} -> ${topic} (${action})`);
          return true;
        }
      }

      // Rol bazlı izinleri kontrol et
      for (const roleName of userInfo.roles) {
        const rolePermissions = this.rolePermissions.get(roleName);
        if (rolePermissions) {
          const actionPermissions = rolePermissions[action] || [];
          for (const pattern of actionPermissions) {
            if (this._matchTopic(pattern, topic)) {
              logger.debug(`Rol izni ile erişim: ${username} (${roleName}) -> ${topic} (${action})`);
              return true;
            }
          }
        }
      }

      logger.warn(`Erişim reddedildi: ${username} -> ${topic} (${action})`);
      return false;
    } catch (error) {
      logger.error(`Yetkilendirme hatası: ${error.message}`);
      return this.options.defaultPolicy === 'allow';
    }
  }

  /**
   * MQTT client için yetkilendirme callback'i
   * @param {Object} client MQTT client
   * @param {string} topic Topic yolu
   * @param {string} action Eylem tipi ('publish', 'subscribe')
   * @param {Function} callback Sonuç callback (err, isAuthorized)
   */
  authorizeClient(client, topic, action, callback) {
    try {
      // Client'tan kullanıcı adını al
      const username = client.username || client.id;
      
      // Action'ı standart formata çevir
      const standardAction = action === 'publish' ? 'write' : 
                           action === 'subscribe' ? 'subscribe' : 
                           'read';

      const authorized = this.authorize(username, topic, standardAction);
      
      if (authorized) {
        logger.debug(`Client yetkilendirme başarılı: ${client.id} -> ${topic} (${action})`);
      } else {
        logger.warn(`Client yetkilendirme başarısız: ${client.id} -> ${topic} (${action})`);
      }

      callback(null, authorized);
    } catch (error) {
      logger.error(`Client yetkilendirme hatası: ${error.message}`);
      callback(error, false);
    }
  }

  /**
   * Kullanıcıya rol atar
   * @param {string} username Kullanıcı adı
   * @param {string} roleName Rol adı
   * @returns {boolean} İşlem başarılıysa true
   */
  assignRole(username, roleName) {
    try {
      let userInfo = this.acl.get(username);
      if (!userInfo) {
        userInfo = {
          roles: [],
          permissions: { read: [], write: [], subscribe: [] }
        };
        this.acl.set(username, userInfo);
      }

      if (!userInfo.roles.includes(roleName)) {
        userInfo.roles.push(roleName);
        logger.info(`Rol atandı: ${username} -> ${roleName}`);
        return true;
      }

      logger.warn(`Rol zaten atanmış: ${username} -> ${roleName}`);
      return false;
    } catch (error) {
      logger.error(`Rol atama hatası: ${error.message}`);
      return false;
    }
  }

  /**
   * Kullanıcıdan rol kaldırır
   * @param {string} username Kullanıcı adı
   * @param {string} roleName Rol adı
   * @returns {boolean} İşlem başarılıysa true
   */
  removeRole(username, roleName) {
    try {
      const userInfo = this.acl.get(username);
      if (!userInfo) {
        logger.warn(`Kullanıcı bulunamadı: ${username}`);
        return false;
      }

      const roleIndex = userInfo.roles.indexOf(roleName);
      if (roleIndex > -1) {
        userInfo.roles.splice(roleIndex, 1);
        logger.info(`Rol kaldırıldı: ${username} -> ${roleName}`);
        return true;
      }

      logger.warn(`Rol bulunamadı: ${username} -> ${roleName}`);
      return false;
    } catch (error) {
      logger.error(`Rol kaldırma hatası: ${error.message}`);
      return false;
    }
  }

  /**
   * ACL'yi diskten yeniden yükler
   * @returns {boolean} İşlem başarılıysa true
   */
  reloadACL() {
    try {
      this.acl.clear();
      this.rolePermissions.clear();
      this._loadACL();
      logger.info('ACL yeniden yüklendi');
      return true;
    } catch (error) {
      logger.error(`ACL yeniden yükleme hatası: ${error.message}`);
      return false;
    }
  }

  /**
   * Kullanıcının izinlerini listeler
   * @param {string} username Kullanıcı adı
   * @returns {Object|null} Kullanıcı izinleri veya null
   */
  getUserPermissions(username) {
    try {
      const userInfo = this.acl.get(username);
      if (!userInfo) {
        return null;
      }

      const permissions = {
        direct: userInfo.permissions,
        roles: {},
        effective: { read: [], write: [], subscribe: [] }
      };

      // Rol izinlerini topla
      for (const roleName of userInfo.roles) {
        const rolePermissions = this.rolePermissions.get(roleName);
        if (rolePermissions) {
          permissions.roles[roleName] = rolePermissions;
          
          // Etkili izinleri birleştir
          ['read', 'write', 'subscribe'].forEach(action => {
            permissions.effective[action] = [
              ...permissions.effective[action],
              ...rolePermissions[action]
            ];
          });
        }
      }

      // Doğrudan izinleri ekle
      ['read', 'write', 'subscribe'].forEach(action => {
        permissions.effective[action] = [
          ...permissions.effective[action],
          ...userInfo.permissions[action]
        ];
      });

      // Tekrarları kaldır
      ['read', 'write', 'subscribe'].forEach(action => {
        permissions.effective[action] = [...new Set(permissions.effective[action])];
      });

      return permissions;
    } catch (error) {
      logger.error(`Kullanıcı izinleri alma hatası: ${error.message}`);
      return null;
    }
  }
}

module.exports = AuthorizationManager; 