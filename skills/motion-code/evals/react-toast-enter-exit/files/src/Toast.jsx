import { useEffect } from 'react'
import './toast.css'

export function Toast({ message, open, onClose, duration = 4000 }) {
  useEffect(() => {
    if (!open) return
    const id = setTimeout(onClose, duration)
    return () => clearTimeout(id)
  }, [open, duration, onClose])

  if (!open) return null

  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast__msg">{message}</span>
      <button className="toast__close" onClick={onClose} aria-label="Fechar">×</button>
    </div>
  )
}
