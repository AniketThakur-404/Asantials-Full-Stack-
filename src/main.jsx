import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
  if (hook && !hook.__evrydaePatched) {
    const originalInject = hook.inject
    if (typeof originalInject === 'function') {
      hook.inject = function injectWithVersion(renderer) {
        if (renderer && !renderer.version && React.version) {
          renderer.version = React.version
        }
        return originalInject.call(this, renderer)
      }
    }
    hook.__evrydaePatched = true
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
