/**
 * LIFEGENIE - Quantum Voice & Speech Controller
 * Handles Speech-to-Text (STT), Text-to-Speech (TTS), and Real-time Voice Call Mode.
 */

class VoiceController {
  constructor() {
    // 1. STT Initialization
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    this.recognition = SpeechRecognition ? new SpeechRecognition() : null;
    this.isListening = false;
    this.autoSendOnSilence = false;

    // 2. TTS Initialization
    this.synth = window.speechSynthesis || null;
    this.voices = [];
    this.selectedVoice = null;
    this.isSpeaking = false;
    let savedRate = localStorage.getItem('lifegenie_voice_rate');
    if (!savedRate || savedRate === '1.25') savedRate = '1.08';
    this.speechRate = parseFloat(savedRate) || 1.08;
    this.currentSpeechSessionId = 0;
    this.keepAliveInterval = null;
    this.autoSpeak = localStorage.getItem('lifegenie_auto_speak') === 'true';

    // 3. Voice Call Mode State
    this.isCallActive = false;
    this.callVisualizer = null;
    this.isMicMuted = false;
    this.isSpeakerMuted = false;

    // DOM References
    this.voiceBtn = document.getElementById('btn-voice-input');
    this.chatInput = document.getElementById('chat-input');
    this.autoSpeakBtn = document.getElementById('btn-dock-auto-speak');
    this.autoSpeakText = document.getElementById('auto-speak-status-text');
    this.callOverlay = document.getElementById('voice-call-overlay');

    this.init();
  }

  init() {
    this.initSTT();
    this.initTTS();
    this.updateAutoSpeakUI();
    this.bindEvents();
  }

  // --------------------------------------------------------------------------
  // SPEECH-TO-TEXT (STT)
  // --------------------------------------------------------------------------
  initSTT() {
    if (!this.recognition) {
      console.warn('SpeechRecognition API is not supported in this browser.');
      if (this.voiceBtn) {
        this.voiceBtn.title = 'Speech Recognition is not supported in your browser (use Chrome or Edge)';
        this.voiceBtn.style.opacity = '0.5';
      }
      return;
    }

    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.updateMicButtonUI(true);
      if (window.cyberAudio) window.cyberAudio.playChirp?.();
      if (window.app && window.app.coreVisualizer) {
        window.app.coreVisualizer.setState('thinking');
      }
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const textToShow = finalTranscript || interimTranscript;

      if (this.isCallActive) {
        this.updateCallUserTranscript(textToShow);
      } else if (this.chatInput) {
        this.chatInput.value = textToShow;
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 160) + 'px';
      }

      if (finalTranscript && this.isCallActive) {
        this.handleCallUserSpoke(finalTranscript.trim());
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      this.stopListening();
      if (event.error === 'not-allowed') {
        if (window.app) window.app.showToast('Microphone permission blocked. Please allow mic access in your browser settings.', 'error');
      } else if (event.error !== 'no-speech') {
        if (window.app) window.app.showToast(`Voice input notice: ${event.error}`, 'info');
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.updateMicButtonUI(false);
      if (window.app && window.app.coreVisualizer && !this.isSpeaking) {
        window.app.coreVisualizer.setState('idle');
      }

      // If in continuous call mode and mic isn't muted and not speaking, restart listening
      if (this.isCallActive && !this.isMicMuted && !this.isSpeaking) {
        setTimeout(() => {
          if (this.isCallActive && !this.isSpeaking && !this.isListening) {
            this.startListening();
          }
        }, 400);
      }
    };
  }

  startListening() {
    if (!this.recognition || this.isListening) return;
    try {
      this.recognition.start();
    } catch (e) {
      console.warn('Recognition start caught error:', e);
    }
  }

  stopListening() {
    if (!this.recognition || !this.isListening) return;
    try {
      this.recognition.stop();
    } catch (e) {}
    this.isListening = false;
    this.updateMicButtonUI(false);
  }

