# Katkı Sağlama Rehberi

ManufactBridge projesine katkıda bulunmak istediğiniz için teşekkür ederiz! Bu rehber, projeye nasıl katkıda bulunabileceğinizi anlatır.

## Geliştirme Ortamı Kurulumu

1. Bu repository'yi fork edin.
2. Yerel makinenize klonlayın: `git clone https://github.com/<kullanıcı-adınız>/ManufactBridge.git`
3. Bağımlılıkları yükleyin: `./manufactbridge.sh install --mode=docker`
4. Yeni bir branch oluşturun: `git checkout -b <özellik/hata/geliştirme-adı>`

## Geliştirme Süreci

### Kod Standartları

- Tüm kod düzenli ve tutarlı olmalıdır
- Modüler ve tekrar kullanılabilir kod yazın
- Fonksiyonlar ve sınıflar için uygun dokümantasyon ekleyin
- Kodunuzu kapsamlı birim testleriyle test edin

### Commit Mesajları

Commit mesajları şu formatta olmalıdır:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Tipler:
- `feat`: Yeni özellik
- `fix`: Hata düzeltme
- `docs`: Sadece dokümantasyon değişiklikleri
- `style`: Kod stilini etkileyen değişiklikler (boşluk, biçimlendirme vb.)
- `refactor`: Ne hata düzeltme ne de özellik eklemeyen kod değişiklikleri
- `test`: Test ekleme veya mevcut testleri düzenleme
- `chore`: Yapı süreci veya yardımcı araç değişiklikleri

### Pull Request Süreci

1. Değişikliklerinizi commit edin: `git commit -m 'feat(connector): yeni SCADA konnektörü eklendi'`
2. Değişikliklerinizi push edin: `git push origin <özellik/hata/geliştirme-adı>`
3. GitHub'da Pull Request oluşturun
4. Pull Request açıklamasında değişikliklerinizi detaylı bir şekilde açıklayın
5. Review sürecinde yapılan yorumlara göre değişikliklerinizi güncelleyin

## Test Etme

Katkınızı göndermeden önce:

1. Tüm testlerin geçtiğinden emin olun: `./manufactbridge.sh test`
2. Projenin hala düzgün çalıştığını doğrulayın
3. Değişikliklerinizin farklı ortamlarda (Docker, Kubernetes) test edildiğinden emin olun

## Dokümantasyon

Yeni özellikler veya API değişiklikleri için:

1. Uygun dokümantasyonu güncelleyin
2. Örnek kodları güncelleyin
3. README.md ve diğer rehberleri gerektiğinde güncelleyin

## Destek

Sorularınız veya yardıma ihtiyacınız olduğunda:

- GitHub issue oluşturun
- Tartışmalar bölümünde soru sorun
- E-posta ile iletişime geçin: support@manufactbridge.org

## Davranış Kuralları

Tüm katkıda bulunanlar profesyonel ve saygılı bir ortam sağlamak için davranış kurallarına uymalıdır.

## License

ManufactBridge projesi MIT lisansı altında dağıtılmaktadır. Katkıda bulunan herkes, katkılarının bu lisans kapsamında yayınlanmasını kabul eder.
