FROM node:22-alpine

WORKDIR /app

# Instalar pnpm globalmente
RUN npm install -g pnpm && pnpm config set minimum-release-age 0

# Copiar archivos de configuración y dependencias
COPY .npmrc* package.json pnpm-lock.yaml ./

# Instalar dependencias de producción
RUN pnpm install --prod

# Copiar el código fuente
COPY . .

# Volúmenes para persistir la sesión y los eventos
VOLUME ["/app/auth_info", "/app/data"]

ENV NODE_ENV=production

CMD ["pnpm", "start"]
