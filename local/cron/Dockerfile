FROM alpine:3.20

# Install curl for making HTTP requests and ca-certificates for HTTPS
RUN apk add --no-cache curl ca-certificates

# Install supercronic (lightweight cron for containers)
ARG SUPERCRONIC_VERSION=v0.2.33
ARG SUPERCRONIC_SHA256=feefa310da569c81b99e1027b86b27b51e6ee9ab647747b49099645120cfc671
RUN curl -fsSL "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-amd64" \
    -o /usr/local/bin/supercronic \
    && echo "${SUPERCRONIC_SHA256}  /usr/local/bin/supercronic" | sha256sum -c - \
    && chmod +x /usr/local/bin/supercronic

# Create app directory
WORKDIR /app

# Copy cron scripts
COPY crontab /app/crontab
COPY run-cron.sh /app/run-cron.sh

RUN chmod +x /app/run-cron.sh

# Run supercronic with the crontab
CMD ["/usr/local/bin/supercronic", "/app/crontab"]
