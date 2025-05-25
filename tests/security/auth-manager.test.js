/**
 * AuthManager Birim Testleri
 */

const AuthManager = require('../../src/UnifiedNamespace/security/auth-manager');
const fs = require('fs');
const path = require('path');

// Mock fs modülü
jest.mock('fs');
jest.mock('../../src/UnifiedNamespace/config', () => global.mockConfig);

describe('AuthManager', () => {
  let authManager;
  const mockUsersFile = path.join(process.cwd(), 'config', 'users.json');

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock users.json dosyası
    const mockUsers = [
      {
        username: 'admin',
        password: 'admin123',
        roles: ['admin']
      },
      {
        username: 'operator1',
        password: 'op123',
        roles: ['operator']
      }
    ];

    fs.existsSync.mockImplementation((filePath) => {
      return filePath === mockUsersFile;
    });

    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath === mockUsersFile) {
        return JSON.stringify(mockUsers);
      }
      throw new Error('File not found');
    });
  });

  describe('Constructor ve Initialization', () => {
    test('basic auth ile başarılı başlatma', () => {
      expect(() => {
        authManager = new AuthManager({
          type: 'basic',
          usersFile: mockUsersFile
        });
      }).not.toThrow();

      expect(authManager.users.size).toBe(2);
      expect(authManager.users.has('admin')).toBe(true);
      expect(authManager.users.has('operator1')).toBe(true);
    });

    test('oauth2 ile başarılı başlatma', () => {
      expect(() => {
        authManager = new AuthManager({
          type: 'oauth2',
          oauth: {
            issuerUrl: 'https://test.com',
            audience: 'test-audience'
          }
        });
      }).not.toThrow();
    });

    test('geçersiz auth tipi ile hata', () => {
      expect(() => {
        authManager = new AuthManager({
          type: 'invalid-type'
        });
      }).toThrow('Desteklenmeyen kimlik doğrulama tipi');
    });

    test('oauth2 eksik konfigürasyon ile hata', () => {
      expect(() => {
        authManager = new AuthManager({
          type: 'oauth2',
          oauth: {
            issuerUrl: 'https://test.com'
            // audience eksik
          }
        });
      }).toThrow('OAuth2 konfigürasyonu eksik');
    });

    test('disabled auth ile başlatma', () => {
      authManager = new AuthManager({
        enabled: false
      });
      expect(authManager.options.enabled).toBe(false);
    });
  });

  describe('Basic Authentication', () => {
    beforeEach(() => {
      authManager = new AuthManager({
        type: 'basic',
        usersFile: mockUsersFile
      });
    });

    test('geçerli kullanıcı ile başarılı doğrulama', async () => {
      const result = await authManager._authenticateBasic('admin', 'admin123');
      expect(result).toBe(true);
    });

    test('geçersiz şifre ile başarısız doğrulama', async () => {
      const result = await authManager._authenticateBasic('admin', 'wrongpassword');
      expect(result).toBe(false);
    });

    test('var olmayan kullanıcı ile başarısız doğrulama', async () => {
      const result = await authManager._authenticateBasic('nonexistent', 'password');
      expect(result).toBe(false);
    });

    test('boş kullanıcı adı ile başarısız doğrulama', async () => {
      const result = await authManager._authenticateBasic('', 'password');
      expect(result).toBe(false);
    });

    test('boş şifre ile başarısız doğrulama', async () => {
      const result = await authManager._authenticateBasic('admin', '');
      expect(result).toBe(false);
    });
  });

  describe('OAuth2 Authentication', () => {
    beforeEach(() => {
      authManager = new AuthManager({
        type: 'oauth2',
        oauth: {
          issuerUrl: 'https://test-issuer.com',
          audience: 'test-audience'
        }
      });
    });

    test('geçerli JWT token ile başarılı doğrulama', async () => {
      // Mock JWT token (base64 encoded)
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3Rlc3QtaXNzdWVyLmNvbSIsImF1ZCI6InRlc3QtYXVkaWVuY2UiLCJzdWIiOiJ0ZXN0LXVzZXIiLCJleHAiOjk5OTk5OTk5OTl9.signature';
      
      const result = await authManager._authenticateOAuth(mockToken);
      expect(result).toBe(true);
    });

    test('geçersiz JWT formatı ile başarısız doğrulama', async () => {
      const result = await authManager._authenticateOAuth('invalid-token');
      expect(result).toBe(false);
    });

    test('boş token ile başarısız doğrulama', async () => {
      const result = await authManager._authenticateOAuth('');
      expect(result).toBe(false);
    });

    test('yanlış issuer ile başarısız doğrulama', async () => {
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3dyb25nLWlzc3Vlci5jb20iLCJhdWQiOiJ0ZXN0LWF1ZGllbmNlIiwic3ViIjoidGVzdC11c2VyIiwiZXhwIjo5OTk5OTk5OTk5fQ.signature';
      
      const result = await authManager._authenticateOAuth(mockToken);
      expect(result).toBe(false);
    });
  });

  describe('Client Authentication', () => {
    beforeEach(() => {
      authManager = new AuthManager({
        type: 'basic',
        usersFile: mockUsersFile
      });
    });

    test('geçerli client ile başarılı doğrulama', (done) => {
      const mockClient = testHelpers.createMockMQTTClient();
      
      authManager.authenticate(mockClient, 'admin', 'admin123', (err, result) => {
        expect(err).toBeNull();
        expect(result).toBe(true);
        done();
      });
    });

    test('geçersiz client ile başarısız doğrulama', (done) => {
      const mockClient = testHelpers.createMockMQTTClient();
      
      authManager.authenticate(mockClient, 'admin', 'wrongpassword', (err, result) => {
        expect(err).toBeNull();
        expect(result).toBe(false);
        done();
      });
    });

    test('Buffer password ile başarılı doğrulama', (done) => {
      const mockClient = testHelpers.createMockMQTTClient();
      const passwordBuffer = Buffer.from('admin123');
      
      authManager.authenticate(mockClient, 'admin', passwordBuffer, (err, result) => {
        expect(err).toBeNull();
        expect(result).toBe(true);
        done();
      });
    });

    test('disabled auth ile her zaman başarılı', (done) => {
      authManager = new AuthManager({ enabled: false });
      const mockClient = testHelpers.createMockMQTTClient();
      
      authManager.authenticate(mockClient, 'anyone', 'anything', (err, result) => {
        expect(err).toBeNull();
        expect(result).toBe(true);
        done();
      });
    });
  });

  describe('User Management', () => {
    beforeEach(() => {
      authManager = new AuthManager({
        type: 'basic',
        usersFile: mockUsersFile
      });
    });

    test('yeni kullanıcı ekleme', () => {
      const result = authManager.addUser('newuser', 'newpass', ['viewer']);
      expect(result).toBe(true);
      expect(authManager.users.has('newuser')).toBe(true);
      
      const user = authManager.users.get('newuser');
      expect(user.password).toBe('newpass');
      expect(user.roles).toEqual(['viewer']);
    });

    test('kullanıcı silme', () => {
      const result = authManager.removeUser('operator1');
      expect(result).toBe(true);
      expect(authManager.users.has('operator1')).toBe(false);
    });

    test('var olmayan kullanıcı silme', () => {
      const result = authManager.removeUser('nonexistent');
      expect(result).toBe(false);
    });

    test('oauth2 modunda kullanıcı ekleme başarısız', () => {
      authManager = new AuthManager({
        type: 'oauth2',
        oauth: {
          issuerUrl: 'https://test.com',
          audience: 'test-audience'
        }
      });
      
      const result = authManager.addUser('newuser', 'newpass');
      expect(result).toBe(false);
    });

    test('kullanıcıları yeniden yükleme', () => {
      const result = authManager.reloadUsers();
      expect(result).toBe(true);
      expect(fs.readFileSync).toHaveBeenCalledWith(mockUsersFile, 'utf8');
    });
  });

  describe('Error Handling', () => {
    test('users.json dosyası bulunamadığında', () => {
      fs.existsSync.mockReturnValue(false);
      
      expect(() => {
        authManager = new AuthManager({
          type: 'basic',
          usersFile: 'nonexistent.json'
        });
      }).not.toThrow();
    });

    test('geçersiz JSON formatında users.json', () => {
      fs.readFileSync.mockReturnValue('invalid json');
      
      expect(() => {
        authManager = new AuthManager({
          type: 'basic',
          usersFile: mockUsersFile
        });
      }).toThrow();
    });

    test('sertifika dizini bulunamadığında', () => {
      expect(() => {
        authManager = new AuthManager({
          type: 'certificate',
          certPath: '/nonexistent/path'
        });
      }).toThrow('Sertifika dizini bulunamadı');
    });
  });
}); 