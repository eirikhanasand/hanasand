from pathlib import Path

# A zero target every 15 ms prevents the receiver adapting to delayed/reordered
# cellular packets. Keep browser-managed jitter buffering for both synced tracks.
p = Path('/opt/gst-web/app.js')
s = p.read_text()
for connected in ('videoConnected', 'audioConnected'):
    start = s.index(f'    if ({connected} === "connected") {{\n        // Repeatedly emit minimum latency target')
    end = s.index('    if (', s.index('        });\n    }', start) + len('        });\n    }'))
    s = s[:start] + s[end:]
p.write_text(s)

# The sender also caps receiver playout at zero in an RTP extension. Removing
# just the JavaScript hints would leave this second override in effect.
p = Path('/usr/local/lib/python3.12/dist-packages/selkies_gstreamer/gstwebrtc_app.py')
s = p.read_text()
old = '''        if not audio:
            rtp_uri_list += ["http://www.webrtc.org/experiments/rtp-hdrext/playout-delay"]
'''
assert s.count(old) == 1, 'Review changed Selkies RTP playout configuration'
p.write_text(s.replace(old, ''))

# Cancel even wheel events that the trackpad throttle does not forward.
p = Path('/opt/gst-web/input.js')
s = p.read_text()
old = '    _mouseWheelWrapper(event) {'
assert s.count(old) == 1, 'Review changed Selkies wheel handler'
s = s.replace(old, old + '\n        event.preventDefault();\n        event.stopPropagation();')
old = "name.startsWith('touch') ? { passive: false } : undefined"
assert s.count(old) == 1, 'Review changed Selkies input listener options'
s = s.replace(old, "(name.startsWith('touch') || name === 'wheel') ? { passive: false } : undefined")
p.write_text(s)
