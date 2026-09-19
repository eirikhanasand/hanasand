'use client'
import { Component, createRef, type ReactNode } from 'react'

// Keep the reader's position when new detections arrive above the event being read.
export default class EventFeed extends Component<{ children: ReactNode, rows: unknown[] }> {
    private viewport = createRef<HTMLDivElement>()
    getSnapshotBeforeUpdate(previous: Readonly<{ rows: unknown[] }>) {
        const node = this.viewport.current
        return node && previous.rows !== this.props.rows && node.scrollTop > 0 ? { top: node.scrollTop, height: node.scrollHeight } : null
    }
    componentDidUpdate(_previous: unknown, _state: unknown, snapshot: { top: number, height: number } | null) {
        const node = this.viewport.current
        if (node && snapshot) node.scrollTop = snapshot.top + node.scrollHeight - snapshot.height
    }
    render() {
        return <div ref={this.viewport} data-logs-scroll style={{ overflowAnchor: 'none' }} className='max-h-[70vh] overflow-auto'>{this.props.children}</div>
    }
}
