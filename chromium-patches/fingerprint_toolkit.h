#ifndef THIRD_PARTY_BLINK_RENDERER_CORE_PRIVACY_FINGERPRINT_TOOLKIT_H_
#define THIRD_PARTY_BLINK_RENDERER_CORE_PRIVACY_FINGERPRINT_TOOLKIT_H_

#include <stddef.h>
#include <stdint.h>
#include "third_party/blink/renderer/platform/wtf/text/wtf_string.h"
#include "third_party/blink/renderer/platform/wtf/vector.h"

namespace blink {

struct FingerprintConfig {
  String timezone;    // e.g. "America/New_York"
  String language;    // e.g. "en-US"
  String platform;    // e.g. "Win32"
  double latitude;
  double longitude;
};

class FingerprintToolkit {
 public:
  explicit FingerprintToolkit(uint64_t seed, const FingerprintConfig& config);

  // Canvas / WebGL image data: add ±1 noise per channel
  void PerturbImageData(uint8_t* data, size_t length);

  // AudioContext buffer: add tiny noise
  void PerturbAudioBuffer(float* data, size_t length);

  // ClientRects: perturb coordinate by ±0.1px
  double PerturbRect(double value);

  // WebGL vendor/renderer spoofing
  String SpoofWebGLVendor();
  String SpoofWebGLRenderer();

  // Navigator
  int SpoofHardwareConcurrency();
  const String& GetPlatform() const { return config_.platform; }
  const String& GetLanguage() const { return config_.language; }
  const String& GetTimezone() const { return config_.timezone; }

  // Font allowlist filter
  Vector<String> FilterFonts(const Vector<String>& system_fonts);

 private:
  uint64_t Next();

  uint64_t state_;
  FingerprintConfig config_;

  static const char* kWebGLVendors[];
  static const char* kWebGLRenderers[];
  static const char* kAllowedFonts[];
};

}  // namespace blink

#endif  // THIRD_PARTY_BLINK_RENDERER_CORE_PRIVACY_FINGERPRINT_TOOLKIT_H_
