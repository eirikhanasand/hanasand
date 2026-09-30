'use client'
import { Component, createRef, type ReactNode } from 'react'

type EventFeedProps = { children: ReactNode, rows: unknown[], fill?: boolean, onLoadMore?: () => void }
type EventFeedSnapshot = { top: number, height: number, appended: boolean }

// Keep the reader's position when new detections arrive above the event being read.
export default class EventFeed extends Component<EventFeedProps> {
    private viewport = createRef<HTMLDivElement>()
    private sentinel = createRef<HTMLDivElement>()
    private observer?: IntersectionObserver
    private sentinelNear = false
    private loadMorePending = false
    componentDidMount() { this.observeLoadMore() }
    getSnapshotBeforeUpdate(previous: Readonly<EventFeedProps>): EventFeedSnapshot | null {
        const node = this.viewport.current
        const appended = previous.rows.length > 0 && previous.rows.length < this.props.rows.length
            && previous.rows.every((row, index) => row === this.props.rows[index])
        if (!node || previous.rows === this.props.rows) return null
        if (appended) return { top: node.scrollTop, height: node.scrollHeight, appended: true }
        return node.scrollTop > 0 ? { top: node.scrollTop, height: node.scrollHeight, appended: false } : null
    }
    componentDidUpdate(previous: Readonly<EventFeedProps>, _state: unknown, snapshot: EventFeedSnapshot | null) {
        const node = this.viewport.current
        if (node && snapshot?.appended) {
            this.loadMorePending = false
        } else if (previous.onLoadMore === undefined && this.props.onLoadMore) {
            this.loadMorePending = false
        }
        if (node && snapshot && !snapshot.appended) node.scrollTop = snapshot.top + node.scrollHeight - snapshot.height
        this.observeLoadMore()
    }
    componentWillUnmount() { this.observer?.disconnect() }
    private onScroll = () => this.tryLoadMore()
    private tryLoadMore() {
        const node = this.viewport.current
        const loadMore = this.props.onLoadMore
        if (!node || !loadMore || !this.sentinelNear || this.loadMorePending) return
        this.loadMorePending = true
        loadMore()
    }
    private observeLoadMore() {
        this.observer?.disconnect()
        this.sentinelNear = false
        if (!this.props.onLoadMore || !this.viewport.current || !this.sentinel.current || typeof IntersectionObserver === 'undefined') return
        this.observer = new IntersectionObserver(entries => {
            this.sentinelNear = entries.some(entry => entry.isIntersecting)
            this.tryLoadMore()
        }, { root: this.viewport.current, rootMargin: '150px' })
        this.observer.observe(this.sentinel.current)
    }
    render() {
        return <div ref={this.viewport} onScroll={this.onScroll} data-logs-scroll style={{ overflowAnchor: 'none' }} className={`overflow-auto ${this.props.fill ? 'min-h-0 flex-1' : 'max-h-[70vh]'}`}>
            {this.props.children}
            {this.props.onLoadMore && <div ref={this.sentinel} aria-hidden className='h-px' data-logs-load-more />}
        </div>
    }
}
