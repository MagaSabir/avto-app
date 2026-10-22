FROM node:22.23.4-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
# An empty API URL would make the production build call /api on its own origin
RUN test -n "$VITE_API_URL" && npm run build

FROM caddy:2.11.7
COPY --from=build /app/dist /srv
