// Content script using html2canvas for individual question screenshots
console.log('MCQ Solver content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkElement') {
        const questionSelector = request.questionSelector || '.gcb-question-row';
        let elements = document.querySelectorAll(questionSelector);
        
        // If no elements found, try smart detection
        if (elements.length === 0) {
            const smartSelector = findQuestionSelector();
            if (smartSelector) {
                elements = document.querySelectorAll(smartSelector);
                sendResponse({
                    exists: elements.length > 0,
                    count: elements.length,
                    selector: smartSelector,
                    autoDetected: true,
                    message: `Auto-detected selector: ${smartSelector}`
                });
                return;
            }
        }
        
        sendResponse({
            exists: elements.length > 0,
            count: elements.length,
            selector: questionSelector,
            autoDetected: false
        });
    }
    
    if (request.action === 'testScreenshot') {
        testScreenshot(request.questionSelector).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({success: false, error: error.message});
        });
        return true;
    }
    
    if (request.action === 'solveMCQ') {
        solveMCQs(request.apiKey, request.questionSelector, request.domainContext).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({success: false, error: error.message});
        });
        return true;
    }
});

// Smart question selector detection
function findQuestionSelector() {
    console.log('🔍 Starting smart question detection...');
    
    // Find all radio button inputs
    const radioInputs = document.querySelectorAll('input[type="radio"]');
    if (radioInputs.length === 0) {
        console.warn('No radio inputs found on page');
        return null;
    }
    
    console.log(`Found ${radioInputs.length} radio inputs`);
    
    // Group radio inputs by their name attribute (questions have same name)
    const questionGroups = {};
    radioInputs.forEach(radio => {
        const name = radio.name;
        if (name) {
            if (!questionGroups[name]) {
                questionGroups[name] = [];
            }
            questionGroups[name].push(radio);
        }
    });
    
    const questionNames = Object.keys(questionGroups);
    console.log(`Found ${questionNames.length} question groups:`, questionNames);
    
    if (questionNames.length === 0) {
        return null;
    }
    
    // Find common parent container for each question group
    const questionContainers = [];
    questionNames.forEach(name => {
        const radios = questionGroups[name];
        const container = findCommonParent(radios);
        if (container) {
            questionContainers.push(container);
        }
    });
    
    if (questionContainers.length === 0) {
        return null;
    }
    
    // Find the most specific common selector
    const selector = findBestSelector(questionContainers);
    console.log(`🎯 Smart detection found selector: ${selector}`);
    
    return selector;
}

function findCommonParent(elements) {
    if (elements.length === 0) return null;
    if (elements.length === 1) return elements[0].closest('div, section, article, form');
    
    let commonParent = elements[0];
    
    // Find the deepest common ancestor
    for (let i = 1; i < elements.length; i++) {
        commonParent = findDeepestCommonAncestor(commonParent, elements[i]);
        if (!commonParent) break;
    }
    
    // Move up to find a more semantic container
    while (commonParent && !isGoodQuestionContainer(commonParent)) {
        commonParent = commonParent.parentElement;
    }
    
    return commonParent;
}

function findDeepestCommonAncestor(elem1, elem2) {
    const ancestors1 = getAncestors(elem1);
    const ancestors2 = getAncestors(elem2);
    
    let common = null;
    for (let i = 0; i < Math.min(ancestors1.length, ancestors2.length); i++) {
        if (ancestors1[i] === ancestors2[i]) {
            common = ancestors1[i];
        } else {
            break;
        }
    }
    
    return common;
}

function getAncestors(element) {
    const ancestors = [];
    let current = element;
    while (current && current !== document.body) {
        ancestors.unshift(current);
        current = current.parentElement;
    }
    return ancestors;
}

function isGoodQuestionContainer(element) {
    const text = element.textContent.trim();
    const hasRadios = element.querySelectorAll('input[type="radio"]').length >= 2;
    const hasSubstantialText = text.length > 20;
    const hasQuestionKeywords = /question|mcq|choice|quiz|assessment|problem/i.test(element.className + ' ' + element.getAttribute('data-*'));
    
    return hasRadios && hasSubstantialText;
}

