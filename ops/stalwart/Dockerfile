FROM stalwartlabs/stalwart@sha256:cea39417b45fb32fad05cdf96ff89892f9ed48ff69aa5aca76c35d0372625d81

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/healthz/live
