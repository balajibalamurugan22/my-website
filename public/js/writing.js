/**
 * LIFEGENIE - Writing Assistant Module
 * Essays, stories, emails, grammar correction, and tone rewriting.
 */

class WritingAssistantController {
  constructor() {
    this.currentMode = 'essay';
    this.lastGeneratedContent = '';
    this.init();
  }

  init() {
    // Mode selector change
    const modeSelect = document.getElementById('writing-mode');
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        this.currentMode = e.target.value;
        this.updateFormLabels();
      });
    }

    const form = document.getElementById('writing-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.generateWriting();
      });
    }

    // Input counter
    const inputArea = document.getElementById('writing-input-text');
    if (inputArea) {
      inputArea.addEventListener('input', () => {
        this.updateWordCount(inputArea.value, 'writing-input-count');
      });
    }

    // Copy button
    document.getElementById('btn-copy-writing')?.addEventListener('click', () => {
      if (!this.lastGeneratedContent) return;
      navigator.clipboard.writeText(this.lastGeneratedContent);
      if (window.app) window.app.showToast('Copied to clipboard!', 'success');
    });

    // Download Markdown button
    document.getElementById('btn-download-writing')?.addEventListener('click', () => {
      this.downloadMarkdown();
    });
  }

  updateFormLabels() {
    const promptLabel = document.getElementById('writing-prompt-label');
    const textLabel = document.getElementById('writing-text-label');
    const textGroup = document.getElementById('writing-text-group');

    if (!promptLabel) return;

    switch (this.currentMode) {
      case 'essay':
        promptLabel.innerText = 'Essay Topic / Thesis Question';
        if (textGroup) textGroup.style.display = 'none';
        break;
      case 'story':
        promptLabel.innerText = 'Story Premise / Characters & Setting';
        if (textGroup) textGroup.style.display = 'none';
        break;
      case 'letter':
        promptLabel.innerText = 'Recipient & Objective (e.g. Job application, proposal)';
        if (textGroup) textGroup.style.display = 'block';
        if (textLabel) textLabel.innerText = 'Key Points to Include (Optional)';
        break;
      case 'grammar':
        promptLabel.innerText = 'Context / Focus (e.g. Academic paper, casual email)';
        if (textGroup) textGroup.style.display = 'block';
        if (textLabel) textLabel.innerText = 'Text to Proofread & Polish';
        break;
      case 'rewrite':
        promptLabel.innerText = 'Target Goal (e.g. Make more persuasive and executive)';
        if (textGroup) textGroup.style.display = 'block';
        if (textLabel) textLabel.innerText = 'Original Text to Rewrite';
        break;
    }
  }

  updateWordCount(str, elementId) {
    const countEl = document.getElementById(elementId);
    if (!countEl) return;
    const words = str.trim() ? str.trim().split(/\s+/).length : 0;
    countEl.innerText = `${words} words • ${str.length} chars`;
  }

  async generateWriting() {
    const prompt = document.getElementById('writing-prompt')?.value?.trim();
    const text = document.getElementById('writing-input-text')?.value?.trim();
    const tone = document.getElementById('writing-tone')?.value;
    const length = document.getElementById('writing-length')?.value;
    const outputEl = document.getElementById('writing-output-content');
    const submitBtn = document.getElementById('btn-writing-submit');

    if (!outputEl) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Crafting with AI Eloquence...</span>`;
    outputEl.innerHTML = `<div class="typing-indicator" style="padding:20px;"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;

    try {
      const res = await API.write({
        mode: this.currentMode,
        prompt,
        text,
        tone,
        length
      });

      this.lastGeneratedContent = res.content;
      outputEl.innerHTML = marked.parse(res.content);
      this.updateWordCount(res.content, 'writing-output-count');

      if (window.cyberAudio) window.cyberAudio.playSuccess();
    } catch (err) {
      outputEl.innerHTML = `<div style="color:var(--rose-primary); padding:16px;">⚠️ ${err.message}</div>`;
      if (window.cyberAudio) window.cyberAudio.playError();
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Generate Document</span>`;
    }
  }

  downloadMarkdown() {
    if (!this.lastGeneratedContent) return;
    const blob = new Blob([this.lastGeneratedContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifegenie-${this.currentMode}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (window.app) window.app.showToast('Downloaded markdown file!', 'success');
  }
}

window.WritingAssistantController = WritingAssistantController;

