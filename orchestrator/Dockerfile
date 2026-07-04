# Multi-stage build: compile TypeScript, then run the plain JS output with
# only production dependencies. Cloud Run injects PORT (defaults to 8080),
# which server.ts already reads via process.env.PORT — no hardcoding needed
# here, unlike litellm/Dockerfile.
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
# (New) sourcing_method: scraping and strategy: scrapeAll both launch
# headless Chromium via the `playwright` dependency above — node:20-slim
# has no browser binaries or the OS packages Chromium needs to run
# (libnss3, libatk, etc.), so both are installed here at build time rather
# than left to fail at first request. Adds real image size/build time;
# accepted as the cost of the scraping/discovery features actually working
# in production rather than only locally where a full Playwright install
# happens to already exist.
RUN npx playwright install --with-deps chromium
COPY --from=build /app/dist ./dist
CMD ["node", "dist/server.js"]
