import { readFileSync, writeFileSync } from 'node:fs'

const path = '/opt/gst-web/input.js'
let source = readFileSync(path, 'utf8')
const replaceOnce = (oldText: string, newText: string, message: string) => {
    if (source.split(oldText).length - 1 !== 1) throw new Error(message)
    source = source.replace(oldText, newText)
}

// Touch-capable laptops still have a mouse/trackpad. Keep both input paths.
replaceOnce(
    '        } else {\n            this.listeners_context.push(addListener(this.element, \'mousemove\', this._mouseButtonMovement, this));',
    '        }\n        {\n            this.listeners_context.push(addListener(this.element, \'mousemove\', this._mouseButtonMovement, this));',
    'Selkies input changed; review the hybrid pointer patch before building',
)

// Replace touch-as-mouse-drag with immediate swipe scrolling and tap clicks.
const methodStart = source.indexOf('    _touch(event) {')
const methodEnd = source.indexOf('\n    /**', methodStart)
if (methodStart < 0 || methodEnd < 0) throw new Error('Selkies touch handler changed')
source = source.slice(0, methodStart) + readFileSync('/tmp/touch-input.js', 'utf8').trimEnd() + '\n' + source.slice(methodEnd)
source = source.replace('addListener(window, \'touchstart\', this._touch, this)', 'addListener(this.element, \'touchstart\', this._touch, this)')
source = source.replace(
    '            this.listeners_context.push(addListener(this.element, \'touchend\', this._touch, this));',
    '            this.listeners_context.push(addListener(this.element, \'touchend\', this._touch, this));\n            this.listeners_context.push(addListener(this.element, \'touchcancel\', this._touch, this));',
)
source = source.replace(
    '    _mouseButtonMovement(event) {',
    '    _mouseButtonMovement(event) {\n        if (event.sourceCapabilities?.firesTouchEvents || Date.now() < (this._suppressTouchMouseUntil || 0)) return;',
)
source = source.replace(
    '    obj.addEventListener(name, newFunc);',
    '    obj.addEventListener(name, newFunc, name.startsWith(\'touch\') ? { passive: false } : undefined);',
)
writeFileSync(path, source)
