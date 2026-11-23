# Збирається Supervisor'ом під час встановлення/оновлення: тягне код з GitHub і збирає інтерфейс.
ARG BUILD_FROM
FROM node:22-alpine AS build
RUN apk add --no-cache git
ARG BUILD_VERSION
RUN git clone --depth 1 https://github.com/vova275/itcity-home /src
WORKDIR /src
RUN npm ci --no-audit --no-fund && npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
COPY --from=build /src/dist ./dist
COPY --from=build /src/server.js /src/climate.js /src/outages.js /src/package.json ./
COPY --from=build /src/node_modules ./node_modules
ENV PORT=8099 NODE_ENV=production
CMD ["node", "server.js"]
