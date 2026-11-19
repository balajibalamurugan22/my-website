/**
 * LIFEGENIE - Settings Controller
 * Handles model selection, Gemini API key configuration, theme toggle, and audio settings.
 */

class SettingsController {
  constructor() {
    this.modal = document.getElementById('settings-modal');
    this.keyInput = document.getElementById('settings-api-key');
    this.modelSelect = document.getElementById('settings-model');
    this.tempInput = document.getElementById('settings-temperature');
    this.tempDisplay = document.getElementById('temp-value-display');
    this.systemPromptInput = document.getElementById('settings-system-prompt');
    this.sfxToggle = document.getElementById('settings-sfx-toggle');
    this.voiceToggle = document.getElementById('settings-voice-toggle');
    this.voiceRateInput = document.getElementById('settings-voice-rate');
    this.voiceRateDisplay = document.getElementById('voice-rate-display');
    this.themeSelect = document.getElementById('settings-theme');

    this.init();
  }

  init() {
    this.loadValues();

    // Temperature slider
    if (this.tempInput && this.tempDisplay) {
      this.tempInput.addEventListener('input', () => {
        this.tempDisplay.innerText = this.tempInput.value;
      });
    }

    // Voice speed slider
    if (this.voiceRateInput && this.voiceRateDisplay) {
      this.voiceRateInput.addEventListener('input', () => {
        const val = parseFloat(this.voiceRateInput.value) || 1.08;
        this.voiceRateDisplay.innerText = `${val.toFixed(2)}x ${val > 1.2 ? '(Fast)' : val < 0.95 ? '(Slow)' : '(Natural)'}`;
      });
    }

    // Modal close buttons
    document.querySelectorAll('.btn-close-settings').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }

