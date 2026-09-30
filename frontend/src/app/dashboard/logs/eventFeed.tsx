'use client'
import { Component, createRef, type ReactNode } from 'react'

// Keep the reader's position when new detections arrive above the event being read.
export default class EventFeed extends Component<{ children: ReactNode, rows: unknown[], fill?: boolean, onLoadMore?: () => void }> {
    private viewport = createRef<HTMLDivElement>()
    private sentinel = createRef<HTMLDivElement>()
    private observer?: IntersectionObserver
    componentDidMount() { this.observeLoadMore(); this.maybeLoadMore() }
    getSnapshotBeforeUpdate(previous: Readonly<{ rows: unknown[] }>) {
        const node = this.viewport.current
        return node && previous.rows !== this.props.rows && node.scrollTop > 0 ? { top: node.scrollTop, height: node.scrollHeight } : null
    }
    componentDidUpdate(_previous: unknown, _state: unknown, snapshot: { top: number, height: number } | null) {
        const node = this.viewport.current
        if (node && snapshot) node.scrollTop = snapshot.top + node.scrollHeight - snapshot.height
        this.observeLoadMore()
        this.maybeLoadMore()
    }
    componentWillUnmount() { this.observer?.disconnect() }
    private observeLoadMore() {
        this.observer?.disconnect()
        if (!this.props.onLoadMore || !this.viewport.current || !this.sentinel.current || typeof IntersectionObserver === 'undefined') return
        this.observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) this.props.onLoadMore?.()
        }, { root: this.viewport.current, rootMargin: '160px 0px' })
        this.observer.observe(this.sentinel.current)
    }
    private maybeLoadMore = () => {
        const node = this.viewport.current
        if (node && node.scrollHeight - node.scrollTop - node.clientHeight <= 160) this.props.onLoadMore?.()
    }
    render() {
        return <div ref={this.viewport} onScroll={this.maybeLoadMore} data-logs-scroll style={{ overflowAnchor: 'none' }} className={`overflow-auto ${this.props.fill ? 'min-h-0 flex-1' : 'max-h-[70vh]'}`}>
            {this.props.children}
            {this.props.onLoadMore && <div ref={this.sentinel} aria-hidden className='h-px' data-logs-load-more />}
        </div>
    }
}
