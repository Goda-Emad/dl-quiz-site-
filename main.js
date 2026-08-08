/**
 * ============================================================
 * APPLIED DEEP LEARNING — MAIN.JS  (Enhanced v2)
 * Handles: quizzes.html (quiz page)
 * Features: jump panel, keyboard shortcuts, smooth UX
 * ============================================================
 */

(function () {
    'use strict';

    // ============================================================
    // CONFIG
    // ============================================================
    const CONFIG = {
        MCQ_FOLDER: 'data/mcq/',
        QUIZ_FOLDER: 'data/quizzes/',
    };

    // ============================================================
    // STATE
    // ============================================================
    let state = {
        quizData: null,
        questions: [],
        totalQuestions: 0,
        currentIndex: 0,
        userAnswers: [],      // null = unanswered
        quizCompleted: false,
        isReviewMode: false,
        isSubmitting: false,
        score: 0,
        correctCount: 0,
        wrongCount: 0,
        unansweredCount: 0,
    };

    // ============================================================
    // DOM REFS
    // ============================================================
    let D = {};

    function cacheDom() {
        D = {
            // Hero
            quizTitle:      document.getElementById('quizTitle'),
            quizSubtitle:   document.getElementById('quizSubtitle'),
            scoreDisplay:   document.getElementById('scoreDisplay'),
            answeredDisplay:document.getElementById('answeredDisplay'),
            totalDisplay:   document.getElementById('totalDisplay'),

            // States
            loadingState:   document.getElementById('loadingState'),
            errorState:     document.getElementById('errorState'),
            errorMessage:   document.getElementById('errorMessage'),
            quizContent:    document.getElementById('quizContent'),

            // Progress
            progressLabel:  document.getElementById('progressLabel'),
            progressPercent:document.getElementById('progressPercent'),
            progressFill:   document.getElementById('progressFill'),

            // Question
            qNumber:        document.getElementById('qNumber'),
            qStatus:        document.getElementById('qStatus'),
            questionText:   document.getElementById('questionText'),
            optionsContainer: document.getElementById('optionsContainer'),
            explanationBox: document.getElementById('explanationBox'),
            expTitle:       document.getElementById('expTitle'),
            expBody:        document.getElementById('expBody'),

            // Nav
            prevBtn:        document.getElementById('prevBtn'),
            nextBtn:        document.getElementById('nextBtn'),
            navCounter:     document.getElementById('navCounter'),
            submitBtn:      document.getElementById('submitBtn'),
            resetBtn:       document.getElementById('resetBtn'),

            // Results
            resultsContainer: document.getElementById('resultsContainer'),
            finalScoreNum:  document.getElementById('finalScoreNum'),
            finalScoreTotal:document.getElementById('finalScoreTotal'),
            finalScorePercent: document.getElementById('finalScorePercent'),
            finalCorrect:   document.getElementById('finalCorrect'),
            finalWrong:     document.getElementById('finalWrong'),
            finalUnanswered:document.getElementById('finalUnanswered'),
            reviewBtn:      document.getElementById('reviewBtn'),
            resultsResetBtn:document.getElementById('resultsResetBtn'),

            // Container (for scroll)
            quizContainer:  document.querySelector('.quiz-container'),
        };
    }

    // ============================================================
    // HELPERS
    // ============================================================

    function getParam(name) {
        return new URL(window.location.href).searchParams.get(name);
    }

    function getFilePath(type, fileName) {
        const folder = type === 'week' ? CONFIG.MCQ_FOLDER : CONFIG.QUIZ_FOLDER;
        return `${folder}${fileName}.json`;
    }

    function show(el)  { if (el) el.style.display = 'block'; }
    function hide(el)  { if (el) el.style.display = 'none'; }
    function set(el, v){ if (el) el.textContent = v; }

    function showError(msg) {
        hide(D.loadingState);
        hide(D.quizContent);
        if (D.errorState) D.errorState.style.display = 'block';
        set(D.errorMessage, msg || 'An unexpected error occurred.');
    }

    // ============================================================
    // STATS & PROGRESS
    // ============================================================

    function countAnswered() {
        return state.userAnswers.filter(a => a !== null && a !== undefined).length;
    }

    function countCorrect() {
        return state.userAnswers.reduce((acc, ans, idx) => {
            if (ans == null) return acc;
            return acc + (ans === state.questions[idx].answer ? 1 : 0);
        }, 0);
    }

    function updateHeroStats() {
        const answered = countAnswered();
        const correct  = countCorrect();
        set(D.scoreDisplay,    correct);
        set(D.answeredDisplay, answered);
        set(D.totalDisplay,    state.totalQuestions);
        state.score = correct;
    }

    function updateProgress() {
        const answered = countAnswered();
        const pct = state.totalQuestions > 0
            ? Math.round((answered / state.totalQuestions) * 100) : 0;
        if (D.progressFill)    D.progressFill.style.width = pct + '%';
        set(D.progressPercent, pct + '%');
        set(D.progressLabel,   `Question ${state.currentIndex + 1} of ${state.totalQuestions}`);
    }

    function updateNavButtons() {
        if (D.prevBtn) D.prevBtn.disabled = state.currentIndex === 0;
        if (D.nextBtn) D.nextBtn.disabled = state.currentIndex === state.totalQuestions - 1;
        set(D.navCounter, `${state.currentIndex + 1} / ${state.totalQuestions}`);
    }

    // ============================================================
    // JUMP PANEL (dot navigator)
    // ============================================================

    function buildJumpPanel() {
        // Insert jump panel above quiz container if not already there
        let panel = document.getElementById('jumpPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'jumpPanel';
            panel.className = 'jump-panel';
            D.quizContainer && D.quizContainer.before(panel);
        }
        renderJumpPanel(panel);
    }

    function renderJumpPanel(panel) {
        if (!panel) panel = document.getElementById('jumpPanel');
        if (!panel) return;

        const isCompleted = state.quizCompleted || state.isReviewMode;

        panel.innerHTML = '';
        for (let i = 0; i < state.totalQuestions; i++) {
            const dot = document.createElement('button');
            dot.className = 'jump-dot';
            dot.textContent = i + 1;
            dot.title = `Question ${i + 1}`;
            dot.setAttribute('aria-label', `Go to question ${i + 1}`);

            const ans = state.userAnswers[i];
            const q = state.questions[i];

            if (i === state.currentIndex) {
                dot.classList.add('current');
            } else if (isCompleted && ans != null) {
                dot.classList.add(ans === q.answer ? 'correct' : 'wrong');
            } else if (!isCompleted && ans != null) {
                dot.classList.add('done');
            }

            dot.addEventListener('click', () => goToQuestion(i));
            panel.appendChild(dot);
        }
    }

    // ============================================================
    // KEYBOARD HINT
    // ============================================================

    function buildKbdHint() {
        let hint = document.getElementById('kbdHint');
        if (!hint && D.quizContainer) {
            hint = document.createElement('div');
            hint.id = 'kbdHint';
            hint.className = 'kbd-hint';
            hint.innerHTML = `
                <span class="kbd">←</span> Prev &nbsp;
                <span class="kbd">→</span> Next &nbsp;
                <span class="kbd">1</span><span class="kbd">2</span><span class="kbd">3</span><span class="kbd">4</span> Choose &nbsp;
                <span class="kbd">Enter</span> Submit
            `;
            D.quizContainer.after(hint);
        }
    }

    // ============================================================
    // RENDER QUESTION
    // ============================================================

    function renderQuestion() {
        if (!state.questions.length) return;
        const q   = state.questions[state.currentIndex];
        if (!q) return;

        const isCompleted = state.quizCompleted || state.isReviewMode;
        const userAns     = state.userAnswers[state.currentIndex];
        const isAnswered  = userAns != null;
        const isCorrect   = isAnswered && userAns === q.answer;

        // ── Q Number ──
        set(D.qNumber, `Q${q.id || state.currentIndex + 1}`);

        // ── Status badge ──
        if (D.qStatus) {
            if (isCompleted) {
                if (!isAnswered) {
                    D.qStatus.textContent = '⚠️ Unanswered';
                    D.qStatus.className = 'q-status';
                } else if (isCorrect) {
                    D.qStatus.textContent = '✅ Correct';
                    D.qStatus.className = 'q-status answered';
                } else {
                    D.qStatus.textContent = '❌ Incorrect';
                    D.qStatus.className = 'q-status';
                }
            } else {
                D.qStatus.textContent = isAnswered ? '✅ Answered' : '⬜ Not answered';
                D.qStatus.className   = isAnswered ? 'q-status answered' : 'q-status';
            }
        }

        // ── Question text ──
        set(D.questionText, q.question);

        // ── Options ──
        if (D.optionsContainer) {
            const labels = ['A', 'B', 'C', 'D'];
            D.optionsContainer.innerHTML = '';

            q.options.forEach((opt, i) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.dataset.optionIndex = i;

                const isSelected = userAns === i;

                // Letter badge
                const letter = document.createElement('span');
                letter.className = 'letter';
                letter.textContent = labels[i];
                btn.appendChild(letter);

                // Text
                const text = document.createElement('span');
                text.textContent = opt;
                btn.appendChild(text);

                if (isSelected) btn.classList.add('selected');

                if (isCompleted) {
                    btn.classList.add('disabled');
                    btn.disabled = true;

                    if (i === q.answer) {
                        btn.classList.add('correct');
                        btn.classList.remove('selected');
                        appendMark(btn, '✓', 'correct');
                    } else if (isSelected) {
                        btn.classList.add('wrong');
                        btn.classList.remove('selected');
                        appendMark(btn, '✗', 'wrong');
                    }
                } else {
                    if (isSelected) appendMark(btn, '✓', 'correct');
                    btn.addEventListener('click', () => selectOption(state.currentIndex, i));
                }

                D.optionsContainer.appendChild(btn);
            });
        }

        // ── Explanation ──
        renderExplanation(q, userAns, isAnswered, isCorrect, isCompleted);

        // ── Misc updates ──
        updateNavButtons();
        updateProgress();
        updateHeroStats();
        renderJumpPanel();

        // Scroll quiz into view
        D.quizContainer && D.quizContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function appendMark(btn, symbol, cls) {
        const mark = document.createElement('span');
        mark.className = `check-mark ${cls}`;
        mark.textContent = symbol;
        btn.appendChild(mark);
    }

    function renderExplanation(q, userAns, isAnswered, isCorrect, isCompleted) {
        if (!D.explanationBox || !D.expTitle || !D.expBody) return;

        if (!isCompleted) {
            D.explanationBox.className = 'explanation-box';
            return;
        }

        D.explanationBox.className = 'explanation-box visible';

        if (!isAnswered) {
            D.expTitle.className = 'exp-title unanswered';
            D.expTitle.innerHTML = '⚠️ No answer selected';
            D.expBody.innerHTML = `
                <p><strong>Correct answer:</strong> ${q.options[q.answer]}</p>
                <p><strong>Explanation:</strong> ${q.explanation || 'No explanation provided.'}</p>
            `;
        } else if (isCorrect) {
            D.expTitle.className = 'exp-title correct';
            D.expTitle.innerHTML = '✅ Correct!';
            D.expBody.innerHTML = `
                <p><strong>Your answer:</strong> ${q.options[userAns]}</p>
                <p><strong>Explanation:</strong> ${q.explanation || 'Great job!'}</p>
            `;
        } else {
            D.expTitle.className = 'exp-title wrong';
            D.expTitle.innerHTML = '❌ Incorrect';
            D.expBody.innerHTML = `
                <p><strong>Your answer:</strong> ${q.options[userAns]}</p>
                <p><strong>Correct answer:</strong> ${q.options[q.answer]}</p>
                <p><strong>Explanation:</strong> ${q.explanation || 'Review the material.'}</p>
            `;
        }
    }

    // ============================================================
    // ACTIONS
    // ============================================================

    function selectOption(questionIndex, optionIndex) {
        if (state.quizCompleted || state.isReviewMode || state.isSubmitting) return;
        state.userAnswers[questionIndex] = optionIndex;
        renderQuestion();
    }

    function goToQuestion(index) {
        if (index < 0 || index >= state.totalQuestions) return;
        state.currentIndex = index;
        renderQuestion();
    }

    // ── Results ──

    function calculateResults() {
        let correct = 0, wrong = 0, unanswered = 0;
        for (let i = 0; i < state.totalQuestions; i++) {
            const ans = state.userAnswers[i];
            if (ans == null)                         { unanswered++; }
            else if (ans === state.questions[i].answer) { correct++; }
            else                                     { wrong++; }
        }
        return { correct, wrong, unanswered };
    }

    function showResults() {
        if (state.isSubmitting) return;
        state.isSubmitting = true;

        const { correct, wrong, unanswered } = calculateResults();
        state.quizCompleted  = true;
        state.correctCount   = correct;
        state.wrongCount     = wrong;
        state.unansweredCount= unanswered;

        const pct = state.totalQuestions > 0
            ? Math.round((correct / state.totalQuestions) * 100) : 0;

        set(D.finalScoreNum,    correct);
        set(D.finalScoreTotal,  state.totalQuestions);
        set(D.finalScorePercent, pct + '%');
        set(D.finalCorrect,     correct);
        set(D.finalWrong,       wrong);
        set(D.finalUnanswered,  unanswered);

        hide(D.quizContainer);
        if (D.resultsContainer) {
            D.resultsContainer.className = 'results-container visible';
            D.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Hide jump panel & kbd hint during results
        const panel = document.getElementById('jumpPanel');
        const hint  = document.getElementById('kbdHint');
        if (panel) panel.style.display = 'none';
        if (hint)  hint.style.display  = 'none';

        updateHeroStats();
        state.isSubmitting = false;
    }

    function startReview() {
        state.isReviewMode  = true;
        state.quizCompleted = true;

        if (D.resultsContainer) D.resultsContainer.className = 'results-container';
        show(D.quizContainer);

        // Restore jump panel & hint
        const panel = document.getElementById('jumpPanel');
        const hint  = document.getElementById('kbdHint');
        if (panel) panel.style.display = 'flex';
        if (hint)  hint.style.display  = 'flex';

        state.currentIndex = 0;
        renderQuestion();

        setSubmitToBackToResults();
    }

    function setSubmitToBackToResults() {
        if (!D.submitBtn) return;
        D.submitBtn.innerHTML = '<i class="fa-regular fa-chart-bar"></i> Back to Results';
        D.submitBtn.className = 'nav-btn primary';
        D.submitBtn.onclick = function () {
            hide(D.quizContainer);
            if (D.resultsContainer) D.resultsContainer.className = 'results-container visible';
            // hide panels again
            const panel = document.getElementById('jumpPanel');
            const hint  = document.getElementById('kbdHint');
            if (panel) panel.style.display = 'none';
            if (hint)  hint.style.display  = 'none';
        };
    }

    function resetSubmitBtn() {
        if (!D.submitBtn) return;
        D.submitBtn.innerHTML = '<i class="fa-regular fa-check-circle"></i> Get Final Score &amp; Feedback';
        D.submitBtn.className = 'nav-btn success';
        D.submitBtn.onclick   = showResults;
    }

    function resetQuiz() {
        state.userAnswers     = new Array(state.totalQuestions).fill(null);
        state.quizCompleted   = false;
        state.isReviewMode    = false;
        state.currentIndex    = 0;
        state.score           = 0;
        state.correctCount    = 0;
        state.wrongCount      = 0;
        state.unansweredCount = 0;

        if (D.resultsContainer) D.resultsContainer.className = 'results-container';
        show(D.quizContainer);

        const panel = document.getElementById('jumpPanel');
        const hint  = document.getElementById('kbdHint');
        if (panel) panel.style.display = 'flex';
        if (hint)  hint.style.display  = 'flex';

        resetSubmitBtn();
        renderQuestion();
        updateHeroStats();
    }

    // ============================================================
    // KEYBOARD SHORTCUTS
    // ============================================================

    function setupKeyboard() {
        document.addEventListener('keydown', function (e) {
            // Don't intercept when typing in an input
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    goToQuestion(state.currentIndex - 1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    goToQuestion(state.currentIndex + 1);
                    break;
                case '1': case '2': case '3': case '4': {
                    if (state.quizCompleted || state.isReviewMode) break;
                    const idx = parseInt(e.key) - 1;
                    const q   = state.questions[state.currentIndex];
                    if (q && idx < q.options.length) {
                        e.preventDefault();
                        selectOption(state.currentIndex, idx);
                    }
                    break;
                }
                case 'Enter':
                    if (!state.quizCompleted && !state.isReviewMode) {
                        const answered = countAnswered();
                        if (answered === state.totalQuestions) {
                            e.preventDefault();
                            showResults();
                        }
                    }
                    break;
            }
        });
    }

    // ============================================================
    // LOAD QUIZ
    // ============================================================

    function loadQuiz() {
        const type = getParam('type') || 'week';
        const file = getParam('file');

        if (!file) {
            showError('No file specified. Please go back and select a quiz.');
            return;
        }

        const path = getFilePath(type, file);

        show(D.loadingState);
        hide(D.errorState);
        hide(D.quizContent);

        fetch(path)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                return res.json();
            })
            .then(data => {
                if (!data.questions || !Array.isArray(data.questions) || !data.questions.length) {
                    throw new Error('No questions found in this file.');
                }

                state.quizData       = data;
                state.questions      = data.questions;
                state.totalQuestions = data.questions.length;
                state.userAnswers    = new Array(state.totalQuestions).fill(null);
                state.currentIndex   = 0;
                state.quizCompleted  = false;
                state.isReviewMode   = false;

                // Header text
                const displayName = file
                    .replace('week', 'Week ')
                    .replace('quiz', 'Quiz ');
                set(D.quizTitle,    data.title    || displayName);
                set(D.quizSubtitle, data.subtitle || `${state.totalQuestions} questions`);

                hide(D.loadingState);
                show(D.quizContent);

                // Render quiz
                renderQuestion();

                // Build UI additions
                buildJumpPanel();
                buildKbdHint();

                // Wire buttons
                if (D.prevBtn)         D.prevBtn.onclick = () => goToQuestion(state.currentIndex - 1);
                if (D.nextBtn)         D.nextBtn.onclick = () => goToQuestion(state.currentIndex + 1);
                if (D.resetBtn)        D.resetBtn.onclick = resetQuiz;
                if (D.reviewBtn)       D.reviewBtn.onclick = startReview;
                if (D.resultsResetBtn) D.resultsResetBtn.onclick = resetQuiz;
                resetSubmitBtn(); // sets submit button fresh
            })
            .catch(err => {
                console.error('Quiz load error:', err);
                showError(err.message || 'Failed to load questions. Check the file path.');
            });
    }

    // ============================================================
    // INIT
    // ============================================================

    function init() {
        cacheDom();
        setupKeyboard();
        loadQuiz();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Dev exposure
    window.__quizApp = { state, goToQuestion, selectOption, showResults, resetQuiz, startReview };

})();
