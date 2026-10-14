FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@11.25.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
FROM build AS api
ENV NODE_ENV=production
ENV HOST=0.0.0.0
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
FROM build AS worker
ENV NODE_ENV=production
ENV HOST=0.0.0.0
USER node
CMD ["node", "apps/worker/dist/main.js"]
FROM nginxinc/nginx-unprivileged:1.28-alpine AS web
COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
