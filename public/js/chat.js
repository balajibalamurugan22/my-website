/**
 * LIFEGENIE - AI Assistant Chat Controller
 * Manages conversation history, message streams, markdown rendering, and user input.
 */

class ChatController {
  constructor() {
    this.conversations = this.loadConversations();
    this.currentChatId = localStorage.getItem(this.getActiveChatKey()) || null;
    this.isGenerating = false;

    this.messagesContainer = document.getElementById('chat-messages');
    this.heroWelcome = document.getElementById('hero-welcome');
    this.chatInput = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('btn-send');
    this.historyList = document.getElementById('sidebar-history-list');

    this.init();
  }

  getConvKey() {
    return window.LIFEGENIE_AUTH ? window.LIFEGENIE_AUTH.getStorageKey('lifegenie_conversations') : 'lifegenie_conversations';
  }

  getActiveChatKey() {
    return window.LIFEGENIE_AUTH ? window.LIFEGENIE_AUTH.getStorageKey('lifegenie_active_chat') : 'lifegenie_active_chat';
  }

  loadConversations() {
    try {
      const key = this.getConvKey();
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
      // If no scoped conversations exist yet, check if this is the default demo user
      // and migrate legacy conversations so the demo user doesn't lose sample work
      const user = window.LIFEGENIE_AUTH ? window.LIFEGENIE_AUTH.getUser() : null;
      if (user && user.email === 'explorer@lifegenie.ai') {
        const legacy = localStorage.getItem('lifegenie_conversations');
        if (legacy) {
          localStorage.setItem(key, legacy);
          return JSON.parse(legacy);
        }
      }
      return [];
    } catch (e) {
      console.error('Failed to parse conversations:', e);
      return [];
    }
  }

  saveConversations() {
    try {
      const convKey = this.getConvKey();
      const activeKey = this.getActiveChatKey();
      localStorage.setItem(convKey, JSON.stringify(this.conversations));
      if (this.currentChatId) {
        localStorage.setItem(activeKey, this.currentChatId);
      }
    } catch (e) {
      console.error('Failed to save conversations:', e);
    }
  }

  getCurrentConversation() {
    return this.conversations.find(c => c.id === this.currentChatId);
  }

  updateActivity() {
    try {
      localStorage.setItem('lifegenie_last_active_time', Date.now().toString());
    } catch (e) {}
  }

