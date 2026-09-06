import { reshape, type TableData } from './workspace'

// Only arrow-created edges are provisional; existing empty rows and columns are never removed.
export type PendingTable = { data: TableData, row?: number, col?: number }

export function navigateTable(pending: PendingTable, target: { row: number, col: number }, extend = false) {
    let { data, row, col } = pending
    const cell = { ...target }
    if (row !== undefined && cell.row !== row) {
        data = reshape(data, 'row', row, true)
        if (cell.row > row) cell.row--
        row = undefined
    }
    if (col !== undefined && cell.col !== col) {
        data = reshape(data, 'column', col, true)
        if (cell.col > col) cell.col--
        col = undefined
    }
    if (extend && (cell.row < 0 || cell.row >= data.cells.length)) {
        row = cell.row < 0 ? 0 : data.cells.length
        data = reshape(data, 'row', row, false)
        cell.row = row
    }
    if (extend && (cell.col < 0 || cell.col >= data.cells[0].length)) {
        col = cell.col < 0 ? 0 : data.cells[0].length
        data = reshape(data, 'column', col, false)
        cell.col = col
    }
    return { data, row, col, cell }
}
