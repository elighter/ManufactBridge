FROM node:18-alpine

# Çalışma dizinini oluştur
WORKDIR /app

# package.json ve package-lock.json dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm install --production

# Uygulama dosyalarını kopyala
COPY . .

# Log dizini oluştur
RUN mkdir -p logs

# Gerekli izinleri ayarla
RUN chmod +x server.js

# Uygulama portunu aç
EXPOSE 3000

# Uygulamayı başlat
CMD ["node", "server.js"]