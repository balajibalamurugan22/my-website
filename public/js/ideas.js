/**
 * LIFEGENIE - Idea Generator Module
 * Generates breakthrough startup ideas, game development projects, inventions, and creative concepts.
 */

class IdeaGeneratorController {
  constructor() {
    this.selectedCategory = 'Startup & Inventions';
    this.savedIdeas = this.loadSavedIdeas();
    this.init();
  }

  getIdeasKey() {
    return window.LIFEGENIE_AUTH ? window.LIFEGENIE_AUTH.getStorageKey('lifegenie_saved_ideas') : 'lifegenie_saved_ideas';
  }

  loadSavedIdeas() {
    try {
      const stored = localStorage.getItem(this.getIdeasKey());
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  saveSavedIdeas() {
    try {
      localStorage.setItem(this.getIdeasKey(), JSON.stringify(this.savedIdeas));
    } catch (e) {}
  }

  init() {
    // Category chips selection
    document.querySelectorAll('.idea-cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.idea-cat-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedCategory = chip.getAttribute('data-cat') || 'Startup & Inventions';
      });
    });

    const form = document.getElementById('idea-generator-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.generateIdeas();
      });
    }

    const viewSavedBtn = document.getElementById('btn-view-saved-ideas');
    if (viewSavedBtn) {
      viewSavedBtn.addEventListener('click', () => this.toggleSavedIdeas());
    }

    this.renderSavedIdeas();
  }

  async generateIdeas() {
    const topic = document.getElementById('idea-topic')?.value?.trim();
    const audience = document.getElementById('idea-audience')?.value?.trim();
    const vibe = document.getElementById('idea-vibe')?.value;
    const outputContainer = document.getElementById('ideas-output');
    const submitBtn = document.getElementById('btn-ideas-submit');

    if (!outputContainer) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Synthesizing Breakthrough Ideas...</span>`;
    outputContainer.innerHTML = `<div class="typing-indicator" style="padding:24px;"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;

    try {
      const res = await API.ideas({
        category: this.selectedCategory,
        topic,
        audience,
        vibe,
        count: 3
      });

      outputContainer.innerHTML = `
        <div class="glass-panel" style="margin-top:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border-glass); padding-bottom:8px;">
            <h3 style="color:var(--text-cyan); font-size:1.15rem;">💡 Generated Concepts: ${this.selectedCategory}</h3>
            <div style="display:flex; gap:8px;">
              <button class="btn-msg-tool" id="btn-save-batch-idea">⭐ Save to Favorites</button>
              <button class="btn-msg-tool" id="btn-copy-ideas">Copy All</button>
            </div>
          </div>
          <div class="markdown-body">${marked.parse(res.content)}</div>
        </div>
      `;

      document.getElementById('btn-copy-ideas')?.addEventListener('click', () => {
        navigator.clipboard.writeText(res.content);
        if (window.app) window.app.showToast('Copied ideas!', 'success');
      });

      document.getElementById('btn-save-batch-idea')?.addEventListener('click', () => {
        this.saveIdea({
          id: 'idea_' + Date.now(),
          category: this.selectedCategory,
          topic: topic || 'Open Concept',
          content: res.content,
          date: new Date().toLocaleDateString()
        });
      });

      if (window.cyberAudio) window.cyberAudio.playSuccess();
    } catch (err) {
      outputContainer.innerHTML = `<div class="glass-panel" style="color:var(--rose-primary); margin-top:16px;">⚠️ ${err.message}</div>`;
      if (window.cyberAudio) window.cyberAudio.playError();
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Generate Innovative Ideas</span>`;
    }
  }

  saveIdea(idea) {
    this.savedIdeas.unshift(idea);
    this.saveSavedIdeas();
    this.renderSavedIdeas();
    if (window.app) window.app.showToast('Idea saved to favorites!', 'success');
  }

  renderSavedIdeas() {
    const list = document.getElementById('saved-ideas-list');
    if (!list) return;

    if (this.savedIdeas.length === 0) {
      list.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem; padding:10px;">No saved ideas yet. Click "Save to Favorites" after generating ideas.</p>`;
      return;
    }

    list.innerHTML = this.savedIdeas.map((item, idx) => `
      <div class="glass-panel" style="margin-bottom:12px; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:0.8rem; font-weight:700; color:var(--text-cyan);">${item.category} • ${item.date}</span>
          <button class="btn-clear-history" data-del-idx="${idx}" style="font-size:0.75rem;">Delete</button>
        </div>
        <div class="markdown-body" style="font-size:0.88rem; max-height:160px; overflow-y:auto;">
          ${marked.parse(item.content)}
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-del-idx]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.getAttribute('data-del-idx'));
        this.savedIdeas.splice(idx, 1);
        this.saveSavedIdeas();
        this.renderSavedIdeas();
      });
    });
  }

  toggleSavedIdeas() {
    const drawer = document.getElementById('saved-ideas-drawer');
    if (drawer) {
      drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
    }
  }
}

window.IdeaGeneratorController = IdeaGeneratorController;

