// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const vm = require('vm'); 
const { spawn } = require('child_process');

const app = express();
app.use(express.json({ limit: '10mb' })); 
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_API_KEY_HERE") {
    console.error("CRITICAL ERROR: GEMINI_API_KEY is not set or is a placeholder in .env.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const KHMER_RESPONSE_INSTRUCTION = "\n\n(សូមឆ្លើយតបជាភាសាខ្មែរ។)";

function buildChatHistory(messages) {
    return messages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
    }));
}

function getUsageInfo(geminiResult) {
    let tokenInfo = "N/A";
    if (geminiResult && geminiResult.response && geminiResult.response.usageMetadata) {
        const { promptTokenCount, candidatesTokenCount, totalTokenCount } = geminiResult.response.usageMetadata;
        let parts = [];
        if (promptTokenCount !== undefined) parts.push(`Prompt: ${promptTokenCount}`);
        if (candidatesTokenCount !== undefined) parts.push(`Response: ${candidatesTokenCount}`);
        if (totalTokenCount !== undefined) parts.push(`Total: ${totalTokenCount}`);
        if (parts.length > 0) tokenInfo = parts.join(', ') + " tokens";
    } else if (geminiResult && geminiResult.totalTokenCount) {
         tokenInfo = `Total: ${geminiResult.totalTokenCount} tokens`;
    }
    return tokenInfo;
}

// --- API Endpoints ---

// 1. Generate Content
app.post('/api/generate', async (req, res) => {
    const startTime = Date.now();
    let { prompt: originalUserPrompt, modelName = "gemini-1.5-flash-latest", forceKhmerResponse = false } = req.body;
    if (!originalUserPrompt) return res.status(400).json({ error: 'Missing prompt' });
    let finalPrompt = originalUserPrompt;
    if (forceKhmerResponse) finalPrompt += KHMER_RESPONSE_INSTRUCTION;
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(finalPrompt);
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        const tokenInfo = getUsageInfo(result);
        res.json({
            model: modelName, response: result.response.text(),
            finishReason: result.response.candidates?.[0]?.finishReason, safetyRatings: result.response.candidates?.[0]?.safetyRatings,
            processingDuration: `${duration}s`, tokenInfo: tokenInfo
        });
    } catch (error) { console.error('Error /api/generate:', error.message); res.status(500).json({ error: 'API error generating content', details: error.message }); }
});

// 2. Chat
app.post('/api/chat', async (req, res) => {
    const startTime = Date.now();
    let { messages, modelName = "gemini-1.5-flash-latest", forceKhmerResponse = false } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0 || messages[messages.length - 1].role !== 'user') {
        return res.status(400).json({ error: 'Invalid messages format or last message not from user.' });
    }
    let modifiedMessages = JSON.parse(JSON.stringify(messages));
    if (forceKhmerResponse) modifiedMessages[modifiedMessages.length - 1].content += KHMER_RESPONSE_INSTRUCTION;
    const history = buildChatHistory(modifiedMessages.slice(0, -1));
    const currentUserPromptWithInstruction = modifiedMessages[modifiedMessages.length - 1].content;
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const chat = model.startChat({ history: history });
        const result = await chat.sendMessage(currentUserPromptWithInstruction);
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        const tokenInfo = getUsageInfo(result);
        res.json({
            model: modelName, response: result.response.text(),
            finishReason: result.response.candidates?.[0]?.finishReason, safetyRatings: result.response.candidates?.[0]?.safetyRatings,
            processingDuration: `${duration}s`, tokenInfo: tokenInfo
        });
    } catch (error) { console.error('Error /api/chat:', error.message); res.status(500).json({ error: 'API error in chat', details: error.message }); }
});

