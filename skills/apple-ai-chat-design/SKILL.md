---
name: apple-ai-chat-design
description: "Design system para apps de mensagem com IA no estilo Apple/ChatGPT. Use esta skill quando estiver desenvolvendo apps de IA conversacional em SwiftUI, React ou web — garantindo padrões rígidos de cores, tipografia, espaçamento responsivo e componentes que pareçam nativamente Apple. Cobre sidebar, chat interface, inputs, modals, e toda a estrutura visual de um app de mensagem moderno. Triggers: 'design apple para meu app', 'fazer parecer ChatGPT', 'padrão Apple', 'UI minimalista tipo Claude', 'design interface de chat', 'componentes tipo Apple'."
---

# Apple AI Chat Design System

Documentação rígida de design para apps de mensagem com IA que pareçam naturalmente Apple.

## Princípios Fundamentais

### 1. Filosofia Apple (HIG - Human Interface Guidelines)
- **Minimalismo radical**: Apenas o essencial. Sem decoração.
- **Clareza em primeiro lugar**: Tipografia clara, hierarquia óbvia.
- **Consistência**: Mesmo comportamento em todos os contextos.
- **Feedback imediato**: Sempre responda às ações do usuário.
- **Segurança**: Nunca destrua dados sem confirmação explícita.

### 2. Liquid Glass (Glassmorphism)
Efeito visual Apple que combina:
- Backdrop blur (8-16px de profundidade)
- Transparência semi-opaca (85-95% opacity)
- Border sutil com gradiente
- Separação visual clara sem cores escuras

**Quando usar**:
- Navbars e sidebars flutuantes
- Modals e popovers
- Floating action buttons
- Headers de seções

---

## Paleta de Cores

### Light Mode (Padrão)
```
Background:
  - Primary: #FFFFFF (fundo puro)
  - Secondary: #F5F5F7 (fundo secundário)
  - Tertiary: #ECECF1 (divisores, backgrounds subtis)

Text:
  - Primary: #000000 (texto principal, 100% opacity)
  - Secondary: #555555 (labels, captions, 60% opacity)
  - Tertiary: #888888 (placeholders, hints, 40% opacity)

Accents:
  - Primary Blue: #0084FF (links, actions, Apple blue)
  - Hover: #0073E6 (estado hover)
  - Active: #005FD1 (estado ativo)
  - Disabled: #D1D1D6 (elementos desativados)

Messages:
  - User Message: #0084FF (blue, align right)
  - AI Message: #F5F5F7 (cinza, align left)
  - System: #E8E8ED (subtle, center-aligned)

Borders & Dividers:
  - Primary: #E5E5EA (1px, subtle)
  - Glass border: rgba(255, 255, 255, 0.8) com blur
```

### Dark Mode
```
Background:
  - Primary: #0A0A0B (pure black)
  - Secondary: #1C1C1E (fundo secundário)
  - Tertiary: #3A3A3C (divisores)

Text:
  - Primary: #FFFFFF (texto principal)
  - Secondary: #ABABAB (labels, 60% opacity)
  - Tertiary: #636366 (placeholders, 40% opacity)

Messages:
  - User Message: #0084FF (mantém azul)
  - AI Message: #1C1C1E (cinza escuro)

Borders:
  - Primary: #424245 (1px)
  - Glass border: rgba(255, 255, 255, 0.15) com blur
```

---

## Tipografia