function findBestSelector(containers) {
    // Try to find a common class or attribute
    const classes = new Map();
    const tagNames = new Map();
    
    containers.forEach(container => {
        // Count tag names
        const tag = container.tagName.toLowerCase();
        tagNames.set(tag, (tagNames.get(tag) || 0) + 1);
        
        // Count classes
        if (container.className) {
            container.className.split(' ').forEach(cls => {
                if (cls.trim()) {
                    classes.set(cls.trim(), (classes.get(cls.trim()) || 0) + 1);
                }
            });
        }
    });
    
    // Find most common class that appears in all containers
    const containerCount = containers.length;
    for (let [className, count] of classes.entries()) {
        if (count === containerCount && className.length > 0) {
            return `.${className}`;
        }
    }
    
    // Fallback to most common tag
    let mostCommonTag = 'div';
    let maxCount = 0;
    for (let [tag, count] of tagNames.entries()) {
        if (count > maxCount) {
            maxCount = count;
            mostCommonTag = tag;
        }
    }
    
    return mostCommonTag;
}

async function testScreenshot(questionSelector = '.gcb-question-row') {
    try {
        let questionElements = document.querySelectorAll(questionSelector);
        
        // Try smart detection if no elements found
        if (questionElements.length === 0) {
            const smartSelector = findQuestionSelector();
            if (smartSelector) {
                questionElements = document.querySelectorAll(smartSelector);
                if (questionElements.length > 0) {
                    console.log(`✅ Smart detection successful: ${smartSelector}`);
                }
            }
        }
        
        if (questionElements.length === 0) {
            throw new Error(`No elements found with selector "${questionSelector}". Try using smart detection.`);
        }

        console.log(`Testing screenshot for ${questionElements.length} questions`);
        
        // Test screenshot for first question only
        const firstQuestion = questionElements[0];
        await captureElementScreenshot(firstQuestion, 0);
        
        return {
            success: true,
            message: `Screenshot test successful! Found ${questionElements.length} questions.`,
            questionsCount: questionElements.length
        };
        
    } catch (error) {
        console.error('Error testing screenshot:', error);
        throw error;
    }
}

// Updated solveMCQs function with parallel processing
async function solveMCQs(apiKey, questionSelector = '.gcb-question-row', domainContext = '') {
    try {
        let questionElements = document.querySelectorAll(questionSelector);
        
        // Try smart detection if no elements found
        if (questionElements.length === 0) {
            console.log('🔍 No questions found with provided selector, trying smart detection...');
            const smartSelector = findQuestionSelector();
            if (smartSelector) {
                questionElements = document.querySelectorAll(smartSelector);
                if (questionElements.length > 0) {
                    console.log(`✅ Smart detection found ${questionElements.length} questions with selector: ${smartSelector}`);
                    showProgress(`Auto-detected selector: ${smartSelector}`, 'info');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        
        if (questionElements.length === 0) {
            throw new Error(`No questions found. Please check the question selector or try manual detection.`);
        }

        console.log(`Found ${questionElements.length} questions to solve`);
        if (domainContext) {
            console.log(`Using domain context: ${domainContext}`);
        }
        
        showProgress(`Starting to solve ${questionElements.length} questions in parallel...`, 'info');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Process all questions in parallel
        const questionPromises = Array.from(questionElements).map(async (element, index) => {
            const questionIndex = index + 1;
            
            try {
                showProgress(`📸 Starting question ${questionIndex}/${questionElements.length}...`, 'progress');
                
                // Capture screenshot
                const screenshot = await captureElementScreenshot(element, index);
                
                // Get answer with retry logic (each question handles its own retries)
                showProgress(`🤖 Processing AI request for question ${questionIndex}/${questionElements.length}...`, 'progress');
                const answer = await getAnswerWithRetry(screenshot, apiKey, questionIndex, domainContext);
                
                // Select answer
                await selectAnswerForQuestion(element, answer, questionIndex);
                
                showProgress(`✅ Question ${questionIndex} completed successfully!`, 'success');
                
                return {
                    questionIndex: questionIndex,
                    answer: answer,
                    success: true
                };
                
            } catch (error) {
                console.error(`Error processing question ${questionIndex}:`, error);
                showProgress(`❌ Question ${questionIndex} failed: ${error.message}`, 'error');
                
                return {
                    questionIndex: questionIndex,
                    error: error.message,
                    success: false
                };
            }
        });
        
        // Wait for all questions to complete
        showProgress(`🔄 Processing all ${questionElements.length} questions in parallel...`, 'progress');
        const results = await Promise.allSettled(questionPromises);
        
        // Process results
        const processedResults = results.map(result => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                return {
                    questionIndex: 0,
                    error: result.reason?.message || 'Unknown error',
                    success: false
                };
            }
        });
        
        const successfulAnswers = processedResults.filter(r => r.success);
        const failedAnswers = processedResults.filter(r => !r.success);
        
        console.log(`Successfully solved ${successfulAnswers.length}/${questionElements.length} questions`);
        
        const finalMessage = `🎉 Completed! Solved ${successfulAnswers.length}/${questionElements.length} questions successfully!`;
        showProgress(finalMessage, 'success');
        
        return {
            success: true,
            questionsCount: questionElements.length,
            successfulAnswers: successfulAnswers.length,
            failedAnswers: failedAnswers.length,
            results: processedResults,
            message: finalMessage
        };
        
    } catch (error) {
        console.error('Error solving MCQs:', error);
        showProgress(`❌ Error: ${error.message}`, 'error');
        throw error;
    }
}

// Enhanced progress display function
function showProgress(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Send message to popup if possible
    try {
        chrome.runtime.sendMessage({
            action: 'updateProgress',
            message: message,
            type: type
        });
    } catch (e) {
        // Popup might be closed, just log
    }
    
    // Also show on page with floating notification
    showFloatingNotification(message, type);
}

function showFloatingNotification(message, type) {
    // Remove existing notification
    const existing = document.getElementById('mcq-solver-notification');
    if (existing) {
        existing.remove();
    }
    
    // Create new notification
    const notification = document.createElement('div');
    notification.id = 'mcq-solver-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getTypeColor(type)};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 400px;
        word-wrap: break-word;
        transition: all 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after delay (except for progress messages)
    if (type !== 'progress') {
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }
        }, type === 'error' ? 5000 : 3000);
    }
}

