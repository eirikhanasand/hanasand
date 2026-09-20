"""Exercise the installed encoder and recovery after a missing reference frame.

Run with the image's gst-env loaded; no display, browser or network is used.
"""
import asyncio
import hashlib
import time

from selkies_gstreamer.gstwebrtc_app import GSTWebRTCApp, Gst

app = GSTWebRTCApp(asyncio.new_event_loop(), encoder='x264enc', framerate=60,
                   keyframe_distance=1, video_bitrate=4000)
app.pipeline = Gst.Pipeline.new('installed-settings')
app.build_webrtcbin_pipeline()
app.build_video_pipeline()
encoder = app.pipeline.get_by_name('x264enc')
capsfilter = encoder.get_static_pad('src').get_peer().get_parent_element()
assert encoder.get_property('key-int-max') == 60
assert encoder.get_property('bframes') == 0
assert encoder.get_property('rc-lookahead') == 0
assert capsfilter.get_property('caps').get_structure(0).get_string('profile') == 'constrained-baseline'

# Reuse the actual installed encoder, not a second copy of its configuration.
encoder.get_static_pad('sink').get_peer().unlink(encoder.get_static_pad('sink'))
capsfilter.get_static_pad('src').unlink(capsfilter.get_static_pad('src').get_peer())
app.pipeline.remove(encoder)
app.pipeline.remove(capsfilter)
pipeline = Gst.parse_launch('videotestsrc num-buffers=180 pattern=ball ! '
                           'video/x-raw,format=NV12,width=1920,height=1080,framerate=60/1 ! '
                           'identity name=input')
sink = Gst.ElementFactory.make('appsink', 'output')
sink.set_property('sync', False)
for element in (encoder, capsfilter, sink):
    pipeline.add(element)
assert pipeline.get_by_name('input').link(encoder)
assert encoder.link(capsfilter)
assert capsfilter.link(sink)


def collect(pipeline, sink):
    result = []
    pipeline.set_state(Gst.State.PLAYING)
    try:
        while True:
            sample = sink.emit('try-pull-sample', 10 * Gst.SECOND)
            if sample:
                result.append((sample.get_buffer().copy_deep(), sample.get_caps().copy()))
            elif sink.get_property('eos'):
                return result
            else:
                error = pipeline.get_bus().pop_filtered(Gst.MessageType.ERROR)
                raise RuntimeError(error.parse_error() if error else 'Video pipeline timed out')
    finally:
        pipeline.set_state(Gst.State.NULL)


started = time.monotonic()
encoded = collect(pipeline, sink)
elapsed = time.monotonic() - started
assert len(encoded) == 180, len(encoded)
keys = [i for i, (buffer, _) in enumerate(encoded) if not buffer.has_flags(Gst.BufferFlags.DELTA_UNIT)]
assert keys == [0, 60, 120], keys
assert encoded[0][1].get_structure(0).get_string('profile') == 'constrained-baseline'
assert encoded[0][1].get_structure(0).get_string('level') == '4.2'


def decode(drop):
    pipeline = Gst.parse_launch('appsrc name=source format=time ! openh264dec ! '
                               'video/x-raw,format=I420 ! appsink name=decoded sync=false')
    source = pipeline.get_by_name('source')
    source.set_property('caps', encoded[0][1])
    for i, (buffer, _) in enumerate(encoded):
        if i != drop:
            assert source.emit('push-buffer', buffer.copy_deep()) == Gst.FlowReturn.OK
    source.emit('end-of-stream')
    return {buffer.pts: hashlib.sha256(buffer.extract_dup(0, buffer.get_size())).digest()
            for buffer, _ in collect(pipeline, pipeline.get_by_name('decoded'))}


complete = decode(None)
damaged = decode(30)
recovery_pts = encoded[60][0].pts
assert len(complete) == 180
assert any(damaged.get(pts) != digest for pts, digest in complete.items() if encoded[30][0].pts < pts < recovery_pts), 'Loss simulation must affect subsequent frames'
assert all(damaged.get(pts) == digest for pts, digest in complete.items() if pts >= recovery_pts), 'Next IDR must fully restore the decoded picture'
print(f'H.264: 1080p60 constrained-baseline level 4.2; IDRs {keys}; '
      f'recovered exactly after reference loss; encoder {180 / elapsed:.1f} FPS')
