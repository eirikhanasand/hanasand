'use client'
import { Component, createRef, type ReactNode } from 'react'

// Keep the reader's position when new detections arrive above the event being read.
export default class EventFeed extends Component<{ children: ReactNode, rows: unknown[], fill?: boolean, onLoadMore?: () => void }> {
    private viewport = createRef<HTMLDivElement>()
    private sentinel = createRef<HTMLDivElement>()
    private observer?: IntersectionObserver
    componentDidMount() { this.observeLoadMore() }
    getSnapshotBeforeUpdate(previous: Readonly<{ rows: unknown[] }>) {
        const node = this.viewport.current
        const appended = previous.rows.length > 0 && previous.rows.length < this.props.rows.length
            && previous.rows.every((row, index) => row === this.props.rows[index])
        return node && previous.rows !== this.props.rows && !appended && node.scrollTop > 0
            ? { top: node.scrollTop, height: node.scrollHeight } : null
    }
    componentDidUpdate(_previous: unknown, _state: unknown, snapshot: { top: number, height: number } | null) {
        const node = this.viewport.current
        if (node && snapshot) node.scrollTop = snapshot.top + node.scrollHeight - snapshot.height
        this.observeLoadMore()
    }
    componentWillUnmount() { this.observer?.disconnect() }
    private observeLoadMore() {
        this.observer?.disconnect()
        if (!this.props.onLoadMore || !this.viewport.current || !this.sentinel.current || typeof IntersectionObserver === 'undefined') return
        this.observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) this.props.onLoadMore?.()
        }, { root: this.viewport.current, rootMargin: '150px' })
        this.observer.observe(this.sentinel.current)
    }
    render() {
        return <div ref={this.viewport} data-logs-scroll style={{ overflowAnchor: 'none' }} className={`overflow-auto ${this.props.fill ? 'min-h-0 flex-1' : 'max-h-[70vh]'}`}>
            {this.props.children}
            {this.props.onLoadMore && <div ref={this.sentinel} aria-hidden className='h-px' data-logs-load-more />}
        </div>
    }
}
