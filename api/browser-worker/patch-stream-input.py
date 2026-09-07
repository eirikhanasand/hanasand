from pathlib import Path

# Touch-capable laptops still have a mouse/trackpad. Keep both input paths.
p = Path('/opt/gst-web/input.js')
s = p.read_text()
old = """        } else {
            this.listeners_context.push(addListener(this.element, 'mousemove', this._mouseButtonMovement, this));"""
new = """        }
        {
            this.listeners_context.push(addListener(this.element, 'mousemove', this._mouseButtonMovement, this));"""
if s.count(old) != 1:
    raise RuntimeError('Selkies input changed; review the hybrid pointer patch before building')
p.write_text(s.replace(old, new))