// 3. Generate Content with Streaming
app.post('/api/generate-stream', async (req, res) => {
    const startTime = Date.now();
    let { prompt: originalUserPrompt, modelName = "gemini-1.5-flash-latest", forceKhmerResponse = false } = req.body;
    if (!originalUserPrompt) return res.status(400).json({ error: 'Missing prompt' });
    let finalPrompt = originalUserPrompt;
    if (forceKhmerResponse) finalPrompt += KHMER_RESPONSE_INSTRUCTION;
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        const result = await model.generateContentStream(finalPrompt);
        const setupEndTime = Date.now();
        const setupDuration = ((setupEndTime - startTime) / 1000).toFixed(2);
        res.write(`data: ${JSON.stringify({ type: "metadata_stream_info", setupDuration: `${setupDuration}s`, message: "Streaming response..." })}\n\n`);
        for await (const chunk of result.stream) {
            res.write(`data: ${JSON.stringify({ chunk: chunk.text() })}\n\n`);
        }
        let finalTokenInfo = "N/A (Streaming)";
        if (result.response && result.response.usageMetadata) { // Check if SDK provides this post-stream
            finalTokenInfo = getUsageInfo(result);
        }
        res.write(`data: ${JSON.stringify({ status: "done", tokenInfo: finalTokenInfo })}\n\n`);
        res.end();
    } catch (error) {
        console.error('Error /api/generate-stream:', error.message);
        if (!res.headersSent) res.status(500).json({ error: 'API error streaming content', details: error.message });
        else { res.write(`data: ${JSON.stringify({ error: "Stream failed", details: error.message })}\n\n`); res.end(); }
    }
});

// 4. Summarize Text
app.post('/api/summarize', async (req, res) => {
    const startTime = Date.now();
    let { textToSummarize, desiredLength = "medium", modelName = "gemini-1.5-flash-latest", forceKhmerResponse = false } = req.body;
    if (!textToSummarize) return res.status(400).json({ error: 'Missing textToSummarize' });
    let summaryInstruction = `Please summarize the following text. `;
    switch (desiredLength.toLowerCase()) {
        case "short": summaryInstruction += "Keep it concise (1-2 sentences)."; break;
        case "long": summaryInstruction += "Provide a detailed summary (several sentences or a short paragraph)."; break;
        default: summaryInstruction += "Provide a medium-length summary (3-5 sentences)."; break;
    }
    summaryInstruction += `\n\nText:\n\"\"\"\n${textToSummarize}\n\"\"\"`;
    let finalSummaryPrompt = summaryInstruction;
    if (forceKhmerResponse) finalSummaryPrompt += KHMER_RESPONSE_INSTRUCTION;
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(finalSummaryPrompt);
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        const tokenInfo = getUsageInfo(result);
        res.json({
            model: modelName, summary: result.response.text(), summaryLengthType: desiredLength,
            finishReason: result.response.candidates?.[0]?.finishReason, safetyRatings: result.response.candidates?.[0]?.safetyRatings,
            processingDuration: `${duration}s`, tokenInfo: tokenInfo
        });
    } catch (error) { console.error('Error /api/summarize:', error.message); res.status(500).json({ error: 'API error summarizing text', details: error.message }); }
});

// 5. Translate Text
app.post('/api/translate', async (req, res) => {
    const startTime = Date.now();
    let { textToTranslate, targetLanguage, sourceLanguage = "auto", modelName = "gemini-1.5-flash-latest" } = req.body;
    if (!textToTranslate || !targetLanguage) return res.status(400).json({ error: 'Missing textToTranslate or targetLanguage' });
    let translationPrompt = (sourceLanguage && sourceLanguage.toLowerCase() !== "auto") 
        ? `Translate the following text from ${sourceLanguage} to ${targetLanguage}:\n\n"${textToTranslate}"\n\nProvide only the translated text.`
        : `Translate the following text to ${targetLanguage}:\n\n"${textToTranslate}"\n\nProvide only the translated text.`;
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(translationPrompt);
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        const tokenInfo = getUsageInfo(result);
        res.json({
            model: modelName, originalText: textToTranslate, sourceLanguageGuessed: sourceLanguage.toLowerCase() === "auto" ? "auto-detected" : sourceLanguage,
            targetLanguage: targetLanguage, translatedText: result.response.text(),
            finishReason: result.response.candidates?.[0]?.finishReason, safetyRatings: result.response.candidates?.[0]?.safetyRatings,
            processingDuration: `${duration}s`, tokenInfo: tokenInfo
        });
    } catch (error) { console.error('Error /api/translate:', error.message); res.status(500).json({ error: 'API error translating text', details: error.message }); }
});

