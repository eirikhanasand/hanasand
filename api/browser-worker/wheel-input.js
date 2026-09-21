    _mouseWheelWrapper(event) {
        event.preventDefault();
        event.stopPropagation();
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 240 : 1;
        const delta = event.deltaY * unit;
        if (!Number.isFinite(delta) || !delta) return;
        const now = Date.now();
        if (now - (this._wheelAt || 0) > 250 || Math.sign(delta) !== Math.sign(this._wheelRemainder || delta)) this._wheelRemainder = 0;
        this._wheelAt = now;
        this._wheelRemainder = (this._wheelRemainder || 0) + delta;
        const steps = Math.trunc(this._wheelRemainder / 100);
        if (!steps) return;
        this._wheelRemainder -= steps * 100;
        const mask = steps > 0 ? 8 : 16;
        const type = document.pointerLockElement ? 'm2' : 'm';
        this.send([type, this.x, this.y, this.buttonMask | mask, Math.min(Math.abs(steps), 3)].join(','));
        this.send([type, this.x, this.y, this.buttonMask, 0].join(','));
    }
