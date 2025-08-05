// Content script using html2canvas for individual question screenshots
console.log('MCQ Solver content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkElement') {
        const questionSelector = request.questionSelector || '.gcb-question-row';
        const elements = document.querySelectorAll(questionSelector);
        sendResponse({
            exists: elements.length > 0,
            count: elements.length,
            selector: questionSelector
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

async function testScreenshot(questionSelector = '.gcb-question-row') {
    try {
        const questionElements = document.querySelectorAll(questionSelector);
        if (questionElements.length === 0) {
            throw new Error(`No elements found with selector "${questionSelector}"`);
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

async function solveMCQs(apiKey, questionSelector = '.gcb-question-row', domainContext='') {
    try {
        const questionElements = document.querySelectorAll(questionSelector);
        if (questionElements.length === 0) {
            throw new Error(`No questions found with selector "${questionSelector}"`);
        }
        if (domainContext) {
            console.log(`Using domain context: ${domainContext}`);
        }

        console.log(`Found ${questionElements.length} questions to solve`);
        
        // Process questions in batches to respect rate limits
        const batchSize = 10; // Adjust based on Gemini's rate limits
        const results = [];
        
        for (let i = 0; i < questionElements.length; i += batchSize) {
            const batch = Array.from(questionElements).slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(questionElements.length/batchSize)}`);
            
            // Process batch in parallel
            const batchPromises = batch.map(async (element, batchIndex) => {
                const questionIndex = i + batchIndex;
                try {
                    // Capture screenshot of individual question
                    const screenshot = await captureElementScreenshot(element, questionIndex);
                    
                    // Get answer from Gemini for this specific question
                    const answer = await getSingleAnswerFromGemini(screenshot, apiKey, questionIndex + 1);
                    
                    // Select the answer for this question
                    await selectAnswerForQuestion(element, answer, questionIndex + 1);
                    
                    return {
                        questionIndex: questionIndex + 1,
                        answer: answer,
                        success: true
                    };
                } catch (error) {
                    console.error(`Error processing question ${questionIndex + 1}:`, error);
                    return {
                        questionIndex: questionIndex + 1,
                        error: error.message,
                        success: false
                    };
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // Add delay between batches to respect rate limits
            if (i + batchSize < questionElements.length) {
                console.log('Waiting before next batch...');
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
            }
        }
        
        const successfulAnswers = results.filter(r => r.success);
        const failedAnswers = results.filter(r => !r.success);
        
        console.log(`Successfully solved ${successfulAnswers.length}/${questionElements.length} questions`);
        if (failedAnswers.length > 0) {
            console.warn('Failed questions:', failedAnswers);
        }
        
        return {
            success: true,
            questionsCount: questionElements.length,
            successfulAnswers: successfulAnswers.length,
            failedAnswers: failedAnswers.length,
            results: results,
            message: `Solved ${successfulAnswers.length}/${questionElements.length} questions successfully!`
        };
        
    } catch (error) {
        console.error('Error solving MCQs:', error);
        throw error;
    }
}

async function captureElementScreenshot(element, questionIndex) {
    return new Promise(async (resolve, reject) => {
        if (typeof html2canvas === 'undefined') {
            reject(new Error('html2canvas library not loaded'));
            return;
        }

        try {
            // Preprocess CORS images
            console.log(`Preprocessing CORS images for question ${questionIndex + 1}...`);
            await preprocessCORSImages(element);
            
            // Wait for images to load
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.warn(`Error preprocessing images for question ${questionIndex + 1}:`, error);
        }

        // Scroll element into view
        element.scrollIntoView({behavior: 'smooth', block: 'center'});
        
        // Wait for scroll
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
                
                // Save for debugging
                // saveImageForDebugging(dataUrl, `question-${questionIndex + 1}-screenshot.png`);
                
                resolve(dataUrl);
            }).catch(error => {
                console.error(`html2canvas error for question ${questionIndex + 1}:`, error);
                reject(error);
            });
        }, 1000);
    });
}

async function getSingleAnswerFromGemini(imageData, apiKey, questionNumber) {
    const base64Data = imageData.split(',')[1];
    
    const prompt = `You are an expert at solving multiple choice questions. Look at this image which contains ONE multiple choice question.

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
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
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
        
        console.log(`✓ Question ${questionNumber}: Selected option ${answer} (${selectedInput.value || 'no value'})`);
        
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