  init() {
    // Detect returning user (closed tab/session or >10 minutes inactivity)
    const sessionActive = sessionStorage.getItem('lifegenie_session_active');
    const lastActiveTime = parseInt(localStorage.getItem('lifegenie_last_active_time') || '0', 10);
    const timeElapsed = Date.now() - lastActiveTime;
    const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

    // Mark current session as active
    sessionStorage.setItem('lifegenie_session_active', 'true');
    this.updateActivity();

    window.addEventListener('beforeunload', () => {
      this.updateActivity();
    });

    // If user returns after closing tab or after inactivity, and previous chat had messages:
    const activeConv = this.getCurrentConversation();
    const shouldStartFresh = (!sessionActive || timeElapsed > INACTIVITY_TIMEOUT) && activeConv && activeConv.messages && activeConv.messages.length > 0;

    if (shouldStartFresh || !this.currentChatId || !this.getCurrentConversation()) {
      this.createNewChat(false);
    }

    this.renderHistory();
    this.renderCurrentChat();

    // Setup input listeners
    if (this.chatInput) {
      this.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      this.chatInput.addEventListener('input', () => {
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 160) + 'px';
      });
    }

    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => this.sendMessage());
    }

    // New Chat Button
    const newChatBtn = document.getElementById('btn-new-chat');
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => {
        this.createNewChat(true);
        if (window.cyberAudio) window.cyberAudio.playChirp();
      });
    }

    // Clear Chat Button
    const clearChatBtn = document.getElementById('btn-clear-chat');
    if (clearChatBtn) {
      clearChatBtn.addEventListener('click', () => this.clearCurrentChat());
    }

    // Clear All History Button
    const clearAllBtn = document.getElementById('btn-clear-all-history');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => this.clearAllHistory());
    }

    // Setup prompt suggestion cards
    document.querySelectorAll('.prompt-card').forEach(card => {
      card.addEventListener('click', () => {
        const text = card.getAttribute('data-prompt');
        if (text && this.chatInput) {
          this.chatInput.value = text;
          this.sendMessage();
        }
      });
    });
  }

  createNewChat(switchView = true) {
    // If the top chat is already empty with 0 messages, simply reuse it
    if (this.conversations.length > 0 && this.conversations[0].messages.length === 0) {
      this.currentChatId = this.conversations[0].id;
      this.saveConversations();
      this.renderHistory();
      this.renderCurrentChat();
      if (switchView && window.app) window.app.switchView('assistant');
      return;
    }

    const newId = 'chat_' + Date.now();
    const newChat = {
      id: newId,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      messages: []
    };
    this.conversations.unshift(newChat);
    this.currentChatId = newId;
    this.saveConversations();
    this.renderHistory();
    this.renderCurrentChat();

    if (switchView && window.app) {
      window.app.switchView('assistant');
    }
  }

  clearCurrentChat() {
    const conv = this.getCurrentConversation();
    if (!conv) return;
    if (confirm('Are you sure you want to clear this conversation?')) {
      conv.messages = [];
      conv.title = 'New Conversation';
      this.saveConversations();
      this.renderHistory();
      this.renderCurrentChat();
      if (window.app) window.app.showToast('Conversation cleared', 'info');
    }
  }

  clearAllHistory() {
    if (confirm('Clear all conversation history?')) {
      this.conversations = [];
      this.createNewChat(false);
      if (window.app) window.app.showToast('All chat history cleared', 'info');
    }
  }

  renderHistory() {
    if (!this.historyList) return;
    this.historyList.innerHTML = '';

    if (this.conversations.length === 0) {
      this.historyList.innerHTML = `<li class="history-item" style="color:var(--text-muted); font-size:0.75rem;">No history yet</li>`;
      return;
    }

    this.conversations.forEach(conv => {
      const li = document.createElement('li');
      li.className = `history-item ${conv.id === this.currentChatId ? 'active' : ''}`;
      li.innerHTML = `
        <span title="${conv.title}">${conv.title}</span>
        <button class="btn-del-chat" title="Delete conversation">✕</button>
      `;

      li.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-del-chat')) {
          e.stopPropagation();
          this.deleteConversation(conv.id);
          return;
        }
        this.currentChatId = conv.id;
        this.saveConversations();
        this.renderHistory();
        this.renderCurrentChat();
        if (window.app) window.app.switchView('assistant');
      });

      this.historyList.appendChild(li);
    });
  }

  deleteConversation(id) {
    this.conversations = this.conversations.filter(c => c.id !== id);
    if (this.currentChatId === id) {
      this.currentChatId = this.conversations.length > 0 ? this.conversations[0].id : null;
      if (!this.currentChatId) {
        this.createNewChat(false);
      }
    }
    this.saveConversations();
    this.renderHistory();
    this.renderCurrentChat();
  }

  renderCurrentChat() {
    const conv = this.getCurrentConversation();
    if (!conv || conv.messages.length === 0) {
      if (this.heroWelcome) this.heroWelcome.style.display = 'flex';
      if (this.messagesContainer) {
        this.messagesContainer.style.display = 'none';
        this.messagesContainer.innerHTML = '';
      }
      return;
    }

    if (this.heroWelcome) this.heroWelcome.style.display = 'none';
    if (this.messagesContainer) {
      this.messagesContainer.style.display = 'flex';
      this.messagesContainer.innerHTML = '';

      conv.messages.forEach(msg => {
        this.appendMessageElement(msg);
      });
      this.scrollToBottom();
    }
  }

  appendMessageElement(msg) {
    if (!this.messagesContainer) return;
    const row = document.createElement('div');
    row.className = `message-row ${msg.role === 'user' ? 'user' : 'ai'}`;

    const isUser = msg.role === 'user';
    const avatarIcon = isUser 
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3m10-10h-3M5 12H2m17.07 7.07l-2.12-2.12M7.05 7.05L4.93 4.93m14.14 0l-2.12 2.12M7.05 16.95l-2.12 2.12"/></svg>`;

    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    let formattedContent = msg.content;
    if (!isUser && typeof marked !== 'undefined') {
      try {
        formattedContent = marked.parse(msg.content);
      } catch (e) {
        formattedContent = msg.content;
      }
    } else {
      // Escape HTML for user
      const div = document.createElement('div');
      div.innerText = msg.content;
      formattedContent = div.innerHTML.replace(/\n/g, '<br>');
    }

    row.innerHTML = `
      <div class="msg-avatar">${avatarIcon}</div>
      <div class="msg-bubble">
        <div class="msg-header">
          <span class="msg-author">${isUser ? 'You' : 'LIFEGENIE AI'}</span>
          <span>${timeStr}</span>
        </div>
        <div class="markdown-body">${formattedContent}</div>
        ${!isUser ? `
          <div class="msg-tools">
            <button class="btn-msg-tool btn-copy-msg" title="Copy response">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy</span>
            </button>
            <button class="btn-msg-tool btn-speak-msg" title="Read message aloud">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
              <span>Speak</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;

    // Copy action
    const copyBtn = row.querySelector('.btn-copy-msg');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(msg.content).then(() => {
          if (window.app) window.app.showToast('Copied to clipboard!', 'success');
        });
      });
    }

    // Speak action
    const speakBtn = row.querySelector('.btn-speak-msg');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        if (window.LIFEGENIE_VOICE) {
          if (window.LIFEGENIE_VOICE.isSpeaking) {
            window.LIFEGENIE_VOICE.stopSpeaking();
          } else {
            window.LIFEGENIE_VOICE.speak(msg.content);
          }
        }
      });
    }

    // Code block copy buttons
    row.querySelectorAll('pre').forEach(pre => {
      const code = pre.querySelector('code');
      if (code && typeof hljs !== 'undefined') {
        hljs.highlightElement(code);
      }
    });

    this.messagesContainer.appendChild(row);
  }

  showTypingIndicator() {
    if (!this.messagesContainer) return;
    const typing = document.createElement('div');
    typing.id = 'active-typing-indicator';
    typing.className = 'message-row ai';
    typing.innerHTML = `
      <div class="msg-avatar" style="background:var(--grad-accent-btn); box-shadow:var(--glow-cyan);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3m10-10h-3M5 12H2"/></svg>
      </div>
      <div class="msg-bubble" style="padding: 12px 18px;">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <span style="font-size:0.78rem; color:var(--text-cyan); margin-left:8px; font-weight:600;">Processing quantum neural stream...</span>
        </div>
      </div>
    `;
    this.messagesContainer.appendChild(typing);
    this.scrollToBottom();
  }

  removeTypingIndicator() {
    const indicator = document.getElementById('active-typing-indicator');
    if (indicator) indicator.remove();
  }

  scrollToBottom() {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  }

  async sendMessage() {
    if (this.isGenerating || !this.chatInput) return;
    const text = this.chatInput.value.trim();
    if (!text) return;

    const conv = this.getCurrentConversation();
    if (!conv) return;

    // Reset input
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';

    // Play send audio & pre-warm speech engines on user interaction
    if (window.cyberAudio) window.cyberAudio.playSend();
    if (window.speechSynthesis) {
      try {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      } catch (e) {}
    }

    // Hide hero if visible
    if (this.heroWelcome) this.heroWelcome.style.display = 'none';
    if (this.messagesContainer) this.messagesContainer.style.display = 'flex';

    // Add user message to conversation
    const userMsg = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    conv.messages.push(userMsg);
    this.saveConversations();
    this.updateActivity();

    // Auto-update conversation title from first message
    if (conv.messages.length === 1) {
      conv.title = text.length > 32 ? text.substring(0, 32) + '...' : text;
      this.renderHistory();
    }

    this.appendMessageElement(userMsg);
    this.scrollToBottom();

    // Set UI to loading state
    this.isGenerating = true;
    if (this.sendBtn) this.sendBtn.disabled = true;
    this.showTypingIndicator();

    if (window.app && window.app.coreVisualizer) {
      window.app.coreVisualizer.setState('thinking');
    }

    try {
      const validMessages = conv.messages.filter(m => m && m.content && !m.content.startsWith('⚠️'));
      const response = await API.chat(validMessages.length > 0 ? validMessages : conv.messages);

      this.removeTypingIndicator();

      const aiMsg = {
        role: 'assistant',
        content: response.content || 'I processed your request.',
        timestamp: new Date().toISOString(),
        model: response.model
      };

      conv.messages.push(aiMsg);
      this.saveConversations();
      this.updateActivity();

      // 1. Play immediate reply audio chime so the user gets instant audio feedback
      if (window.cyberAudio) {
        window.cyberAudio.playReceive();
      }

      // 2. Immediate voice replay at comfortable, natural pace (without delay)
      if (window.LIFEGENIE_VOICE && window.LIFEGENIE_VOICE.autoSpeak) {
        window.LIFEGENIE_VOICE.speak(aiMsg.content);
      }

      this.appendMessageElement(aiMsg);
      this.scrollToBottom();

    } catch (err) {
      this.removeTypingIndicator();
      console.error('Chat error:', err);

      if (window.cyberAudio) window.cyberAudio.playError();

      // Show friendly error card in chat
      const errorMsg = {
        role: 'assistant',
        content: `⚠️ **Connection Error**: ${err.message}\n\n*If you haven't added your Gemini API key yet, click the **Settings** button in the header or sidebar to configure it.*`,
        timestamp: new Date().toISOString()
      };
      conv.messages.push(errorMsg);
      this.appendMessageElement(errorMsg);
      this.scrollToBottom();

      if (err.message && err.message.includes('API Key')) {
        if (window.app) window.app.openSettings();
      }
    } finally {
      this.isGenerating = false;
      if (this.sendBtn) this.sendBtn.disabled = false;
      if (window.app && window.app.coreVisualizer) {
        window.app.coreVisualizer.setState('idle');
      }
    }
  }
}

window.ChatController = ChatController;

