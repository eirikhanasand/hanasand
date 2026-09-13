FROM python:3.13-alpine@sha256:7415fbc3c9e4979cc717d92377ab2bc7b2b4a2af1ac03cc52b5f3f88efedaf3a
RUN apk add --no-cache openssh-client ca-certificates
WORKDIR /app
COPY health.py /app/health.py
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
USER 1000:1000
HEALTHCHECK --interval=30s --timeout=3s --start-period=45s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health',timeout=2)"
CMD ["python", "/app/health.py"]
