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
COPY --from=build /app/dist ./dist
CMD ["node", "dist/server.js"]
