// --- Required Modules ---
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
// require('dotenv').config(); // REMOVED: Using hardcoded key

// --- Express App Setup ---
const app = express();

// --- Middleware Configuration ---
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files from the current directory

// --- Constants ---
// WARNING: Hardcoding API keys is a security risk. Use .env for production or shared projects.
const GEMINI_API_KEY = "AIzaSyAK8obivhQ8T9mF-dGC-SnaZ7GutGQF4e0"; // API Key hardcoded here
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// --- Helper Functions ---

/**
 * Gets descriptive text for the activity level factor.
 */
function getActivityLevelText(level) {
    const numericLevel = parseFloat(level);
    const levels = {
        1.2: "Sedentary (little or no exercise)",
        1.375: "Light Activity (exercise 1-3 days/week)",
        1.55: "Moderate Activity (exercise 3-5 days/week)",
        1.725: "Very Active (exercise 6-7 days/week)",
        1.9: "Extreme Activity (very hard exercise/physical job)"
    };
    return levels[numericLevel] || "Unknown";
}

/**
 * Formats the user's metrics into a readable string for the AI prompt.
 */
function formatMetricsForPrompt(metrics) {
    if (!metrics) {
        // Added console log here to check if metrics are missing when expected
        console.log("[Server Log] formatMetricsForPrompt called, but metrics object was null or undefined.");
        return "\nThe user has not provided their biometric data yet. You can gently remind them to fill out the form on the dashboard for personalized advice if their question seems to require it.";
    }

    // Log that metrics were received (useful for debugging data flow)
    console.log("[Server Log] Formatting metrics for prompt:", JSON.stringify(metrics, null, 2)); // Pretty print the metrics object

    let context = "\n\n--- IMPORTANT USER CONTEXT (Use this data to personalize your response!) ---\n";
    context += `- Name: ${metrics.name ?? 'N/A'}\n`;
    context += `- Age: ${metrics.age ?? 'N/A'} years\n`;
    context += `- Gender: ${metrics.gender ?? 'N/A'}\n`;
    context += `- Height: ${metrics.height ? metrics.height.toFixed(0) + ' cm' : 'N/A'}\n`;
    context += `- Weight: ${metrics.weight ? metrics.weight.toFixed(1) + ' kg' : 'N/A'}\n`;
    context += `- Activity Level: Factor ${metrics.activityLevel ?? 'N/A'} (${getActivityLevelText(metrics.activityLevel)})\n`;
    context += `- Stated Goal: ${metrics.goal ?? 'N/A'}\n`; // Added "Stated"
    context += `- Calculated BMI: ${metrics.bmi ? metrics.bmi.toFixed(1) : 'N/A'} (${metrics.bmiCategory ?? 'N/A'})\n`;
    context += `- Estimated Daily Calories Needed (for Goal): ${metrics.calories ? Math.round(metrics.calories) : 'N/A'} kcal\n`; // Clarified calories
    context += `- Estimated Body Fat: ${metrics.bodyFat ? metrics.bodyFat.toFixed(1) + '%' : 'N/A'}\n`;
    context += `- Estimated Water Intake: ${metrics.water ?? 'N/A'} L/day\n`;
    context += `- Estimated Micronutrient Needs (RDAs):\n`;
    context += `    - Zinc: ${metrics.micronutrients?.zinc ?? 'N/A'} mg\n`;
    context += `    - Iron: ${metrics.micronutrients?.iron ?? 'N/A'} mg\n`;
    context += `    - Magnesium: ${metrics.micronutrients?.magnesium ?? 'N/A'} mg\n`;
    context += `    - Calcium: ${metrics.micronutrients?.calcium ?? 'N/A'} mg\n`;
    context += "--- END USER CONTEXT ---\n";
    // More explicit instruction
    context += "\n**Instruction:** Base your response *directly* on the user context provided above whenever the question relates to their health, diet, or fitness plan. Refer to their specific goals, calorie needs, etc.";
    return context;
}


