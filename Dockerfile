FROM node:22-alpine

WORKDIR /app

# Instalar pnpm globalmente
RUN npm install -g pnpm

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml ./

# Instalar dependencias de producción de forma reproducible
RUN pnpm install --prod --frozen-lockfile

# Copiar el código fuente
COPY . .

# Volúmenes para persistir la sesión y los eventos
VOLUME ["/app/auth_info", "/app/data"]

ENV NODE_ENV=production

CMD ["pnpm", "start"]
