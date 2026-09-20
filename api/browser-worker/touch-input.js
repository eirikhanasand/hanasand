    _touch(event) {
        // A finger swipe is scrolling, not a held mouse button. Send over the
        // existing data channel immediately; never wait for page analysis.
        this._suppressTouchMouseUntil = Date.now() + 800;
        if (event.cancelable) event.preventDefault();
        if (event.type === 'touchcancel' || event.touches.length > 1) {
            this._touchGesture = null;
            return;
        }
        const touch = Array.from(event.changedTouches).find(t =>
            !this._touchGesture || t.identifier === this._touchGesture.id);
        if (!touch) return;
        if (event.type === 'touchstart') {
            this._windowMath();
            this._touchGesture = { id: touch.identifier, startX: touch.clientX,
                startY: touch.clientY, lastY: touch.clientY, remainder: 0, moved: false };
            return;
        }
        const gesture = this._touchGesture;
        if (!gesture) return;
        this.x = this._clientToServerX(touch.clientX);
        this.y = this._clientToServerY(touch.clientY);
        gesture.moved ||= Math.hypot(touch.clientX - gesture.startX, touch.clientY - gesture.startY) > 6;
        if (event.type === 'touchmove' && gesture.moved) {
            gesture.remainder += gesture.lastY - touch.clientY;
            gesture.lastY = touch.clientY;
            // X11 wheel notches: retain small movements without queuing events.
            const steps = Math.trunc(gesture.remainder / 12);
            if (steps) {
                gesture.remainder -= steps * 12;
                const mask = steps > 0 ? 8 : 16;
                this.send(['m', this.x, this.y, this.buttonMask | mask, Math.min(Math.abs(steps), 10)].join(','));
                this.send(['m', this.x, this.y, this.buttonMask, 0].join(','));
            }
        }
        if (event.type === 'touchend') {
            if (!gesture.moved) {
                this.send(['m', this.x, this.y, this.buttonMask | 1, 0].join(','));
                this.send(['m', this.x, this.y, this.buttonMask, 0].join(','));
            }
            this._touchGesture = null;
        }
    }
