# SkyLog Sandbox — Isolated Linux environment for Claude agent execution
FROM debian:bookworm-slim

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install required tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    coreutils \
    ripgrep \
    grep \
    gawk \
    sed \
    curl \
    wget \
    jq \
    python3 \
    python3-pip \
    sudo \
    net-tools \
    dnsutils \
    less \
    file \
  && rm -rf /var/lib/apt/lists/*

# Create the 'agents' group (gid 2000) and /workspace directory
RUN groupadd -g 2000 agents \
  && mkdir -p /workspace \
  && chown root:agents /workspace \
  && chmod 775 /workspace

# Copy helper scripts
COPY scripts/create-agent-user.sh /usr/local/bin/create-agent-user
RUN chmod +x /usr/local/bin/create-agent-user

WORKDIR /workspace

# Keep container running — agent sessions are spawned via `docker exec`
CMD ["tail", "-f", "/dev/null"]