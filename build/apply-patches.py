#!/usr/bin/env python3
"""
Apply FingerprintToolkit modifications to Chromium source.
Run after gclient sync: python3 apply-patches.py <chromium_src>
"""
import sys, os, re, shutil

SRC = sys.argv[1] if len(sys.argv) > 1 else "chromium-src"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)

def read(path):
    with open(path, encoding="utf-8") as f: return f.read()

def write(path, content):
    with open(path, "w", encoding="utf-8") as f: f.write(content)

def patch_file(rel_path, search, replacement, description):
    path = os.path.join(SRC, rel_path)
    if not os.path.exists(path):
        print(f"  SKIP (not found): {rel_path}")
        return
    content = read(path)
    if search not in content:
        print(f"  SKIP (already patched or changed): {rel_path}")
        return
    write(path, content.replace(search, replacement, 1))
    print(f"  OK: {description}")

print("=== Copying FingerprintToolkit ===")
privacy_dir = os.path.join(SRC, "third_party/blink/renderer/core/privacy")
os.makedirs(privacy_dir, exist_ok=True)
for f in ["fingerprint_toolkit.h", "fingerprint_toolkit.cc"]:
    shutil.copy(os.path.join(REPO_ROOT, "chromium-patches", f), privacy_dir)
    print(f"  Copied {f}")

print("\n=== Patching LocalFrame ===")
patch_file(
    "third_party/blink/renderer/core/frame/local_frame.h",
    "class LocalFrame final",
    '#include "third_party/blink/renderer/core/privacy/fingerprint_toolkit.h"\n\nclass LocalFrame final',
    "Add FingerprintToolkit include"
)
patch_file(
    "third_party/blink/renderer/core/frame/local_frame.h",
    " private:",
    ' private:\n  std::unique_ptr<FingerprintToolkit> fingerprint_toolkit_;\n public:\n  FingerprintToolkit* GetFingerprintToolkit() { return fingerprint_toolkit_.get(); }\n  void SetFingerprintToolkit(std::unique_ptr<FingerprintToolkit> tk) { fingerprint_toolkit_ = std::move(tk); }\n private:',
    "Add fingerprint_toolkit_ member + accessors"
)

patch_file(
    "third_party/blink/renderer/core/frame/local_frame.cc",
    "void LocalFrame::Init(",
    'void LocalFrame::Init(',
    ""  # anchor only, handled below
)
local_frame_cc = os.path.join(SRC, "third_party/blink/renderer/core/frame/local_frame.cc")
if os.path.exists(local_frame_cc):
    content = read(local_frame_cc)
    inject = (
        '#include "base/command_line.h"\n'
        '#include "base/rand_util.h"\n'
    )
    if inject not in content:
        content = inject + content
    init_inject = (
        '  {\n'
        '    auto* cmd = base::CommandLine::ForCurrentProcess();\n'
        '    FingerprintConfig cfg;\n'
        '    cfg.timezone = String(cmd->GetSwitchValueASCII("fingerprint-timezone").c_str());\n'
        '    cfg.language = String(cmd->GetSwitchValueASCII("fingerprint-language").c_str());\n'
        '    cfg.platform = String(cmd->GetSwitchValueASCII("fingerprint-platform").c_str());\n'
        '    uint64_t seed = base::RandUint64();\n'
        '    const std::string s = cmd->GetSwitchValueASCII("fingerprint-seed");\n'
        '    if (!s.empty()) seed = std::stoull(s);\n'
        '    SetFingerprintToolkit(std::make_unique<FingerprintToolkit>(seed, cfg));\n'
        '  }\n'
    )
    content = re.sub(
        r'(void LocalFrame::Init\([^)]*\)\s*\{)',
        r'\1\n' + init_inject,
        content, count=1
    )
    write(local_frame_cc, content)
    print("  OK: LocalFrame::Init toolkit injection")

