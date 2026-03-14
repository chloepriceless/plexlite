FROM node:22-slim AS base
WORKDIR /app
COPY dvhub/package.json dvhub/package-lock.json ./
RUN npm ci --omit=dev
COPY dvhub/ .
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node", "--experimental-sqlite", "server.js"]