### Fontes
- **UI Principal**: SF Pro Display / SF Pro Text
  - iOS/macOS: Usa nativo `.system`
  - Web: `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **Código / Monospace**: SF Mono
  - iOS: `.monospaced()`
  - Web: `font-family: 'SF Mono', 'Monaco', monospace`

### Escala de Tamanhos (rem/pt)

| Uso | Tamanho | Peso | Line Height | Letter Spacing |
|-----|---------|------|-------------|----------------|
| Hero Title | 32pt / 2rem | 700 (Bold) | 1.1 | -0.5px |
| Page Title | 28pt / 1.75rem | 600 (Semibold) | 1.2 | -0.3px |
| Section Header | 20pt / 1.25rem | 600 (Semibold) | 1.3 | 0 |
| Subtitle | 17pt / 1.0625rem | 600 (Semibold) | 1.4 | 0 |
| Body Text | 16pt / 1rem | 400 (Regular) | 1.5 | 0 |
| Label | 14pt / 0.875rem | 400 (Regular) | 1.5 | 0 |
| Caption | 12pt / 0.75rem | 400 (Regular) | 1.4 | 0 |
| Footnote | 11pt / 0.6875rem | 400 (Regular) | 1.3 | 0 |

**Regra**: Não use < 11pt ou > 32pt sem razão. Apple usa escala logarítmica.

---

## Espaçamento & Grid

### Sistema de Espaçamento Base
```
Unidade base: 4pt (iOS) ou 0.25rem (web)
8pt = 1 unidade
16pt = 2 unidades
24pt = 3 unidades
32pt = 4 unidades
48pt = 6 unidades
64pt = 8 unidades
```

### Aplicação por Componente

#### Sidebar
```
Largura: 260pt (iOS) | 280pt (macOS) | 260px (web)
Padding: 16pt (topo/bottom) | 12pt (laterais)
Item Height: 40pt (botão) | 44pt (mensagem)
Item Padding: 8pt (vertical) | 12pt (horizontal)
Espaço entre items: 8pt
Separator: 1px com cor de divisor
```

#### Chat Area
```
Padding lateral: 16pt (mobile) | 24pt (desktop)
Padding vertical: 12pt
Message bubble max-width: 70% (mobile) | 50% (desktop)
Message padding: 12pt (horizontal) | 8pt (vertical)
Espaço entre mensagens: 8pt (same speaker) | 16pt (different speaker)
Avatar size: 32pt × 32pt
Avatar margin right: 8pt
```

#### Input Area
```
Height: 44pt (iOS) | 48pt (web)
Padding: 8pt (interno)
Border radius: 24pt (fully rounded)
Send button size: 28pt × 28pt
Espaço entre input e botão: 8pt
Bottom padding: 12pt
```

#### Buttons & Controls
```
Min touch target: 44pt × 44pt (Apple standard)
Padding: 10pt (vertical) | 16pt (horizontal)
Border radius: 10pt (standard) | 24pt (pill) | 8pt (compact)
```

---

## Componentes Principais

### 1. Sidebar (Navigation)
```swift
// SwiftUI Example
VStack(spacing: 0) {
    // Header
    HStack {
        Image(systemName: "plus.circle.fill")
            .font(.system(size: 24))
            .foregroundColor(.blue)
        Spacer()
        Image(systemName: "list.bullet")
            .font(.system(size: 16))
    }
    .padding(16)
    .background(Color(.systemBackground))
    
    // Separator
    Divider()
    
    // Chat List
    ScrollView {
        VStack(spacing: 8) {
            ForEach(chats) { chat in
                ChatListItem(chat)
                    .padding(.horizontal, 12)
            }
        }
        .padding(.vertical, 12)
    }
    
    Spacer()
    
    // Footer (User Menu)
    VStack(spacing: 0) {
        Divider()
        UserMenuButton()
            .padding(12)
    }
}
.frame(width: 260)
.background(Color(.systemBackground))
```

### 2. Chat Message Bubbles
```swift
// User Message (Blue, Right-aligned)
HStack(spacing: 0) {
    Spacer()
    Text(message.content)
        .font(.system(size: 16, weight: .regular))
        .padding(12)
        .background(Color(red: 0, green: 0.52, blue: 1)) // #0084FF
        .foregroundColor(.white)
        .cornerRadius(18)
}
.padding(.horizontal, 16)
.padding(.vertical, 4)

// AI Message (Gray, Left-aligned)
HStack(spacing: 8) {
    Image("ai-avatar")
        .resizable()
        .scaledToFill()
        .frame(width: 32, height: 32)
        .cornerRadius(8)
    
    VStack(alignment: .leading, spacing: 4) {
        Text("Claude")
            .font(.system(size: 13, weight: .semibold))
            .foregroundColor(.secondary)
        
        Text(message.content)
            .font(.system(size: 16, weight: .regular))
    }
    .padding(12)
    .background(Color(.systemGray6))
    .cornerRadius(18)
    
    Spacer()
}
.padding(.horizontal, 16)
.padding(.vertical, 4)
```

### 3. Input Field (Minimalista)
```swift
HStack(spacing: 8) {
    TextField("Message...", text: $input)
        .font(.system(size: 16, weight: .regular))
        .padding(12)
        .background(Color(.systemGray6))
        .cornerRadius(24)
    
    Button(action: { send() }) {
        Image(systemName: "arrow.up.circle.fill")
            .font(.system(size: 24))
            .foregroundColor(.blue)
    }
    .frame(width: 44, height: 44)
}
.padding(16)
.background(Color(.systemBackground))
```

### 4. Liquid Glass Effect
```swift
// iOS/macOS
ZStack {
    // Blur background
    VisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))
    
    // Content
    VStack {
        // ...
    }
    .padding(16)
}
.background(
    Color.white.opacity(0.85)
)
.cornerRadius(12)
.overlay(
    RoundedRectangle(cornerRadius: 12)
        .stroke(Color.white.opacity(0.3), lineWidth: 1)
)

