#!/bin/bash
set -e
CHROMIUM_SRC="${1:-./chromium-src}"
PATCHES_DIR="$(dirname "$0")/../patches"

echo "Applying patches to $CHROMIUM_SRC..."
for patch in "$PATCHES_DIR"/*.patch; do
  echo "  Applying $(basename $patch)..."
  git -C "$CHROMIUM_SRC" apply "$patch"
done

# Copy FingerprintToolkit into Chromium source tree
PRIVACY_DIR="$CHROMIUM_SRC/third_party/blink/renderer/core/privacy"
mkdir -p "$PRIVACY_DIR"
cp "$(dirname "$0")/../chromium-patches/fingerprint_toolkit.h" "$PRIVACY_DIR/"
cp "$(dirname "$0")/../chromium-patches/fingerprint_toolkit.cc" "$PRIVACY_DIR/"

# Write BUILD.gn for FingerprintToolkit
cat > "$PRIVACY_DIR/BUILD.gn" << 'EOF'
source_set("fingerprint_toolkit") {
  sources = [
    "fingerprint_toolkit.cc",
    "fingerprint_toolkit.h",
  ]
  deps = [
    "//third_party/blink/renderer/platform/wtf",
  ]
}
EOF

# Add dep to blink core BUILD.gn
CORE_BUILD="$CHROMIUM_SRC/third_party/blink/renderer/core/BUILD.gn"
if ! grep -q "fingerprint_toolkit" "$CORE_BUILD"; then
  sed -i 's|"//third_party/blink/renderer/platform/wtf",|"//third_party/blink/renderer/platform/wtf",\n    "//third_party/blink/renderer/core/privacy:fingerprint_toolkit",|' "$CORE_BUILD"
fi

# Copy args.gn
mkdir -p "$CHROMIUM_SRC/out/Release"
cp "$(dirname "$0")/args.gn" "$CHROMIUM_SRC/out/Release/args.gn"

echo "All patches applied."
