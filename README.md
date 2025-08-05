# MCQ Auto Solver Chrome Extension

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Chrome](https://img.shields.io/badge/chrome-extension-orange.svg)

A powerful Chrome extension that automatically solves multiple choice questions using Google's Gemini 2.5 Flash AI. Built for students, professionals, and anyone dealing with online MCQ assessments.
[![Usage Example](https://raw.githubusercontent.com/adityasd314/MCQ-Solver/master/image/README/1754422638903.png)](https://raw.githubusercontent.com/adityasd314/MCQ-Solver/master/video/tut.gif)

![Extension UI](https://raw.githubusercontent.com/adityasd314/MCQ-Solver/master/image/README/1754422638903.png)

## 📋 Prerequisites

- **Google Chrome Browser** (Version 88 or higher)
- **Gemini API Key** (Free tier available)

## 🔧 Installation

### Step 1: Download the Extension

```bash
# Clone the repository
git clone https://github.com/adityasd314/MCQ-Solver.git

# Or download ZIP and extract
wget https://github.com/adityasd314/MCQ-Solver/archive/refs/heads/master.zip
unzip master.zip
```

### Step 2: Load Extension in Chrome

1. **Open Chrome Extensions Management:**

   ```
   Navigate to: chrome://extensions/
   ```
2. **Enable Developer Mode:**

   - Toggle the "Developer mode" switch in the top-right corner
3. **Load the Extension:**

   - Click "Load unpacked" button
   - Navigate to and select the `MCQ-Solver` folder
   - Extension should appear in your extensions list
4. **Pin to Toolbar (Recommended):**

   - Click the puzzle piece icon in Chrome toolbar
   - Find "MCQ Auto Solver" and click the pin icon

### Step 3: Obtain Gemini API Key

1. **Visit Google AI Studio:**

   ```
   https://aistudio.google.com/apikey
   ```
2. **Create API Key:**

   - Sign in with your Google account
   - Click "Create API key"
   - Select "Create API key in new project"
   - **Important:** Copy and securely store this key
3. **Free Tier Limits:**

   - 60 requests per minute
   - 1,500 requests per day
   - No credit card required

### Step 4: Configure Extension

1. Click the extension icon in your Chrome toolbar
2. Add API Key: Paste your Gemini API key and click "Save Key"
3. Initial Setup Complete ✅

## 📖 Usage Guide

### Basic Usage

1. **Navigate to Quiz Page** with multiple choice questions
2. **Configure Settings:**
   - Click the MCQ Auto Solver extension icon
   - Verify the question selector (default: `.gcb-question-row`)
   - Add domain context if needed (e.g., "Computer Science", "Mathematics")
3. **Test Configuration:**
   - Click "Check Questions" to verify question detection
   - Click "Test Screenshot" to ensure image capture works
4. **Solve Questions:**
   - Click "Solve MCQs" button
   - Monitor progress - questions will be highlighted green (success) or red (failure)

## 🎯 Finding the Right CSS Selector

### Understanding CSS Selectors

The selector must target a container that includes the complete question: text, images, and all answer options with radio buttons.

#### Selector Types

1. **Class Selector (.)** - Most common

   ```css
   .gcb-question-row      /* NPTEL/SWAYAM */
   .question-item         /* Generic platforms */
   .quiz-question         /* Quiz platforms */
   ```
2. **ID Selector (#)** - Less common

   ```css
   #question-1            /* Specific question */
   ```
3. **Attribute Selector** - For data attributes

   ```css
   [data-question]        /* Elements with data-question attribute */
   ```

### Step-by-Step Selector Finding

#### Method 1: Browser Inspector (Recommended)

1. **Right-click on a question** → "Inspect Element"
2. **Find the container** that wraps:
   - Question text
   - Any images
   - All radio button options
3. **Copy the class name** from `class="your-class-name"`
4. **Test in console:**
   ```javascript
   document.querySelectorAll('.your-class-name').length
   ```

### Platform-Specific Selectors

| Platform     | Selector                                 | Notes                                 |
| ------------ | ---------------------------------------- | ------------------------------------- |
| NPTEL/SWAYAM | `.gcb-question-row`                    | Default, works for most NPTEL courses |
| Google Forms | `.freebirdFormviewerViewItemsItemItem` | For Google Form quizzes               |
| Moodle       | `.que.multichoice`                     | Moodle LMS platform                   |
| Canvas       | `.question.multiple_choice_question`   | Canvas LMS                            |
| Custom       | Use browser inspector                    | Follow the detection method above     |

### Verifying Selector Completeness

Your selector should capture this complete structure:

```html
<div class="gcb-question-row">               <!-- Your selector targets this -->
  <div class="question-text">
    <p>What is 2+2?</p>
    <img src="diagram.png">                  <!-- Images included -->
  </div>
  <div class="options">
    <input type="radio" name="q1" value="1"> Option A
    <input type="radio" name="q1" value="2"> Option B    <!-- All options -->
    <input type="radio" name="q1" value="3"> Option C
    <input type="radio" name="q1" value="4"> Option D
  </div>
</div>
```

## 🚧 Contributing

### Project Structure

```
MCQ-Solver/
├── manifest.json          # Extension configuration
├── content.js             # Main question processing logic
├── popup.html             # User interface
├── popup.js              # UI event handling
├── background.js         # API calls and CORS handling
└── html2canvas.min.js    # Screenshot library
```

### Code Components

manifest.json

Defines extension permissions and configuration:

```json
{
  "permissions": ["activeTab", "storage"],
  "host_permissions": ["https://generativelanguage.googleapis.com/*"],
  "content_scripts": [{"matches": ["<all_urls>"], "js": ["html2canvas.min.js", "content.js"]}]
}
```

content.js

- Main Logic
  **Key Functions:**
- `solveMCQs()`: Main orchestrator, processes questions in batches
- `captureElementScreenshot()`: Screenshots individual questions using html2canvas
- `getSingleAnswerFromGemini()`: Sends image to Gemini API and parses response
- `selectAnswerForQuestion()`: Finds and clicks the correct radio button
- `preprocessCORSImages()`: Handles cross-origin image issues

**Message Handlers:**

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkElement') // Count questions
  if (request.action === 'testScreenshot') // Test screenshot capture  
  if (request.action === 'solveMCQ') // Main solving function
});
```

popup.js

- UI Logic
  **Key Functions:**
- Settings management (API key, selectors, domain context)
- User input validation
- Status updates and error handling
- Chrome storage integration

background.js

- Service Worker
  **Key Functions:**
- `fetchImage()`: Bypasses CORS by fetching images from background script
- Message routing between popup and content scripts
- API call coordination

### Development Workflow

#### Setting Up Development

1. **Clone and setup:**

   ```bash
   git clone https://github.com/adityasd314/MCQ-Solver.git
   cd MCQ-Solver
   ```
2. **Load in Chrome:**

   - Go to `chrome://extensions/`
   - Enable Developer mode
   - Load unpacked extension
3. **Development cycle:**

   - Make changes to code
   - Click reload button in extensions page
   - Test on quiz pages

### Contributing Process

1. **Fork the repository**
2. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** following the code style
4. **Test thoroughly** on multiple platforms
5. **Update documentation** if needed
6. **Submit a pull request** with clear description
