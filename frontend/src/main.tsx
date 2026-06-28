import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ShapeProvider } from '@/lib/shape-context'

// ShapeProvider drives the corner radius of all components/ui/* (Button, Select,
// Input, Badge…). Default with no provider is "pill" (very round); "rounded" gives
// the tighter rounded-lg corners that match the clinical brand. Press R to toggle.
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ShapeProvider defaultShape="rounded">
            <App />
        </ShapeProvider>
    </StrictMode>,
)
