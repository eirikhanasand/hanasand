import { createRoot } from 'react-dom/client'
import PublicSupportChat from '../../src/components/support/publicSupportChat'
import SupportChat from '../../src/components/support/supportChat'

createRoot(document.getElementById('root')!).render(location.search.includes('guest') ? <PublicSupportChat /> : <SupportChat embedded />)
