# Sparkplug B Protokolü

Bu dizin, ManufactBridge projesinde Sparkplug B protokolünü uygulamak için gerekli dosyaları içerir.

## Sparkplug B Nedir?

Sparkplug B, endüstriyel IoT (IIoT) uygulamaları için Eclipse Foundation tarafından geliştirilen açık bir spesifikasyondur. MQTT protokolü üzerinde çalışan Sparkplug B, OT (Operasyonel Teknoloji) ve IT (Bilgi Teknolojisi) sistemleri arasında veri alışverişini standartlaştırır.

## Temel Özellikler

- MQTT 3.1.1 üzerinde çalışır
- Oturum farkındalığı
- Veri biçimi tanımı
- Cihaz durum yönetimi
- Kompakt, verimli veri payloşımı
- İstemci otomatik keşfi
- Tarihsel veri desteği

## Konu Yapısı

Sparkplug B'nin standart konu yapısı:

```
spBv1.0/[group_id]/[message_type]/[edge_node_id]/[device_id]
```

Örneğin:
```
spBv1.0/Factory1/DDATA/PLC1/TempSensor1
```

## Mesaj Tipleri

- `NBIRTH`: Edge düğümünün doğuşu (bağlantı)
- `NDEATH`: Edge düğümünün ölümü (bağlantı kesilmesi)
- `DBIRTH`: Cihaz doğuşu
- `DDEATH`: Cihaz ölümü
- `NDATA`: Edge düğümünden gelen veri
- `DDATA`: Cihazdan gelen veri
- `NCMD`: Edge düğümüne komut
- `DCMD`: Cihaza komut

## ManufactBridge'de Sparkplug B

ManufactBridge, Unified Namespace ile Sparkplug B uyumlu cihazlar arasında dönüşüm yapar. Bu, standart Sparkplug B mesajlarının UNS formatına ve tersine dönüştürülmesini içerir.

## Kaynaklar

- [Eclipse Sparkplug Spesifikasyonu](https://www.eclipse.org/tahu/spec/Sparkplug%20Topic%20Namespace%20and%20State%20ManagementV2.2-with%20appendix%20B%20format%20-%20Eclipse.pdf)
- [Sparkplug GitHub](https://github.com/eclipse/tahu)
- [Eclipse Sparkplug Çalışma Grubu](https://sparkplug.eclipse.org/) 