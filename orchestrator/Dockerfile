# Multi-stage build: compile TypeScript, then run the plain JS output with
# only production dependencies. Cloud Run injects PORT (defaults to 3000,
# see src/index.ts), which works unmodified.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# sourcing_method: scraping and strategy: scrapeAll both launch headless
# Chromium via the `playwright` dependency — node:20-slim has no browser
# binaries or the OS packages Chromium needs to run (libnss3, libatk, etc.),
# so both are installed here at build time rather than left to fail at
# first request.
RUN npx playwright install --with-deps chromium
COPY --from=build /app/dist ./dist
CMD ["node", "dist/index.js"]
