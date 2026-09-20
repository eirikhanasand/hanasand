from pathlib import Path

p = Path('/usr/local/lib/python3.12/dist-packages/selkies_gstreamer/gstwebrtc_app.py')
s = p.read_text()
old = 'h264enc_caps.set_value("profile", "main")'
assert s.count(old) == 1, 'Review changed Selkies H.264 profile configuration'
# Match the WebRTC baseline decoder contract instead of sending Main as Baseline.
s = s.replace(old, 'h264enc_caps.set_value("profile", "constrained-baseline")')
start = s.index('        # Firefox needs profile-level-id=42e01f')
end = s.index("            if 'level-asymmetry-allowed' not in sdp_text:", start)
assert 're.sub' in s[start:end], 'Review changed Selkies SDP configuration'
# Preserve the profile AND level generated from the actual stream. In particular,
# 1080p60 must not be advertised as level 3.1 (42e01f).
s = s[:start] + '''        # Keep GStreamer's actual H.264 profile-level-id in the offer.
        if "h264" in self.encoder or "x264" in self.encoder:
''' + s[end:]
p.write_text(s)
