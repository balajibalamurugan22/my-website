/**
 * LIFEGENIE - Study Genie Module
 * Concept explanations, interactive quiz generator, study timetable, and simplified learning.
 */

class StudyGenieController {
  constructor() {
    this.currentTab = 'concept';
    this.currentQuizData = null;
    this.quizAnswers = {};
    this.init();
  }

  init() {
    // Tab switching
    document.querySelectorAll('.study-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Form submissions
    const conceptForm = document.getElementById('study-concept-form');
    if (conceptForm) {
      conceptForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleConceptExplain();
      });
    }

    const quizForm = document.getElementById('study-quiz-form');
    if (quizForm) {
      quizForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleQuizGenerate();
      });
    }

    const timetableForm = document.getElementById('study-timetable-form');
    if (timetableForm) {
      timetableForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleTimetableGenerate();
      });
    }

    const simpleForm = document.getElementById('study-simple-form');
    if (simpleForm) {
      simpleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSimpleExplain();
      });
    }
  }

  switchTab(tabId) {
    this.currentTab = tabId;
    document.querySelectorAll('.study-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.study-tab-panel').forEach(panel => {
      panel.style.display = panel.id === `study-panel-${tabId}` ? 'block' : 'none';
    });
  }

  async handleConceptExplain() {
    const topic = document.getElementById('concept-topic')?.value?.trim();
    const subject = document.getElementById('concept-subject')?.value?.trim();
    const level = document.getElementById('concept-level')?.value;
    const outputContainer = document.getElementById('concept-output');
    const submitBtn = document.getElementById('btn-concept-submit');

    if (!topic || !outputContainer) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Synthesizing Concept...</span>`;
    outputContainer.innerHTML = `<div class="typing-indicator" style="padding:20px;"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;

    try {
      const res = await API.study({ action: 'concept', topic, subject, level });
      outputContainer.innerHTML = `
        <div class="glass-panel" style="margin-top:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border-glass); padding-bottom:8px;">
            <h3 style="color:var(--text-cyan); font-size:1.15rem;">📚 Academic Breakdown: ${topic}</h3>
            <button class="btn-msg-tool" id="btn-copy-concept">Copy Guide</button>
          </div>
          <div class="markdown-body">${marked.parse(res.content)}</div>
        </div>
      `;

      document.getElementById('btn-copy-concept')?.addEventListener('click', () => {
        navigator.clipboard.writeText(res.content);
        if (window.app) window.app.showToast('Copied concept guide!', 'success');
      });

      if (window.cyberAudio) window.cyberAudio.playSuccess();
    } catch (err) {
      outputContainer.innerHTML = `<div class="glass-panel" style="color:var(--rose-primary); margin-top:16px;">⚠️ ${err.message}</div>`;
      if (window.cyberAudio) window.cyberAudio.playError();
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Generate Concept Breakdown</span>`;
    }
  }

  async handleQuizGenerate() {
    const topic = document.getElementById('quiz-topic')?.value?.trim();
    const subject = document.getElementById('quiz-subject')?.value?.trim();
    const grade = document.getElementById('quiz-grade')?.value;
    const level = document.getElementById('quiz-level')?.value;
    const num = document.getElementById('quiz-num')?.value || 5;
    const outputContainer = document.getElementById('quiz-output');
    const submitBtn = document.getElementById('btn-quiz-submit');

    if (!topic || !outputContainer) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Forging ${grade ? grade.split('(')[0].trim() : ''} Quiz...</span>`;
    outputContainer.innerHTML = `<div class="typing-indicator" style="padding:20px;"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;

    try {
      const res = await API.study({ action: 'quiz', topic, subject, grade, level, numQuestions: parseInt(num) });
      const quiz = res.quiz;
      this.currentQuizData = quiz;
      this.quizAnswers = {};

      this.renderInteractiveQuiz(quiz, outputContainer);
      if (window.cyberAudio) window.cyberAudio.playSuccess();
    } catch (err) {
      outputContainer.innerHTML = `<div class="glass-panel" style="color:var(--rose-primary); margin-top:16px;">⚠️ ${err.message}</div>`;
      if (window.cyberAudio) window.cyberAudio.playError();
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Generate Interactive Quiz</span>`;
    }
  }

  renderInteractiveQuiz(quiz, container) {
    if (!quiz || !quiz.questions || quiz.questions.length === 0) {
      container.innerHTML = `<div class="glass-panel">No quiz questions generated. Please try again.</div>`;
      return;
    }

    const gradeBadge = quiz.grade 
      ? `<span style="font-size:0.75rem; background:rgba(0,240,255,0.12); color:var(--cyan-primary); padding:3px 9px; border-radius:12px; margin-left:8px; border:1px solid rgba(0,240,255,0.3); font-weight:600;">🎓 ${quiz.grade}</span>`
      : '';

    let questionsHtml = quiz.questions.map((q, idx) => {
      const optionsHtml = q.options.map((opt, optIdx) => `
        <button class="quiz-opt-btn" data-qid="${idx}" data-oidx="${optIdx}">
          <span><strong>${String.fromCharCode(65 + optIdx)}.</strong> ${opt}</span>
          <span class="opt-status-icon"></span>
        </button>
      `).join('');

      return `
        <div class="quiz-card" id="qcard-${idx}">
          <div class="quiz-question">${idx + 1}. ${q.question}</div>
          <div class="quiz-options">${optionsHtml}</div>
          <div class="quiz-explanation" id="qexp-${idx}" style="display:none;">${q.explanation}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="glass-panel" style="margin-top:20px;">
        <div class="quiz-header">
          <div>
            <h3 style="color:var(--text-cyan); font-size:1.2rem; display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
              <span>🎯 Interactive Quiz: ${quiz.topic}</span>
              ${gradeBadge}
            </h3>
            <span style="font-size:0.8rem; color:var(--text-muted);">${quiz.questions.length} Questions</span>
          </div>
          <div class="quiz-score-badge" id="quiz-score-counter">Score: 0 / ${quiz.questions.length}</div>
        </div>
        <div class="quiz-box" style="margin-top:20px;">
          ${questionsHtml}
        </div>
      </div>
    `;

    // Add option click handlers
    container.querySelectorAll('.quiz-opt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const qid = parseInt(btn.getAttribute('data-qid'));
        const oidx = parseInt(btn.getAttribute('data-oidx'));
        this.selectQuizAnswer(qid, oidx);
      });
    });
  }

  selectQuizAnswer(qid, chosenIdx) {
    if (this.quizAnswers[qid] !== undefined) return; // already answered
    this.quizAnswers[qid] = chosenIdx;

    const question = this.currentQuizData.questions[qid];
    const isCorrect = chosenIdx === question.correctIndex;

    const card = document.getElementById(`qcard-${qid}`);
    if (!card) return;

    const optionBtns = card.querySelectorAll('.quiz-opt-btn');
    optionBtns.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === question.correctIndex) {
        btn.classList.add('correct');
      } else if (idx === chosenIdx) {
        btn.classList.add('incorrect');
      }
    });

    const exp = document.getElementById(`qexp-${qid}`);
    if (exp) exp.style.display = 'block';

    if (isCorrect) {
      if (window.cyberAudio) window.cyberAudio.playSuccess();
    } else {
      if (window.cyberAudio) window.cyberAudio.playError();
    }

    // Update score
    let score = 0;
    Object.keys(this.quizAnswers).forEach(qIndex => {
      if (this.quizAnswers[qIndex] === this.currentQuizData.questions[qIndex].correctIndex) {
        score++;
      }
    });

    const scoreBadge = document.getElementById('quiz-score-counter');
    if (scoreBadge) {
      scoreBadge.innerText = `Score: ${score} / ${this.currentQuizData.questions.length}`;
      if (Object.keys(this.quizAnswers).length === this.currentQuizData.questions.length) {
        if (score === this.currentQuizData.questions.length) {
          if (window.app) window.app.showToast('🎉 Perfect score! Mastermind!', 'success');
        } else {
          if (window.app) window.app.showToast(`Quiz completed! You scored ${score}/${this.currentQuizData.questions.length}`, 'info');
        }
      }
    }
  }

  async handleTimetableGenerate() {
    const topic = document.getElementById('timetable-topic')?.value?.trim();
    const examDate = document.getElementById('timetable-date')?.value?.trim();
    const notes = document.getElementById('timetable-notes')?.value?.trim();
    const outputContainer = document.getElementById('timetable-output');
    const submitBtn = document.getElementById('btn-timetable-submit');

    if (!topic || !outputContainer) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Calculating Optimal Timetable...</span>`;
    outputContainer.innerHTML = `<div class="typing-indicator" style="padding:20px;"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;

    try {
      const res = await API.study({ action: 'timetable', topic, examDate, notes });
      outputContainer.innerHTML = `
        <div class="glass-panel" style="margin-top:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border-glass); padding-bottom:8px;">
            <h3 style="color:var(--text-cyan); font-size:1.15rem;">📅 Structured Study Schedule</h3>
            <button class="btn-msg-tool" id="btn-copy-timetable">Copy Timetable</button>
          </div>
          <div class="markdown-body">${marked.parse(res.content)}</div>
        </div>
      `;

      document.getElementById('btn-copy-timetable')?.addEventListener('click', () => {
        navigator.clipboard.writeText(res.content);
        if (window.app) window.app.showToast('Timetable copied!', 'success');
      });

      if (window.cyberAudio) window.cyberAudio.playSuccess();
    } catch (err) {
      outputContainer.innerHTML = `<div class="glass-panel" style="color:var(--rose-primary); margin-top:16px;">⚠️ ${err.message}</div>`;
      if (window.cyberAudio) window.cyberAudio.playError();
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Build Study Timetable</span>`;
    }
  }

  async handleSimpleExplain() {
    const topic = document.getElementById('simple-topic')?.value?.trim();
    const outputContainer = document.getElementById('simple-output');
    const submitBtn = document.getElementById('btn-simple-submit');

    if (!topic || !outputContainer) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Simplifying...</span>`;
    outputContainer.innerHTML = `<div class="typing-indicator" style="padding:20px;"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;

    try {
      const res = await API.study({ action: 'simple', topic });
      outputContainer.innerHTML = `
        <div class="glass-panel" style="margin-top:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border-glass); padding-bottom:8px;">
            <h3 style="color:var(--text-cyan); font-size:1.15rem;">🎈 Simple Explanation: ${topic}</h3>
            <button class="btn-msg-tool" id="btn-copy-simple">Copy</button>
          </div>
          <div class="markdown-body">${marked.parse(res.content)}</div>
        </div>
      `;

      document.getElementById('btn-copy-simple')?.addEventListener('click', () => {
        navigator.clipboard.writeText(res.content);
        if (window.app) window.app.showToast('Copied simple explanation!', 'success');
      });

      if (window.cyberAudio) window.cyberAudio.playSuccess();
    } catch (err) {
      outputContainer.innerHTML = `<div class="glass-panel" style="color:var(--rose-primary); margin-top:16px;">⚠️ ${err.message}</div>`;
      if (window.cyberAudio) window.cyberAudio.playError();
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Explain in Simple Words</span>`;
    }
  }
}

window.StudyGenieController = StudyGenieController;

