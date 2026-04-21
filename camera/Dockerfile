FROM debian:bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ustreamer ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
