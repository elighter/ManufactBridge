# Unified Namespace Şema Yapısı

Bu dizin, ManufactBridge Unified Namespace (UNS) platformundaki veri şemalarına ait dosyaları içerir.

## Şema Tanımları

Unified Namespace, yapılandırılmış veri paylaşımı için JSON Schema tabanlı şema doğrulama mekanizması kullanır. Bu sayede:

- Veri tutarlılığı sağlanır
- Veri formatı standartlaştırılır
- Uygulama geliştirme kolaylaşır
- Veri kalitesi artar

## Temel Veri Yapısı

UNS'de yayınlanan her mesaj, aşağıdaki genel yapıya uymalıdır:

```json
{
  "timestamp": "2023-06-15T12:34:56.789Z",
  "value": <değer-tipi-değişebilir>,
  "quality": "GOOD|BAD|UNCERTAIN",
  "metadata": {
    "source": "kaynak-sistem-id",
    "dataType": "string|number|boolean|object|array",
    "unit": "opsiyonel-birim"
  }
}
```

## Şema Doğrulama

UNS'de veri doğrulaması iki aşamada gerçekleşir:

1. **Konu Yolu (Topic) Doğrulama**: Verilerin yayınlandığı konu yolları, tanımlı kurallara uygunluk açısından doğrulanır.

2. **Veri Yapısı Doğrulama**: Yayınlanan veriler, veri tipine göre ilgili JSON şeması ile doğrulanır.

## Mevcut Şemalar

Bu dizinde aşağıdaki şemaları bulabilirsiniz:

- **base-message.json**: Tüm UNS mesajları için temel şema
- **device-data.json**: Cihaz verileri için şema
- **alarm-event.json**: Alarm ve olaylar için şema
- **command.json**: Komut mesajları için şema
- **metadata.json**: Metadata bilgileri için şema

## Şema Geliştirme

Yeni şemalar eklerken veya mevcut şemaları güncellerken aşağıdaki adımları izleyin:

1. JSON Schema formatına uygun şekilde şemayı tanımlayın
2. Şema doğrulamasını test edin
3. Şemayı bu dizine ekleyin
4. `schema-validator.js` dosyasında gerekli referansları güncelleyin

## Kaynaklar

- [JSON Schema Resmi Sitesi](https://json-schema.org/)
- [JSON Schema Doğrulama](https://json-schema.org/understanding-json-schema/)
- [AJV JavaScript Doğrulama Kütüphanesi](https://ajv.js.org/) 