// 6. Image Q&A (Multimodal)
app.post('/api/image-qa', async (req, res) => {
    const startTime = Date.now();
    let { prompt, imageBase64, imageMimeType, modelName = "gemini-1.5-flash-latest", forceKhmerResponse = false } = req.body;
    if (!prompt || !imageBase64 || !imageMimeType) return res.status(400).json({ error: 'Missing prompt, imageBase64, or imageMimeType' });
    let finalPrompt = prompt; if (forceKhmerResponse) finalPrompt += KHMER_RESPONSE_INSTRUCTION;
    const imagePart = { inlineData: { data: imageBase64, mimeType: imageMimeType } };
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const requestParts = [{ text: finalPrompt }, imagePart];
        const result = await model.generateContent({ contents: [{ role: "user", parts: requestParts }] });
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        const tokenInfo = getUsageInfo(result);
        res.json({
            model: modelName, prompt: prompt, response: result.response.text(),
            finishReason: result.response.candidates?.[0]?.finishReason, safetyRatings: result.response.candidates?.[0]?.safetyRatings,
            processingDuration: `${duration}s`, tokenInfo: tokenInfo
        });
    } catch (error) { console.error('Error /api/image-qa:', error.message); res.status(500).json({ error: 'API error for image Q&A', details: error.message }); }
});

// 7. Khmer Spell Check
app.post('/api/spell-check', async (req, res) => {
    const startTime = Date.now();
    let { textToCheck, modelName = "gemini-1.5-flash-latest" } = req.body;
    if (!textToCheck) return res.status(400).json({ error: 'Missing textToCheck' });
    const spellCheckPrompt = `Please act as a meticulous Khmer language spell checker and grammar corrector. Review the following Khmer text carefully. Correct any spelling mistakes and grammatical errors you find. Your goal is to produce a perfectly spelled and grammatically correct version of the text. Provide ONLY the fully corrected Khmer text as your response, without any additional explanations, comments, or introductions. Original Khmer Text: """ ${textToCheck} """ Corrected Khmer Text:`;
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(spellCheckPrompt);
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        const tokenInfo = getUsageInfo(result);
        res.json({
            model: modelName, originalText: textToCheck, correctedText: result.response.text(),
            finishReason: result.response.candidates?.[0]?.finishReason, safetyRatings: result.response.candidates?.[0]?.safetyRatings,
            processingDuration: `${duration}s`, tokenInfo: tokenInfo
        });
    } catch (error) { console.error('Error /api/spell-check:', error.message); res.status(500).json({ error: 'API error spell checking text', details: error.message }); }
});

// 8. Suggest Image Enhancements (Textual Suggestions)
app.post('/api/suggest-image-enhancements', async (req, res) => {
    const startTime = Date.now();
    let { prompt, imageBase64, imageMimeType, modelName = "gemini-1.5-flash-latest", forceKhmerResponse = false } = req.body;
    if (!imageBase64 || !imageMimeType) return res.status(400).json({ error: 'Missing imageBase64 or imageMimeType' });
    let enhancementRequestPrompt = "Analyze the following image. Provide 3-5 actionable suggestions to enhance its visual quality, composition, or impact. ";
    if (prompt && prompt.trim() !== "") enhancementRequestPrompt += `The user is specifically interested in: "${prompt}". Please tailor your suggestions accordingly.`;
    else enhancementRequestPrompt += "Consider aspects like lighting, color, focus, framing, and potential artistic styles.";
    if (forceKhmerResponse) enhancementRequestPrompt += KHMER_RESPONSE_INSTRUCTION;
    const imagePart = { inlineData: { data: imageBase64, mimeType: imageMimeType } };
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const requestParts = [{ text: enhancementRequestPrompt }, imagePart];
        const result = await model.generateContent({ contents: [{ role: "user", parts: requestParts }] });
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        const tokenInfo = getUsageInfo(result);
        res.json({
            model: modelName, userPrompt: prompt, suggestions: result.response.text(),
            finishReason: result.response.candidates?.[0]?.finishReason, safetyRatings: result.response.candidates?.[0]?.safetyRatings,
            processingDuration: `${duration}s`, tokenInfo: tokenInfo
        });
    } catch (error) { console.error('Error /api/suggest-image-enhancements:', error.message); res.status(500).json({ error: 'API error for image enhancement suggestions', details: error.message }); }
});