  toggleListening() {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.stopSpeaking(); // stop any current speech before listening
      this.startListening();
    }
  }

  updateMicButtonUI(active) {
    if (!this.voiceBtn) return;
    if (active) {
      this.voiceBtn.classList.add('recording');
      this.voiceBtn.title = 'Listening... Click to stop';
      if (this.chatInput && !this.chatInput.value) {
        this.chatInput.placeholder = '🎙️ Listening... Speak your prompt now...';
      }
    } else {
      this.voiceBtn.classList.remove('recording');
      this.voiceBtn.title = 'Voice Input (Click to speak)';
      if (this.chatInput) {
        this.chatInput.placeholder = 'Ask LIFEGENIE anything...';
      }
    }
  }

  // --------------------------------------------------------------------------
  // TEXT-TO-SPEECH (TTS)
  // --------------------------------------------------------------------------
  initTTS() {
    if (!this.synth) return;

    const populateVoices = () => {
      this.voices = this.synth.getVoices();
      // Prefer friendly, natural English voices
      this.selectedVoice = this.voices.find(v => 
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Jenny') || v.name.includes('Samantha') || v.name.includes('Guy')) && v.lang.startsWith('en')
      ) || this.voices.find(v => v.lang.startsWith('en')) || this.voices[0];
    };

    populateVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = populateVoices;
    }
  }

  // Clean Markdown & Code blocks before vocalizing
  cleanTextForSpeech(markdown) {
    if (!markdown) return '';
    return markdown
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, ' [Code snippet omitted] ')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove images and markdown links [text](url) -> text
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      // Ensure separate lines / bullet points end with punctuation so sentences chunk cleanly
      .replace(/([^\s.?!])\n+/g, '$1. ')
      // Remove headings, blockquotes, bullets
      .replace(/^[#>\s*-]+/gm, '')
      // Remove bold/italics markers
      .replace(/[*_~]{1,3}/g, '')
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Fast chunking of text into sentences so synthesis begins immediately with minimal latency
  splitIntoSentences(text) {
    if (!text) return [];
    const matched = text.match(/[^.!?:\n\r]+[.!?:]+(?=[\s\n\r]|$)|[^.!?:\n\r]+/g);
    if (!matched) return [text.trim()];
    return matched.map(s => s.trim()).filter(s => s.length > 0);
  }

  speak(text, onEndCallback = null) {
    if (!this.synth || this.isSpeakerMuted) return;

    this.stopSpeaking();

    const clean = this.cleanTextForSpeech(text);
    if (!clean) return;

    const sentences = this.splitIntoSentences(clean);
    if (sentences.length === 0) return;

    const sessionId = ++this.currentSpeechSessionId;
    this.isSpeaking = true;
    this.updateSpeakingButtons(true);
    if (window.app && window.app.coreVisualizer) {
      window.app.coreVisualizer.setState('speaking');
    }
    if (this.isCallActive && this.callVisualizer) {
      this.callVisualizer.setState('speaking');
    }

    this.startSpeechKeepAlive();
    const rate = this.speechRate || 1.25;

    sentences.forEach((sentence, idx) => {
      const utterance = new SpeechSynthesisUtterance(sentence);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = rate; // Fast speech pacing (1.25x default)
      utterance.pitch = 1.0;

      if (idx === sentences.length - 1) {
        utterance.onend = () => {
          if (this.currentSpeechSessionId !== sessionId) return;
          this.stopSpeechKeepAlive();
          this.isSpeaking = false;
          if (window.app && window.app.coreVisualizer) {
            window.app.coreVisualizer.setState('idle');
          }
          if (this.isCallActive && this.callVisualizer) {
            this.callVisualizer.setState('idle');
          }
          this.updateSpeakingButtons(false);
          if (onEndCallback) onEndCallback();

          // If call is active, auto-listen for user reply
          if (this.isCallActive && !this.isMicMuted) {
            setTimeout(() => {
              if (this.isCallActive && !this.isSpeaking && !this.isListening) {
                this.startListening();
              }
            }, 300);
          }
        };
      }

      utterance.onerror = (e) => {
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('Speech synthesis utterance error:', e);
        }
        if (idx === sentences.length - 1 && this.currentSpeechSessionId === sessionId) {
          this.stopSpeechKeepAlive();
          this.isSpeaking = false;
          this.updateSpeakingButtons(false);
        }
      };

      this.synth.speak(utterance);
    });

    // Unpause immediately if Chrome/Edge was paused
    if (this.synth.paused) {
      this.synth.resume();
    }
  }

  stopSpeaking() {
    this.currentSpeechSessionId = (this.currentSpeechSessionId || 0) + 1;
    this.stopSpeechKeepAlive();
    if (this.synth) {
      this.synth.cancel();
      try {
        if (this.synth.paused) this.synth.resume();
      } catch (e) {}
    }
    this.isSpeaking = false;
    this.updateSpeakingButtons(false);
    if (window.app && window.app.coreVisualizer) {
      window.app.coreVisualizer.setState('idle');
    }
    if (this.isCallActive && this.callVisualizer) {
      this.callVisualizer.setState('idle');
    }
  }

  startSpeechKeepAlive() {
    this.stopSpeechKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      if (!this.synth || !this.isSpeaking) {
        this.stopSpeechKeepAlive();
        return;
      }
      if (this.synth.paused) {
        this.synth.resume();
      }
    }, 3500);
  }

  stopSpeechKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  setSpeechRate(rate) {
    this.speechRate = Math.max(0.8, Math.min(2.0, parseFloat(rate) || 1.08));
    localStorage.setItem('lifegenie_voice_rate', this.speechRate.toString());
  }

  toggleAutoSpeak() {
    this.autoSpeak = !this.autoSpeak;
    localStorage.setItem('lifegenie_auto_speak', this.autoSpeak ? 'true' : 'false');
    this.updateAutoSpeakUI();
    if (window.app) {
      window.app.showToast(`Voice Auto-Replay: ${this.autoSpeak ? 'Enabled (ON)' : 'Disabled (OFF)'}`, 'info');
    }
  }

  updateAutoSpeakUI() {
    if (this.autoSpeakBtn) {
      this.autoSpeakBtn.classList.toggle('active', this.autoSpeak);
    }
    if (this.autoSpeakText) {
      this.autoSpeakText.innerText = this.autoSpeak ? 'Voice: ON' : 'Voice: OFF';
    }
    const voiceToggle = document.getElementById('settings-voice-toggle');
    if (voiceToggle) {
      voiceToggle.checked = this.autoSpeak;
    }
  }

  updateSpeakingButtons(isSpeaking) {
    document.querySelectorAll('.btn-speak-msg').forEach(btn => {
      btn.classList.toggle('speaking', isSpeaking);
      const span = btn.querySelector('span');
      if (span) span.innerText = isSpeaking ? 'Stop' : 'Speak';
    });
  }

  // --------------------------------------------------------------------------
  // IMMERSIVE VOICE CALL MODE
  // --------------------------------------------------------------------------
  startVoiceCall() {
    if (!this.recognition) {
      if (window.app) window.app.showToast('Speech recognition is not supported in this browser. Please use Chrome or Edge.', 'error');
      return;
    }

    this.isCallActive = true;
    if (this.callOverlay) {
      this.callOverlay.classList.add('active');
    }

    // Initialize or resize Call Canvas Visualizer
    if (!this.callVisualizer && typeof AICoreVisualizer !== 'undefined') {
      this.callVisualizer = new AICoreVisualizer('call-core-canvas');
    } else if (this.callVisualizer) {
      this.callVisualizer.resize();
    }

    this.setCallStatus('Connecting to Neural Stream...', 'connecting');
    if (window.cyberAudio) window.cyberAudio.playSuccess?.();

    setTimeout(() => {
      this.setCallStatus('Listening... Speak naturally', 'listening');
      this.updateCallUserTranscript('Say anything to LIFEGENIE...');
      this.updateCallAiSubtitle('Hello! I am listening. What would you like to explore today?');
      this.speak('Hello! Neural voice link is active. What would you like to explore today?');
    }, 700);
  }

  endVoiceCall() {
    this.isCallActive = false;
    this.stopSpeaking();
    this.stopListening();

    if (this.callOverlay) {
      this.callOverlay.classList.remove('active');
    }
    if (window.cyberAudio) window.cyberAudio.playChirp?.();
    if (window.app) window.app.showToast('Voice call ended. Dialogue saved to chat.', 'info');
  }

  async handleCallUserSpoke(query) {
    if (!query) return;

    this.stopListening();
    this.setCallStatus('Processing quantum thoughts...', 'thinking');
    if (this.callVisualizer) this.callVisualizer.setState('thinking');

    // Add query to chat UI behind the scenes
    if (window.app && window.app.chatCtrl) {
      const conv = window.app.chatCtrl.getCurrentConversation();
      if (conv) {
        conv.messages.push({
          role: 'user',
          content: query,
          timestamp: new Date().toISOString()
        });
        window.app.chatCtrl.renderCurrentChat();
      }

      try {
        const response = await API.chat(conv.messages);
        const replyText = response.content || 'I processed your request.';
        
        conv.messages.push({
          role: 'assistant',
          content: replyText,
          timestamp: new Date().toISOString(),
          model: response.model
        });
        window.app.chatCtrl.saveConversations();
        window.app.chatCtrl.renderCurrentChat();

        this.setCallStatus('LIFEGENIE is speaking...', 'speaking');
        this.updateCallAiSubtitle(replyText);
        this.speak(replyText);

      } catch (err) {
        this.setCallStatus(`Error: ${err.message}`, 'error');
        this.speak("I encountered an issue connecting to the neural core. Please try again.");
      }
    }
  }

  setCallStatus(text, stateClass = '') {
    const statusText = document.getElementById('call-status-text');
    const statusPulse = document.getElementById('call-status-pulse');
    if (statusText) statusText.innerText = text;
    if (statusPulse) {
      statusPulse.className = `call-status-pulse ${stateClass}`;
    }
  }

  updateCallUserTranscript(text) {
    const el = document.getElementById('call-user-transcript');
    if (el) el.innerText = text ? `"${text}"` : 'Listening...';
  }

  updateCallAiSubtitle(text) {
    const el = document.getElementById('call-ai-subtitle');
    if (el) el.innerText = text;
  }

  toggleCallMic() {
    this.isMicMuted = !this.isMicMuted;
    const btn = document.getElementById('btn-call-mute-mic');
    if (btn) btn.classList.toggle('muted', this.isMicMuted);

    if (this.isMicMuted) {
      this.stopListening();
      this.setCallStatus('Microphone Muted', 'muted');
    } else {
      this.setCallStatus('Listening... Speak now', 'listening');
      this.startListening();
    }
  }

  toggleCallSpeaker() {
    this.isSpeakerMuted = !this.isSpeakerMuted;
    const btn = document.getElementById('btn-call-mute-speaker');
    if (btn) btn.classList.toggle('muted', this.isSpeakerMuted);

    if (this.isSpeakerMuted) {
      this.stopSpeaking();
    }
  }

  // --------------------------------------------------------------------------
  // BIND EVENT LISTENERS
  // --------------------------------------------------------------------------
  bindEvents() {
    // 1. Microphone Button in Chat Dock
    if (this.voiceBtn) {
      this.voiceBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleListening();
      });
    }

    // 2. Auto-Speak Toggle Button in Dock
    if (this.autoSpeakBtn) {
      this.autoSpeakBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleAutoSpeak();
      });
    }

    // 3. Start Voice Call Buttons
    document.querySelectorAll('.btn-start-voice-call').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.startVoiceCall();
      });
    });

    // 4. Voice Call Controls
    document.getElementById('btn-call-end')?.addEventListener('click', () => this.endVoiceCall());
    document.getElementById('btn-call-mute-mic')?.addEventListener('click', () => this.toggleCallMic());
    document.getElementById('btn-call-mute-speaker')?.addEventListener('click', () => this.toggleCallSpeaker());
  }
}

// Instantiate and expose globally
window.addEventListener('DOMContentLoaded', () => {
  window.LIFEGENIE_VOICE = new VoiceController();
});
