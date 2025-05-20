# ISA-95 Standartı

Bu dizin, ManufactBridge projesinde ISA-95 standardını uygulamak için gerekli dosyaları içerir.

## ISA-95 Nedir?

ISA-95, üretim yönetim sistemleri ile kurumsal sistemler arasındaki entegrasyonu tanımlayan uluslararası bir standarttır. İşletme Kaynak Planlaması (ERP) ve Üretim Yönetim Sistemleri (MES) arasındaki iletişimi standartlaştırır.

## Hiyerarşi Modeli

ISA-95 standardı, fabrika ve üretim yapılarını şu şekilde hiyerarşik olarak tanımlar:

- Seviye 0: Fiziksel üretim süreci
- Seviye 1: Sensörler ve aktüatörler
- Seviye 2: Kontrol sistemleri (PLC, DCS, SCADA)
- Seviye 3: Üretim operasyonları yönetimi (MES)
- Seviye 4: İşletme planlaması ve lojistik (ERP)

## ManufactBridge'de ISA-95

ManufactBridge, Unified Namespace (UNS) içinde ISA-95 hiyerarşisini konu yolları olarak aşağıdaki formatta kullanır:

```
manufactbridge/enterprise/site/area/line/device/datatype/tagname
```

Örneğin:
```
manufactbridge/acme/istanbul/machine-shop/line1/cnc5/data/temperature
```

## Konu Yolları

ISA-95 tabanlı konu yolları şunları içerir:

- **enterprise**: İşletme adı
- **site**: Tesis/Fabrika lokasyonu
- **area**: Üretim alanı
- **line**: Üretim hattı
- **device**: Cihaz veya ekipman
- **datatype**: Veri tipi (data, event, command)
- **tagname**: Değişken adı

## Kaynaklar

- [ISA-95 Resmi Sitesi](https://www.isa.org/standards-and-publications/isa-standards/isa-standards-committees/isa95)
- [ANSI/ISA-95.00.01-2010](https://www.isa.org/products/ansi-isa-95-00-01-2010-enterprise-control-system-in) 