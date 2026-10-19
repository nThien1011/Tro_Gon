FROM node:24-alpine AS web
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
ENV VITE_DATA_SOURCE=api VITE_API_BASE_URL=/api/v1 VITE_DEMO_ENABLED=false
RUN npm run build

FROM node:24-alpine AS api-dependencies
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS runtime
RUN addgroup -g 10001 trogon && adduser -D -u 10001 -G trogon trogon \
    && mkdir -p /app/server /data/media && chown -R trogon:trogon /app /data
WORKDIR /app
COPY --chown=trogon:trogon package.json ./package.json
COPY --from=api-dependencies --chown=trogon:trogon /build/server/node_modules ./server/node_modules
COPY --chown=trogon:trogon server/package.json ./server/package.json
COPY --chown=trogon:trogon server/src ./server/src
COPY --chown=trogon:trogon server/migrations ./server/migrations
COPY --chown=trogon:trogon src/domain ./src/domain
COPY --chown=trogon:trogon src/config/locations.ts ./src/config/locations.ts
COPY --chown=trogon:trogon src/data ./src/data
COPY --from=web --chown=trogon:trogon /build/dist ./dist
USER trogon
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 STORAGE_DIR=/data/media
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:8080/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["./server/node_modules/.bin/tsx", "server/src/index.ts"]
