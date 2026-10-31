FROM node:22-alpine

WORKDIR /app

# Instalar pnpm globalmente y configurar políticas
RUN npm install -g pnpm && pnpm config set minimum-release-age 0

# Copiar archivos de dependencias y configuraciones de builds permitidos
COPY .npmrc* package.json pnpm-lock.yaml pnpm-workspace.yaml* ./

# Instalar dependencias de producción
RUN pnpm install --prod

# Copiar el código fuente
COPY . .

# Volúmenes para persistir la sesión y los eventos
VOLUME ["/app/auth_info", "/app/data"]

ENV NODE_ENV=production

CMD ["pnpm", "start"]
