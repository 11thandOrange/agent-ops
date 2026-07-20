# Multi-stage build: compile TypeScript (including pipeline-orchestrator's
# own build, triggered by its `prepare` script since it's installed as a git
# dependency), then copy the already-built node_modules + dist into a lean
# runtime image. Deliberately NOT a second `npm ci --omit=dev` in the
# production stage: that would re-resolve pipeline-orchestrator from git and
# re-run its `prepare` build, and --omit=dev's interaction with a git
# dependency's own devDependencies (needed for ITS build) is a real, easy
# way to end up with a broken/missing dist/ in production. Copying the
# already-built tree from the build stage sidesteps that entirely, at the
# cost of carrying build-time devDependencies into the final image.
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
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# sourcing_method: scraping and strategy: scrapeAll both launch headless
# Chromium via the `playwright` dependency — node:20-slim has no browser
# binaries or the OS packages Chromium needs to run (libnss3, libatk, etc.),
# so both are installed here at build time rather than left to fail at
# first request.
RUN npx playwright install --with-deps chromium
CMD ["node", "dist/index.js"]
