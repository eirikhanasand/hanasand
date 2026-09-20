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

# Replace touch-as-mouse-drag with immediate swipe scrolling and tap clicks.
s = p.read_text()
start = s.index('    _touch(event) {')
end = s.index('\n    /**', start)
method = Path(__file__).with_name('touch-input.js').read_text().rstrip()
s = s[:start] + method + '\n' + s[end:]
s = s.replace("addListener(window, 'touchstart', this._touch, this)", "addListener(this.element, 'touchstart', this._touch, this)")
s = s.replace("            this.listeners_context.push(addListener(this.element, 'touchend', this._touch, this));", "            this.listeners_context.push(addListener(this.element, 'touchend', this._touch, this));\n            this.listeners_context.push(addListener(this.element, 'touchcancel', this._touch, this));")
s = s.replace('    _mouseButtonMovement(event) {', "    _mouseButtonMovement(event) {\n        if (event.sourceCapabilities?.firesTouchEvents || Date.now() < (this._suppressTouchMouseUntil || 0)) return;")
s = s.replace('    obj.addEventListener(name, newFunc);', "    obj.addEventListener(name, newFunc, name.startsWith('touch') ? { passive: false } : undefined);")
p.write_text(s)
