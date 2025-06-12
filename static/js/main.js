document.addEventListener('DOMContentLoaded', () => {
    const appRoot = document.getElementById('app-root');
    let allQuestions = []; // All questions fetched from the backend
    let currentQuestions = []; // Questions selected for the current quiz round
    let userAnswers = []; // Stores user's selected answers
    let currentQuestionIndex = 0;
    let quizStarted = false;
    let showResults = false;
    let numQuestionsToAsk = 10; // Default number of questions
    let showNumQuestionsError = false;

    // --- Helper Functions for Rendering ---

    function createButton(text, classes, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = classes;
        button.addEventListener('click', onClick);
        return button;
    }

    function createIcon(type) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "20");
        svg.setAttribute("height", "20");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.classList.add("inline-block", "align-middle");

        if (type === 'check') {
            svg.classList.add("icon-correct");
            const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path1.setAttribute("d", "M22 11.08V12a10 10 0 1 1-5.93-9.14");
            const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path2.setAttribute("d", "m9 11 3 3L22 4");
            svg.appendChild(path1);
            svg.appendChild(path2);
        } else if (type === 'x') {
            svg.classList.add("icon-wrong");
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", "12");
            circle.setAttribute("cy", "12");
            circle.setAttribute("r", "10");
            const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path1.setAttribute("d", "m15 9-6 6");
            const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path2.setAttribute("d", "m9 9 6 6");
            svg.appendChild(circle);
            svg.appendChild(path1);
            svg.appendChild(path2);
        }
        return svg;
    }

    // Function to render math using KaTeX
    function renderMath(element) {
        // Check if renderMathInElement is defined (meaning KaTeX script has loaded)
        if (typeof renderMathInElement !== 'undefined') {
            renderMathInElement(element, {
                delimiters: [
                    {left: "$$", right: "$$", display: true},
                    {left: "$", right: "$", display: false},
                    {left: "\\(", right: "\\)", display: false},
                    {left: "\\[", right: "\\]", display: true}
                ]
            });
        } else {
            console.warn("KaTeX auto-render script not loaded. Math equations might not display correctly.");
        }
    }


    // --- State Management and Rendering Functions ---

    function renderApp() {
        appRoot.innerHTML = ''; // Clear previous content

        if (!quizStarted && !showResults) {
            renderStartScreen();
        } else if (quizStarted) {
            renderQuiz();
        } else if (showResults) {
            renderResults();
        }
        // After rendering content, trigger KaTeX to render math
        // This needs to be called after the HTML elements are in the DOM
        renderMath(appRoot);
    }

    function renderStartScreen() {
        const startScreenDiv = document.createElement('div');
        startScreenDiv.className = 'text-center';
        startScreenDiv.innerHTML = `
            <p class="text-lg mb-6 text-gray-700">
                Test your knowledge on Linear Algebra concepts from the course materials!
            </p>
            <div class="mb-6">
                <label for="numQuestions" class="block text-lg font-medium text-gray-700 mb-2">
                    Number of questions to ask:
                </label>
                <input
                    type="number"
                    id="numQuestions"
                    min="1"
                    max="${allQuestions.length}"
                    value="${numQuestionsToAsk}"
                    class="mt-1 block w-full md:w-1/3 mx-auto px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base text-center"
                />
                ${showNumQuestionsError ? `<p class="text-red-600 text-sm mt-2">Please enter a number between 1 and ${allQuestions.length}.</p>` : ''}
            </div>
        `;
        const startButton = createButton('Start Quiz', 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50', handleStartQuiz);
        startScreenDiv.appendChild(startButton);

        appRoot.appendChild(startScreenDiv);

        document.getElementById('numQuestions').addEventListener('input', (e) => {
            numQuestionsToAsk = parseInt(e.target.value);
            // Re-render to clear error if input becomes valid
            if (numQuestionsToAsk > 0 && numQuestionsToAsk <= allQuestions.length) {
                showNumQuestionsError = false;
                renderApp();
            }
        });
    }

    function handleStartQuiz() {
        if (numQuestionsToAsk <= 0 || numQuestionsToAsk > allQuestions.length || isNaN(numQuestionsToAsk)) {
            showNumQuestionsError = true;
            renderApp();
            return;
        }
        showNumQuestionsError = false;

        // Shuffle and select 'numQuestionsToAsk' questions
        const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
        currentQuestions = shuffled.slice(0, numQuestionsToAsk);
        currentQuestionIndex = 0;
        userAnswers = Array(currentQuestions.length).fill(null); // Initialize user answers for each question
        quizStarted = true;
        showResults = false;
        renderApp();
    }

    function renderQuiz() {
        const quizDiv = document.createElement('div');
        quizDiv.className = 'space-y-6';

        if (currentQuestions.length === 0) {
            quizDiv.innerHTML = '<div class="text-center text-lg">Loading quiz...</div>';
            appRoot.appendChild(quizDiv);
            return;
        }

        const currentQuestion = currentQuestions[currentQuestionIndex];

        const questionNav = document.createElement('div');
        questionNav.className = 'text-lg font-semibold text-blue-700';
        questionNav.textContent = `Question ${currentQuestionIndex + 1} of ${currentQuestions.length}`;
        quizDiv.appendChild(questionNav);

        const questionText = document.createElement('p');
        questionText.className = 'text-2xl font-bold mb-4 text-gray-900 leading-relaxed';
        questionText.textContent = currentQuestion.question; // KaTeX will render the math directly from this textContent
        quizDiv.appendChild(questionText);

        const answerArea = document.createElement('div');
        answerArea.className = 'space-y-3';
        quizDiv.appendChild(answerArea);

        // Render question type
        if (currentQuestion.type === 'mcq') {
            currentQuestion.options.forEach((option, index) => {
                const label = document.createElement('label');
                label.className = `flex items-center p-4 rounded-lg cursor-pointer transition-colors duration-200 border-2 ${
                    userAnswers[currentQuestionIndex] === index
                        ? 'bg-blue-200 border-blue-500 shadow-md'
                        : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                }`;
                label.innerHTML = `
                    <input type="radio" name="question-${currentQuestion.id}" value="${index}"
                           class="form-radio h-5 w-5 text-blue-600" ${userAnswers[currentQuestionIndex] === index ? 'checked' : ''}/>
                    <span class="ml-4 text-lg text-gray-800">${option}</span>
                `;
                label.querySelector('input').addEventListener('change', () => {
                    userAnswers[currentQuestionIndex] = index;
                    renderApp(); // Re-render to update selection style
                });
                answerArea.appendChild(label);
            });
        } else if (currentQuestion.type === 'true_false') {
            [true, false].forEach(value => {
                const label = document.createElement('label');
                label.className = `flex items-center p-4 rounded-lg cursor-pointer transition-colors duration-200 border-2 ${
                    userAnswers[currentQuestionIndex] === value
                        ? 'bg-blue-200 border-blue-500 shadow-md'
                        : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                }`;
                label.innerHTML = `
                    <input type="radio" name="question-${currentQuestion.id}" value="${value}"
                           class="form-radio h-5 w-5 text-blue-600" ${userAnswers[currentQuestionIndex] === value ? 'checked' : ''}/>
                    <span class="ml-4 text-lg text-gray-800">${value ? 'True' : 'False'}</span>
                `;
                label.querySelector('input').addEventListener('change', () => {
                    userAnswers[currentQuestionIndex] = value;
                    renderApp(); // Re-render to update selection style
                });
                answerArea.appendChild(label);
            });
        } else if (currentQuestion.type === 'drag_drop') {
            renderDragDropQuestion(answerArea, currentQuestion);
        }

        const navButtons = document.createElement('div');
        navButtons.className = 'flex justify-between mt-8';
        quizDiv.appendChild(navButtons);

        const prevButton = createButton('Previous', `px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
            currentQuestionIndex === 0
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg transform hover:scale-105'
        }`, () => {
            currentQuestionIndex--;
            renderApp();
        });
        prevButton.disabled = currentQuestionIndex === 0;
        navButtons.appendChild(prevButton);

        if (currentQuestionIndex < currentQuestions.length - 1) {
            const nextButton = createButton('Next', 'px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transform transition-all duration-300 hover:scale-105', () => {
                currentQuestionIndex++;
                renderApp();
            });
            navButtons.appendChild(nextButton);
        } else {
            const submitButton = createButton('Submit Quiz', 'px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transform transition-all duration-300 hover:scale-105', handleSubmitQuiz);
            navButtons.appendChild(submitButton);
        }

        appRoot.appendChild(quizDiv);
    }

    function renderDragDropQuestion(container, question) {
        const dragDropDiv = document.createElement('div');
        dragDropDiv.className = 'flex flex-col md:flex-row gap-8 items-center justify-center p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-inner';

        const draggableItemsContainer = document.createElement('div');
        draggableItemsContainer.className = 'flex flex-col items-center justify-center w-full md:w-1/2 space-y-3';
        draggableItemsContainer.innerHTML = '<h3 class="text-xl font-semibold text-gray-800 mb-2">Items to drag:</h3>';

        const droppableTargetsContainer = document.createElement('div');
        droppableTargetsContainer.className = 'flex flex-col items-center justify-center w-full md:w-1/2 space-y-3';
        droppableTargetsContainer.innerHTML = '<h3 class="text-xl font-semibold text-gray-800 mb-2">Drop targets:</h3>';

        dragDropDiv.appendChild(draggableItemsContainer);
        dragDropDiv.appendChild(droppableTargetsContainer);
        container.appendChild(dragDropDiv);

        let currentMapping = userAnswers[currentQuestionIndex] || {};
        let draggedItem = null;

        // Helper to update mapping and re-render only the drag/drop part
        const updateMappingAndRender = () => {
            userAnswers[currentQuestionIndex] = currentMapping;
            renderApp(); // Full re-render for simplicity in this example
        };

        question.draggableItems.forEach(item => {
            const draggableDiv = document.createElement('div');
            draggableDiv.id = `draggable-${item.id}`;
            draggableDiv.textContent = item.text; // Text content, KaTeX will render if math
            draggableDiv.draggable = true;
            draggableDiv.className = `draggable cursor-grab p-3 w-full max-w-xs text-center bg-blue-100 border-2 border-blue-400 rounded-md shadow-sm font-medium text-blue-800 transition-all duration-200 ${
                Object.keys(currentMapping).includes(item.id) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-200'
            }`;

            draggableDiv.addEventListener('dragstart', (e) => {
                draggedItem = item.id;
                e.dataTransfer.setData('text/plain', item.id);
                draggableDiv.classList.add('dragging');
            });

            draggableDiv.addEventListener('dragend', () => {
                draggableDiv.classList.remove('dragging');
            });

            draggableItemsContainer.appendChild(draggableDiv);
        });

        question.droppableTargets.forEach(target => {
            const droppableDiv = document.createElement('div');
            droppableDiv.id = `droppable-${target.id}`;
            droppableDiv.textContent = target.text; // Text content, KaTeX will render if math
            droppableDiv.className = `droppable relative p-3 w-full max-w-xs text-center border-2 rounded-md shadow-sm transition-all duration-200 min-h-[50px] flex items-center justify-center
                ${Object.values(currentMapping).includes(target.id) ? 'bg-green-100 border-green-400 mapped' : 'bg-gray-100 border-gray-300 hover:bg-gray-200'}
            `;

            // Check if a draggable item is currently mapped to this target
            const mappedDraggableId = Object.keys(currentMapping).find(key => currentMapping[key] === target.id);
            if (mappedDraggableId) {
                const mappedDraggableText = question.draggableItems.find(d => d.id === mappedDraggableId)?.text;
                const overlay = document.createElement('div');
                overlay.className = 'absolute top-0 left-0 right-0 bottom-0 bg-white bg-opacity-90 flex items-center justify-center rounded-md';
                overlay.innerHTML = `
                    <span class="font-semibold text-green-700 text-sm md:text-base">${mappedDraggableText}</span>
                    <button class="absolute top-1 right-1 text-red-500 hover:text-red-700 text-sm font-bold p-1 rounded-full bg-red-100 hover:bg-red-200" aria-label="Remove mapping">&times;</button>
                `;
                overlay.querySelector('button').addEventListener('click', () => {
                    const newMap = { ...currentMapping };
                    delete newMap[mappedDraggableId];
                    currentMapping = newMap;
                    updateMappingAndRender();
                });
                droppableDiv.appendChild(overlay);
            }


            droppableDiv.addEventListener('dragover', (e) => {
                e.preventDefault(); // Prevent default to allow drop
                droppableDiv.classList.add('drag-over');
            });

            droppableDiv.addEventListener('dragleave', () => {
                droppableDiv.classList.remove('drag-over');
            });

            droppableDiv.addEventListener('drop', (e) => {
                e.preventDefault();
                droppableDiv.classList.remove('drag-over');
                const droppedDraggableId = e.dataTransfer.getData('text/plain');

                // If this target is already mapped, remove the old mapping first
                const existingMappedDraggableId = Object.keys(currentMapping).find(key => currentMapping[key] === target.id);
                const newMap = { ...currentMapping };

                if (existingMappedDraggableId) {
                    delete newMap[existingMappedDraggableId];
                }

                // If the item being dragged is already mapped somewhere else, unmap it first
                const currentTargetOfDraggedItem = newMap[droppedDraggableId];
                if (currentTargetOfDraggedItem) {
                    const draggableToUnmap = Object.keys(newMap).find(key => newMap[key] === currentTargetOfDraggedItem && key !== droppedDraggableId);
                    if (draggableToUnmap) {
                        delete newMap[draggableToUnmap];
                    }
                }

                newMap[droppedDraggableId] = target.id;
                currentMapping = newMap;
                updateMappingAndRender();
            });

            droppableTargetsContainer.appendChild(droppableDiv);
        });
    }


    function handleSubmitQuiz() {
        quizStarted = false;
        showResults = true;
        renderApp();
    }

    function renderResults() {
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'space-y-8';

        const { score, results } = evaluateQuiz();

        const scoreSummary = document.createElement('div');
        scoreSummary.className = 'text-center bg-blue-100 p-6 rounded-lg shadow-inner border border-blue-300';
        scoreSummary.innerHTML = `
            <p class="text-2xl font-semibold text-blue-700">
                Your Score: <span class="text-blue-900">${score}</span> / ${currentQuestions.length}
            </p>
            <p class="text-lg text-gray-700 mt-2">
                You answered ${Math.round((score / currentQuestions.length) * 100)}% of questions correctly.
            </p>
        `;
        resultsDiv.appendChild(scoreSummary);

        const individualResultsDiv = document.createElement('div');
        individualResultsDiv.className = 'space-y-6';
        resultsDiv.appendChild(individualResultsDiv);

        results.forEach((result, index) => {
            const questionResultDiv = document.createElement('div');
            questionResultDiv.className = 'bg-gray-50 p-6 rounded-xl shadow-md border border-gray-200';
            individualResultsDiv.appendChild(questionResultDiv);

            const questionHeading = document.createElement('h3');
            questionHeading.className = 'text-xl font-bold mb-3 text-gray-900';
            questionHeading.textContent = `Question ${index + 1}: ${result.question.question}`;
            questionResultDiv.appendChild(questionHeading);

            const userAnswerP = document.createElement('p');
            userAnswerP.className = 'text-lg mb-2';
            userAnswerP.innerHTML = `<span class="font-semibold">Your Answer: </span>`;

            const userAnswerSpan = document.createElement('span');
            userAnswerSpan.className = `${result.isCorrect ? 'text-green-600' : 'text-red-600'} font-medium`;
            userAnswerSpan.textContent = displayUserAnswer(result.question, result.userAnswer);
            userAnswerP.appendChild(userAnswerSpan);

            if (!result.isCorrect) {
                userAnswerP.appendChild(createIcon('x'));
            } else {
                userAnswerP.appendChild(createIcon('check'));
            }
            questionResultDiv.appendChild(userAnswerP);

            if (!result.isCorrect) {
                const correctAnswerP = document.createElement('p');
                correctAnswerP.className = 'text-lg mb-2';
                correctAnswerP.innerHTML = `<span class="font-semibold">Correct Answer: </span>`;
                const correctAnswerSpan = document.createElement('span');
                correctAnswerSpan.className = 'text-green-600 font-medium';
                correctAnswerSpan.textContent = displayCorrectAnswer(result.question);
                correctAnswerP.appendChild(correctAnswerSpan);
                questionResultDiv.appendChild(correctAnswerP);
            }

            const explanationP = document.createElement('p');
            explanationP.className = 'text-lg text-gray-700 mt-4 border-t pt-4 border-gray-200';
            explanationP.innerHTML = `<span class="font-semibold text-blue-700">Explanation: </span>${result.question.explanation}`;
            questionResultDiv.appendChild(explanationP);
        });

        const retakeButtonContainer = document.createElement('div');
        retakeButtonContainer.className = 'text-center mt-8';
        const retakeButton = createButton('Retake Quiz', 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50', handleRetakeQuiz);
        retakeButtonContainer.appendChild(retakeButton);
        resultsDiv.appendChild(retakeButtonContainer);

        appRoot.appendChild(resultsDiv);
    }

    function evaluateQuiz() {
        let score = 0;
        const results = currentQuestions.map((q, index) => {
            const userAnswer = userAnswers[index];
            let isCorrect = false;

            if (q.type === 'mcq') {
                isCorrect = userAnswer === q.correctAnswerIndex;
            } else if (q.type === 'true_false') {
                isCorrect = userAnswer === q.correctAnswer;
            } else if (q.type === 'drag_drop') {
                let allMatched = true;
                const correctMappingKeys = Object.keys(q.correctMapping);
                const userMappedKeys = Object.keys(userAnswer || {}); // Ensure userAnswer is an object

                // Check if all correct mappings are present and correct in user's answer
                if (correctMappingKeys.length !== userMappedKeys.length) {
                    allMatched = false;
                } else {
                    for (const draggableId of correctMappingKeys) {
                        if (userAnswer[draggableId] !== q.correctMapping[draggableId]) {
                            allMatched = false;
                            break;
                        }
                    }
                }
                isCorrect = allMatched;
            }

            if (isCorrect) {
                score++;
            }

            return {
                question: q,
                userAnswer: userAnswer,
                isCorrect: isCorrect,
            };
        });

        return { score, results };
    }

    function displayUserAnswer(question, answer) {
        if (answer === null || answer === undefined) return 'No answer provided';

        if (question.type === 'mcq') {
            return question.options[answer];
        } else if (question.type === 'true_false') {
            return answer ? 'True' : 'False';
        } else if (question.type === 'drag_drop') {
            const mappedItems = Object.entries(answer).map(([draggableId, droppableId]) => {
                const draggableText = question.draggableItems.find(item => item.id === draggableId)?.text;
                const droppableText = question.droppableTargets.find(target => target.id === droppableId)?.text;
                return `${draggableText} → ${droppableText}`;
            });
            return mappedItems.length > 0 ? mappedItems.join(', ') : 'No items mapped';
        }
        return String(answer);
    }

    function displayCorrectAnswer(question) {
        if (question.type === 'mcq') {
            return question.options[question.correctAnswerIndex];
        } else if (question.type === 'true_false') {
            return question.correctAnswer ? 'True' : 'False';
        } else if (question.type === 'drag_drop') {
            const correctMappedItems = Object.entries(question.correctMapping).map(([draggableId, droppableId]) => {
                const draggableText = question.draggableItems.find(item => item.id === draggableId)?.text;
                const droppableText = question.droppableTargets.find(target => target.id === droppableId)?.text;
                return `${draggableText} → ${droppableText}`;
            });
            return correctMappedItems.join(', ');
        }
        return '';
    }

    // --- Initial Data Fetch ---
    async function fetchQuestions() {
        try {
            const response = await fetch('/api/questions');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allQuestions = await response.json();
            renderApp(); // Render after questions are loaded
        } catch (error) {
            console.error("Could not fetch questions:", error);
            appRoot.innerHTML = '<p class="text-red-600 text-center text-lg">Failed to load quiz questions. Please try again later.</p>';
        }
    }

    // Initial render call
    fetchQuestions();
});
