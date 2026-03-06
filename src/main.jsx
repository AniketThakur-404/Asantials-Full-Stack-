import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const isValidSemver = (value) =>
  typeof value === 'string' && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z-.]+)?$/.test(value)

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
  const fallbackVersion = isValidSemver(React.version) ? React.version : '19.1.1'

  if (hook && typeof hook.inject === 'function' && !hook.__evrydaePatched) {
    const originalInject = hook.inject

    hook.inject = function injectWithSafeVersion(renderer) {
      if (renderer) {
        if (!isValidSemver(renderer.version)) {
          renderer.version = fallbackVersion
        }
        if (!isValidSemver(renderer.reconcilerVersion)) {
          renderer.reconcilerVersion = fallbackVersion
        }
      }
      return originalInject.call(this, renderer)
    }

    hook.__evrydaePatched = true
  }
}

const { default: App } = await import('./App.jsx')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
