#include "third_party/blink/renderer/core/privacy/fingerprint_toolkit.h"
#include <cmath>
#include <cstring>

namespace blink {

// Real GPU strings pool for spoofing
const char* FingerprintToolkit::kWebGLVendors[] = {
    "Google Inc. (NVIDIA)", "Google Inc. (Intel)", "Google Inc. (AMD)",
    "Google Inc.", nullptr};
const char* FingerprintToolkit::kWebGLRenderers[] = {
    "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)",
    "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)",
    "ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)",
    "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0)",
    nullptr};
const char* FingerprintToolkit::kAllowedFonts[] = {
    "Arial", "Times New Roman", "Courier New", "Georgia", "Verdana",
    "Helvetica", "Tahoma", "Trebuchet MS", nullptr};

FingerprintToolkit::FingerprintToolkit(uint64_t seed,
                                       const FingerprintConfig& config)
    : state_(seed), config_(config) {}

// xorshift64 PRNG
uint64_t FingerprintToolkit::Next() {
  state_ ^= state_ << 13;
  state_ ^= state_ >> 7;
  state_ ^= state_ << 17;
  return state_;
}

void FingerprintToolkit::PerturbImageData(uint8_t* data, size_t length) {
  for (size_t i = 0; i < length; i += 4) {
    uint64_t r = Next();
    // ±1 noise on R, G, B; leave alpha unchanged
    for (int c = 0; c < 3; ++c) {
      int v = data[i + c] + (int)((r >> (c * 8)) & 1) * 2 - 1;
      data[i + c] = (uint8_t)(v < 0 ? 0 : v > 255 ? 255 : v);
    }
  }
}

void FingerprintToolkit::PerturbAudioBuffer(float* data, size_t length) {
  for (size_t i = 0; i < length; ++i) {
    double noise = ((double)(Next() & 0xFFFF) / 0xFFFF - 0.5) * 1e-7;
    data[i] += (float)noise;
  }
}

double FingerprintToolkit::PerturbRect(double value) {
  double noise = ((double)(Next() & 0xFF) / 0xFF - 0.5) * 0.2;
  return value + noise;
}

String FingerprintToolkit::SpoofWebGLVendor() {
  int count = 0;
  while (kWebGLVendors[count]) ++count;
  return String(kWebGLVendors[Next() % count]);
}

String FingerprintToolkit::SpoofWebGLRenderer() {
  int count = 0;
  while (kWebGLRenderers[count]) ++count;
  return String(kWebGLRenderers[Next() % count]);
}

int FingerprintToolkit::SpoofHardwareConcurrency() {
  static const int kValues[] = {2, 4, 4, 8, 8, 16};
  return kValues[Next() % 6];
}

Vector<String> FingerprintToolkit::FilterFonts(
    const Vector<String>& system_fonts) {
  Vector<String> result;
  for (const auto& font : system_fonts) {
    for (int i = 0; kAllowedFonts[i]; ++i) {
      if (font == kAllowedFonts[i]) {
        result.push_back(font);
        break;
      }
    }
  }
  return result;
}

}  // namespace blink
