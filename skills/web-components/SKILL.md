# React/Web Implementation Reference

## CSS Base (Tailwind + Custom)

```css
/* Colors */
:root[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f7;
  --bg-tertiary: #ececf1;
  --text-primary: #000000;
  --text-secondary: #555555;
  --text-tertiary: #888888;
  --blue-primary: #0084ff;
  --blue-hover: #0073e6;
  --blue-active: #005fd1;
  --border-primary: #e5e5ea;
  --message-ai: #f5f5f7;
}

:root[data-theme="dark"] {
  --bg-primary: #0a0a0b;
  --bg-secondary: #1c1c1e;
  --bg-tertiary: #3a3a3c;
  --text-primary: #ffffff;
  --text-secondary: #ababab;
  --text-tertiary: #636366;
  --blue-primary: #0084ff;
  --border-primary: #424245;
  --message-ai: #1c1c1e;
}

/* Typography */
.text-hero {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.5px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.text-title {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.3px;
}

.text-subtitle {
  font-size: 1.0625rem;
  font-weight: 600;
  line-height: 1.4;
}

.text-body {
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
}

.text-label {
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.5;
}

.text-caption {
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.4;
}

.text-mono {
  font-family: 'SF Mono', 'Monaco', monospace;
  font-size: 0.875rem;
}

/* Spacing */
.p-xs { padding: 0.5rem; }
.p-sm { padding: 1rem; }
.p-md { padding: 1.5rem; }
.p-lg { padding: 2rem; }
.p-xl { padding: 3rem; }

.gap-xs { gap: 0.5rem; }
.gap-sm { gap: 1rem; }
.gap-md { gap: 1.5rem; }
.gap-lg { gap: 2rem; }

/* Border & Glass */
.border-subtle {
  border: 1px solid var(--border-primary);
}

.glass {
  backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
}

:root[data-theme="dark"] .glass {
  background: rgba(10, 10, 11, 0.85);
  border-color: rgba(255, 255, 255, 0.15);
}

/* Buttons */
.btn {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-weight: 500;
  transition: all 200ms ease-out;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--blue-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--blue-hover);
}

.btn-primary:active:not(:disabled) {
  background: var(--blue-active);
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.btn-tertiary {
  background: transparent;
  color: var(--blue-primary);
  padding: 0.5rem 0;
}

.btn-tertiary:hover:not(:disabled) {
  opacity: 0.7;
}

/* Inputs */
.input {
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-primary);
  border-radius: 24px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 1rem;
  transition: border-color 200ms ease-out;
}

.input:focus {
  outline: none;
  border-color: var(--blue-primary);
  background: var(--bg-primary);
}

.input::placeholder {
  color: var(--text-tertiary);
}
```

## React Components

### ChatContainer.jsx
```jsx
import React, { useState } from 'react';
import './ChatContainer.css';

export function ChatContainer() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = { id: Date.now(), content: input, isUser: true };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Simular resposta da IA
    setTimeout(() => {
      const aiMsg = {
        id: Date.now() + 1,
        content: 'Resposta da IA aqui',
        isUser: false
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2 className="text-subtitle">Claude</h2>
        <button className="btn btn-tertiary" aria-label="Info">
          ⓘ
        </button>
      </div>

      <div className="chat-messages">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`message ${msg.isUser ? 'user' : 'ai'}`}
          >
            {!msg.isUser && (
              <img src="/ai-avatar.png" alt="AI" className="avatar" />
            )}
            <div className="message-bubble">
              {!msg.isUser && <p className="text-caption">Claude</p>}
              <p className="text-body">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && <LoadingBubble />}
      </div>

      <div className="chat-input-area">
        <div className="input-wrapper">
          <input
            type="text"
            className="input"
            placeholder="Message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
          />
          <button
            className="btn btn-send"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingBubble() {
  return (
    <div className="message ai">
      <img src="/ai-avatar.png" alt="AI" className="avatar" />
      <div className="message-bubble loading">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}
```

