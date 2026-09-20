#!/usr/bin/env python3
"""Stream existing support data into the paused independent store over SSH.

Export runs on Inspur; import runs on OVH after all public API instances route
support to the paused service and the old HTTP instances have drained.
"""
import csv
import io
import json
from pathlib import Path
import subprocess
import sys

TABLES = ('users', 'support_tickets', 'support_messages', 'support_live_tickets', 'support_auth_sessions')


def export():
    sql = """
    BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
    WITH sessions AS (
        SELECT encode(sha256(convert_to(t.token,'UTF8')),'hex') AS token_hash, t.id AS user_id,
            LEAST(t.timestamp + CASE WHEN t.user_agent LIKE 'Hanasand Desktop/%' THEN INTERVAL '30 days' ELSE INTERVAL '24 hours' END,
                  NOW()+INTERVAL '24 hours') AS expires_at,
            json_build_object(
                'user', json_build_object('id',u.id,'name',u.name,'avatar',u.avatar,'active',u.active,'deletion_scheduled_at',u.deletion_scheduled_at),
                'roles', (SELECT json_agg(r) FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=t.id),
                'session', json_build_object('token_id',t.token_id,'id',t.id,'ip',t.ip,'user_agent',t.user_agent,'created_at',t.created_at,'timestamp',t.timestamp),
                'refreshed', json_build_object('expires_at',t.timestamp+CASE WHEN t.user_agent LIKE 'Hanasand Desktop/%' THEN INTERVAL '30 days' ELSE INTERVAL '24 hours' END)
            ) AS snapshot
        FROM tokens t JOIN users u ON u.id=t.id
        WHERE t.revoked_at IS NULL AND u.active IS TRUE AND u.deletion_scheduled_at IS NULL AND u.account_type='user'
          AND t.timestamp > NOW()-CASE WHEN t.user_agent LIKE 'Hanasand Desktop/%' THEN INTERVAL '30 days' ELSE INTERVAL '24 hours' END
          AND EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=t.id AND ur.role_id='support')
    )
    SELECT json_build_object(
        'users', COALESCE((SELECT json_agg(v) FROM (SELECT id,name FROM users WHERE id IN (
            SELECT user_id FROM support_tickets UNION SELECT sender_id FROM support_messages UNION SELECT user_id FROM sessions)) v),'[]'::json),
        'support_tickets', COALESCE((SELECT json_agg(t) FROM support_tickets t),'[]'::json),
        'support_messages', COALESCE((SELECT json_agg(m) FROM support_messages m),'[]'::json),
        'support_live_tickets', COALESCE((SELECT json_agg(l) FROM support_live_tickets l WHERE expires_at>NOW()),'[]'::json),
        'support_auth_sessions', COALESCE((SELECT json_agg(s) FROM sessions s),'[]'::json));
    COMMIT;
    """
    subprocess.run(['docker', 'exec', '-i', 'hanasand_database', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'hanasand', '-d', 'hanasand'], input=sql.encode(), check=True)


def restore():
    config = json.loads(Path('/home/ubuntu/hanasand-resilience/support.json').read_text())
    if config.get('SUPPORT_MAINTENANCE') != '1':
        raise RuntimeError('Pause support writes before migrating')
    data = json.load(sys.stdin)
    if set(data) != set(TABLES) or not all(isinstance(data[table], list) for table in TABLES):
        raise RuntimeError('Invalid support snapshot')
    # COPY a single JSON document: customer text cannot become SQL.
    buffer = io.StringIO()
    csv.writer(buffer, lineterminator='\n').writerow([json.dumps(data)])
    sql = "BEGIN; SET LOCAL standard_conforming_strings=on; CREATE TEMP TABLE support_import(document JSON);\nCOPY support_import FROM STDIN WITH (FORMAT csv);\n"
    sql += buffer.getvalue() + "\\.\n"
    sql += "DO $$ BEGIN IF EXISTS(SELECT 1 FROM support_tickets) OR EXISTS(SELECT 1 FROM support_messages) THEN RAISE EXCEPTION 'Support destination must be empty'; END IF; END $$;\n"
    for table in TABLES:
        sql += f"INSERT INTO {table} SELECT record.* FROM support_import, json_populate_recordset(NULL::{table}, document->'{table}') AS record;\n"
    sql += 'COMMIT;\n'
    subprocess.run(['docker', 'exec', '-i', 'hanasand-support-db', 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-p', '18508', '-U', 'support', '-d', 'hanasand_support'], input=sql.encode(), check=True, stdout=subprocess.DEVNULL)
    print(json.dumps({'imported': {table: len(data[table]) for table in TABLES}}))


if __name__ == '__main__':
    if sys.argv[1:] == ['export']: export()
    elif sys.argv[1:] == ['import']: restore()
    else: raise SystemExit('Use export on Inspur or import on OVH')
