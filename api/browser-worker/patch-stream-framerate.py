from pathlib import Path

# The old player saved the server's 30 FPS default as a user preference.
# Give the new default a fresh key; subsequent explicit choices still persist.
p = Path('/opt/gst-web/app.js')
s = p.read_text()
for old, new in [
    ('app.getIntParam("videoFramerate", null)', 'app.getIntParam("videoFramerateV2", null)'),
    ('this.setIntParam("videoFramerate", newValue)', 'this.setIntParam("videoFramerateV2", newValue)'),
]:
    if s.count(old) != 1:
        raise RuntimeError('Selkies framerate preferences changed; review the migration')
    s = s.replace(old, new)
p.write_text(s)
