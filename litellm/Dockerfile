# Cloud Run deploys from a Dockerfile/image, not docker-compose.yml — this
# just bakes config.yaml into the official LiteLLM image and listens on
# Cloud Run's expected port. docker-compose.yml is still the source of
# truth for local/VM runs.
FROM ghcr.io/berriai/litellm:main-stable
COPY config.yaml /app/config.yaml
CMD ["--config", "/app/config.yaml", "--port", "8080"]
