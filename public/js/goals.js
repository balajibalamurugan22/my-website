/**
 * LIFEGENIE - Goal Planner Module
 * Goal creation, milestone tracking, progress bars, and AI milestone generation.
 */

class GoalPlannerController {
  constructor() {
    this.goals = this.loadGoals();
    this.filter = 'all';
    this.init();
  }

  getGoalsKey() {
    return window.LIFEGENIE_AUTH ? window.LIFEGENIE_AUTH.getStorageKey('lifegenie_goals') : 'lifegenie_goals';
  }

  loadGoals() {
    try {
      const stored = localStorage.getItem(this.getGoalsKey());
      if (stored) return JSON.parse(stored);
      // Default initial goal
      return [
        {
          id: 'goal_sample_1',
          title: 'Master Full-Stack AI Application Engineering',
          category: 'Learning & Skills',
          targetDate: '2026-12-31',
          priority: 'High',
          description: 'Build production-ready apps using Google Gemini and modern web technologies.',
          milestones: [
            { id: 'm1', title: 'Learn Gemini API core features and parameters', completed: true },
            { id: 'm2', title: 'Design futuristic UI with glassmorphism and animations', completed: true },
            { id: 'm3', title: 'Implement interactive tools and local persistence', completed: false },
            { id: 'm4', title: 'Deploy and test on mobile and desktop devices', completed: false }
          ],
          createdAt: new Date().toISOString()
        }
      ];
    } catch (e) {
      return [];
    }
  }

  saveGoals() {
    try {
      localStorage.setItem(this.getGoalsKey(), JSON.stringify(this.goals));
    } catch (e) {}
  }

