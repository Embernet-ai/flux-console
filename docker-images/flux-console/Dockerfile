# Flux Console Docker Image
# Based on OpenZiti ZAC, licensed under Apache 2.0
# Copyright (c) 2026 Fireball Industries

ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-bookworm-slim AS builder

LABEL org.opencontainers.image.title="Flux Console"
LABEL org.opencontainers.image.description="Zero-trust network administration console for Flux overlay networks"
LABEL org.opencontainers.image.vendor="Fireball Industries"
LABEL org.opencontainers.image.source="https://github.com/embernet-ai/flux-console"
LABEL org.opencontainers.image.licenses="Apache-2.0"

WORKDIR /usr/src/app

RUN npm install -g @angular/cli@18

COPY package*.json ./
COPY version.js ./
COPY . .

RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/usr/src/app/.angular/cache \
    npm install --omit=optional && \
    ng build flux-console-lib && \
    ng build flux-console --configuration production


FROM node:${NODE_VERSION}-bookworm-slim

LABEL org.opencontainers.image.title="Flux Console"
LABEL org.opencontainers.image.description="Zero-trust network administration console for Flux overlay networks"
LABEL org.opencontainers.image.vendor="Fireball Industries"
LABEL org.opencontainers.image.source="https://github.com/embernet-ai/flux-console"
LABEL org.opencontainers.image.licenses="Apache-2.0"

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY ./package*.json ./
COPY ./server.js ./
COPY ./run-flux-console.sh ./

# The in-container path for the key file to use for TLS.
ENV FLUX_CONSOLE_SERVER_KEY=
# The in-container path for the cert bundle file to use for TLS.
ENV FLUX_CONSOLE_SERVER_CERT_CHAIN=
# the HTTP port Flux Console uses
ENV PORT=
# the HTTPS port Flux Console uses
ENV PORTTLS=

# Expose ports
EXPOSE 1408
EXPOSE 8443

ENTRYPOINT ["/usr/src/app/run-flux-console.sh"]
CMD ["node-api"]
