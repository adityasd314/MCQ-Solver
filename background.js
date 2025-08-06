// Background script for Chrome extension
console.log('MCQ Solver background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('MCQ Solver extension installed');
});

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'solve-mcq') {
        console.log('Solve MCQ keyboard shortcut triggered');
        
        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            
            // Get stored settings
            const result = await chrome.storage.sync.get(['geminiApiKey', 'questionSelector', 'domainContext']);
            
            if (!result.geminiApiKey) {
                console.error('No API key found. Please set it in the extension popup.');
                // Show notification to user
                chrome.notifications?.create({
                    type: 'basic',
                    iconUrl: 'icon.png', // You might want to add an icon
                    title: 'MCQ Solver',
                    message: 'Please set your Gemini API key in the extension popup first!'
                });
                return;
            }
            
            const questionSelector = result.questionSelector || '.gcb-question-row';
            const domainContext = result.domainContext || '';
            
            // Send message to content script to solve MCQs
            chrome.tabs.sendMessage(tab.id, {
                action: 'solveMCQ',
                apiKey: result.geminiApiKey,
                questionSelector: questionSelector,
                domainContext: domainContext
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Error sending message to content script:', chrome.runtime.lastError);
                    return;
                }
                
                if (response && response.success) {
                    console.log('MCQ solving completed:', response.message);
                    // Show success notification
                    chrome.notifications?.create({
                        type: 'basic',
                        iconUrl: 'icon.png',
                        title: 'MCQ Solver',
                        message: response.message
                    });
                } else {
                    console.error('MCQ solving failed:', response?.error);
                    // Show error notification
                    chrome.notifications?.create({
                        type: 'basic',
                        iconUrl: 'icon.png',
                        title: 'MCQ Solver - Error',
                        message: response?.error || 'Failed to solve MCQs'
                    });
                }
            });
            
        } catch (error) {
            console.error('Error in keyboard command handler:', error);
        }
    }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureScreenshot') {
        // Capture visible tab screenshot
        chrome.tabs.captureVisibleTab(null, {format: 'png'}, (dataUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({error: chrome.runtime.lastError.message});
            } else {
                sendResponse({dataUrl: dataUrl});
            }
        });
        return true; // Keep message channel open
    }
    
    if (request.action === 'fetchImage') {
        console.log('Attempting to fetch image:', request.url);
        
        // Fetch image from background script to bypass CORS
        fetch(request.url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Mobile Safari/537.36'
            }
        })
        .then(response => {
            console.log('Fetch response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.blob();
        })
        .then(blob => {
            console.log('Successfully fetched blob, size:', blob.size);
            const reader = new FileReader();
            reader.onloadend = () => {
                console.log('Successfully converted to data URL');
                sendResponse({dataUrl: reader.result});
            };
            reader.onerror = (error) => {
                console.error('FileReader error:', error);
                sendResponse({error: 'Failed to read blob'});
            };
            reader.readAsDataURL(blob);
        })
        .catch(error => {
            console.error('Error fetching image:', error);
            sendResponse({error: error.message});
        });
        
        return true; // Keep message channel open for async response
    }
});