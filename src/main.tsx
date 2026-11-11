import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import './deqant-admin-fixes.css'
import './deq-promise-ledger.css'
import { SupabaseProvider } from "@/providers/store"
import { CartProvider } from "@/providers/cart"
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SupabaseProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </SupabaseProvider>
    </BrowserRouter>
  </StrictMode>,
)
