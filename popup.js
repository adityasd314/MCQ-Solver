document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveKeyBtn = document.getElementById('saveKey');
    const solveMCQBtn = document.getElementById('solveMCQ');
    const checkElementBtn = document.getElementById('checkElement');
    const testScreenshotBtn = document.getElementById('testScreenshot');
    const statusDiv = document.getElementById('status');

    // Load saved API key
    chrome.storage.sync.get(['geminiApiKey'], function(result) {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
        }
    });

    // Save API key
    saveKeyBtn.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.storage.sync.set({geminiApiKey: apiKey}, function() {
                showStatus('API Key saved!', 'success');
            });
        } else {
            showStatus('Please enter a valid API key', 'error');
        }
    });

    // Check if element exists
    checkElementBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'checkElement'}, function(response) {
                if (response && response.exists) {
                    showStatus('Element found! Ready to solve MCQs.', 'success');
                } else {
                    showStatus('Element "gcb-main-article" not found on this page.', 'warning');
                }
            });
        });
    });

    // Test screenshot only
    testScreenshotBtn.addEventListener('click', function() {
        showStatus('Testing screenshot capture...', 'warning');
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'testScreenshot'}, function(response) {
                if (response && response.success) {
                    showStatus('Screenshot captured and saved! Check your downloads.', 'success');
                } else {
                    showStatus(response?.error || 'Failed to capture screenshot', 'error');
                }
            });
        });
    });

    // Solve MCQs
    solveMCQBtn.addEventListener('click', function() {
        chrome.storage.sync.get(['geminiApiKey'], function(result) {
            if (!result.geminiApiKey) {
                showStatus('Please save your Gemini API key first!', 'error');
                return;
            }

            showStatus('Solving MCQs...', 'warning');
            
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'solveMCQ',
                    apiKey: result.geminiApiKey
                }, function(response) {
                    if (response && response.success) {
                        showStatus(`Successfully solved ${response.questionsCount} questions!`, 'success');
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
        
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
});