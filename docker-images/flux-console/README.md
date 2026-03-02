
# Flux Console Docker Image

This Docker image builds the Flux Console web application for deployment as a containerized service.

## Build

From the project root:

```bash
docker build -f ./docker-images/flux-console/Dockerfile -t ghcr.io/embernet-ai/flux-console:1.0.0 .
```

## Run

```bash
docker run -p 8443:8443 ghcr.io/embernet-ai/flux-console:1.0.0
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FLUX_CONSOLE_SERVER_KEY` | Path to TLS private key file |
| `FLUX_CONSOLE_SERVER_CERT_CHAIN` | Path to TLS certificate chain file |
| `PORT` | HTTP port (default: 1408) |
| `PORTTLS` | HTTPS port (default: 8443) |

## License

Based on OpenZiti ZAC, licensed under Apache 2.0. Copyright (c) 2026 Fireball Industries.
