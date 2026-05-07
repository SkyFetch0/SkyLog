#!/usr/bin/env bash
# create-agent-user.sh — Provision an isolated Linux user for a SkyLog agent
#
# Usage: create-agent-user <agent_id> <session_id>
#
# Example: create-agent-user a1b2c3 sess_xyz
#
# What it does:
#   1. Creates a system user  agent_<agent_id>  in the 'agents' group
#   2. Creates a private workspace directory under /workspace/sessions/<session_id>/agents/<agent_id>
#   3. Grants that user ownership and rwx access to their own directory only

set -euo pipefail

# ── argument validation ────────────────────────────────────────────────────────
if [[ $# -lt 2 ]]; then
  echo "Usage: create-agent-user <agent_id> <session_id>" >&2
  exit 1
fi

AGENT_ID="$1"
SESSION_ID="$2"
USERNAME="agent_${AGENT_ID}"
WORKDIR="/workspace/sessions/${SESSION_ID}/agents/${AGENT_ID}"

# ── guard: skip if user already exists ────────────────────────────────────────
if id "$USERNAME" &>/dev/null; then
  echo "[create-agent-user] User '$USERNAME' already exists — skipping useradd." >&2
else
  useradd \
    --create-home \
    --gid agents \
    --shell /bin/bash \
    --comment "SkyLog agent ${AGENT_ID}" \
    "$USERNAME"
  echo "[create-agent-user] Created user: $USERNAME"
fi

# ── create per-agent workspace ─────────────────────────────────────────────────
mkdir -p "$WORKDIR"
chown -R "${USERNAME}:agents" "$WORKDIR"
chmod 750 "$WORKDIR"

echo "[create-agent-user] Workspace ready: $WORKDIR (owner: ${USERNAME}:agents, mode: 750)"