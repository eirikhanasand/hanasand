import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import pg from 'pg'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('self-ingestion cleanup preserves referenced proof and restores protected sources', async () => {
    const client = new pg.Client({host:'127.0.0.1',port:Number(process.env.POSTGRES_FILTER_TEST_PORT),user:'postgres',database:'postgres_filter_test'})
    await client.connect()
    try {
        await client.query('BEGIN')
        await client.query('CREATE TEMP TABLE service_logs(id bigint PRIMARY KEY); CREATE TEMP TABLE log_proxy_requests(connection_id uuid PRIMARY KEY, service_log_id bigint REFERENCES service_logs(id) ON DELETE CASCADE, connection jsonb, access jsonb); CREATE TEMP TABLE log_proxy_receipts(connection_id uuid)')
        for(let id=1;id<=4;id++) {
            await client.query('INSERT INTO service_logs VALUES($1)',[id])
            await client.query('INSERT INTO log_proxy_requests VALUES($1,$2,$3,$4)',[`00000000-0000-4000-8000-${String(id).padStart(12,'0')}`,id,{}, {method:id===4?'GET':'POST',status:201,path:'/api/logs/ingest',ip:'128.39.142.218'}])
        }
        await client.query('INSERT INTO log_proxy_receipts SELECT connection_id FROM log_proxy_requests WHERE service_log_id=3')
        const source=readFileSync(new URL('../scripts/drop-self-ingestion-responses.ts',import.meta.url),'utf8')
        const remove=source.match(/`(DELETE FROM log_proxy_requests p[\s\S]*?RETURNING p\.\*)`/)![1]
        const restore=source.match(/`(INSERT INTO log_proxy_requests\(connection_id[\s\S]*?JOIN service_logs s ON s.id=p.service_log_id)`/)![1]
        const unused=(await client.query(remove,[[1,2,3,4]])).rows
        expect(unused.map(row=>Number(row.service_log_id)).sort()).toEqual([1,2])
        // Source 1 passed all replay checks; source 2 was protected and survives.
        await client.query('DELETE FROM service_logs WHERE id=1')
        await client.query(restore,[JSON.stringify(unused)])
        expect((await client.query('SELECT service_log_id FROM log_proxy_requests ORDER BY service_log_id')).rows.map(row=>Number(row.service_log_id))).toEqual([2,3,4])
    } finally { await client.query('ROLLBACK'); await client.end() }
})

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('bulk replay reporting cleanup preserves exact counts and organization boundaries', async () => {
    const client = new pg.Client({host:'127.0.0.1',port:Number(process.env.POSTGRES_FILTER_TEST_PORT),user:'postgres',database:'postgres_filter_test'})
    await client.connect()
    try {
        await client.query('BEGIN')
        const namespace=`cleanup_counts_${process.pid}`
        await client.query(`CREATE SCHEMA ${namespace}; SET LOCAL search_path TO ${namespace}`)
        await client.query('CREATE TABLE mill_events(id text PRIMARY KEY,organization_id text); CREATE TABLE mill_log_dimensions(event_id text PRIMARY KEY REFERENCES mill_events(id) ON DELETE CASCADE,organization_id text,event_timestamp timestamptz,severity text,service text,log_type text)')
        const {logCountsSchema}=await import('../src/utils/db/logCountsSchema.ts')
        for(const sql of logCountsSchema) await client.query(sql)
        await client.query('INSERT INTO mill_events VALUES(\'remove\',\'org\'),(\'keep\',\'org\'),(\'other\',\'other\'); INSERT INTO mill_log_dimensions SELECT id,organization_id,\'2026-09-24T10:00Z\',\'low\',\'test\',\'HttpLogs\' FROM mill_events')
        const source=readFileSync(new URL('../scripts/drop-self-ingestion-responses.ts',import.meta.url),'utf8')
        const remove=source.match(/`(DELETE FROM mill_log_dimensions d[\s\S]*?ANY\(\$2::text\[\]\))`/)![1]
        await client.query(remove,['org',['remove','other']])
        await client.query('DELETE FROM mill_events WHERE organization_id=$1 AND id=ANY($2::text[])',['org',['remove','other']])
        expect((await client.query('SELECT event_id FROM mill_log_dimensions ORDER BY event_id')).rows.map(row=>row.event_id)).toEqual(['keep','other'])
        expect((await client.query('SELECT event_count FROM mill_log_counts ORDER BY bucket_seconds,organization_id')).rows.map(row=>Number(row.event_count))).toEqual([1,1,1,1,1,1])
    } finally { await client.query('ROLLBACK'); await client.end() }
})
