export function createUserMessage(content: string): GPT_ChatMessage {
    return { id: crypto.randomUUID(), role: 'user', content }
}

export function createAssistantMessage(conversationId: string): GPT_ChatMessage {
    return { id: `${conversationId}-assistant`, role: 'assistant', content: '', pending: true }
}

export function toRequestMessages(messages: GPT_ChatMessage[]) {
    return messages
        .filter(message => message.role === 'user' || message.role === 'assistant')
        .map(message => ({ role: message.role, content: message.content }))
}
