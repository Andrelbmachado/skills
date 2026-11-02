# macOS Implementation Patterns

## Diferenças do iOS para macOS

### Sidebar
- **Largura padrão**: 280pt (vs 260pt iOS)
- **Comportamento**: Não colapsa automaticamente (suporta collapse manual)
- **Resizing**: Permite drag na borda direita para redimensionar

### Input
- **Height**: 48pt (vs 44pt iOS)
- **Comportamento**: Sempre visível, não afeta pela keyboard

### Hover States
- **Obrigatório**: Todos os botões precisam hover visual
- **Implementação**: background levemente mais escuro ou overlay sutil

### Keyboard Navigation
- **Tab**: Percorrer todos os elementos interativos
- **Enter**: Enviar mensagem
- **Escape**: Fechar modals, cancelar operações
- **Cmd+N**: Nova conversa

## SwiftUI (macOS)

### Split View Layout
```swift
import SwiftUI

struct ChatApp: App {
    var body: some Scene {
        WindowGroup {
            NavigationSplitView {
                Sidebar()
                    .frame(minWidth: 200, idealWidth: 280, maxWidth: 400)
            } detail: {
                ChatView()
            }
            .frame(minWidth: 800, minHeight: 600)
        }
    }
}

struct Sidebar: View {
    @State var selectedChat: Int?
    @State var chats: [ChatItem] = []
    
    var body: some View {
        VStack(spacing: 0) {
            Button(action: { newChat() }) {
                HStack {
                    Image(systemName: "plus.circle.fill")
                    Text("Nova Conversa")
                    Spacer()
                }
                .frame(height: 44)
                .padding(.horizontal, 12)
                .background(Color(.systemBlue))
                .foregroundColor(.white)
                .cornerRadius(8)
                .padding(12)
            }
            .buttonStyle(.plain)
            .help("Começar nova conversa (Cmd+N)")
            
            Divider()
            
            ScrollView {
                VStack(spacing: 4) {
                    ForEach(chats) { chat in
                        NavigationLink(destination: ChatView(chat: chat), tag: chat.id, selection: $selectedChat) {
                            ChatListItem(chat: chat)
                                .padding(.horizontal, 8)
                        }
                    }
                }
                .padding(.vertical, 8)
            }
            
            Spacer()
            
            Divider()
            
            HStack {
                Image("user-avatar")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 32, height: 32)
                    .cornerRadius(6)
                
                VStack(alignment: .leading) {
                    Text("User Name")
                        .font(.system(size: 13, weight: .semibold))
                    Text("Free Plan")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Menu {
                    Button(action: { /* Settings */ }) {
                        Label("Configurações", systemImage: "gear")
                    }
                    Divider()
                    Button(role: .destructive, action: { /* Logout */ }) {
                        Label("Sair", systemImage: "icloud.and.arrow.down")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.system(size: 18))
                        .foregroundColor(.secondary)
                }
                .menuStyle(.borderlessButton)
                .frame(width: 30, height: 30)
            }
            .padding(12)
        }
        .background(Color(.controlBackgroundColor))
    }
    
    func newChat() {
        // Implementation
    }
}

struct ChatListItem: View {
    let chat: ChatItem
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(chat.title)
                .font(.system(size: 14, weight: .semibold))
                .lineLimit(1)
            
            Text(chat.preview)
                .font(.system(size: 12))
                .foregroundColor(.secondary)
                .lineLimit(1)
        }
        .frame(height: 44)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.controlBackgroundColor))
        )
        .onHover { hovering in
            // Mudar background on hover
        }
    }
}
```

