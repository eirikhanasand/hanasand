FROM oven/bun:1.3.11-alpine AS runtime

ARG HANASAND_RELEASE_COMMIT=unknown
LABEL org.opencontainers.image.revision=$HANASAND_RELEASE_COMMIT

WORKDIR /app/ti/scraper
ENV NODE_ENV=production \
    SCRAPER_PORT=8097 \
    SCRAPER_ENV=production

EXPOSE 8097

CMD ["sh", "-c", "test \"$(cat .hanasand-release)\" = \"$HANASAND_RELEASE_COMMIT\" && exec bun run start"]