function getTypeColor(type) {
    switch (type) {
        case 'success': return '#4CAF50';
        case 'error': return '#f44336';
        case 'progress': return '#2196F3';
        case 'info': return '#FF9800';
        default: return '#2196F3';
    }
}

// Updated getAnswerWithRetry with better rate limit handling for parallel requests
async function getAnswerWithRetry(imageData, apiKey, questionNumber, domainContext, maxRetries = 5) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 1) {
                showProgress(`Retry ${attempt}/${maxRetries} for question ${questionNumber}...`, 'progress');
            }
            
            const answer = await getSingleAnswerFromGemini(imageData, apiKey, questionNumber, domainContext);
            
            if (answer >= 1 && answer <= 4) {
                return answer;
            } else {
                throw new Error(`Invalid answer received: ${answer}`);
            }
            
        } catch (error) {
            lastError = error;
            console.warn(`Attempt ${attempt} failed for question ${questionNumber}:`, error.message);
            
            if (attempt < maxRetries) {
                // Check if it's a rate limiting error
                if (error.message.includes('429') || error.message.includes('rate limit') || error.message.includes('quota')) {
                    // For parallel processing, use randomized delay to spread out retries
                    const baseDelay = 5000; // 5 seconds base
                    const randomDelay = Math.random() * 10000; // 0-10 seconds random
                    const attemptMultiplier = attempt * 2000; // Increase delay with attempts
                    const waitTime = baseDelay + randomDelay + attemptMultiplier;
                    
                    showProgress(`⏳ Rate limit for Q${questionNumber}. Waiting ${Math.round(waitTime/1000)}s...`, 'info');
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    // For other errors, shorter randomized wait
                    const waitTime = 2000 + (Math.random() * 3000); // 2-5 seconds
                    showProgress(`⏳ Retrying Q${questionNumber} in ${Math.round(waitTime/1000)}s...`, 'info');
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }
    }
    
    throw new Error(`Q${questionNumber} failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
}

// Enhanced captureElementScreenshot to handle parallel processing better
async function captureElementScreenshot(element, questionIndex) {
    return new Promise(async (resolve, reject) => {
        if (typeof html2canvas === 'undefined') {
            reject(new Error('html2canvas library not loaded'));
            return;
        }

        try {
            // Preprocess CORS images
            await preprocessCORSImages(element);
            
            // Add small random delay to prevent all screenshots happening at exact same time
            const randomDelay = Math.random() * 1000; // 0-1 second random delay
            await new Promise(resolve => setTimeout(resolve, randomDelay));
            
        } catch (error) {
            console.warn(`Error preprocessing images for question ${questionIndex + 1}:`, error);
        }

        // Scroll element into view gently (without scrolling to bottom)
        element.scrollIntoView({behavior: 'smooth', block: 'center'});
        
        // Wait for scroll with small random delay
        const scrollDelay = 500 + (Math.random() * 500); // 0.5-1 second
        setTimeout(() => {
            console.log(`Capturing screenshot for question ${questionIndex + 1}...`);
            
            html2canvas(element, {
                useCORS: false,
                allowTaint: true,
                scale: 1,
                logging: false,
                backgroundColor: '#ffffff',
                removeContainer: true,
                foreignObjectRendering: false,
                width: element.scrollWidth,
                height: element.scrollHeight
            }).then(canvas => {
                const dataUrl = canvas.toDataURL('image/png', 0.9);
                
                console.log(`Screenshot captured for question ${questionIndex + 1}:`, {
                    canvasWidth: canvas.width,
                    canvasHeight: canvas.height,
                    dataUrlLength: dataUrl.length
                });
                
                resolve(dataUrl);
            }).catch(error => {
                console.error(`html2canvas error for question ${questionIndex + 1}:`, error);
                reject(error);
            });
        }, scrollDelay);
    });
}

// Rate-limited API call wrapper
class RateLimiter {
    constructor(requestsPerMinute = 60) {
        this.requestsPerMinute = requestsPerMinute;
        this.requests = [];
    }
    
    async waitForSlot() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        // Remove requests older than 1 minute
        this.requests = this.requests.filter(time => time > oneMinuteAgo);
        
        if (this.requests.length >= this.requestsPerMinute) {
            // Wait until the oldest request is more than 1 minute old
            const waitTime = this.requests[0] + 60000 - now + 1000; // +1s buffer
            console.log(`Rate limiter: waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.waitForSlot(); // Recursive call
        }
        
        this.requests.push(now);
    }
}

