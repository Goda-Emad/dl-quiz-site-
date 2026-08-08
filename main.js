/**
 * ============================================================
 * APPLIED DEEP LEARNING — MAIN.JS
 * الملف الرئيسي المسؤول عن كل المنطق في الموقع
 * ============================================================
 */

(function() {
    'use strict';

    // ============================================================
    // 1. CONFIGURATION
    // ============================================================
    const CONFIG = {
        MCQ_FOLDER: 'data/mcq/',
        QUIZ_FOLDER: 'data/quizzes/',
        DEFAULT_QUESTIONS_PER_PAGE: 1, // عرض سؤال واحد في كل صفحة
        ANIMATION_DELAY: 300,
    };

    // ============================================================
    // 2. STATE
    // ============================================================
    let state = {
        // البيانات
        quizData: null,           // الكائن الكامل للأسئلة
        questions: [],            // مصفوفة الأسئلة
        totalQuestions: 0,        // عدد الأسئلة الكلي

        // تقدم المستخدم
        currentIndex: 0,          // السؤال الحالي (index)
        userAnswers: [],          // إجابات المستخدم (null = لم يجب)
        answeredCount: 0,         // عدد الأسئلة المجاب عنها

        // حالة الاختبار
        quizCompleted: false,     // هل انتهى الاختبار؟
        isReviewMode: false,      // هل في وضع المراجعة؟
        isSubmitting: false,      // منع الضغط المتكرر

        // النتائج
        score: 0,
        correctCount: 0,
        wrongCount: 0,
        unansweredCount: 0,
        results: [],
    };

    // ============================================================
    // 3. DOM REFS (يتم تعبئتها في init)
    // ============================================================
    let DOM = {};

    // ============================================================
    // 4. HELPERS
    // ============================================================

    /** استخراج البارامتر من الرابط */
    function getParam(name) {
        const url = new URL(window.location.href);
        return url.searchParams.get(name);
    }

    /** الحصول على مسار الملف المناسب */
    function getFilePath(type, fileName) {
        const folder = type === 'week' ? CONFIG.MCQ_FOLDER : CONFIG.QUIZ_FOLDER;
        return `${folder}${fileName}.json`;
    }

    /** عرض رسالة خطأ */
    function showError(message) {
        if (DOM.errorState) {
            DOM.errorState.style.display = 'block';
            DOM.errorMessage.textContent = message || 'حدث خطأ غير متوقع.';
        }
        if (DOM.loadingState) DOM.loadingState.style.display = 'none';
        if (DOM.quizContent) DOM.quizContent.style.display = 'none';
    }

    /** إخفاء رسالة الخطأ */
    function hideError() {
        if (DOM.errorState) DOM.errorState.style.display = 'none';
    }

    /** تحديث الإحصائيات في الهيدر */
    function updateHeroStats() {
        if (!state.questions || state.questions.length === 0) return;

        const answered = state.userAnswers.filter(a => a !== null && a !== undefined).length;
        const correct = state.userAnswers.reduce((acc, ans, idx) => {
            if (ans === null || ans === undefined) return acc;
            return acc + (ans === state.questions[idx].answer ? 1 : 0);
        }, 0);

        if (DOM.scoreDisplay) DOM.scoreDisplay.textContent = correct;
        if (DOM.answeredDisplay) DOM.answeredDisplay.textContent = answered;
        if (DOM.totalDisplay) DOM.totalDisplay.textContent = state.totalQuestions;

        state.answeredCount = answered;
        state.score = correct;
    }

    /** تحديث شريط التقدم */
    function updateProgress() {
        const answered = state.userAnswers.filter(a => a !== null && a !== undefined).length;
        const pct = state.totalQuestions > 0 ? Math.round((answered / state.totalQuestions) * 100) : 0;

        if (DOM.progressFill) DOM.progressFill.style.width = pct + '%';
        if (DOM.progressPercent) DOM.progressPercent.textContent = pct + '%';
        if (DOM.progressLabel) {
            DOM.progressLabel.textContent = `سؤال ${state.currentIndex + 1} من ${state.totalQuestions}`;
        }
    }

    /** تحديث أزرار التنقل */
    function updateNavButtons() {
        if (DOM.prevBtn) DOM.prevBtn.disabled = state.currentIndex === 0;
        if (DOM.nextBtn) DOM.nextBtn.disabled = state.currentIndex === state.totalQuestions - 1;
        if (DOM.navCounter) DOM.navCounter.textContent = `${state.currentIndex + 1} / ${state.totalQuestions}`;
    }

    /** الحصول على إجابة السؤال الحالي */
    function getCurrentAnswer() {
        return state.userAnswers[state.currentIndex];
    }

    /** هل السؤال الحالي تمت الإجابة عليه؟ */
    function isCurrentAnswered() {
        return getCurrentAnswer() !== null && getCurrentAnswer() !== undefined;
    }

    /** هل السؤال الحالي صحيح؟ */
    function isCurrentCorrect() {
        const ans = getCurrentAnswer();
        if (ans === null || ans === undefined) return false;
        return ans === state.questions[state.currentIndex].answer;
    }

    // ============================================================
    // 5. RENDER FUNCTIONS
    // ============================================================

    /** عرض السؤال الحالي */
    function renderQuestion() {
        if (!state.questions || state.questions.length === 0) return;
        const q = state.questions[state.currentIndex];
        if (!q) return;

        const isCompleted = state.quizCompleted || state.isReviewMode;
        const userAns = state.userAnswers[state.currentIndex];
        const isAnswered = userAns !== null && userAns !== undefined;
        const isCorrect = isAnswered && userAns === q.answer;

        // ===== رقم السؤال =====
        if (DOM.qNumber) {
            DOM.qNumber.textContent = `Q${q.id || state.currentIndex + 1}`;
        }

        // ===== حالة السؤال =====
        if (DOM.qStatus) {
            if (isCompleted) {
                if (!isAnswered) {
                    DOM.qStatus.textContent = '⚠️ لم يتم الإجابة';
                    DOM.qStatus.className = 'q-status';
                } else if (isCorrect) {
                    DOM.qStatus.textContent = '✅ إجابة صحيحة';
                    DOM.qStatus.className = 'q-status answered';
                } else {
                    DOM.qStatus.textContent = '❌ إجابة خاطئة';
                    DOM.qStatus.className = 'q-status';
                }
            } else {
                DOM.qStatus.textContent = isAnswered ? '✅ تم الإجابة' : '⬜ لم يتم الإجابة';
                DOM.qStatus.className = isAnswered ? 'q-status answered' : 'q-status';
            }
        }

        // ===== نص السؤال =====
        if (DOM.questionText) {
            DOM.questionText.textContent = q.question;
        }

        // ===== الخيارات =====
        if (DOM.optionsContainer) {
            const labels = ['A', 'B', 'C', 'D'];
            DOM.optionsContainer.innerHTML = '';

            q.options.forEach((opt, i) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.setAttribute('data-option-index', i);

                const isSelected = userAns === i;

                // الحرف
                const letter = document.createElement('span');
                letter.className = 'letter';
                letter.textContent = labels[i];
                btn.appendChild(letter);

                // النص
                const text = document.createElement('span');
                text.textContent = opt;
                btn.appendChild(text);

                // تحديد إذا كان مختاراً
                if (isSelected) {
                    btn.classList.add('selected');
                }

                // في حالة الانتهاء أو المراجعة
                if (isCompleted) {
                    btn.classList.add('disabled');

                    if (i === q.answer) {
                        btn.classList.add('correct');
                        const mark = document.createElement('span');
                        mark.className = 'check-mark correct';
                        mark.textContent = '✓';
                        btn.appendChild(mark);
                    } else if (isSelected && i !== q.answer) {
                        btn.classList.add('wrong');
                        const mark = document.createElement('span');
                        mark.className = 'check-mark wrong';
                        mark.textContent = '✗';
                        btn.appendChild(mark);
                    } else if (isSelected) {
                        const mark = document.createElement('span');
                        mark.className = 'check-mark correct';
                        mark.textContent = '✓';
                        btn.appendChild(mark);
                    }
                } else {
                    // وضع تفاعلي
                    btn.addEventListener('click', function() {
                        if (state.quizCompleted || state.isReviewMode) return;
                        selectOption(state.currentIndex, i);
                    });

                    if (isSelected) {
                        const mark = document.createElement('span');
                        mark.className = 'check-mark correct';
                        mark.textContent = '✓';
                        btn.appendChild(mark);
                    }
                }

                DOM.optionsContainer.appendChild(btn);
            });
        }

        // ===== شرح الإجابة =====
        if (DOM.explanationBox && DOM.expTitle && DOM.expBody) {
            if (isCompleted) {
                DOM.explanationBox.className = 'explanation-box visible';

                if (!isAnswered) {
                    DOM.expTitle.className = 'exp-title unanswered';
                    DOM.expTitle.innerHTML = '⚠️ لم يتم اختيار إجابة';
                    DOM.expBody.innerHTML = `
                        <p><strong>الإجابة الصحيحة:</strong> ${q.options[q.answer]}</p>
                        <p><strong>الشرح:</strong> ${q.explanation || 'لا يوجد شرح متاح.'}</p>
                    `;
                } else if (isCorrect) {
                    DOM.expTitle.className = 'exp-title correct';
                    DOM.expTitle.innerHTML = '✅ إجابة صحيحة!';
                    DOM.expBody.innerHTML = `
                        <p><strong>إجابتك:</strong> ${q.options[userAns]}</p>
                        <p><strong>الشرح:</strong> ${q.explanation || 'أحسنت!'}</p>
                    `;
                } else {
                    DOM.expTitle.className = 'exp-title wrong';
                    DOM.expTitle.innerHTML = '❌ إجابة خاطئة';
                    DOM.expBody.innerHTML = `
                        <p><strong>إجابتك:</strong> ${q.options[userAns]}</p>
                        <p><strong>الإجابة الصحيحة:</strong> ${q.options[q.answer]}</p>
                        <p><strong>الشرح:</strong> ${q.explanation || 'راجع المادة.'}</p>
                    `;
                }
            } else {
                DOM.explanationBox.className = 'explanation-box';
            }
        }

        // ===== تحديث العناصر الأخرى =====
        updateNavButtons();
        updateProgress();
        updateHeroStats();

        // ===== التمرير إلى السؤال =====
        if (DOM.quizContainer) {
            DOM.quizContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /** اختيار إجابة */
    function selectOption(questionIndex, optionIndex) {
        if (state.quizCompleted || state.isReviewMode) return;
        if (state.isSubmitting) return;

        state.userAnswers[questionIndex] = optionIndex;
        renderQuestion();
    }

    /** الانتقال إلى سؤال محدد */
    function goToQuestion(index) {
        if (index < 0 || index >= state.totalQuestions) return;
        state.currentIndex = index;
        renderQuestion();
    }

    // ============================================================
    // 6. QUIZ LOGIC
    // ============================================================

    /** حساب النتائج */
    function calculateResults() {
        let correct = 0,
            wrong = 0,
            unanswered = 0;
        const results = [];

        for (let i = 0; i < state.totalQuestions; i++) {
            const ans = state.userAnswers[i];
            const correctAns = state.questions[i].answer;

            if (ans === null || ans === undefined) {
                unanswered++;
                results.push({ status: 'unanswered' });
            } else if (ans === correctAns) {
                correct++;
                results.push({ status: 'correct' });
            } else {
                wrong++;
                results.push({ status: 'wrong' });
            }
        }

        return { correct, wrong, unanswered, results };
    }

    /** عرض النتائج */
    function showResults() {
        if (state.isSubmitting) return;
        state.isSubmitting = true;

        // حساب النتائج
        const { correct, wrong, unanswered, results } = calculateResults();
        state.correctCount = correct;
        state.wrongCount = wrong;
        state.unansweredCount = unanswered;
        state.results = results;
        state.quizCompleted = true;

        const pct = state.totalQuestions > 0 ? Math.round((correct / state.totalQuestions) * 100) : 0;

        // تحديث عناصر النتائج
        if (DOM.finalScoreNum) DOM.finalScoreNum.textContent = correct;
        if (DOM.finalScoreTotal) DOM.finalScoreTotal.textContent = state.totalQuestions;
        if (DOM.finalScorePercent) DOM.finalScorePercent.textContent = pct + '%';
        if (DOM.finalCorrect) DOM.finalCorrect.textContent = correct;
        if (DOM.finalWrong) DOM.finalWrong.textContent = wrong;
        if (DOM.finalUnanswered) DOM.finalUnanswered.textContent = unanswered;

        // إخفاء الاختبار وإظهار النتائج
        if (DOM.quizContainer) DOM.quizContainer.style.display = 'none';
        if (DOM.resultsContainer) {
            DOM.resultsContainer.className = 'results-container visible';
            DOM.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // تحديث الإحصائيات
        updateHeroStats();

        // تغيير زر التقديم للرجوع للنتائج
        if (DOM.submitBtn) {
            DOM.submitBtn.textContent = '🔙 العودة للنتائج';
            DOM.submitBtn.className = 'nav-btn primary';
            DOM.submitBtn.onclick = function() {
                if (DOM.quizContainer) DOM.quizContainer.style.display = 'none';
                if (DOM.resultsContainer) {
                    DOM.resultsContainer.className = 'results-container visible';
                }
            };
        }

        state.isSubmitting = false;
    }

    /** بدء مراجعة الإجابات */
    function startReview() {
        state.isReviewMode = true;
        state.quizCompleted = true;

        // إخفاء النتائج وإظهار الاختبار
        if (DOM.resultsContainer) DOM.resultsContainer.className = 'results-container';
        if (DOM.quizContainer) DOM.quizContainer.style.display = 'block';

        state.currentIndex = 0;
        renderQuestion();

        // تغيير زر التقديم
        if (DOM.submitBtn) {
            DOM.submitBtn.textContent = '🔙 العودة للنتائج';
            DOM.submitBtn.className = 'nav-btn primary';
            DOM.submitBtn.onclick = function() {
                showResults();
                DOM.submitBtn.textContent = '🔙 العودة للنتائج';
                DOM.submitBtn.className = 'nav-btn primary';
                DOM.submitBtn.onclick = function() {
                    if (DOM.quizContainer) DOM.quizContainer.style.display = 'none';
                    if (DOM.resultsContainer) {
                        DOM.resultsContainer.className = 'results-container visible';
                    }
                };
            };
        }
    }

    /** إعادة تعيين الاختبار */
    function resetQuiz() {
        state.userAnswers = new Array(state.totalQuestions).fill(null);
        state.quizCompleted = false;
        state.isReviewMode = false;
        state.currentIndex = 0;
        state.score = 0;
        state.correctCount = 0;
        state.wrongCount = 0;
        state.unansweredCount = 0;
        state.results = [];

        if (DOM.resultsContainer) DOM.resultsContainer.className = 'results-container';
        if (DOM.quizContainer) DOM.quizContainer.style.display = 'block';

        // إعادة تعيين زر التقديم
        if (DOM.submitBtn) {
            DOM.submitBtn.textContent = '📊 عرض النتيجة النهائية';
            DOM.submitBtn.className = 'nav-btn success';
            DOM.submitBtn.onclick = showResults;
        }

        renderQuestion();
        updateHeroStats();
    }

    // ============================================================
    // 7. LOAD QUIZ
    // ============================================================

    /** تحميل ملف الأسئلة */
    function loadQuiz() {
        const type = getParam('type') || 'week';
        const file = getParam('file');

        if (!file) {
            showError('لم يتم تحديد ملف الأسئلة. الرجاء العودة واختيار اختبار.');
            return;
        }

        const path = getFilePath(type, file);

        // إظهار حالة التحميل
        if (DOM.loadingState) DOM.loadingState.style.display = 'block';
        if (DOM.errorState) DOM.errorState.style.display = 'none';
        if (DOM.quizContent) DOM.quizContent.style.display = 'none';

        fetch(path)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                return res.json();
            })
            .then(data => {
                if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
                    throw new Error('لا توجد أسئلة في هذا الملف.');
                }

                // تخزين البيانات
                state.quizData = data;
                state.questions = data.questions;
                state.totalQuestions = data.questions.length;
                state.userAnswers = new Array(state.totalQuestions).fill(null);

                // تعيين العنوان
                const displayName = file.replace('week', 'الأسبوع ').replace('quiz', 'كويز ');
                if (DOM.quizTitle) {
                    DOM.quizTitle.textContent = data.title || displayName;
                }
                if (DOM.quizSubtitle) {
                    DOM.quizSubtitle.textContent = data.subtitle || `${state.totalQuestions} سؤال`;
                }

                // إخفاء التحميل وإظهار المحتوى
                if (DOM.loadingState) DOM.loadingState.style.display = 'none';
                if (DOM.quizContent) DOM.quizContent.style.display = 'block';

                // عرض السؤال الأول
                state.currentIndex = 0;
                state.quizCompleted = false;
                state.isReviewMode = false;

                renderQuestion();

                // إعداد الأزرار
                if (DOM.prevBtn) {
                    DOM.prevBtn.onclick = () => goToQuestion(state.currentIndex - 1);
                }
                if (DOM.nextBtn) {
                    DOM.nextBtn.onclick = () => goToQuestion(state.currentIndex + 1);
                }
                if (DOM.submitBtn) {
                    DOM.submitBtn.onclick = showResults;
                }
                if (DOM.resetBtn) {
                    DOM.resetBtn.onclick = resetQuiz;
                }
                if (DOM.reviewBtn) {
                    DOM.reviewBtn.onclick = startReview;
                }
                if (DOM.resultsResetBtn) {
                    DOM.resultsResetBtn.onclick = resetQuiz;
                }

            })
            .catch(err => {
                console.error('خطأ في التحميل:', err);
                showError(err.message || 'فشل تحميل الأسئلة. تأكد من وجود الملف.');
            });
    }

    // ============================================================
    // 8. KEYBOARD SHORTCUTS
    // ============================================================

    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            // منع الاختصارات في حالة عرض النتائج أو مراجعة
            if (state.quizCompleted || state.isReviewMode) return;

            // السهم الأيسر → السابق
            if (e.key === 'ArrowLeft' && state.currentIndex > 0) {
                e.preventDefault();
                goToQuestion(state.currentIndex - 1);
            }
            // السهم الأيمن → التالي
            else if (e.key === 'ArrowRight' && state.currentIndex < state.totalQuestions - 1) {
                e.preventDefault();
                goToQuestion(state.currentIndex + 1);
            }
            // أرقام 1-4 للاختيار
            else if (['1', '2', '3', '4'].includes(e.key)) {
                const idx = parseInt(e.key) - 1;
                if (!state.quizCompleted && !state.isReviewMode) {
                    const q = state.questions[state.currentIndex];
                    if (q && idx < q.options.length) {
                        e.preventDefault();
                        selectOption(state.currentIndex, idx);
                    }
                }
            }
            // زر Enter لتقديم النتيجة
            else if (e.key === 'Enter' && !state.quizCompleted && !state.isReviewMode) {
                const answered = state.userAnswers.filter(a => a !== null && a !== undefined).length;
                if (answered === state.totalQuestions) {
                    e.preventDefault();
                    showResults();
                }
            }
        });
    }

    // ============================================================
    // 9. INIT
    // ============================================================

    function init() {
        // ===== تهيئة الـ DOM refs =====
        DOM = {
            // Header
            quizTitle: document.getElementById('quizTitle'),
            quizSubtitle: document.getElementById('quizSubtitle'),
            scoreDisplay: document.getElementById('scoreDisplay'),
            answeredDisplay: document.getElementById('answeredDisplay'),
            totalDisplay: document.getElementById('totalDisplay'),

            // Loading / Error
            loadingState: document.getElementById('loadingState'),
            errorState: document.getElementById('errorState'),
            errorMessage: document.getElementById('errorMessage'),
            quizContent: document.getElementById('quizContent'),

            // Progress
            progressLabel: document.getElementById('progressLabel'),
            progressPercent: document.getElementById('progressPercent'),
            progressFill: document.getElementById('progressFill'),

            // Question
            qNumber: document.getElementById('qNumber'),
            qStatus: document.getElementById('qStatus'),
            questionText: document.getElementById('questionText'),
            optionsContainer: document.getElementById('optionsContainer'),
            explanationBox: document.getElementById('explanationBox'),
            expTitle: document.getElementById('expTitle'),
            expBody: document.getElementById('expBody'),

            // Navigation
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn'),
            navCounter: document.getElementById('navCounter'),
            submitBtn: document.getElementById('submitBtn'),
            resetBtn: document.getElementById('resetBtn'),

            // Results
            resultsContainer: document.getElementById('resultsContainer'),
            finalScoreNum: document.getElementById('finalScoreNum'),
            finalScoreTotal: document.getElementById('finalScoreTotal'),
            finalScorePercent: document.getElementById('finalScorePercent'),
            finalCorrect: document.getElementById('finalCorrect'),
            finalWrong: document.getElementById('finalWrong'),
            finalUnanswered: document.getElementById('finalUnanswered'),
            reviewBtn: document.getElementById('reviewBtn'),
            resultsResetBtn: document.getElementById('resultsResetBtn'),

            // Container
            quizContainer: document.querySelector('.quiz-container'),
        };

        // ===== التحقق من وجود العناصر الأساسية =====
        if (!DOM.quizContent) {
            console.warn('بعض عناصر الصفحة غير موجودة. تأكد من أنك في صفحة quizzes.html');
        }

        // ===== إعداد اختصارات لوحة المفاتيح =====
        setupKeyboardShortcuts();

        // ===== تحميل الاختبار =====
        loadQuiz();
    }

    // ============================================================
    // 10. START
    // ============================================================

    // انتظار تحميل الصفحة بالكامل
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ============================================================
    // 11. EXPOSE (للتطوير)
    // ============================================================
    window.__quizApp = {
        state: state,
        renderQuestion: renderQuestion,
        goToQuestion: goToQuestion,
        selectOption: selectOption,
        showResults: showResults,
        resetQuiz: resetQuiz,
        startReview: startReview,
        DOM: DOM,
    };

})();
