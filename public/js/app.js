/**
 * LIFEGENIE - Main Application Orchestrator
 * Coordinates navigation, themes, toast messages, and module controllers.
 */

class LifeGenieApp {
  constructor() {
    this.currentView = 'assistant';
    this.coreVisualizer = null;
    this.chatCtrl = null;
    this.studyCtrl = null;
    this.ideasCtrl = null;
    this.writingCtrl = null;
    this.goalsCtrl = null;
    this.settingsCtrl = null;

    this.init();
  }

  init() {
    // 1. Initialize Theme
    const savedTheme = localStorage.getItem('lifegenie_theme') || 'dark';
    this.applyTheme(savedTheme);

    // 2. Dynamic Greeting
    this.updateGreeting();

    // 3. Initialize Visualizer
    if (typeof AICoreVisualizer !== 'undefined') {
      this.coreVisualizer = new AICoreVisualizer('ai-core-canvas');
    }

    // 4. Initialize Controllers
    this.chatCtrl = new ChatController();
    this.studyCtrl = new StudyGenieController();
    this.ideasCtrl = new IdeaGeneratorController();
    this.writingCtrl = new WritingAssistantController();
    this.goalsCtrl = new GoalPlannerController();
    this.settingsCtrl = new SettingsController();

    // 5. Setup Navigation
    this.setupNavigation();

    // 6. Setup Mobile Drawer
    this.setupMobileMenu();

    // 7. Setup Header Buttons
    this.setupHeaderActions();

    // 8. Check Backend & API Status
    this.checkApiStatus();

    // 9. Setup User Profile & Authentication integration
    this.setupUserAuth();

    // 10. Update model badge & migrate legacy or rate-limited models
    let model = localStorage.getItem('lifegenie_model');
    if (!model || model.includes('2.5') || model.includes('1.5') || model.includes('3.5') || model.includes('3.8')) {
      model = 'gemini-3.1-flash-lite';
      localStorage.setItem('lifegenie_model', model);
    }
    const dockModel = document.getElementById('dock-model-select');
    if (dockModel) {
      dockModel.value = model;
    }
    this.updateModelBadge(model);
  }

