// public/script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const modelNameSelect = document.getElementById('modelName');
    const forceKhmerCheckbox = document.getElementById('forceKhmerCheckbox');
    const promptInput = document.getElementById('promptInput');
    const sendButton = document.getElementById('sendButton');
    const responseOutput = document.getElementById('responseOutput');
    const chatHistoryDiv = document.getElementById('chatHistory');
    const clearAllButton = document.getElementById('clearAllButton');
    const exportChatButton = document.getElementById('exportChatButton');
    const currentModeTitle = document.getElementById('currentModeTitle');


    const modeButtons = {
        generate: document.getElementById('btnModeGenerate'),
        chat: document.getElementById('btnModeChat'),
        stream: document.getElementById('btnModeStream'),
        summarize: document.getElementById('btnModeSummarize'),
        translate: document.getElementById('btnModeTranslate'),
        imageqa: document.getElementById('btnModeImageQA'),
        spellcheck: document.getElementById('btnModeSpellCheck'),
        imageenhance: document.getElementById('btnModeImageEnhance'),
        codegen: document.getElementById('btnModeCodeGen'),
        coderunner: document.getElementById('btnModeCodeRunner'),
        webeditor: document.getElementById('btnModeWebEditor')
    };

    const modeContentSections = {
        generate: document.getElementById('generalInputSection'),
        chat: document.getElementById('generalInputSection'), 
        stream: document.getElementById('generalInputSection'), 
        summarize: document.getElementById('summarizeSection'),
        translate: document.getElementById('translateSection'),
        imageqa: document.getElementById('imageQASection'),
        spellcheck: document.getElementById('spellCheckSection'),
        imageenhance: document.getElementById('imageEnhanceSection'),
        codegen: document.getElementById('codeGenSection'),
        coderunner: document.getElementById('codeRunnerSection'),
        webeditor: document.getElementById('webEditorSection')
    };
    
    const textToSummarizeInput = document.getElementById('textToSummarizeInput');
    const summaryLengthSelect = document.getElementById('summaryLength');
    const summarizeButton = document.getElementById('summarizeButton');
    const textToTranslateInput = document.getElementById('textToTranslateInput');
    const sourceLanguageSelect = document.getElementById('sourceLanguage');
    const targetLanguageSelect = document.getElementById('targetLanguage');
    const translateButton = document.getElementById('translateButton');
    const imageUploadInput = document.getElementById('imageUploadInput');
    const imagePreview = document.getElementById('imagePreview');
    const imageQAPromptInput = document.getElementById('imageQAPromptInput');
    const sendImageQAButton = document.getElementById('sendImageQAButton');
    const textToSpellCheckInput = document.getElementById('textToSpellCheckInput');
    const spellCheckButton = document.getElementById('spellCheckButton');
    const spellCheckResultsArea = document.querySelector('.spellcheck-results-area');
    const spellCheckOriginalOutput = document.getElementById('spellCheckOriginalOutput');
    const spellCheckCorrectedOutput = document.getElementById('spellCheckCorrectedOutput');
    const imageEnhanceUploadInput = document.getElementById('imageEnhanceUploadInput');
    const imageEnhancePreview = document.getElementById('imageEnhancePreview');
    const imageEnhancePromptInput = document.getElementById('imageEnhancePromptInput');
    const sendImageEnhanceButton = document.getElementById('sendImageEnhanceButton');
    const codeDescriptionInput = document.getElementById('codeDescriptionInput');
    const codeLanguageSelect = document.getElementById('codeLanguageSelect');
    const generateCodeButton = document.getElementById('generateCodeButton');
    const runnerLanguageSelect = document.getElementById('runnerLanguageSelect');
    const codeToRunInput = document.getElementById('codeToRunInput');
    const runCodeButton = document.getElementById('runCodeButton');
    const codeRunnerOutput = document.getElementById('codeRunnerOutput');
    const htmlCodeInput = document.getElementById('htmlCodeInput');
    const cssCodeInput = document.getElementById('cssCodeInput');
    const jsCodeInput = document.getElementById('jsCodeInput');
    const livePreviewFrame = document.getElementById('livePreviewFrame');
    const fullscreenPreviewButton = document.getElementById('fullscreenPreviewButton');
    const webEditorConsole = document.querySelector('.web-editor-console');
    const webEditorConsoleOutput = document.getElementById('webEditorConsoleOutput');
    
    const mainResponseArea = document.getElementById('mainResponseArea');
    const mainMetadataOutput = document.getElementById('mainMetadataOutput');
    const spellCheckMetadataOutput = document.getElementById('spellCheckMetadataOutput');
    const responseLoadingOverlay = document.getElementById('responseLoadingOverlay');

    const speakMainResponseButton = document.getElementById('speakMainResponseButton');
    const speakOriginalSpellCheckButton = document.getElementById('speakOriginalSpellCheck');
    const speakCorrectedSpellCheckButton = document.getElementById('speakCorrectedSpellCheck');
    const copyMainResponseButton = document.getElementById('copyMainResponseButton');
    const copyOriginalSpellCheckButton = document.getElementById('copyOriginalSpellCheck');
    const copyCorrectedSpellCheckButton = document.getElementById('copyCorrectedSpellCheck');

    const synth = window.speechSynthesis;
    let currentUtterance = null;
    let voices = [];
    let currentMode = 'generate';
    let chatMessages = [];
    let currentImageBase64 = null;
    let currentImageMimeType = null;
    const CHAT_HISTORY_KEY = 'geminiAIChatHistory';
    const defaultPlaceholders = {};

    function showButtonLoading(button, isLoading, defaultText) {
        if (!button) return;
        const iconHTML = button.querySelector('i')?.outerHTML || '';
        let textContent = defaultText; 
        const buttonLabelSpan = button.querySelector('.button-label') || button.querySelector('.button-label-sm');

        if(buttonLabelSpan && !isLoading) { 
             textContent = buttonLabelSpan.textContent;
        } else if (!isLoading && defaultText && typeof defaultText === 'string' && defaultText.includes("<span class=\"button-label")) {
             const match = defaultText.match(/<span class="button-label.*?">(.*?)<\/span>/i);
             if (match && match[1]) textContent = match[1];
             else textContent = defaultText.replace(/<i.*?<\/i>/i, '').replace(/\.\.\..*/, '').trim();
        } else if (!isLoading && defaultText) {
            textContent = defaultText.replace(/<i.*?<\/i>/i, '').replace(/\.\.\..*/, '').trim();
        }
        
        button.disabled = isLoading;
        const spinnerHTML = `<span class="spinner"></span>`;
        
        if (isLoading) {
            if (buttonLabelSpan) button.innerHTML = `${iconHTML} <span class="${buttonLabelSpan.className}">${textContent}...</span> ${spinnerHTML}`;
            else button.innerHTML = `${iconHTML} ${textContent}... ${spinnerHTML}`;
        } else {
            if (buttonLabelSpan) button.innerHTML = `${iconHTML} <span class="${buttonLabelSpan.className}">${textContent}</span>`;
            else button.innerHTML = `${iconHTML} ${textContent}`;
        }
    }

    function showResponseLoading(isLoading) {
        if (responseLoadingOverlay) responseLoadingOverlay.style.display = isLoading ? 'flex' : 'none';
        const activeSection = modeContentSections[currentMode];
        if (activeSection) {
            const formElements = activeSection.querySelectorAll('textarea, select, input[type="file"], .action-button:not(.mode-button)');
            formElements.forEach(el => {
                const isButtonItselfLoading = el.classList.contains('action-button') && el.querySelector('.spinner');
                if (el.disabled !== isLoading && !isButtonItselfLoading) {
                    el.disabled = isLoading;
                }
            });
        }
        if (currentMode === 'chat' || currentMode === 'generate' || currentMode === 'stream') {
             const sendButtonIsLoading = sendButton && sendButton.querySelector('.spinner');
             if (sendButton && sendButton.disabled !== isLoading && !sendButtonIsLoading) sendButton.disabled = isLoading;
             if (promptInput && promptInput.disabled !== isLoading) promptInput.disabled = isLoading;
        }
    }
    
    function getVoices() { voices = synth.getVoices(); }
    getVoices();
    if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = getVoices;

    function speakText(textToSpeak, lang = 'en-US') {
        if (!textToSpeak || textToSpeak.trim() === '') return;
        if (synth.speaking && currentUtterance) synth.cancel();
        currentUtterance = new SpeechSynthesisUtterance(textToSpeak);
        currentUtterance.lang = lang;
        const targetLangMain = lang.split('-')[0];
        let selectedVoice = voices.find(voice => voice.lang.toLowerCase() === lang.toLowerCase());
        if (!selectedVoice) selectedVoice = voices.find(voice => voice.lang.toLowerCase().startsWith(targetLangMain + '-'));
        if (!selectedVoice && targetLangMain !== 'en' && targetLangMain !== 'km') selectedVoice = voices.find(voice => voice.lang.toLowerCase().startsWith('en-'));
        if (selectedVoice) currentUtterance.voice = selectedVoice; else console.warn(`No voice for lang '${lang}'.`);
        currentUtterance.onstart = () => {
            document.querySelectorAll('.speak-button.speaking').forEach(btn => btn.classList.remove('speaking'));
            const textNormalized = textToSpeak.replace(/\s+/g, ' ').trim();
            const responseTextContent = responseOutput ? (responseOutput.textContent || '') : '';
            const spellOrigContent = spellCheckOriginalOutput ? (spellCheckOriginalOutput.textContent || '') : '';
            const spellCorrContent = spellCheckCorrectedOutput ? (spellCheckCorrectedOutput.textContent || '') : '';

            const responseNormalized = responseTextContent.replace(/---.*?---/g, '').replace(/ការណែនាំអំពីការកែលម្អ:\n\n/i, '').replace(/សេចក្តីសង្ខេប \(.*?\):\n\n/i, '').replace(/.*?ពី .*? ទៅ .*?:\n\n/i, '').replace(/\s+/g, ' ').trim();
            const originalSpellNormalized = spellOrigContent.replace(/\s+/g, ' ').trim();
            const correctedSpellNormalized = spellCorrContent.replace(/\s+/g, ' ').trim();

            if (textNormalized === responseNormalized && speakMainResponseButton) speakMainResponseButton.classList.add('speaking');
            else if (textNormalized === originalSpellNormalized && speakOriginalSpellCheckButton) speakOriginalSpellCheckButton.classList.add('speaking');
            else if (textNormalized === correctedSpellNormalized && speakCorrectedSpellCheckButton) speakCorrectedSpellCheckButton.classList.add('speaking');
        };
        currentUtterance.onend = () => { currentUtterance = null; document.querySelectorAll('.speak-button.speaking').forEach(btn => btn.classList.remove('speaking')); };
        currentUtterance.onerror = (event) => { console.error("SpeechSynthesisUtterance.onerror", event); currentUtterance = null; document.querySelectorAll('.speak-button.speaking').forEach(btn => btn.classList.remove('speaking')); };
        synth.speak(currentUtterance);
    }

    function updateActionButtonsState(speakButton, copyButton, textContent) {
        const isEmptyPlaceholder = !textContent || textContent.trim() === '' || textContent.startsWith("ការឆ្លើយតប") || textContent.startsWith("កំពុង") || textContent.startsWith("អត្ថបទ") || textContent.startsWith("មិនមានប្រវត្តិ");
        [speakButton, copyButton].filter(btn => btn).forEach(button => {
            button.style.display = !isEmptyPlaceholder ? 'inline-flex' : 'none';
            button.disabled = isEmptyPlaceholder;
        });
    }
    
    function displayApiMetadata(element, duration, tokenInfo) {
        if (!element) return;
        let htmlContent = "";
        if (duration) htmlContent += `<span><i class="fas fa-stopwatch"></i> ${duration}</span>`;
        if (tokenInfo && tokenInfo !== "N/A") htmlContent += `<span><i class="fas fa-coins"></i> ${tokenInfo}</span>`;
        element.innerHTML = htmlContent;
        element.style.display = htmlContent ? 'block' : 'none';
    }

    function setMode(mode) {
        currentMode = mode;
        Object.values(modeButtons).forEach(btn => { if (btn) btn.classList.remove('active'); });
        if (modeButtons[mode]) {
            modeButtons[mode].classList.add('active');
            if(currentModeTitle) currentModeTitle.textContent = modeButtons[mode].querySelector('.button-text')?.textContent || mode.charAt(0).toUpperCase() + mode.slice(1);
        }


        Object.values(modeContentSections).forEach(section => { if (section) section.style.display = 'none'; });
        const activeSection = modeContentSections[mode];
        if (activeSection) {
            activeSection.style.display = 'block';
            if((mode === 'chat' || mode === 'stream') && modeContentSections.generate && modeContentSections.generate !== activeSection) {
                modeContentSections.generate.style.display = 'block';
            } else if (mode !== 'generate' && mode !== 'chat' && mode !== 'stream' && modeContentSections.generate) {
                 if (modeContentSections.generate !== activeSection) modeContentSections.generate.style.display = 'none';
            }
        }
        
        chatHistoryDiv.style.display = (mode === 'chat') ? 'block' : 'none';
        const chatActionsDiv = document.querySelector('.chat-actions');
        if (chatActionsDiv) chatActionsDiv.style.display = (mode === 'chat' && chatMessages.length > 0) ? 'flex' : 'none';
        if (mode === 'chat') updateChatDisplay();

        mainResponseArea.style.display = (mode !== 'spellcheck' && mode !== 'coderunner' && mode !== 'webeditor') ? 'block' : 'none';
        spellCheckResultsArea.style.display = (mode === 'spellcheck') ? 'block' : 'none';
        const codeRunnerOutputArea = document.querySelector('.code-runner-output-area');
        if(codeRunnerOutputArea) codeRunnerOutputArea.style.display = (mode === 'coderunner') ? 'block' : 'none';
        if(webEditorConsole) webEditorConsole.style.display = (mode === 'webeditor') ? 'block' : 'none';
        
        displayApiMetadata(mainMetadataOutput, null, null); 
        displayApiMetadata(spellCheckMetadataOutput, null, null);

        const khmerToggleDiv = document.querySelector('.control-item.khmer-toggle');
        if (khmerToggleDiv) khmerToggleDiv.style.display = (mode !== 'webeditor' && mode !== 'coderunner' && mode !== 'spellcheck') ? 'flex' : 'none';
        
        updateActionButtonsState(speakMainResponseButton, copyMainResponseButton, '');
        updateActionButtonsState(speakOriginalSpellCheckButton, copyOriginalSpellCheckButton, '');
        updateActionButtonsState(speakCorrectedSpellCheckButton, copyCorrectedSpellCheckButton, '');
        if (fullscreenPreviewButton) {
             fullscreenPreviewButton.style.display = (mode === 'webeditor') ? 'inline-flex' : 'none';
             if (mode === 'webeditor') updateFullscreenButtonState(); 
        }
        
        if (synth.speaking) synth.cancel();
        if (document.fullscreenElement && currentMode !== 'webeditor') {
            if (document.exitFullscreen) document.exitFullscreen().catch(e => console.error("Error exiting fullscreen:", e));
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();
        }

        if (responseOutput) responseOutput.classList.remove('code'); 
        if (codeRunnerOutput) codeRunnerOutput.textContent = defaultPlaceholders.codeToRunInput ? defaultPlaceholders.codeToRunInput.replace("បិទភ្ជាប់កូដ...", "លទ្ធផលកូដនឹងបង្ហាញនៅទីនេះ។") : 'Code output will appear here.';
        if (webEditorConsoleOutput) webEditorConsoleOutput.textContent = '';

        if (mode === 'spellcheck') {
            if(spellCheckOriginalOutput && defaultPlaceholders.textToSpellCheckInput) spellCheckOriginalOutput.textContent = defaultPlaceholders.textToSpellCheckInput.replace("បញ្ចូល", "អត្ថបទដើមនឹងបង្ហាញ");
            if(spellCheckCorrectedOutput && defaultPlaceholders.textToSpellCheckInput) spellCheckCorrectedOutput.textContent = defaultPlaceholders.textToSpellCheckInput.replace("បញ្ចូល", "អត្ថបទដែលបានកែនឹងបង្ហាញ");
        } else if (mode === 'coderunner') {
            // Placeholder handled above by clearing codeRunnerOutput then setting placeholder in setMode if needed
        } else if (mode === 'webeditor') {
             updateLivePreview(); 
        }
        else {
            let placeholderText = defaultPlaceholders.responseOutput || "ការឆ្លើយតប AI របស់អ្នកនឹងបង្ហាញនៅទីនេះ។";
            if (mode === 'stream') placeholderText = "ការឆ្លើយតបស្ទ្រីមនឹងបង្ហាញនៅទីនេះ...";
            else if (mode === 'summarize') placeholderText = "ការសង្ខេបនឹងបង្ហាញនៅទីនេះ។";
            else if (mode === 'translate') placeholderText = "អត្ថបទដែលបានបកប្រែនឹងបង្ហាញនៅទីនេះ។";
            else if (mode === 'imageqa') placeholderText = "ការឆ្លើយតបអំពីរូបភាពនឹងបង្ហាញនៅទីនេះ។";
            else if (mode === 'imageenhance') placeholderText = "ការណែនាំអំពីការកែលម្អរូបភាពនឹងបង្ហាញនៅទីនេះ។";
            else if (mode === 'codegen') {
                placeholderText = "កូដដែលបានបង្កើតនឹងបង្ហាញនៅទីនេះ។";
                if (responseOutput) responseOutput.classList.add('code'); 
            }
            else if (mode === 'chat' && chatMessages.length === 0) placeholderText = "ការសន្ទនាជជែកនឹងបង្ហាញនៅទីនេះ។";
            else if (mode === 'chat' && chatMessages.length > 0) placeholderText = "ការឆ្លើយតបការជជែកបន្ទាប់របស់ AI នឹងបង្ហាញនៅទីនេះ។";
            if(responseOutput) responseOutput.textContent = placeholderText;
        }
        Object.keys(defaultPlaceholders).forEach(key => {
            const el = document.getElementById(key);
            if (el && defaultPlaceholders[key] !== undefined && el.placeholder !== undefined) {
                 el.placeholder = defaultPlaceholders[key];
            }
        });
        showResponseLoading(false);
    }

    Object.keys(modeButtons).forEach(modeKey => { if(modeButtons[modeKey]) modeButtons[modeKey].addEventListener('click', () => setMode(modeKey)); });
    
    function updateChatDisplay() { /* ... (Full logic from previous responses, including export button visibility) ... */ }
    function loadChatHistory() { /* ... (Full logic from previous responses) ... */ }
    function saveChatHistory() { /* ... (Full logic from previous responses) ... */ }
    clearAllButton.addEventListener('click', () => { /* ... (Full logic from previous responses, ensuring all inputs/previews are cleared) ... */ });
    function handleImageUpload(event, previewElement) { /* ... (Full logic from previous responses) ... */ }
    if(imageUploadInput) imageUploadInput.addEventListener('change', (event) => handleImageUpload(event, imagePreview));
    if(imageEnhanceUploadInput) imageEnhanceUploadInput.addEventListener('change', (event) => handleImageUpload(event, imageEnhancePreview));

    async function handleApiRequest(button, endpoint, payload, successCallback, errorCallbackPrefix) { /* ... (Full logic from previous "Fullscreen Fix" response) ... */ }

    // --- Event Handlers for Action Buttons ---
    sendButton.addEventListener('click', async () => { /* ... (Full logic from previous "Fullscreen Fix" response, ensure defaultText for showButtonLoading is correct) ... */ });
    summarizeButton.addEventListener('click', () => { /* ... (Full logic from previous "Fullscreen Fix" response) ... */ });
    translateButton.addEventListener('click', () => { /* ... (Full logic from previous "Fullscreen Fix" response) ... */ });
    sendImageQAButton.addEventListener('click', () => { /* ... (Full logic from previous "Fullscreen Fix" response) ... */ });
    sendImageEnhanceButton.addEventListener('click', () => { /* ... (Full logic from previous "Fullscreen Fix" response) ... */ });
    spellCheckButton.addEventListener('click', () => { /* ... (Full logic from previous "Fullscreen Fix" response) ... */ });
    generateCodeButton.addEventListener('click', () => { /* ... (Full logic from previous "Fullscreen Fix" response) ... */ });
    runCodeButton.addEventListener('click', async () => { /* ... (Full logic from previous "Fullscreen Fix" response) ... */ });

    // --- Web Editor Live Preview Logic & iframe Console ---
    let debounceTimerWebEditor;
    function updateLivePreview() { /* ... (Full logic from "Fullscreen Fix" response) ... */ }
    window.addEventListener('message', function(event) { /* ... (Full logic from "Fullscreen Fix" response) ... */ });
    function debouncedUpdatePreview() { clearTimeout(debounceTimerWebEditor); debounceTimerWebEditor = setTimeout(updateLivePreview, 350); }
    if (htmlCodeInput) htmlCodeInput.addEventListener('input', debouncedUpdatePreview);
    if (cssCodeInput) cssCodeInput.addEventListener('input', debouncedUpdatePreview);
    if (jsCodeInput) jsCodeInput.addEventListener('input', debouncedUpdatePreview);

    // --- Fullscreen Preview Logic (Corrected) ---
    function updateFullscreenButtonState() {
        if (fullscreenPreviewButton) {
            const buttonLabel = fullscreenPreviewButton.querySelector('.button-label-sm');
            const icon = fullscreenPreviewButton.querySelector('i');
            const lang = document.documentElement.lang;
            const isFullscreenActive = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);

            if (isFullscreenActive) {
                if(icon) icon.className = 'fas fa-compress';
                if(buttonLabel) buttonLabel.textContent = lang === 'km' ? 'ចាកចេញ' : 'Exit';
                fullscreenPreviewButton.title = lang === 'km' ? 'ចាកចេញពីពេញអេក្រង់' : "Exit Fullscreen";
                document.body.classList.add('app-in-fullscreen-preview');
            } else {
                if(icon) icon.className = 'fas fa-expand';
                if(buttonLabel) buttonLabel.textContent = lang === 'km' ? 'ពេញអេក្រង់' : 'Fullscreen';
                fullscreenPreviewButton.title = lang === 'km' ? 'មើលពេញអេក្រង់' : "Fullscreen Preview";
                document.body.classList.remove('app-in-fullscreen-preview');
            }
        }
    }
    if (fullscreenPreviewButton && livePreviewFrame) {
        fullscreenPreviewButton.addEventListener('click', () => {
            const isCurrentlyFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
            const elementToFullscreen = livePreviewFrame; 
            if (!isCurrentlyFullscreen) {
                if (elementToFullscreen.requestFullscreen) elementToFullscreen.requestFullscreen().catch(err => console.error(`Error fullscreen: ${err.message}`));
                else if (elementToFullscreen.webkitRequestFullscreen) elementToFullscreen.webkitRequestFullscreen();
                else if (elementToFullscreen.mozRequestFullScreen) elementToFullscreen.mozRequestFullScreen();
                else if (elementToFullscreen.msRequestFullscreen) elementToFullscreen.msRequestFullscreen();
                else alert("Fullscreen API is not supported by this browser.");
            } else {
                if (document.exitFullscreen) document.exitFullscreen().catch(err => console.error("Error exiting fullscreen:", err));
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
                else if (document.msExitFullscreen) document.msExitFullscreen();
            }
        });
    }
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(event => {
        document.addEventListener(event, updateFullscreenButtonState);
    });

    // --- Speak and Copy Button Listeners ---
    speakMainResponseButton.addEventListener('click', () => { /* ... (Same as before, ensuring text cleaning is robust) ... */ });
    speakOriginalSpellCheckButton.addEventListener('click', () => speakText(spellCheckOriginalOutput.textContent, 'km-KH'));
    speakCorrectedSpellCheckButton.addEventListener('click', () => speakText(spellCheckCorrectedOutput.textContent, 'km-KH'));
    function copyToClipboard(textToCopy, buttonElement) { /* ... (Same as "Copy Button Fix" response) ... */ }
    copyMainResponseButton.addEventListener('click', () => { /* ... (Same as "Copy Button Fix" response, ensure text cleaning) ... */ });
    copyOriginalSpellCheckButton.addEventListener('click', () => copyToClipboard(spellCheckOriginalOutput.textContent, copyOriginalSpellCheckButton));
    copyCorrectedSpellCheckButton.addEventListener('click', () => copyToClipboard(spellCheckCorrectedOutput.textContent, copyCorrectedSpellCheckButton));

    // --- Export Chat History ---
    if (exportChatButton) { /* ... (Same as before) ... */ }

    // --- Initial Setup ---
    loadChatHistory();
    Object.keys(defaultPlaceholders).forEach(key => {
        const el = document.getElementById(key);
        if (el) {
            if (el.placeholder !== undefined && defaultPlaceholders[key] === undefined ) defaultPlaceholders[key] = el.placeholder;
            else if (el.textContent && defaultPlaceholders[key] === undefined && !el.id.toLowerCase().includes("output") && !el.id.toLowerCase().includes("history") && el.tagName !== 'BUTTON') defaultPlaceholders[key] = el.textContent;
             else if (el.id === "responseOutput" && defaultPlaceholders[key] === undefined) defaultPlaceholders[key] = "ការឆ្លើយតប AI របស់អ្នកនឹងបង្ហាញនៅទីនេះ។";
        }
    });
    setMode('generate');
});