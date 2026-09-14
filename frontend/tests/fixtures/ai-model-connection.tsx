import { createRoot } from 'react-dom/client'
import useGptPageState from '../../src/components/gpt/useGptPageState'
function Fixture() {
    const gpt = useGptPageState()
    return <><p>{gpt.isConnected ? 'Connected' : 'Reconnecting'}</p><p>{gpt.clients.map(client => client.displayName).join(', ')}</p><button onClick={() => gpt.openChat(gpt.clients[0])} disabled={!gpt.clients.length}>Test model</button><button onClick={() => gpt.sendPrompt('Reply OK')} disabled={!gpt.chatSession}>Send</button><p>{gpt.chatSession?.messages.map(message => message.content).join(' ')}</p></>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
