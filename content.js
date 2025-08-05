// Content script using html2canvas for complete element screenshots
console.log('MCQ Solver content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkElement') {
        const element = document.getElementById('gcb-main-article');
        sendResponse({exists: !!element});
    }
    
    if (request.action === 'testScreenshot') {
        testScreenshot().then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({success: false, error: error.message});
        });
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'solveMCQ') {
        solveMCQs(request.apiKey).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({success: false, error: error.message});
        });
        return true; // Keep message channel open for async response
    }
});

async function testScreenshot() {
    try {
        // Check if element exists
        const mainElement = document.getElementById('gcb-main-article');
        if (!mainElement) {
            throw new Error('Element with id "gcb-main-article" not found');
        }

        console.log('Testing screenshot for element:', mainElement);
        console.log('Element dimensions:', {
            scrollWidth: mainElement.scrollWidth,
            scrollHeight: mainElement.scrollHeight,
            clientWidth: mainElement.clientWidth,
            clientHeight: mainElement.clientHeight,
            offsetWidth: mainElement.offsetWidth,
            offsetHeight: mainElement.offsetHeight
        });
        
        // Take screenshot
        await captureCompleteElementScreenshot(mainElement);
        
        return {
            success: true,
            message: 'Screenshot captured and saved successfully!'
        };
        
    } catch (error) {
        console.error('Error testing screenshot:', error);
        throw error;
    }
}

async function solveMCQs(apiKey) {
    try {
        // Check if element exists
        const mainElement = document.getElementById('gcb-main-article');
        if (!mainElement) {
            throw new Error('Element with id "gcb-main-article" not found');
        }

        // Take screenshot of the complete element
        const screenshot = await captureCompleteElementScreenshot(mainElement);
        
        // Send image to Gemini API
        const answers = await getAnswersFromGemini(screenshot, apiKey);
        
        // Parse answers and select options
        const questionsCount = await selectAnswers(mainElement, answers);
        
        return {
            success: true,
            questionsCount: questionsCount,
            message: 'MCQs solved successfully!'
        };
        
    } catch (error) {
        console.error('Error solving MCQs:', error);
        throw error;
    }
}

async function captureCompleteElementScreenshot(element) {
    return new Promise(async (resolve, reject) => {
        // Ensure html2canvas is loaded
        if (typeof html2canvas === 'undefined') {
            reject(new Error('html2canvas library not loaded'));
            return;
        }

        try {
            // Preprocess CORS images before html2canvas
            console.log('Preprocessing CORS images...');
            const imageReplacements = await preprocessCORSImages(element);
            console.log(`Processed ${imageReplacements.length} CORS images`);
            
            // Wait a bit for images to load
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.warn('Error preprocessing images:', error);
            // Continue anyway, but images might not work
        }

        // Scroll element into view
        element.scrollIntoView({behavior: 'smooth', block: 'start'});
        
        // Wait for scroll to complete
        setTimeout(() => {
            console.log('Capturing element screenshot with html2canvas...');
            
            // Use html2canvas with safe options
            html2canvas(element, {
                useCORS: false, // Disable CORS since we've already handled images
                allowTaint: true, // Allow cross-origin content
                scale: 1,
                logging: false, // Disable logging to reduce console spam
                width: element.scrollWidth,
                height: element.scrollHeight,
                scrollX: 0,
                scrollY: 0,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight,
                backgroundColor: '#ffffff',
                removeContainer: true,
                foreignObjectRendering: false, // Disable to avoid issues
                // No need for ignoreElements since we've preprocessed
            }).then(canvas => {
                const dataUrl = canvas.toDataURL('image/png', 0.9);
                
                console.log('Screenshot captured successfully:', {
                    canvasWidth: canvas.width,
                    canvasHeight: canvas.height,
                    dataUrlLength: dataUrl.length
                });
                
                // Save the image for debugging
                saveImageForDebugging(dataUrl, 'complete-element-screenshot.png');
                
                resolve(dataUrl);
            }).catch(error => {
                console.error('html2canvas error:', error);
                reject(error);
            });
        }, 1500);
    });
}

function saveImageForDebugging(dataUrl, filename) {
    // Create a download link
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    
    // Add timestamp to filename to avoid conflicts
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `${timestamp}-${filename}`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`Saved debug image: ${link.download}`);
}

