from pathlib import Path

p = Path('/usr/local/lib/python3.12/dist-packages/selkies_gstreamer/gstwebrtc_app.py')
s = p.read_text()
old = 'x264enc.set_property("sliced-threads", True)'
assert s.count(old) == 1, 'Review changed Selkies H.264 threading configuration'
# Encode a picture as one slice. With independently decodable slices, a receiver
# can display only part of a picture after packet loss and retain stale regions.
# Frame threading preserves throughput with a small encoding delay.
p.write_text(s.replace(old, 'x264enc.set_property("sliced-threads", False)'))

s = p.read_text()
old = 'self.congestion_control = congestion_control'
assert s.count(old) == 1, 'Review changed Selkies congestion control configuration'
# The pinned GCC/x264 path corrupts pictures when packet timing varies. Keep the
# bounded encoder bitrate and RTP retransmission path that passes the same loss
# test; other codecs retain their existing congestion-control configuration.
p.write_text(s.replace(old, "self.congestion_control = congestion_control and encoder != 'x264enc'"))
