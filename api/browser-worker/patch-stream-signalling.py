from pathlib import Path

p = Path('/usr/local/lib/python3.12/dist-packages/selkies_gstreamer/gstwebrtc_app.py')
s = p.read_text()
# GStreamer invokes these callbacks from its own threads. The signalling socket
# belongs to the main asyncio loop; separate loops can interleave socket writes.
for callback in ("self.on_sdp('offer', sdp_text)", 'self.on_ice(mlineindex, candidate)'):
    old = f'asyncio.run({callback})'
    assert s.count(old) == 1, 'Review changed Selkies signalling callbacks'
    s = s.replace(old, f'asyncio.run_coroutine_threadsafe({callback}, self.async_event_loop)')
p.write_text(s)