    // Save Settings form
    const form = document.getElementById('settings-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSettings();
      });
    }

    // Test API Key button
    const testBtn = document.getElementById('btn-test-key');
    if (testBtn) {
      testBtn.addEventListener('click', () => this.testApiKey());
    }

    // Clear Storage button
    const clearBtn = document.getElementById('btn-reset-storage');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Reset all LIFEGENIE conversations, goals, and local settings?')) {
          localStorage.clear();
          location.reload();
        }
      });
    }

    // Sync dock model dropdown if changed
    const dockModel = document.getElementById('dock-model-select');
    if (dockModel) {
      let saved = localStorage.getItem('lifegenie_model');
      if (!saved || saved !== 'gemini-3.1-flash-lite') {
        saved = 'gemini-3.5-flash-lite';
        localStorage.setItem('lifegenie_model', saved);
      }
      dockModel.value = saved;
      dockModel.addEventListener('change', (e) => {
        localStorage.setItem('lifegenie_model', e.target.value);
        if (this.modelSelect) this.modelSelect.value = e.target.value;
        if (window.app) window.app.updateModelBadge(e.target.value);
      });
    }
  }

  loadValues() {
    if (this.keyInput) {
      this.keyInput.value = API.getApiKey();
    }

    if (this.modelSelect) {
      let saved = localStorage.getItem('lifegenie_model');
      if (!saved || saved.includes('2.5') || saved.includes('1.5')) {
        saved = 'gemini-3.5-flash-lite';
      }
      this.modelSelect.value = saved;
    }

    if (this.tempInput && this.tempDisplay) {
      const savedTemp = localStorage.getItem('lifegenie_temperature') || '0.7';
      this.tempInput.value = savedTemp;
      this.tempDisplay.innerText = savedTemp;
    }

    if (this.systemPromptInput) {
      this.systemPromptInput.value = localStorage.getItem('lifegenie_system_prompt') || '';
    }

    if (this.sfxToggle) {
      this.sfxToggle.checked = localStorage.getItem('lifegenie_sfx') !== 'false';
    }

    if (this.voiceToggle) {
      this.voiceToggle.checked = localStorage.getItem('lifegenie_auto_speak') === 'true';
    }

    if (this.voiceRateInput) {
      let savedRate = localStorage.getItem('lifegenie_voice_rate');
      if (!savedRate || savedRate === '1.25') savedRate = '1.08';
      this.voiceRateInput.value = savedRate;
      if (this.voiceRateDisplay) {
        const val = parseFloat(savedRate) || 1.08;
        this.voiceRateDisplay.innerText = `${val.toFixed(2)}x ${val > 1.2 ? '(Fast)' : val < 0.95 ? '(Slow)' : '(Natural)'}`;
      }
    }

    if (this.themeSelect) {
      this.themeSelect.value = localStorage.getItem('lifegenie_theme') || 'dark';
    }
  }

  open() {
    this.loadValues();
    if (this.modal) {
      this.modal.classList.add('active');
    }
  }

  close() {
    if (this.modal) {
      this.modal.classList.remove('active');
    }
  }

  async testApiKey() {
    const key = this.keyInput ? this.keyInput.value.trim() : '';
    const statusEl = document.getElementById('api-key-test-status');
    const testBtn = document.getElementById('btn-test-key');

    if (!key) {
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--rose-primary);">Please enter an API key first.</span>`;
      return;
    }

    if (testBtn) testBtn.disabled = true;
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--text-cyan);">Testing connection to Gemini 2.5 Flash...</span>`;

    try {
      const res = await API.validateKey(key, true);
      if (res.success) {
        if (statusEl) statusEl.innerHTML = `<span style="color:var(--emerald-primary);">✓ Validated successfully! Ready for AI acceleration.</span>`;
        API.setApiKey(key);
        if (window.cyberAudio) window.cyberAudio.playSuccess();
        if (window.app) {
          window.app.updateStatusIndicator(true);
          window.app.showToast('API Key verified & saved!', 'success');
        }
      } else {
        if (statusEl) statusEl.innerHTML = `<span style="color:var(--rose-primary);">✕ ${res.message}</span>`;
      }
    } catch (err) {
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--rose-primary);">✕ ${err.message}</span>`;
    } finally {
      if (testBtn) testBtn.disabled = false;
    }
  }

  saveSettings() {
    const key = this.keyInput ? this.keyInput.value.trim() : '';
    const model = this.modelSelect ? this.modelSelect.value : 'gemini-2.5-flash';
    const temp = this.tempInput ? this.tempInput.value : '0.7';
    const sys = this.systemPromptInput ? this.systemPromptInput.value.trim() : '';
    const sfx = this.sfxToggle ? this.sfxToggle.checked : true;
    const voice = this.voiceToggle ? this.voiceToggle.checked : false;
    const voiceRate = this.voiceRateInput ? parseFloat(this.voiceRateInput.value) || 1.08 : 1.08;
    const theme = this.themeSelect ? this.themeSelect.value : 'dark';

    API.setApiKey(key);
    localStorage.setItem('lifegenie_model', model);
    localStorage.setItem('lifegenie_temperature', temp);
    localStorage.setItem('lifegenie_system_prompt', sys);
    localStorage.setItem('lifegenie_sfx', sfx ? 'true' : 'false');
    localStorage.setItem('lifegenie_auto_speak', voice ? 'true' : 'false');
    localStorage.setItem('lifegenie_voice_rate', voiceRate.toString());
    localStorage.setItem('lifegenie_theme', theme);

    if (window.LIFEGENIE_VOICE) {
      window.LIFEGENIE_VOICE.autoSpeak = voice;
      window.LIFEGENIE_VOICE.setSpeechRate(voiceRate);
      window.LIFEGENIE_VOICE.updateAutoSpeakUI();
    }

    if (window.cyberAudio) {
      window.cyberAudio.enabled = sfx;
    }

    if (window.app) {
      window.app.applyTheme(theme);
      window.app.updateModelBadge(model);
      window.app.checkApiStatus();
      window.app.showToast('Settings saved successfully!', 'success');
    }

    // Sync dock model dropdown
    const dockModel = document.getElementById('dock-model-select');
    if (dockModel) dockModel.value = model;

    this.close();
  }
}

window.SettingsController = SettingsController;

