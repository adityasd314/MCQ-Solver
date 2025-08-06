document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const questionSelectorInput = document.getElementById('questionSelector');
    const domainContextInput = document.getElementById('domainContext');
    const saveKeyBtn = document.getElementById('saveKey');
    const solveMCQBtn = document.getElementById('solveMCQ');
    const checkElementBtn = document.getElementById('checkElement');
    const testScreenshotBtn = document.getElementById('testScreenshot');
    const statusDiv = document.getElementById('status');

    // Listen for progress updates from content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'updateProgress') {
            showStatus(request.message, request.type);
        }
    });

    // Load saved values
    chrome.storage.sync.get(['geminiApiKey', 'questionSelector', 'domainContext'], function(result) {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
        }
        if (result.questionSelector) {
            questionSelectorInput.value = result.questionSelector;
        }
        if (result.domainContext) {
            domainContextInput.value = result.domainContext;
        }
    });

    // Save settings
    saveKeyBtn.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        const questionSelector = questionSelectorInput.value.trim() || '.gcb-question-row';
        const domainContext = domainContextInput.value.trim();
        
        if (apiKey) {
            chrome.storage.sync.set({
                geminiApiKey: apiKey,
                questionSelector: questionSelector,
                domainContext: domainContext
            }, function() {
                showStatus('Settings saved!', 'success');
            });
        } else {
            showStatus('Please enter a valid API key', 'error');
        }
    });

    // Check questions with smart detection
    checkElementBtn.addEventListener('click', function() {
        const questionSelector = questionSelectorInput.value.trim() || '.gcb-question-row';
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'checkElement',
                questionSelector: questionSelector
            }, function(response) {
                if (response && response.exists) {
                    let message = `Found ${response.count} questions`;
                    if (response.autoDetected) {
                        message += ` (${response.message})`;
                        // Update the selector input with auto-detected value
                        questionSelectorInput.value = response.selector;
                    } else {
                        message += ` with selector "${response.selector}"`;
                    }
                    showStatus(message, 'success');
                } else {
                    showStatus(`No questions found with selector "${questionSelector}". Try smart detection or check the selector.`, 'warning');
                }
            });
        });
    });

    // Test screenshot
    testScreenshotBtn.addEventListener('click', function() {
        const questionSelector = questionSelectorInput.value.trim() || '.gcb-question-row';
        showStatus('Testing screenshot capture...', 'warning');
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'testScreenshot',
                questionSelector: questionSelector
            }, function(response) {
                if (response && response.success) {
                    showStatus(`${response.message} Check downloads.`, 'success');
                } else {
                    showStatus(response?.error || 'Failed to capture screenshot', 'error');
                }
            });
        });
    });

    // Solve MCQs with enhanced progress tracking
    solveMCQBtn.addEventListener('click', function() {
        const questionSelector = questionSelectorInput.value.trim() || '.gcb-question-row';
        
        chrome.storage.sync.get(['geminiApiKey', 'domainContext'], function(result) {
            if (!result.geminiApiKey) {
                showStatus('Please save your Gemini API key first!', 'error');
                return;
            }

            // Disable button during processing
            solveMCQBtn.disabled = true;
            solveMCQBtn.textContent = 'Processing...';
            showStatus('Starting MCQ solving process...', 'progress');
            
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'solveMCQ',
                    apiKey: result.geminiApiKey,
                    questionSelector: questionSelector,
                    domainContext: result.domainContext || ''
                }, function(response) {
                    // Re-enable button
                    solveMCQBtn.disabled = false;
                    solveMCQBtn.textContent = 'Solve MCQs';
                    
                    if (response && response.success) {
                        showStatus(response.message, 'success');
                    } else {
                        showStatus(response?.error || 'Failed to solve MCQs', 'error');
                    }
                });
            });
        });
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
        
        // Don't auto-hide progress messages
        if (type !== 'progress') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
    }
});