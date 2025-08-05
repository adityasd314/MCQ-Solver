// Background script for Chrome extension
console.log('MCQ Solver background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('MCQ Solver extension installed');
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