  updateGreeting() {
    const greetingEl = document.getElementById('hero-greeting-text');
    if (!greetingEl) return;

    const hour = new Date().getHours();
    let timeGreeting = 'Hello';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 18) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    const user = window.LIFEGENIE_AUTH ? window.LIFEGENIE_AUTH.getUser() : null;
    const displayName = user && user.name ? user.name.split(' ')[0] : 'Explorer';
    greetingEl.innerText = `${timeGreeting}, ${displayName}!`;
  }

  setupUserAuth() {
    const user = window.LIFEGENIE_AUTH ? window.LIFEGENIE_AUTH.getUser() : null;
    if (!user) return;

    // Calculate avatar initials (e.g. "Alex Explorer" -> "AE")
    const parts = user.name ? user.name.trim().split(' ') : ['E'];
    const initials = parts.length > 1 
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].substring(0, 2).toUpperCase();

    // Update Header Profile
    const headerAvatar = document.getElementById('header-user-avatar');
    const headerName = document.getElementById('header-user-name');
    if (headerAvatar) headerAvatar.innerText = initials;
    if (headerName) headerName.innerText = user.name || 'Explorer';

    // Update Sidebar Profile Card
    const sidebarAvatar = document.getElementById('sidebar-user-avatar');
    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarEmail = document.getElementById('sidebar-user-email');
    if (sidebarAvatar) sidebarAvatar.innerText = initials;
    if (sidebarName) sidebarName.innerText = user.name || 'Explorer';
    if (sidebarEmail) sidebarEmail.innerText = user.email || (user.isGuest ? 'Guest Session' : 'explorer@lifegenie.ai');

    // Logout Actions
    const handleLogout = async () => {
      if (confirm(`Sign out from LIFEGENIE as ${user.name}?`)) {
        if (window.cyberAudio) window.cyberAudio.playClick?.();
        this.showToast('Signing out of Neural Stream...', 'info');
        setTimeout(() => {
          window.LIFEGENIE_AUTH.logout();
        }, 300);
      }
    };

    document.getElementById('btn-header-logout')?.addEventListener('click', handleLogout);
    document.getElementById('btn-sidebar-logout')?.addEventListener('click', handleLogout);
  }

  setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.getAttribute('data-view');
        if (view === 'settings') {
          this.openSettings();
        } else if (view) {
          this.switchView(view);
          this.closeMobileSidebar();
        }
      });
    });

    // Brand click returns to assistant
    document.getElementById('brand-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.switchView('assistant');
    });
  }

  switchView(viewName) {
    this.currentView = viewName;

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewName);
    });

    // Update view panes
    document.querySelectorAll('.view-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    const targetPane = document.getElementById(`view-${viewName}`);
    if (targetPane) {
      targetPane.classList.add('active');
    }

    // Update Header Title
    const titleEl = document.getElementById('header-view-title');
    const pillEl = document.getElementById('header-view-pill');
    const titles = {
      assistant: { title: 'AI Assistant', pill: 'Neural Core' },
      study: { title: 'Study Genie', pill: 'Academic AI' },
      ideas: { title: 'Idea Generator', pill: 'Innovation Engine' },
      writing: { title: 'Writing Assistant', pill: 'Creative Studio' },
      goals: { title: 'Goal Planner', pill: 'Execution Roadmap' }
    };

    if (titles[viewName]) {
      if (titleEl) titleEl.innerText = titles[viewName].title;
      if (pillEl) pillEl.innerText = titles[viewName].pill;
    }

    if (window.cyberAudio) window.cyberAudio.playChirp();
  }

  setupMobileMenu() {
    const toggleBtn = document.getElementById('btn-mobile-toggle');
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    const toggleSidebar = (open) => {
      const shouldOpen = typeof open === 'boolean' ? open : !sidebar.classList.contains('mobile-open');
      sidebar.classList.toggle('mobile-open', shouldOpen);
      if (backdrop) {
        backdrop.classList.toggle('active', shouldOpen);
      }
    };

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSidebar();
      });

      if (backdrop) {
        backdrop.addEventListener('click', () => {
          toggleSidebar(false);
        });
      }

      // Close when clicking outside
      document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('mobile-open') && 
            !sidebar.contains(e.target) && 
            e.target !== toggleBtn && 
            !toggleBtn.contains(e.target)) {
          toggleSidebar(false);
        }
      });
    }
  }

  closeMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
  }

  setupHeaderActions() {
    // SFX toggle button
    const sfxBtn = document.getElementById('btn-header-sfx');
    if (sfxBtn && window.cyberAudio) {
      sfxBtn.addEventListener('click', () => {
        const enabled = window.cyberAudio.toggle();
        this.showToast(`Audio FX: ${enabled ? 'Enabled' : 'Disabled'}`, 'info');
        sfxBtn.style.color = enabled ? 'var(--text-cyan)' : 'var(--text-muted)';
      });
    }

    // Theme toggle button
    const themeBtn = document.getElementById('btn-header-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const currentTheme = document.body.classList.contains('theme-light') ? 'light' : 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
        localStorage.setItem('lifegenie_theme', newTheme);
        this.showToast(`Theme switched to ${newTheme === 'dark' ? 'Cyber Dark' : 'Polar Light'}`, 'info');
      });
    }

    // Settings open buttons
    document.querySelectorAll('.btn-open-settings').forEach(btn => {
      btn.addEventListener('click', () => this.openSettings());
    });

    // Alert badge click opens settings
    document.getElementById('btn-key-alert')?.addEventListener('click', () => {
      this.openSettings();
    });
  }

  applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
  }

  openSettings() {
    if (this.settingsCtrl) {
      this.settingsCtrl.open();
    }
  }

  async checkApiStatus() {
    try {
      const status = await API.getStatus();
      this.updateStatusIndicator(status.configured);
    } catch (e) {
      this.updateStatusIndicator(false);
    }
  }

  updateStatusIndicator(isConfigured) {
    const pulseDot = document.getElementById('status-pulse-dot');
    const statusText = document.getElementById('status-text');
    const keyAlert = document.getElementById('btn-key-alert');

    if (isConfigured) {
      if (pulseDot) {
        pulseDot.classList.remove('warning');
      }
      if (statusText) statusText.innerText = 'AI Core Online';
      if (keyAlert) keyAlert.style.display = 'none';
    } else {
      if (pulseDot) {
        pulseDot.classList.add('warning');
      }
      if (statusText) statusText.innerText = 'API Key Required';
      if (keyAlert) keyAlert.style.display = 'flex';
    }
  }

  updateModelBadge(modelId) {
    const badges = document.querySelectorAll('.model-badge-text');
    badges.forEach(b => {
      b.innerText = modelId || 'gemini-3.1-flash-lite';
    });
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
    toast.innerHTML = `<span style="font-weight:700;">${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
}

// Start app once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.app = new LifeGenieApp();
});

