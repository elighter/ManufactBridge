# ManufactBridge Dockerfile
# Modern Üretim-ERP Veri Platformu

FROM node:18-alpine AS builder

# Metadata
LABEL maintainer="Emre Çakmak <emre@example.com>"
LABEL description="ManufactBridge - Modern Manufacturing-ERP Data Platform"
LABEL version="1.0.0"

# Çalışma dizini oluştur
WORKDIR /app

# Package dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm ci --only=production && npm cache clean --force

# Uygulama kodunu kopyala
COPY src/ ./src/
COPY config/ ./config/

# Logs ve certs dizinlerini oluştur
RUN mkdir -p logs certs

# Production stage
FROM node:18-alpine AS production

# Güvenlik için non-root user oluştur
RUN addgroup -g 1001 -S manufactbridge && \
    adduser -S manufactbridge -u 1001

# Çalışma dizini
WORKDIR /app

# Builder stage'den dosyaları kopyala
COPY --from=builder --chown=manufactbridge:manufactbridge /app .

# Gerekli sistem paketlerini yükle
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Health check script
COPY --chown=manufactbridge:manufactbridge docker/healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod +x /usr/local/bin/healthcheck.sh

# User'a geç
USER manufactbridge

# Port'ları expose et
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# Uygulama başlat
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"] 