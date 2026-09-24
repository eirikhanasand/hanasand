import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

if (process.env.DB_HOST !== 'role-test-db') throw Error('Requires isolated role-test-db')
let user = 'admin'
let allowed = true
let authenticated = true
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: authenticated, id: user, authenticatedId: user }) }))
mock.module('../src/utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: allowed }) }))
mock.module('../src/utils/auth/hasPermissionToModifyRole.ts', () => ({ default: async () => ({ valid: true }) }))
const { queryOnce: q } = await import('../src/utils/db.ts')
const { default: schema } = await import('../src/utils/db/roleSchema.ts')
const { default: put } = await import('../src/handlers/roles/put.ts')
const { default: post } = await import('../src/handlers/roles/post.ts')
const { default: remove } = await import('../src/handlers/roles/delete.ts')
const app = Fastify()
app.put('/role/:id', put)
app.post('/role', post)
app.delete('/role/:id', remove)
const update = (id: string, payload: unknown) => app.inject({ method: 'PUT', url: `/role/${id}`, payload })

test('role edits enforce the hierarchy, reserve zero and commit audit evidence atomically', async () => {
    await q(`CREATE TABLE roles(id text PRIMARY KEY,name text UNIQUE,description text,priority int NOT NULL DEFAULT 1000,created_by text,updated_at timestamptz DEFAULT now());
        CREATE TABLE user_roles(user_id text,role_id text);
        CREATE TABLE system_events(event_type text,severity text,source text,service text,actor_id text,object_type text,object_id text,organization_id text,subject_id text,request_id text,outcome text,reason text,context jsonb,ip text,user_agent text);
        INSERT INTO roles(id,name,priority) VALUES ('administrator','Administrator',0),('system_admin','System Administrator',20),('user_admin','User Administrator',40),('content_admin','Content Administrator',60);
        INSERT INTO user_roles VALUES ('admin','administrator'),('limited','user_admin');`)
    await schema()
    await schema()
    let response = await update('content_admin', { priority: 50, icon: 'pencil' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ priority: 50, icon: 'pencil' })
    const event = (await q('SELECT * FROM system_events')).rows[0]
    expect(event).toMatchObject({ event_type: 'role.updated', actor_id: 'admin', object_id: 'content_admin', outcome: 'success', context: { before: { priority: 60, icon: null }, after: { priority: 50, icon: 'pencil' } } })
    for (const priority of [0, -1, 1.5, '1', 2147483648, null]) expect((await update('content_admin', { priority })).statusCode).toBe(400)
    expect((await update('administrator', { priority: 1 })).statusCode).toBe(400)
    expect((await update('administrator', { priority: 0, icon: 'crown' })).statusCode).toBe(200)
    expect((await app.inject({ method: 'DELETE', url: '/role/administrator' })).statusCode).toBe(403)
    expect((await update('content_admin', { priority: 1, target: 'administrator' })).statusCode).toBe(400)
    expect((await update('content_admin', { icon: '<svg onload=alert(1)>' })).statusCode).toBe(400)
    user = 'limited'
    expect((await update('content_admin', { priority: 1 })).statusCode).toBe(403)
    expect((await update('system_admin', { priority: 50 })).statusCode).toBe(403)
    expect((await update('content_admin', { priority: 45 })).statusCode).toBe(200)
    allowed = false
    expect((await update('content_admin', { priority: 50 })).statusCode).toBe(403)
    authenticated = false
    expect((await update('content_admin', { priority: 50 })).statusCode).toBe(401)
    allowed = authenticated = true
    user = 'admin'
    response = await app.inject({ method: 'POST', url: '/role', payload: { id: 'developer', name: 'Developer', priority: 70, icon: 'code-2', created_by: 'forged-user' } })
    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({ priority: 70, icon: 'code-2', created_by: 'admin' })
    expect((await q('SELECT actor_id FROM system_events WHERE event_type=\'role.created\'')).rows[0].actor_id).toBe('admin')
    expect((await app.inject({ method: 'POST', url: '/role', payload: { id: 'bad', name: 'Bad', priority: 0 } })).statusCode).toBe(400)
    expect((await app.inject({ method: 'POST', url: '/role', payload: { id: 'administrator', name: 'Other admin', priority: 0 } })).statusCode).toBe(400)
    await expect(q('UPDATE roles SET priority=0 WHERE id=\'developer\'')).rejects.toThrow()
    await expect(q('UPDATE roles SET priority=2 WHERE id=\'administrator\'')).rejects.toThrow()
    await q('ALTER TABLE system_events ADD CONSTRAINT reject_audit CHECK(event_type <> \'role.updated\') NOT VALID')
    expect((await update('developer', { priority: 80 })).statusCode).toBe(500)
    expect((await q('SELECT priority FROM roles WHERE id=\'developer\'')).rows[0].priority).toBe(70)
    await q('ALTER TABLE system_events DROP CONSTRAINT reject_audit')
})
