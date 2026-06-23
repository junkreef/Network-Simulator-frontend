import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { useTopologyStore } from './store/topologyStore'

if (typeof window !== 'undefined') {
  (window as any).useTopologyStore = useTopologyStore;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
