FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Build the Vite app (env vars baked at build time)
ARG VITE_MONO_URL=/api/mono/metrics
ENV VITE_MONO_URL=$VITE_MONO_URL
ARG VITE_MS_URL=/api/ms/metrics
ENV VITE_MS_URL=$VITE_MS_URL
ARG VITE_HYBRID_URL=/api/hybrid/metrics
ENV VITE_HYBRID_URL=$VITE_HYBRID_URL

RUN npm run build

# ── Production: serve with nginx ──────────────────────────────
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# nginx config: serve SPA + proxy /api/* to backend services
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