  init() {
    const addGoalForm = document.getElementById('new-goal-form');
    if (addGoalForm) {
      addGoalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addGoal();
      });
    }

    // AI Milestone Generator button in Goal form
    const aiBreakdownBtn = document.getElementById('btn-ai-goal-breakdown');
    if (aiBreakdownBtn) {
      aiBreakdownBtn.addEventListener('click', () => this.generateAiMilestones());
    }

    // Filter tabs
    document.querySelectorAll('.goal-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.goal-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filter = btn.getAttribute('data-filter') || 'all';
        this.renderGoals();
      });
    });

    this.renderStats();
    this.renderGoals();
  }

  async generateAiMilestones() {
    const title = document.getElementById('goal-title')?.value?.trim();
    const category = document.getElementById('goal-category')?.value;
    const targetDate = document.getElementById('goal-date')?.value;
    const description = document.getElementById('goal-desc')?.value?.trim();
    const btn = document.getElementById('btn-ai-goal-breakdown');
    const milestoneContainer = document.getElementById('goal-ai-milestones-preview');

    if (!title) {
      if (window.app) window.app.showToast('Please enter a Goal Title first!', 'info');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span>AI Synthesizing Milestones...</span>`;

    try {
      const res = await API.breakdownGoal({ title, category, targetDate, description });
      const plan = res.plan;

      if (plan && plan.milestones) {
        let previewHtml = `
          <div class="glass-panel" style="margin-top:14px; background:rgba(0, 240, 255, 0.05); border-color:var(--border-glass-strong); padding:16px;">
            <h4 style="color:var(--text-cyan); font-size:0.9rem; margin-bottom:8px;">✨ AI Strategy: ${plan.summary || ''}</h4>
            <div style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:8px;">Estimated Duration: ${plan.estimatedDuration || 'N/A'}</div>
            <ul style="padding-left:18px; font-size:0.85rem; display:flex; flex-direction:column; gap:6px;">
        `;

        this.tempAiMilestones = plan.milestones.map((m, i) => {
          previewHtml += `<li><strong>${m.title}</strong>: ${m.description} (${m.estimatedDays} days)</li>`;
          return {
            id: 'm_' + Date.now() + '_' + i,
            title: `${m.title} - ${m.description}`,
            completed: false
          };
        });

        previewHtml += `</ul>
          <div style="margin-top:10px; font-size:0.75rem; color:var(--emerald-primary);">✓ Milestones will be added automatically upon creating this goal!</div>
        </div>`;

        if (milestoneContainer) {
          milestoneContainer.innerHTML = previewHtml;
          milestoneContainer.style.display = 'block';
        }

        if (window.cyberAudio) window.cyberAudio.playSuccess();
        if (window.app) window.app.showToast('AI Action Milestones generated!', 'success');
      }
    } catch (err) {
      if (window.app) window.app.showToast(`AI Milestone error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>✨ AI Generate Action Steps</span>`;
    }
  }

  addGoal() {
    const title = document.getElementById('goal-title')?.value?.trim();
    const category = document.getElementById('goal-category')?.value;
    const targetDate = document.getElementById('goal-date')?.value;
    const priority = document.getElementById('goal-priority')?.value || 'Medium';
    const description = document.getElementById('goal-desc')?.value?.trim();

    if (!title) return;

    let milestones = [];
    if (this.tempAiMilestones && this.tempAiMilestones.length > 0) {
      milestones = [...this.tempAiMilestones];
      this.tempAiMilestones = null;
    } else {
      // Default starting milestone
      milestones = [
        { id: 'm_' + Date.now() + '_1', title: 'Define initial action step and resources', completed: false }
      ];
    }

    const newGoal = {
      id: 'goal_' + Date.now(),
      title,
      category,
      targetDate: targetDate || 'No deadline',
      priority,
      description,
      milestones,
      createdAt: new Date().toISOString()
    };

    this.goals.unshift(newGoal);
    this.saveGoals();

    // Reset form
    document.getElementById('new-goal-form')?.reset();
    const milestoneContainer = document.getElementById('goal-ai-milestones-preview');
    if (milestoneContainer) {
      milestoneContainer.innerHTML = '';
      milestoneContainer.style.display = 'none';
    }

    this.renderStats();
    this.renderGoals();
    if (window.app) window.app.showToast('Goal added successfully!', 'success');
  }

  toggleMilestone(goalId, milestoneId) {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) return;

    const milestone = goal.milestones.find(m => m.id === milestoneId);
    if (!milestone) return;

    milestone.completed = !milestone.completed;
    this.saveGoals();
    this.renderStats();
    this.renderGoals();

    if (milestone.completed) {
      if (window.cyberAudio) window.cyberAudio.playSuccess();
    }
  }

  deleteGoal(id) {
    if (confirm('Delete this goal?')) {
      this.goals = this.goals.filter(g => g.id !== id);
      this.saveGoals();
      this.renderStats();
      this.renderGoals();
    }
  }

  addCustomMilestone(goalId) {
    const text = prompt('Enter new milestone action step:');
    if (!text || !text.trim()) return;

    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) return;

    goal.milestones.push({
      id: 'm_' + Date.now(),
      title: text.trim(),
      completed: false
    });

    this.saveGoals();
    this.renderStats();
    this.renderGoals();
  }

  renderStats() {
    const totalGoals = this.goals.length;
    let completedGoals = 0;

    this.goals.forEach(g => {
      const totalM = g.milestones.length;
      const doneM = g.milestones.filter(m => m.completed).length;
      if (totalM > 0 && doneM === totalM) {
        completedGoals++;
      }
    });

    const activeGoals = totalGoals - completedGoals;

    document.getElementById('stat-total-goals') && (document.getElementById('stat-total-goals').innerText = totalGoals);
    document.getElementById('stat-active-goals') && (document.getElementById('stat-active-goals').innerText = activeGoals);
    document.getElementById('stat-completed-goals') && (document.getElementById('stat-completed-goals').innerText = completedGoals);
  }

  renderGoals() {
    const list = document.getElementById('goals-container-list');
    if (!list) return;

    let filtered = this.goals;
    if (this.filter === 'active') {
      filtered = this.goals.filter(g => {
        const total = g.milestones.length;
        const done = g.milestones.filter(m => m.completed).length;
        return total === 0 || done < total;
      });
    } else if (this.filter === 'completed') {
      filtered = this.goals.filter(g => {
        const total = g.milestones.length;
        const done = g.milestones.filter(m => m.completed).length;
        return total > 0 && done === total;
      });
    }

    if (filtered.length === 0) {
      list.innerHTML = `<div class="glass-panel" style="text-align:center; padding:30px; color:var(--text-muted);">No goals found. Create a new goal above!</div>`;
      return;
    }

    list.innerHTML = filtered.map(goal => {
      const totalM = goal.milestones.length;
      const doneM = goal.milestones.filter(m => m.completed).length;
      const percent = totalM > 0 ? Math.round((doneM / totalM) * 100) : 0;

      const milestonesHtml = goal.milestones.map(m => `
        <li class="milestone-item ${m.completed ? 'completed' : ''}">
          <input type="checkbox" class="milestone-checkbox" 
            data-gid="${goal.id}" data-mid="${m.id}" 
            ${m.completed ? 'checked' : ''} />
          <span>${m.title}</span>
        </li>
      `).join('');

      return `
        <div class="goal-card" id="card-${goal.id}">
          <div class="goal-card-top">
            <div>
              <div class="goal-card-title">
                ${goal.title}
                <span style="font-size:0.72rem; padding:2px 8px; border-radius:12px; background:rgba(0, 240, 255, 0.12); color:var(--text-cyan);">${goal.priority}</span>
              </div>
              <div class="goal-card-meta">
                <span>📁 ${goal.category}</span>
                <span>📅 Target: ${goal.targetDate}</span>
                <span>⭐ ${percent}% Completed</span>
              </div>
            </div>
            <button class="btn-clear-history" data-del-goal="${goal.id}" title="Delete goal">✕</button>
          </div>

          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width: ${percent}%;"></div>
          </div>

          ${goal.description ? `<p style="font-size:0.86rem; color:var(--text-secondary); margin-bottom:14px;">${goal.description}</p>` : ''}

          <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <span>Milestones (${doneM}/${totalM})</span>
            <button class="btn-msg-tool" data-add-milestone="${goal.id}" style="font-size:0.7rem; padding:2px 8px;">+ Add Step</button>
          </div>

          <ul class="milestones-checklist">
            ${milestonesHtml}
          </ul>
        </div>
      `;
    }).join('');

    // Attach checkbox handlers
    list.querySelectorAll('.milestone-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const gid = cb.getAttribute('data-gid');
        const mid = cb.getAttribute('data-mid');
        this.toggleMilestone(gid, mid);
      });
    });

    // Delete goal handler
    list.querySelectorAll('[data-del-goal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const gid = btn.getAttribute('data-del-goal');
        this.deleteGoal(gid);
      });
    });

    // Add custom milestone handler
    list.querySelectorAll('[data-add-milestone]').forEach(btn => {
      btn.addEventListener('click', () => {
        const gid = btn.getAttribute('data-add-milestone');
        this.addCustomMilestone(gid);
      });
    });
  }
}

window.GoalPlannerController = GoalPlannerController;