async function getAnswersFromGemini(imageData, apiKey) {
    const base64Data = imageData.split(',')[1]; // Remove data:image/png;base64, prefix
    
    const prompt = `You are an expert at solving multiple choice questions. Look at this image which contains MCQs. 

For each question in the image:
1. Read the question carefully
2. Analyze all the given options
3. Choose the correct answer
4. Respond with ONLY the option numbers (1, 2, 3, or 4) separated by commas

For example, if there are 3 questions and the answers are option 2, option 1, and option 4, respond exactly like this:
2,1,4

Important: 
- Give only the option numbers
- Separate multiple answers with commas
- No explanations or additional text
- Count questions from top to bottom`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
    
    const answerText = data.candidates[0].content.parts[0].text.trim();
    
    console.log('Gemini response:', answerText);
    
    // Parse the comma-separated answers
    return answerText.split(',').map(answer => parseInt(answer.trim()));
}

async function selectAnswers(mainElement, answers) {
    const inputs = mainElement.getElementsByTagName('input');
    console.log('Found inputs:', inputs.length);
    
    // Group inputs by question (assuming radio buttons with same name belong to same question)
    const questionGroups = {};
    
    for (let input of inputs) {
        if (input.type === 'radio') {
            const name = input.name;
            if (!questionGroups[name]) {
                questionGroups[name] = [];
            }
            questionGroups[name].push(input);
        }
    }
    
    const questionNames = Object.keys(questionGroups);
    console.log('Found question groups:', questionNames.length);
    console.log('Question groups:', questionGroups);
    
    // Select answers for each question
    questionNames.forEach((questionName, index) => {
        if (index < answers.length) {
            const answerIndex = answers[index] - 1; // Convert 1-based to 0-based index
            const questionInputs = questionGroups[questionName];
            
            console.log(`Question ${index + 1} (${questionName}): Selecting option ${answers[index]} (index ${answerIndex})`);
            
            if (answerIndex >= 0 && answerIndex < questionInputs.length) {
                // Uncheck all options first
                questionInputs.forEach(input => input.checked = false);
                
                // Check the correct option
                questionInputs[answerIndex].checked = true;
                
                // Trigger both change and click events to ensure the website registers the selection
                questionInputs[answerIndex].dispatchEvent(new Event('change', { bubbles: true }));
                questionInputs[answerIndex].click();
                
                console.log(`✓ Selected option ${answers[index]} for question ${index + 1}`);
            } else {
                console.warn(`⚠ Invalid answer index ${answerIndex} for question ${index + 1} (has ${questionInputs.length} options)`);
            }
        }
    });
    
    return questionNames.length;
}

async function preprocessCORSImages(element) {
    // Find all images with storage.googleapis.com sources
    const corsImages = element.querySelectorAll('img[src*="storage.googleapis.com"]');
    const imageReplacements = [];
    
    for (let img of corsImages) {
        const originalSrc = img.src;
        
        try {
            // Try to fetch the image through the background script
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
            
            // Replace the src with the fetched data URL
            img.src = response;
            imageReplacements.push({img, originalSrc, newSrc: response});
            console.log('Successfully replaced CORS image:', originalSrc);
            
        } catch (error) {
            console.warn('Could not fetch image, creating placeholder:', originalSrc, error);
            
            // Create a placeholder image with the question text or number
            const placeholder = createPlaceholderImage(img, originalSrc);
            img.src = placeholder;
            imageReplacements.push({img, originalSrc, newSrc: placeholder});
        }
    }
    
    return imageReplacements;
}

function createPlaceholderImage(img, originalSrc) {
    // Extract question number from URL if possible
    const questionMatch = originalSrc.match(/a1q(\d+)/);
    const questionNum = questionMatch ? questionMatch[1] : '?';
    
    // Get original dimensions or use defaults
    const width = img.naturalWidth || img.width || 400;
    const height = img.naturalHeight || img.height || 300;
    
    // Create SVG placeholder
    const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#f0f0f0" stroke="#ccc" stroke-width="2"/>
            <text x="50%" y="40%" font-family="Arial, sans-serif" font-size="16" 
                  text-anchor="middle" fill="#666">Question ${questionNum}</text>
            <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="12" 
                  text-anchor="middle" fill="#999">Image not accessible</text>
        </svg>
    `;
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}