// Create global rate limiter
const globalRateLimiter = new RateLimiter(50); // Slightly under the 60/min limit for safety

// Updated getSingleAnswerFromGemini with rate limiting
async function getSingleAnswerFromGemini(imageData, apiKey, questionNumber, domainContext = '') {
    // Wait for rate limiter slot
    await globalRateLimiter.waitForSlot();
    
    const base64Data = imageData.split(',')[1];
    
    // Build the prompt with optional domain context
    let prompt = `You are an expert at solving multiple choice questions. Look at this image which contains ONE multiple choice question.`;
    
    // Add domain context if provided
    if (domainContext && domainContext.trim()) {
        prompt += `\n\nDomain Context: You are dealing with questions from the domain of ${domainContext.trim()}. Use your expertise in this field to answer accurately.`;
    }
    
    prompt += `

Analyze the question and all the given options carefully, then choose the correct answer.

CRITICAL INSTRUCTION: You must respond with ONLY the option NUMBER (1, 2, 3, or 4) - NOT letters like A, B, C, D.

Response format rules:
- If the first option is correct, respond: 1
- If the second option is correct, respond: 2  
- If the third option is correct, respond: 3
- If the fourth option is correct, respond: 4

DO NOT use letters (A, B, C, D). 
DO NOT include any explanations, text, or punctuation.
DO NOT use words like "option", "answer", "correct", etc.
ONLY respond with a single digit: 1, 2, 3, or 4

Example correct responses:
- If second option is correct: 2
- If fourth option is correct: 4

REMEMBER: Numbers only (1-4), never letters (A-D).`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {text: prompt},
                        {
                            inline_data: {
                                mime_type: "image/png",
                                data: base64Data
                            }
                        }
                    ]
                }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Gemini API error: ${response.status}`;
            
            if (response.status === 429) {
                errorMessage = 'Rate limit exceeded. Will retry after waiting.';
            } else if (response.status === 403) {
                errorMessage = 'API key invalid or quota exceeded.';
            } else if (response.status >= 500) {
                errorMessage = 'Gemini server error. Will retry.';
            }
            
            throw new Error(errorMessage + ` - ${errorText}`);
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Invalid response from Gemini API');
        }
        
        let answerText = data.candidates[0].content.parts[0].text.trim();
        console.log(`Gemini raw response for question ${questionNumber}:`, answerText);
        
        // Handle cases where Gemini might still return letters despite instructions
        if (answerText.match(/^[A-D]$/i)) {
            console.log(`Converting letter response "${answerText}" to number`);
            const letterToNumber = {
                'A': 1, 'a': 1,
                'B': 2, 'b': 2, 
                'C': 3, 'c': 3,
                'D': 4, 'd': 4
            };
            answerText = letterToNumber[answerText].toString();
        }
        
        // Extract just the number from the response (in case there's extra text)
        const numberMatch = answerText.match(/[1-4]/);
        if (!numberMatch) {
            throw new Error(`No valid option number (1-4) found in response: "${answerText}"`);
        }
        
        const answer = parseInt(numberMatch[0]);
        console.log(`Final parsed answer for question ${questionNumber}: ${answer}`);
        
        if (isNaN(answer) || answer < 1 || answer > 4) {
            throw new Error(`Invalid answer format: ${answerText} -> ${answer}`);
        }
        
        return answer;
    } catch (error) {
        console.error(`Error getting answer for question ${questionNumber}:`, error);
        throw error;
    }
}

async function selectAnswerForQuestion(questionElement, answer, questionNumber) {
    try {
        // Find all input elements within this question
        const inputs = questionElement.getElementsByTagName('input');
        const radioInputs = Array.from(inputs).filter(input => input.type === 'radio');
        
        console.log(`Question ${questionNumber}: Found ${radioInputs.length} radio inputs`);
        
        if (radioInputs.length === 0) {
            throw new Error(`No radio inputs found for question ${questionNumber}`);
        }
        
        const answerIndex = answer - 1; // Convert 1-based to 0-based
        
        if (answerIndex < 0 || answerIndex >= radioInputs.length) {
            throw new Error(`Invalid answer ${answer} for question ${questionNumber} (has ${radioInputs.length} options)`);
        }
        
        // Uncheck all options first
        radioInputs.forEach(input => {
            input.checked = false;
        });
        
        // Select the correct option
        const selectedInput = radioInputs[answerIndex];
        selectedInput.checked = true;
        
        // Trigger events
        selectedInput.dispatchEvent(new Event('change', { bubbles: true }));
        selectedInput.dispatchEvent(new Event('click', { bubbles: true }));
        
        console.log(`✓ Question ${questionNumber}: Selected option ${answer}`);
        
        // Add visual feedback
        questionElement.style.border = '2px solid #4CAF50';
        questionElement.style.backgroundColor = '#f0f8f0';
        
        setTimeout(() => {
            questionElement.style.border = '';
            questionElement.style.backgroundColor = '';
        }, 2000);
        
    } catch (error) {
        console.error(`Error selecting answer for question ${questionNumber}:`, error);
        
        // Add error visual feedback
        questionElement.style.border = '2px solid #f44336';
        questionElement.style.backgroundColor = '#fff0f0';
        
        setTimeout(() => {
            questionElement.style.border = '';
            questionElement.style.backgroundColor = '';
        }, 3000);
        
        throw error;
    }
}

// Keep existing helper functions
function saveImageForDebugging(dataUrl, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function preprocessCORSImages(element) {
    const corsImages = element.querySelectorAll('img[src*="storage.googleapis.com"]');
    const imageReplacements = [];
    
    for (let img of corsImages) {
        const originalSrc = img.src;
        
        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'fetchImage',
                    url: originalSrc
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (response && response.dataUrl) {
                        resolve(response.dataUrl);
                    } else if (response && response.error) {
                        reject(new Error(response.error));
                    } else {
                        reject(new Error('Unknown error'));
                    }
                });
            });
            
            img.src = response;
            imageReplacements.push({img, originalSrc, newSrc: response});
            console.log('Successfully replaced CORS image:', originalSrc);
            
        } catch (error) {
            console.warn('Could not fetch image, creating placeholder:', originalSrc, error);
            const placeholder = createPlaceholderImage(img, originalSrc);
            img.src = placeholder;
            imageReplacements.push({img, originalSrc, newSrc: placeholder});
        }
    }
    
    return imageReplacements;
}

function createPlaceholderImage(img, originalSrc) {
    const questionMatch = originalSrc.match(/a1q(\d+)/);
    const questionNum = questionMatch ? questionMatch[1] : '?';
    
    const width = img.naturalWidth || img.width || 400;
    const height = img.naturalHeight || img.height || 300;
    
    const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#f0f0f0" stroke="#ccc" stroke-width="2"/>
            <text x="50%" y="40%" font-family="Arial, sans-serif" font-size="16" 
                  text-anchor="middle" fill="#666">Question ${questionNum}</text>
            <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="12" 
                  text-anchor="middle" fill="#999">[Image not available]</text>
        </svg>`;
    
    return 'data:image/svg+xml;base64,' + btoa(svg);
}