// Web (CSS)
.glass-effect {
  backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
}
```

### 5. Botões Padrão
```swift
// Primary Button (Azul)
Button(action: {}) {
    Text("Send")
        .font(.system(size: 16, weight: .semibold))
        .frame(maxWidth: .infinity)
        .frame(height: 44)
        .background(Color(red: 0, green: 0.52, blue: 1))
        .foregroundColor(.white)
        .cornerRadius(10)
}

// Secondary Button (Outline)
Button(action: {}) {
    Text("Cancel")
        .font(.system(size: 16, weight: .semibold))
        .frame(maxWidth: .infinity)
        .frame(height: 44)
        .background(Color(.systemGray6))
        .foregroundColor(.primary)
        .cornerRadius(10)
}

// Tertiary Button (Text only)
Button(action: {}) {
    Text("Learn More")
        .font(.system(size: 16, weight: .semibold))
        .foregroundColor(.blue)
}
```

---

## Animações & Transições

### Timing Functions (Apple Standard)
```
Rápido (UI feedback): 200ms, easeOut
Médio (transições): 300ms, easeInOut
Lento (modals): 400ms, easeInOut
Muito lento (grandes mudanças): 600ms, easeInOut
```

### Animações Comuns
```swift
// Fade in
withAnimation(.easeInOut(duration: 0.3)) {
    isVisible = true
}

// Scale + Fade (Modal open)
withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
    showModal = true
}

// Message appear
Text(message)
    .transition(.opacity.combined(with: .scale(scale: 0.95)))
    .animation(.easeOut(duration: 0.2), value: message)

// Loading indicator
Image(systemName: "ellipsis")
    .font(.system(size: 16))
    .rotationEffect(.degrees(rotation))
    .onAppear {
        withAnimation(.linear(duration: 1).repeatForever(autoreverses: false)) {
            rotation = 360
        }
    }
```

### Redução de Motion (Accessibility)
```swift
@Environment(\.accessibilityReduceMotion) var reduceMotion

withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.3)) {
    // animation code
}
```

---

## Dark Mode

Apple usa dark mode como first-class citizen. Sempre suporte.

```swift
// SwiftUI: Automático com Color.primary, Color.secondary, Color(.systemBackground)
// Não hardcode cores!

@Environment(\.colorScheme) var colorScheme

VStack {
    Text("Hello")
        .foregroundColor(.primary) // Adapta light/dark
}
.preferredColorScheme(nil) // Respeita setting do sistema
```

---

## Padrões de Interação

### Estados dos Componentes
- **Normal**: Design padrão descrito acima
- **Hover** (Web/macOS): Levemente mais escuro (opacity -10%) ou fundo sutil
- **Active**: Cor mais saturada ou sombra
- **Disabled**: opacity 50%, cursor not-allowed
- **Loading**: Spinner indeterminado

### Feedback Tátil
```swift
// iOS haptics
UIImpactFeedbackGenerator(style: .light).impactOccurred()
UIImpactFeedbackGenerator(style: .medium).impactOccurred()
UINotificationFeedbackGenerator().notificationOccurred(.success)
```

### Gestos
- **Tap**: Botões, links, opções
- **Long press**: Contexto, ações secundárias
- **Swipe**: Ações (delete, archive)
- **Pinch**: Zoom (se relevante)

---

## Estrutura Layout Completa

### iPhone (Vertical)
```
┌─────────────────────┐
│ Header (Safe area)  │ 44pt
├─────────────────────┤
│                     │
│  Chat Messages      │ Scrollable, padding 16pt
│  (flex height)      │
│                     │
├─────────────────────┤
│ Input (safe area)   │ 48pt + 12pt padding
└─────────────────────┘
```

### iPad / Desktop (Horizontal)
```
┌──────────┬─────────────────────┐
│          │ Header              │ 44pt
│ Sidebar  ├─────────────────────┤
│ (260pt)  │ Chat Messages       │ Scrollable
│          │                     │
│ Scroll   ├─────────────────────┤
│          │ Input               │ 48pt
└──────────┴─────────────────────┘
```

---

## Checklist de Implementação

- [ ] Respeita safe areas (notch, home indicator)
- [ ] Cores ajustam automaticamente para light/dark mode
- [ ] Tipografia segue escala acima (sem hardcodes)
- [ ] Spacing usa múltiplos de 8pt
- [ ] Todos os botões têm mínimo 44pt × 44pt
- [ ] Sem hardcoded colors (use Color(.systemBackground), etc)
- [ ] Animações <= 400ms para ações rápidas
- [ ] Accessibility: VoiceOver labels, contrast ratio >= 4.5:1
- [ ] Liquid glass usa backdrop-filter/VisualEffectView
- [ ] Mensagens variam left/right com avatar apropriado
- [ ] Input sempre acima da keyboard (iOS safe area)
- [ ] Sidebar colapsa em mobile
- [ ] Hover states implementados (web)
- [ ] Loading states durante requisições

---

## Referências Apple

- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
- [SF Symbols](https://developer.apple.com/sf-symbols/)
- [SwiftUI Styling](https://developer.apple.com/documentation/swiftui)
- [iOS Design Guidelines](https://developer.apple.com/ios/design/)
- [Accessibility](https://developer.apple.com/accessibility/)

---

## Exemplo Completo: Chat View

```swift
import SwiftUI

