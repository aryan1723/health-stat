/**
 * Initializes chatbot functionality once the DOM is fully loaded.
 * Sets up event listeners for toggling, closing, and sending messages.
 */
document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Element References ---
    // Cache references to frequently used elements for efficiency.
    const chatbotToggle = document.getElementById('chatbot-toggle');
    const chatbotPopup = document.getElementById('chatbot-popup');
    const closeBtn = document.querySelector('.close-chatbot');
    const sendBtn = document.getElementById('send-message');
    const chatInput = document.getElementById('chatbot-input');
    const chatMessages = document.getElementById('chatbot-messages');

    // --- Event Listeners ---

    // Toggle chatbot visibility and focus input field when opened.
    chatbotToggle.addEventListener('click', () => {
        chatbotPopup.classList.toggle('active');
        if (chatbotPopup.classList.contains('active')) {
            chatInput.focus(); // Auto-focus the input field for immediate typing
        }
    });

    // Close the chatbot popup.
    closeBtn.addEventListener('click', () => {
        chatbotPopup.classList.remove('active');
    });

    // Send message when the send button is clicked.
    sendBtn.addEventListener('click', handleSendMessage);

    // Send message when the Enter key is pressed in the input field,
    // unless the Shift key is also held (allowing for multi-line input).
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
             e.preventDefault(); // Prevent default newline insertion or form submission
             handleSendMessage();
        }
    });

    // Auto-resize the text area based on its content height, up to a maximum.
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto'; // Reset height first to get the correct scrollHeight
        const maxHeight = 100; // Define a maximum height (e.g., 100px)
        // Set height based on content, but cap it at maxHeight
        chatInput.style.height = `${Math.min(chatInput.scrollHeight, maxHeight)}px`;
    });

    // --- Core Functions ---

    /**
     * Handles the process of sending a user's message:
     * 1. Gets the message text.
     * 2. Displays the user message in the chat.
     * 3. Clears the input field.
     * 4. Shows a typing indicator.
     * 5. Prepares the payload (message + user metrics).
     * 6. Sends the payload to the backend API (/chat endpoint on your server).
     * 7. Handles the response (displays bot reply or error).
     */
    function handleSendMessage() {
        const message = chatInput.value.trim(); // Get message and remove leading/trailing whitespace
        if (!message) return; // Don't send empty messages

        // Display the user's message immediately in the chat window
        addMessageToChat(message, 'user');
        chatInput.value = ''; // Clear the input field
        chatInput.style.height = 'auto'; // Reset input field height after sending

        // Show a visual typing indicator
        showTypingIndicator();

        // Prepare the data to send to the backend server
        const payload = {
            message: message,
            // Include user metrics if the 'currentUserMetrics' global variable (from script.js) exists and is not null
            metrics: (typeof currentUserMetrics !== 'undefined' && currentUserMetrics) ? currentUserMetrics : null
        };

        // --- API Call using Fetch to your backend server ---
        fetch('/chat', { // The endpoint defined in server.js
            method: 'POST',
            headers: {
                'Content-Type': 'application/json', // Indicate we're sending JSON data
                'Accept': 'application/json'       // Indicate we expect a JSON response
            },
            body: JSON.stringify(payload) // Convert the payload object to a JSON string
        })
        .then(response => {
            // Check if the HTTP response status is successful (e.g., 200 OK)
            if (!response.ok) {
                // If not OK, try to parse error details from the response body (if it's JSON)
                return response.json()
                    // If parsing fails (e.g., plain text error), create a generic error
                    .catch(() => {
                        throw new Error(`Server responded with status: ${response.status} ${response.statusText}`);
                    })
                    // If parsing succeeds, throw an error using the message from the server's JSON response
                    .then(errorData => {
                        throw new Error(errorData.error || `Server error: ${response.status}`);
                    });
            }
            return response.json(); // Parse the successful JSON response body
        })
        .then(data => {
            removeTypingIndicator(); // Hide the typing indicator
            // Process the response data
            if (data && data.reply) {
                // If a reply exists, display the bot's message
                addMessageToChat(data.reply, 'bot');
            } else {
                 // Log a warning if the response format is unexpected
                 console.warn("Received response from server without a 'reply' field:", data);
                 // Display a fallback message to the user
                 addMessageToChat('Sorry, I received an unclear response. Please try asking differently.', 'bot');
            }
        })
        .catch(error => {
            // Handle network errors or errors thrown during response processing
            console.error('Chatbot Fetch Error:', error); // Log the detailed error for debugging
            removeTypingIndicator(); // Ensure typing indicator is removed on error
            // Display a user-friendly error message in the chat window
            addMessageToChat(`Sorry, an error occurred: ${error.message}. Please try again later.`, 'bot');
        });
    }

    /**
     * Adds a message bubble (from user or bot) to the chat display area.
     * Performs basic Markdown-to-HTML conversion for bot messages.
     * @param {string} text - The raw message text.
     * @param {string} sender - Specifies the sender ('user' or 'bot').
     */
    function addMessageToChat(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add(`${sender}-message`); // Apply CSS class for styling

        let formattedHtml = text;

        // --- Basic Markdown to HTML Conversion (applied only to 'bot' messages) ---
        if (sender === 'bot') {
            // **Bold** -> <strong>
            formattedHtml = formattedHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            // *Italic* -> <em> (using negative lookarounds to avoid matching **)
            formattedHtml = formattedHtml.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
            // ```Code Block``` -> <pre><code> (handles optional language hint)
             formattedHtml = formattedHtml.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
                const languageClass = lang ? ` class="language-${lang.trim()}"` : '';
                // Basic HTML escaping for code content
                const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return `<pre><code${languageClass}>${escapedCode.trim()}</code></pre>`;
            });
            // `Inline Code` -> <code>
            formattedHtml = formattedHtml.replace(/`([^`]+)`/g, '<code>$1</code>');
            // Headings (# H3, ## H4)
            formattedHtml = formattedHtml.replace(/^# (.*$)/gim, '<h3>$1</h3>');
            formattedHtml = formattedHtml.replace(/^## (.*$)/gim, '<h4>$1</h4>');

            // Process lists carefully to handle potential nesting and spacing
            // Convert lines starting with '-' or '*' to <li> items
            formattedHtml = formattedHtml.replace(/^[-*] (.*$)/gim, '<li>$1</li>');
            // Wrap consecutive <li> items in <ul> tags
            formattedHtml = formattedHtml.replace(/^(<li>.*<\/li>\s*)+/gm, (match) => `<ul>${match.trim()}</ul>`);
             // Merge adjacent <ul> tags that might result from processing
            formattedHtml = formattedHtml.replace(/<\/ul>\s*<ul>/g, '');

            // Convert lines starting with '1.', '2.', etc. to <temp_li> items (temporary tag)
            formattedHtml = formattedHtml.replace(/^\d+\. (.*$)/gim, '<temp_li>$1</temp_li>');
             // Wrap consecutive <temp_li> items in <ol> tags
            formattedHtml = formattedHtml.replace(/^(<temp_li>.*<\/temp_li>\s*)+/gm, (match) => `<ol>${match.trim()}</ol>`);
            // Merge adjacent <ol> tags
            formattedHtml = formattedHtml.replace(/<\/ol>\s*<ol>/g, '');
            // Convert the temporary <temp_li> tags back to standard <li> tags
            formattedHtml = formattedHtml.replace(/<temp_li>/g, '<li>').replace(/<\/temp_li>/g, '</li>');

            // Convert newline characters to <br> tags, avoiding those inside <pre> blocks
            const parts = formattedHtml.split(/(<\/?pre[^>]*>)/); // Split by <pre> tags
            formattedHtml = parts.map((part, index) => {
                // If it's not a <pre> tag (even indices), replace newlines
                if (index % 2 === 0) {
                    // Replace newline, trim whitespace around break, avoid double breaks
                    return part.replace(/\n/g, '<br>').replace(/\s*<br>\s*/g, '<br>').replace(/(<br>){2,}/g, '<br>');
                }
                return part; // Return <pre> tags unchanged
            }).join('');

            // Final cleanup of breaks
            formattedHtml = formattedHtml.replace(/^<br>|<br>$/g, ''); // Remove leading/trailing breaks
        }

        // Set the innerHTML of the message div.
        // Wrap in <p> by default for consistent styling, unless it's already a block element.
        if (formattedHtml.match(/^<(ul|ol|h[34]|pre)/)) {
             messageDiv.innerHTML = formattedHtml;
        } else {
             messageDiv.innerHTML = `<p>${formattedHtml}</p>`;
        }

        chatMessages.appendChild(messageDiv); // Add the new message bubble to the chat container
        scrollToBottom(); // Ensure the view scrolls to the latest message
    }

     /**
      * Displays a simple animated typing indicator in the chat window.
      */
     function showTypingIndicator() {
        // Prevent adding multiple indicators if one already exists
        if (chatMessages.querySelector('.typing-indicator')) return;

        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('bot-message', 'typing-indicator');
        // Use spans for the animated dots (styling handled in CSS)
        typingIndicator.innerHTML = '<p><span>.</span><span>.</span><span>.</span></p>';
        chatMessages.appendChild(typingIndicator);
        scrollToBottom(); // Scroll to make the indicator visible
    }

    /**
     * Removes the typing indicator element from the chat window.
     */
    function removeTypingIndicator() {
        const indicator = chatMessages.querySelector('.typing-indicator');
        if (indicator) {
            chatMessages.removeChild(indicator);
        }
    }

    /**
     * Scrolls the chat message container smoothly to the bottom.
     * Uses requestAnimationFrame for better performance and synchronization with rendering.
     */
    function scrollToBottom() {
         requestAnimationFrame(() => {
            // Check if the element exists before trying to scroll
            if (chatMessages) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
         });
    }

}); // End DOMContentLoaded wrapper
