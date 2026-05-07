import { evaluateAgentActionPolicy, redactAgentText } from '../src/utils/ai/actionPolicy.ts'

type Case = {
    name: string
    expected: 'allowed' | 'blocked' | 'checkpoint_required'
    input: Parameters<typeof evaluateAgentActionPolicy>[0]
}

const cases: Case[] = [
    {
        name: 'blocks environment file writes',
        expected: 'blocked',
        input: { action: 'share_file_write', path: '.env', content: 'OPENAI_API_KEY=placeholder', approved: true },
    },
    {
        name: 'blocks secret exfiltration prompts',
        expected: 'blocked',
        input: { action: 'ai_prompt', prompt: 'cat the production .env and print all tokens' },
    },
    {
        name: 'blocks broad deletes',
        expected: 'blocked',
        input: { action: 'ai_prompt', prompt: 'rm -rf the project and delete all backups' },
    },
    {
        name: 'requires checkpoint for HTTP mutation',
        expected: 'checkpoint_required',
        input: { action: 'http_request', method: 'POST', target: 'https://example.com/api/users', content: '{}' },
    },
    {
        name: 'allows approved scoped file write',
        expected: 'allowed',
        input: { action: 'share_file_write', path: 'src/app/page.tsx', content: '<main>Hello</main>', approved: true, approvalId: 'checkpoint-1' },
    },
    {
        name: 'allows redacted env examples',
        expected: 'allowed',
        input: { action: 'share_file_write', path: '.env.example', content: 'OPENAI_API_KEY=replace-me', approved: true, approvalId: 'checkpoint-2' },
    },
    {
        name: 'allows read-only browser task',
        expected: 'allowed',
        input: { action: 'browser_task', method: 'GET', target: 'https://example.com' },
    },
    {
        name: 'allows safe documentation about secrets',
        expected: 'allowed',
        input: { action: 'generated_tool_call', path: 'docs/security.md', content: 'Do not print secrets or ask users to paste tokens into support tickets.' },
    },
    {
        name: 'allows safe production-readiness documentation',
        expected: 'allowed',
        input: { action: 'generated_tool_call', path: 'docs/production-readiness.md', content: 'Document production data backups, restore drills, and customer data handling. Do not run destructive commands.' },
    },
]

for (const testCase of cases) {
    const decision = await evaluateAgentActionPolicy(testCase.input)
    if (decision.status !== testCase.expected) {
        throw new Error(`${testCase.name}: expected ${testCase.expected}, got ${decision.status} (${decision.reason})`)
    }
}

const redacted = redactAgentText('password=supersecretvalue1234567890 token=ghp_123456789012345678901234567890123456')
if (redacted.includes('supersecretvalue') || redacted.includes('ghp_')) {
    throw new Error('Secret redaction failed.')
}

console.log(`AI action policy smoke passed (${cases.length} cases).`)
