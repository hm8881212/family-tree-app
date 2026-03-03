FROM node:20-alpine AS base

# Build server
FROM base AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Build client
FROM base AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Production image
FROM base AS production
WORKDIR /app
RUN npm install -g serve

# Copy server build
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/node_modules ./server/node_modules
COPY --from=server-build /app/server/package.json ./server/package.json
COPY --from=server-build /app/server/scripts ./server/scripts
COPY db/ ./db/

# Copy client build
COPY --from=client-build /app/client/dist ./client/dist

# Start script
COPY docker-start.sh ./
RUN chmod +x docker-start.sh

EXPOSE 4000 3000

CMD ["./docker-start.sh"]