print("\n=== Patching Canvas ===")
patch_file(
    "third_party/blink/renderer/modules/canvas/canvas2d/canvas_rendering_context_2d.cc",
    "return image_data;",
    'if (auto* tk = GetDocument().GetFrame() ? static_cast<LocalFrame*>(GetDocument().GetFrame())->GetFingerprintToolkit() : nullptr)\n    tk->PerturbImageData(image_data->data()->Data(), image_data->data()->length());\n  return image_data;',
    "Canvas getImageData noise"
)

print("\n=== Patching WebGL ===")
patch_file(
    "third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc",
    "case GL_VENDOR:",
    'if (auto* tk = canvas()->GetDocument().GetFrame() ? static_cast<LocalFrame*>(canvas()->GetDocument().GetFrame())->GetFingerprintToolkit() : nullptr) {\n    if (pname == GL_VENDOR || pname == 0x9245u) return WebGLAny(script_state, tk->SpoofWebGLVendor());\n    if (pname == GL_RENDERER || pname == 0x9246u) return WebGLAny(script_state, tk->SpoofWebGLRenderer());\n  }\n  case GL_VENDOR:',
    "WebGL vendor/renderer spoof"
)

print("\n=== Patching AudioContext ===")
patch_file(
    "third_party/blink/renderer/modules/webaudio/audio_buffer.cc",
    "return channel_data;",
    'if (auto* frame = GetExecutionContext() ? GetExecutionContext()->GetFrame() : nullptr)\n    if (auto* tk = static_cast<LocalFrame*>(frame)->GetFingerprintToolkit())\n      tk->PerturbAudioBuffer(channel_data->Data(), channel_data->length());\n  return channel_data;',
    "AudioContext buffer noise"
)

print("\n=== Patching Navigator ===")
patch_file(
    "third_party/blink/renderer/core/frame/navigator.cc",
    "return GetFrame()->GetSettings()->GetWebDriverEnabled();",
    "return false;",
    "navigator.webdriver = false"
)
patch_file(
    "third_party/blink/renderer/core/frame/navigator.cc",
    "return do_not_track_;",
    'return "1";',
    "doNotTrack = 1"
)

print("\n=== Patching WebRTC ===")
patch_file(
    "third_party/webrtc/p2p/base/port.cc",
    "void Port::AddAddress(",
    "void Port::AddAddress(",  # will be handled below
    ""
)
# WebRTC: filter private IPs in AddAddress
webrtc_path = os.path.join(SRC, "third_party/webrtc/p2p/base/port.cc")
if os.path.exists(webrtc_path):
    content = read(webrtc_path)
    # Find AddAddress and insert IP filter at top of function body
    content = re.sub(
        r'(void Port::AddAddress\([^)]+\)\s*\{)',
        r'\1\n  if (address.IsLoopbackIP() || address.IsPrivateIP()) return;',
        content, count=1
    )
    write(webrtc_path, content)
    print("  OK: WebRTC local IP filter")

print("\n=== Patching Widget (no-window) ===")
patch_file(
    "ui/views/widget/widget.cc",
    "void Widget::Show() {",
    'void Widget::Show() {\n  if (base::CommandLine::ForCurrentProcess()->HasSwitch("no-window")) return;',
    "Widget::Show no-window flag"
)

print("\n=== Writing BUILD.gn ===")
build_gn = os.path.join(privacy_dir, "BUILD.gn")
write(build_gn, '''source_set("fingerprint_toolkit") {
  sources = [ "fingerprint_toolkit.cc", "fingerprint_toolkit.h" ]
  deps = [ "//third_party/blink/renderer/platform/wtf" ]
}
''')
print("  Written privacy/BUILD.gn")

print("\n=== Copying args.gn ===")
out_dir = os.path.join(SRC, "out/Release")
os.makedirs(out_dir, exist_ok=True)
shutil.copy(os.path.join(SCRIPT_DIR, "args.gn"), out_dir)
print("  Copied args.gn")

print("\n=== Done ===")