struct ChatView: View {
    @State var messages: [Message] = []
    @State var input: String = ""
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Claude")
                    .font(.system(size: 17, weight: .semibold))
                Spacer()
                Image(systemName: "info.circle")
                    .font(.system(size: 18))
                    .foregroundColor(.blue)
            }
            .padding(16)
            .background(Color(.systemBackground))
            .border(Color(.systemGray6), width: 1)
            
            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 12) {
                        ForEach(messages) { msg in
                            if msg.isUser {
                                UserMessage(msg.content)
                            } else {
                                AIMessage(msg.content)
                            }
                        }
                    }
                    .padding(16)
                }
            }
            
            // Input
            HStack(spacing: 8) {
                TextField("Message...", text: $input)
                    .font(.system(size: 16))
                    .padding(12)
                    .background(Color(.systemGray6))
                    .cornerRadius(24)
                
                Button(action: { sendMessage() }) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 24))
                        .foregroundColor(.blue)
                }
                .frame(width: 44, height: 44)
            }
            .padding(16)
        }
        .background(Color(.systemBackground))
    }
    
    func sendMessage() {
        // Implementation
    }
}

struct UserMessage: View {
    let content: String
    
    var body: some View {
        HStack(spacing: 0) {
            Spacer()
            Text(content)
                .font(.system(size: 16, weight: .regular))
                .padding(12)
                .background(Color(red: 0, green: 0.52, blue: 1))
                .foregroundColor(.white)
                .cornerRadius(18)
        }
    }
}

struct AIMessage: View {
    let content: String
    
    var body: some View {
        HStack(spacing: 8) {
            Image("claude-avatar")
                .resizable()
                .scaledToFill()
                .frame(width: 32, height: 32)
                .cornerRadius(8)
            
            VStack(alignment: .leading, spacing: 4) {
                Text("Claude")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.secondary)
                Text(content)
                    .font(.system(size: 16, weight: .regular))
            }
            .padding(12)
            .background(Color(.systemGray6))
            .cornerRadius(18)
            
            Spacer()
        }
    }
}
```

---

## Notas Finais

1. **Não customize sem necessidade**: Apple design é opiniativo. Segue as regras.
2. **Teste em dispositivos reais**: Simuladores enganam (fontes, cores, notch).
3. **Acessibilidade desde o início**: Não é "nice to have", é obrigatório.
4. **Versioning**: Mantenha este documento atualizado conforme o design evolui.
5. **Consistência é tudo**: Um pixel fora do lugar é visível.

Boa sorte! 🎨

## Integração Harness² (Propose–Probe–Compose)
- **c1..c4 (Prompt/Guardrails):** Respeite estritamente a hierarquia tipográfica, contraste, áreas de toque (44×44 pt) e estados de streaming/redução de movimento.
- **c7 (Probe determinístico):** Sempre valide o layout renderizado em desktop e mobile (sem overflow horizontal e sem elementos cortados) antes de concluir.
- **c3/c6 (Experience Reflector):** Ao encontrar um padrão visual ou correção de acessibilidade recorrente, consolide a regra nesta skill.