// 9. Generate Code
app.post('/api/generate-code', async (req, res) => {
    const startTime = Date.now();
    let { description, language, modelName = "gemini-1.5-flash-latest", forceKhmerResponse = false } = req.body;
    if (!description || !language) return res.status(400).json({ error: 'Missing code description or target language' });
    let codeGenPrompt = `Generate a code snippet in ${language} for the following requirement: "${description}". Provide only the code block itself. If you must include any explanation, clearly separate it from the code block. For the code block, use standard markdown like \`\`\`${language.toLowerCase()}\nCODE_HERE\n\`\`\` if possible. If the language is something like HTML, just provide the HTML code.`;
    if (forceKhmerResponse) codeGenPrompt += `\nIf you provide any explanation outside the code block, please provide that explanation in Khmer. The code itself should remain in ${language}. ${KHMER_RESPONSE_INSTRUCTION}`;
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(codeGenPrompt);
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        const tokenInfo = getUsageInfo(result);
        const generatedContent = result.response.text();
        let codeOnly = generatedContent;
        const codeBlockRegex = new RegExp("```(?:" + language.toLowerCase().replace('+', '\\+') + ")?\\s*([\\s\\S]*?)\\s*```");
        const match = generatedContent.match(codeBlockRegex);
        if (match && match[1]) codeOnly = match[1].trim();
        
        res.json({
            model: modelName, language: language, description: description,
            generatedCode: codeOnly, fullResponse: generatedContent,
            finishReason: result.response.candidates?.[0]?.finishReason, safetyRatings: result.response.candidates?.[0]?.safetyRatings,
            processingDuration: `${duration}s`, tokenInfo: tokenInfo
        });
    } catch (error) { console.error('Error /api/generate-code:', error.message); res.status(500).json({ error: 'Failed to generate code from Gemini API', details: error.message }); }
});

// 10. Run JavaScript Code
app.post('/api/run-javascript', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'No JavaScript code provided.' });
    const output = []; const errors = []; let executionTime = 0; const startTime = process.hrtime();
    try {
        const sandbox = {
            console: {
                log: (...args) => output.push(args.map(arg => String(arg)).join(' ')),
                error: (...args) => errors.push(args.map(arg => String(arg)).join(' ')),
                warn: (...args) => output.push(`WARN: ${args.map(arg => String(arg)).join(' ')}`),
            },
            setTimeout, clearTimeout, setInterval, clearInterval, Math, Date, JSON,
        };
        const context = vm.createContext(sandbox);
        vm.runInContext(code, context, { timeout: 5000 });
        const diff = process.hrtime(startTime); executionTime = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
        res.json({ output: output.join('\n'), errors: errors.join('\n'), executionTime: `${executionTime}ms`, status: errors.length > 0 ? "completed_with_errors" : "success" });
    } catch (e) {
        const diff = process.hrtime(startTime); executionTime = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
        errors.push(e.message); if (e.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') errors.push("Execution timed out (max 5 seconds).");
        res.json({ output: output.join('\n'), errors: errors.join('\n'), executionTime: `${executionTime}ms`, status: "execution_error" });
    }
});

// 11. Run Python Code
app.post('/api/run-python', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'No Python code provided.' });
    let output = ''; let errors = ''; let executionTime = 0; const startTime = process.hrtime();
    const pythonExecutable = process.platform === "win32" ? "python" : "python3"; 
    const pythonProcess = spawn(pythonExecutable, ['-u', '-c', code], { timeout: 5000 }); // Added -u for unbuffered output

    pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { errors += data.toString(); });
    pythonProcess.on('close', (exitCode) => {
        const diff = process.hrtime(startTime); executionTime = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
        res.json({ output: output.trim(), errors: errors.trim(), exitCode: exitCode, executionTime: `${executionTime}ms`, status: exitCode === 0 && !errors ? "success" : (exitCode === 0 && errors ? "completed_with_stderr" : "execution_error") });
    });
    pythonProcess.on('error', (err) => {
        const diff = process.hrtime(startTime); executionTime = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
        res.status(500).json({ output: '', errors: `Failed to start Python process: ${err.message}. Is Python installed and in PATH?`, executionTime: `${executionTime}ms`, status: "process_spawn_error" });
    });
});


app.listen(PORT, () => {
    console.log(`Gemini AI Server running on http://localhost:${PORT}`);
    if (GEMINI_API_KEY && GEMINI_API_KEY.includes("YOUR_API_KEY_HERE")) {
        console.warn("WARNING: GEMINI_API_KEY in .env is a placeholder. Update it with your actual key.");
    }
});