### ChatContainer.css
```css
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--border-primary);
  height: 44px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.message {
  display: flex;
  gap: 0.5rem;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.message.user {
  justify-content: flex-end;
}

.message.user .message-bubble {
  background: var(--blue-primary);
  color: white;
  border-radius: 18px;
  max-width: 70%;
}

.message.ai .message-bubble {
  background: var(--message-ai);
  border-radius: 18px;
  max-width: 70%;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
}

.message-bubble {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.message-bubble.loading {
  display: flex;
  flex-direction: row;
  gap: 0.25rem;
  padding: 1rem 0.75rem;
}

.message-bubble.loading span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text-secondary);
  animation: pulse 1.4s ease-in-out infinite;
}

.message-bubble.loading span:nth-child(2) {
  animation-delay: 0.2s;
}

.message-bubble.loading span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.chat-input-area {
  padding: 1rem;
  border-top: 1px solid var(--border-primary);
  background: var(--bg-primary);
}

.input-wrapper {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.input {
  flex: 1;
}

.btn-send {
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 50%;
  background: var(--blue-primary);
  color: white;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-send:hover:not(:disabled) {
  background: var(--blue-hover);
}

@media (max-width: 768px) {
  .message.ai .message-bubble,
  .message.user .message-bubble {
    max-width: 85%;
  }
}
```

### Sidebar.jsx
```jsx
import React, { useState } from 'react';
import './Sidebar.css';

export function Sidebar() {
  const [chats, setChats] = useState([
    { id: 1, title: 'Nova conversa', date: 'hoje' },
    { id: 2, title: 'Projeto React', date: 'ontem' },
  ]);
  const [expanded, setExpanded] = useState(true);

  return (
    <aside className={`sidebar ${expanded ? 'expanded' : 'collapsed'}`}>
      <div className="sidebar-header">
        <button className="btn btn-primary" style={{ width: '100%' }}>
          + Nova conversa
        </button>
        <button
          className="btn btn-tertiary"
          onClick={() => setExpanded(!expanded)}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
      </div>

      <div className="sidebar-content">
        <h3 className="text-caption">Conversas recentes</h3>
        <div className="chat-list">
          {chats.map(chat => (
            <div key={chat.id} className="chat-item">
              <div>
                <p className="text-label">{chat.title}</p>
                <p className="text-caption">{chat.date}</p>
              </div>
              <button className="btn btn-tertiary" aria-label="More options">
                ⋯
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <button className="btn btn-secondary" style={{ width: '100%' }}>
          ⚙ Configurações
        </button>
      </div>
    </aside>
  );
}
```

### Sidebar.css
```css
.sidebar {
  width: 260px;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-primary);
  display: flex;
  flex-direction: column;
  transition: width 300ms ease-out;
  overflow: hidden;
}

.sidebar.collapsed {
  width: 60px;
}

.sidebar.collapsed .sidebar-content,
.sidebar.collapsed .text-label {
  display: none;
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-primary);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sidebar-content {
  flex: 1;
  padding: 1rem 0.75rem;
  overflow-y: auto;
}

.sidebar-content h3 {
  padding: 0.5rem;
  margin-bottom: 0.5rem;
}

.chat-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chat-item {
  padding: 0.75rem;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 200ms ease-out;
  white-space: nowrap;
  overflow: hidden;
}

.chat-item:hover {
  background: var(--bg-secondary);
}

.chat-item p {
  overflow: text-overflow;
  text-overflow: ellipsis;
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid var(--border-primary);
}

@media (max-width: 768px) {
  .sidebar {
    position: absolute;
    height: 100%;
    z-index: 100;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  }

  .sidebar.collapsed {
    width: 0;
  }
}
```

### Theme Hook
```jsx
import { useEffect, useState } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    // Detectar preferência do sistema
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const stored = localStorage.getItem('theme');
    const initial = stored || (prefersDark ? 'dark' : 'light');

    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return { theme, toggle };
}
```

## Tailwind Config (Alternativa)

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        'apple-bg': 'var(--bg-primary)',
        'apple-blue': 'var(--blue-primary)',
      },
      fontFamily: {
        'apple': [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif'
        ],
        'apple-mono': ['"SF Mono"', '"Monaco"', 'monospace'],
      },
      spacing: {
        'xs': '0.5rem',
        'sm': '1rem',
        'md': '1.5rem',
        'lg': '2rem',
        'xl': '3rem',
      },
      animation: {
        'pulse-dot': 'pulse-dot 1.4s ease-in-out infinite',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
};
```
