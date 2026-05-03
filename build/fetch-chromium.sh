#!/bin/bash
set -e

# Minimal Chromium fetch: Windows + Linux only, no test data, no toolchain
# Usage: bash fetch-chromium.sh [target_dir]

DIR="${1:-chromium-src}"
PROXY="${HTTPS_PROXY:-}"

echo "=== Fetching Chromium (minimal) to $DIR ==="

# 1. Install depot_tools if not present
if ! command -v gclient &>/dev/null; then
  git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
  export PATH="$PWD/depot_tools:$PATH"
fi

mkdir -p "$DIR" && cd "$DIR"

# 2. Copy .gclient config
cp "$(dirname "$0")/.gclient" .

# 3. Fetch source (no history = shallow clone, saves ~10GB)
gclient sync \
  --no-history \
  --nohooks \
  --with_branch_heads \
  -D

# 4. Skip downloading prebuilt toolchain (use system clang)
export DEPOT_TOOLS_WIN_TOOLCHAIN=0

echo "=== Fetch complete. Run hooks manually if needed ==="
echo "Next: bash apply-patches.sh $PWD"