// --- API Endpoint: /chat ---
app.post('/chat', async (req, res) => {
    const { message, metrics } = req.body; // Get metrics from request body

    // Log received data for debugging
    console.log(`[Server Log] Received /chat request. Message: "${message}"`);
    // Log metrics only if they exist to avoid logging 'null' excessively
    if (metrics) {
        console.log("[Server Log] Metrics received from client:", JSON.stringify(metrics, null, 2));
    } else {
        console.log("[Server Log] No metrics received from client for this request.");
    }


    if (!message || typeof message !== 'string' || message.trim() === '') {
        console.warn('Chat request rejected: Missing or invalid message.');
        return res.status(400).json({ error: 'Message is required and must be a non-empty string.' });
    }

    if (!GEMINI_API_KEY) {
         console.error('FATAL SERVER ERROR: Hardcoded Gemini API key is missing or empty.');
         return res.status(500).json({ error: 'Server configuration error. API key missing.' });
    }

    // Construct the prompt including the formatted metrics
    const systemBasePrompt = `You are HealthStat AI, a professional, friendly, and encouraging health and fitness assistant integrated into a dashboard. Provide concise, accurate, and actionable advice about health, nutrition, and fitness. Use markdown formatting for readability (e.g., **bold**, *italics*, - lists, \`inline code\`). Keep responses relatively brief unless the user asks for detailed information. Address the user directly (e.g., "Based on your goal..."). Do not give medical advice; always suggest consulting a healthcare professional for medical concerns or before making significant changes.`;
    const userContext = formatMetricsForPrompt(metrics); // Format metrics (includes logging)
    const fullPrompt = `${systemBasePrompt}${userContext}\n\n--- User's Question ---\n${message}`;

    // Log the final prompt being sent (optional, can be long)
    // console.log("[Server Log] Full prompt being sent to Gemini:\n", fullPrompt);

    const requestPayload = {
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 800,
        },
         safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
         ]
    };

    try {
        console.log(`[Server Log] Sending request to Gemini API...`);
        const apiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload)
        });

        if (!apiResponse.ok) {
            let errorBodyText = await apiResponse.text();
            let errorJson = {};
            try { errorJson = JSON.parse(errorBodyText); } catch (e) { /* Ignore */ }
            console.error(`[Server Log] Gemini API Error: ${apiResponse.status} ${apiResponse.statusText}`, errorJson || errorBodyText);
            const errorMessage = errorJson?.error?.message || `AI service request failed with status ${apiResponse.status}.`;
            throw new Error(errorMessage);
        }

        const responseData = await apiResponse.json();
        console.log('[Server Log] Successfully received response from Gemini API.');

        if (!responseData.candidates || responseData.candidates.length === 0) {
             if (responseData.promptFeedback?.blockReason) {
                 const reason = responseData.promptFeedback.blockReason;
                 console.warn(`[Server Log] Gemini prompt blocked by safety settings: ${reason}`);
                 return res.status(400).json({ reply: `I cannot process that request due to safety guidelines (${reason}). Please rephrase your question.` });
             } else {
                 console.error('[Server Log] Gemini API returned no candidates:', JSON.stringify(responseData, null, 2));
                 throw new Error('AI service returned an empty or invalid response.');
             }
        }

        const candidate = responseData.candidates[0];

        if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
             console.warn(`[Server Log] Gemini response finished with reason: ${candidate.finishReason}`);
             if (candidate.finishReason === 'SAFETY') {
                 return res.status(400).json({ reply: `I generated a response, but it was blocked due to safety guidelines (${candidate.finishReason}). Please try asking differently.` });
             }
        }

        const replyText = candidate.content?.parts?.[0]?.text;

        if (replyText) {
            res.status(200).json({ reply: replyText.trim() });
        } else {
             console.error('[Server Log] Could not extract reply text from Gemini response:', JSON.stringify(responseData, null, 2));
             throw new Error('Could not process the content from the AI response structure.');
        }

    } catch (error) {
        console.error('[Server Log] Error occurred during /chat request processing:', error);
        res.status(500).json({ error: `Failed to get response from the health assistant. ${error.message}` });
    }
});

// --- Default Route ---
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// --- Start the Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n--- HealthStat AI Dashboard Server ---`);
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`Serving static files from directory: ${__dirname}`);
     if (!GEMINI_API_KEY || GEMINI_API_KEY.length < 30) {
        console.warn('\n**********************************************************************');
        console.warn('! WARNING: Hardcoded GEMINI_API_KEY seems missing or too short!    !');
        console.warn('! The chatbot functionality will likely fail.                      !');
        console.warn('! Please ensure the key is correctly placed in the server.js file. !');
        console.warn('**********************************************************************\n');
     } else {
         console.log('Using hardcoded Gemini API key.');
         console.warn('Reminder: Using hardcoded keys is insecure for shared/production projects.');
     }
     console.log('----------------------------------------');
});
