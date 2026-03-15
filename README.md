# Multilingual Translation Web Application

This project is a responsive translation interface built with HTML, CSS, and Vanilla JavaScript for ASSIGNMENT 3.

## Features

- Default translation on load from English to French for "Hello, how are you"
- Source language options for Detect Language, English, and French
- Target language selection for multiple languages
- Switch button to swap source and target languages and text
- 500-character input limit with a live counter
- Real-time translation with debounce plus a manual Translate button
- Text-to-speech support for both the original and translated text
- Copy to clipboard support for both cards
- Loading and error feedback during translation requests
- Responsive layout and dark mode toggle

## Setup

1. Open the ASSIGNMENT 3 folder in VS Code.
2. Run the project with a simple static server.
3. Open index.html in the browser through that server.

Examples of simple static servers:

- VS Code Live Server extension
- `npx serve "ASSIGNMENT 3"`
- `python -m http.server` from inside the ASSIGNMENT 3 folder

## Files

- index.html: Application structure and controls
- style.css: Visual design, responsive behavior, and dark mode
- script.js: Translation logic, debounce, speech, clipboard, and API integration

## API Note

The assignment specifies the MyMemory endpoint with a POST request and JSON payload. In practice, the endpoint rejects that JSON body and responds with "NO QUERY SPECIFIED". The application therefore attempts the required POST request first, then falls back to a GET request with the same `q` and `langpair` values so the feature still works reliably.