### Chat View (macOS)
```swift
struct ChatView: View {
    @State var messages: [Message] = []
    @State var input: String = ""
    @State var isLoading: Bool = false
    @FocusState var inputFocused: Bool
    
    let chat: ChatItem
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            VStack(spacing: 0) {
                HStack(spacing: 0) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(chat.title)
                            .font(.system(size: 17, weight: .semibold))
                        Text(chat.description)
                            .font(.system(size: 13))
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    
                    HStack(spacing: 8) {
                        Button(action: { /* Info */ }) {
                            Image(systemName: "info.circle")
                                .font(.system(size: 16))
                        }
                        .buttonStyle(.plain)
                        .help("Informações da conversa")
                        
                        Menu {
                            Button(action: { /* Rename */ }) {
                                Label("Renomear", systemImage: "pencil")
                            }
                            Button(action: { /* Archive */ }) {
                                Label("Arquivar", systemImage: "archivebox")
                            }
                            Button(role: .destructive, action: { /* Delete */ }) {
                                Label("Deletar", systemImage: "trash")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                                .font(.system(size: 16))
                        }
                        .menuStyle(.borderlessButton)
                    }
                    .foregroundColor(.secondary)
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 16)
                
                Divider()
            }
            
            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(messages) { message in
                            ChatBubble(message: message)
                                .id(message.id)
                        }
                        
                        if isLoading {
                            LoadingBubble()
                                .id("loading")
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.vertical, 16)
                }
                .onAppear {
                    withAnimation {
                        proxy.scrollTo("loading" ?? messages.last?.id, anchor: .bottom)
                    }
                }
            }
            
            // Input
            VStack(spacing: 0) {
                Divider()
                
                HStack(spacing: 12) {
                    HStack(spacing: 8) {
                        TextField("Message...", text: $input, axis: .vertical)
                            .font(.system(size: 15, weight: .regular, design: .default))
                            .lineLimit(5)
                            .focused($inputFocused)
                            .textFieldStyle(.roundedBorder)
                        
                        Button(action: { sendMessage() }) {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.system(size: 20))
                                .foregroundColor(.blue)
                        }
                        .buttonStyle(.plain)
                        .disabled(input.trimmingCharacters(in: .whitespaces).isEmpty || isLoading)
                        .keyboardShortcut(.return, modifiers: [.command])
                        .help("Enviar (Cmd+Return)")
                    }
                    .padding(8)
                    .background(Color(.controlBackgroundColor))
                    .cornerRadius(24)
                }
                .padding(16)
            }
        }
        .background(Color(.windowBackgroundColor))
        .onAppear {
            inputFocused = true
        }
    }
    
    func sendMessage() {
        let trimmed = input.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        
        let message = Message(
            id: UUID(),
            content: trimmed,
            isUser: true,
            timestamp: Date()
        )
        
        withAnimation {
            messages.append(message)
            input = ""
        }
        
        // Simular resposta
        isLoading = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation {
                messages.append(Message(
                    id: UUID(),
                    content: "Resposta da IA aqui",
                    isUser: false,
                    timestamp: Date()
                ))
                isLoading = false
            }
        }
    }
}

struct ChatBubble: View {
    let message: Message
    
    var body: some View {
        HStack(spacing: 8) {
            if message.isUser {
                Spacer()
            }
            
            if !message.isUser {
                Image("ai-avatar")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 32, height: 32)
                    .cornerRadius(6)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                if !message.isUser {
                    Text("Claude")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.secondary)
                }
                
                Text(message.content)
                    .font(.system(size: 15, weight: .regular))
                    .lineLimit(nil)
                    .textSelection(.enabled)
            }
            .padding(12)
            .background(message.isUser ?
                Color(red: 0, green: 0.52, blue: 1) :
                Color(.controlBackgroundColor)
            )
            .foregroundColor(message.isUser ? .white : .primary)
            .cornerRadius(18)
            .contextMenu {
                Button("Copiar", action: { 
                    NSPasteboard.general.setString(message.content, forType: .string)
                })
            }
            
            if !message.isUser {
                Spacer()
            }
        }
    }
}

struct LoadingBubble: View {
    @State var opacity: Double = 0.3
    
    var body: some View {
        HStack(spacing: 8) {
            Image("ai-avatar")
                .resizable()
                .scaledToFill()
                .frame(width: 32, height: 32)
                .cornerRadius(6)
            
            HStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(Color.secondary)
                        .frame(width: 4, height: 4)
                        .opacity(opacity)
                        .animation(
                            .easeInOut(duration: 1.4)
                                .repeatForever()
                                .delay(Double(index) * 0.2),
                            value: opacity
                        )
                }
            }
            .padding(12)
            .background(Color(.controlBackgroundColor))
            .cornerRadius(18)
            
            Spacer()
        }
        .onAppear {
            opacity = 1
        }
    }
}
```

## macOS-Specific Interactions

### Context Menu
```swift
.contextMenu {
    Button("Copiar", action: { NSPasteboard.general.setString(text, forType: .string) })
    Button("Compartilhar", action: { /* Share */ })
    Divider()
    Button(role: .destructive, action: { /* Delete */ }) {
        Label("Deletar", systemImage: "trash")
    }
}
```

### Keyboard Shortcuts
```swift
@CommandsBuilder
var appCommands: some Commands {
    CommandGroup(replacing: .newItem) {
        Button("New Chat", action: { newChat() })
            .keyboardShortcut("n", modifiers: [.command])
    }
    
    CommandGroup(after: .sidebar) {
        Button("Toggle Sidebar", action: { toggleSidebar() })
            .keyboardShortcut("b", modifiers: [.command, .option])
    }
}
```

### Window Size & Position
```swift
struct ChatApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(minWidth: 800, minHeight: 600)
                .onAppear {
                    if let window = NSApplication.shared.windows.first {
                        // Restaurar tamanho anterior da janela
                        let frame = NSRect(x: 100, y: 100, width: 1200, height: 800)
                        window.setFrame(frame, display: true, animate: false)
                        window.center()
                    }
                }
        }
    }
}
```

### Menu Bar
```swift
var body: some Scene {
    MenuBarExtra(isPresented: .constant(true)) {
        VStack {
            Button("Nova Conversa", action: { newChat() })
            Divider()
            Button("Configurações", action: { showSettings() })
            Button("Sair", action: { exit(0) })
        }
        .padding(8)
    } label: {
        Image(systemName: "bubble.left.fill")
    }
}
```

## Responsividade macOS

### Espaçamento Dinâmico
```swift
let horizontalPadding: CGFloat = NSScreen.main?.frame.width ?? 1200 > 1000 ? 32 : 16
let verticalPadding: CGFloat = 16

VStack {
    // Content
}
.padding(.horizontal, horizontalPadding)
.padding(.vertical, verticalPadding)
```

### Sidebar Width
```swift
NavigationSplitView {
    Sidebar()
        .frame(
            minWidth: 200,
            idealWidth: 280,
            maxWidth: 400
        )
}
```

## Tema e Aparência

### Sistema de Cor Automático
```swift
@Environment(\.colorScheme) var colorScheme

// Automático: respeita Light/Dark mode do sistema
Text("Hello")
    .foregroundColor(.primary)
    .background(Color(.windowBackgroundColor))
```

### Accessibility Colors
```swift
VStack {
    Text("Important")
        .foregroundColor(colorScheme == .dark ? 
            Color(red: 0.3, green: 0.8, blue: 1) :
            Color(red: 0, green: 0.52, blue: 1)
        )
}
```

## Performance Tips

1. **Lazy Loading**: Carregar mensagens sob demanda
2. **Image Caching**: Cache avatares com `NSCache`
3. **Async/Await**: Usar estruturas modernas Swift
4. **Reduce Animations**: Respeitar `prefersReducedMotion`
