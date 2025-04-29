// Global variable to store user metrics for the chatbot
// This allows the chatbot (in chatbot.js) to access the calculated data.
let currentUserMetrics = null;

/**
 * Executes when the DOM is fully loaded and parsed.
 * Sets up event listeners and initializes the application state.
 */
document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Element References ---
    // Cache frequently accessed DOM elements for better performance.
    const themeSwitch = document.getElementById('theme-switch');
    const body = document.body;
    const unitBtns = document.querySelectorAll('.unit-btn');
    const metricUnits = document.querySelectorAll('.metric-unit');
    const imperialUnits = document.querySelectorAll('.imperial-unit');
    const bioForm = document.getElementById('biometrics-form');
    const resultsSection = document.getElementById('results-section');
    const micronutrientsSection = document.getElementById('micronutrients-section');
    const chartsContainer = document.getElementById('charts-container');
    const chartPlaceholder = document.getElementById('chart-placeholder');

    // Input fields references (useful for validation feedback or clearing)
    const heightCmInput = document.getElementById('height-cm');
    const weightKgInput = document.getElementById('weight-kg');
    const heightFtInput = document.getElementById('height-ft');
    const heightInInput = document.getElementById('height-in');
    const weightLbsInput = document.getElementById('weight-lbs');
    const ageInput = document.getElementById('age');
    const nameInput = document.getElementById('name');
    const genderSelect = document.getElementById('gender');
    const activityLevelSelect = document.getElementById('activity-level');
    const goalSelect = document.getElementById('goal');

    // Result display element references
    const bmiResultEl = document.getElementById('bmi-result');
    const bmiCategoryEl = document.getElementById('bmi-category');
    const caloriesResultEl = document.getElementById('calories-result');
    const caloriesGoalEl = document.getElementById('calories-goal');
    const bodyFatValueEl = document.getElementById('body-fat-value');
    const waterIntakeEl = document.getElementById('water-intake');
    const zincResultEl = document.getElementById('zinc-result');
    const ironResultEl = document.getElementById('iron-result');
    const magnesiumResultEl = document.getElementById('magnesium-result');
    const calciumResultEl = document.getElementById('calcium-result');


    // --- Theme Handling ---

    /**
     * Initializes the color theme based on localStorage or system preference.
     */
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        // Check for system preference if no theme is saved
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        // Use saved theme, or system preference, or default to 'light'
        const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
        setTheme(currentTheme);
    }

    /**
     * Applies the specified theme ('light' or 'dark') to the application.
     * Updates the body attribute, localStorage, and the toggle button icon.
     * Also triggers a chart update if data exists.
     * @param {string} theme - The theme to set ('light' or 'dark').
     */
    function setTheme(theme) {
        body.setAttribute('data-theme', theme); // Apply theme class to body
        localStorage.setItem('theme', theme);   // Save theme preference
        updateThemeIcon(theme);                 // Update the toggle button icon

        // Re-render charts with updated theme colors if metrics are available
        if (currentUserMetrics && typeof updateCharts === 'function') {
             // Pass necessary data to the chart update function
             updateCharts(currentUserMetrics.bmi, currentUserMetrics.bodyFat, currentUserMetrics.calories);
        } else if (currentUserMetrics && typeof updateCharts !== 'function') {
             console.warn("Chart update function (updateCharts) not found, but metrics exist. Theme change won't update chart colors.");
        }
    }

    /**
     * Toggles the color theme between light and dark modes.
     */
    function handleThemeSwitch() {
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    }

    /**
     * Updates the icon inside the theme toggle button based on the current theme.
     * @param {string} theme - The current theme ('light' or 'dark').
     */
    function updateThemeIcon(theme) {
        themeSwitch.innerHTML = theme === 'dark'
            ? '<i class="fas fa-sun"></i>' // Sun icon indicates switch to light mode
            : '<i class="fas fa-moon"></i>'; // Moon icon indicates switch to dark mode
    }

    // --- Unit Conversion ---

    /**
     * Handles the user clicking on the unit switcher buttons (Metric/Imperial).
     * Updates button styles, shows/hides relevant input fields, and clears hidden fields.
     */
    function handleUnitConversion() {
        // 'this' refers to the button that was clicked
        const selectedUnit = this.dataset.unit;
        const showMetric = selectedUnit === 'metric';

        // Update button active states
        unitBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.unit === selectedUnit));

        // Toggle visibility of unit-specific input groups
        metricUnits.forEach(el => el.style.display = showMetric ? 'block' : 'none');
        imperialUnits.forEach(el => el.style.display = showMetric ? 'none' : 'block');

        // Clear the input values of the fields being hidden to prevent confusion
        if (showMetric) {
            heightFtInput.value = '';
            heightInInput.value = '';
            weightLbsInput.value = '';
        } else {
            heightCmInput.value = '';
            weightKgInput.value = '';
        }
    }

    // --- Form Submission and Calculation ---

    /**
     * Handles the submission of the biometrics form.
     * Prevents default submission, gets/validates data, calculates metrics,
     * stores results globally, and updates the UI.
     * @param {Event} e - The form submission event object.
     */
    function handleFormSubmit(e) {
        e.preventDefault(); // Prevent the default form submission (page reload)

        // 1. Get and Validate Form Data
        // The getFormValues function now includes validation and returns null on failure.
        const formData = getFormValues();
        if (!formData) {
            // Error message is shown within getFormValues or showError
            return; // Stop processing if validation failed
        }

        // 2. Calculate All Health Metrics
        const metrics = calculateAllMetrics(
            formData.height, // cm
            formData.weight, // kg
            formData.age,
            formData.gender,
            formData.activityLevel, // Factor (e.g., 1.55)
            formData.goal // 'lose', 'maintain', 'gain'
        );

        // 3. Store Metrics Globally for Chatbot Access
        // Combine the original validated inputs with the calculated metrics.
        currentUserMetrics = { ...formData, ...metrics };
        console.log("User Metrics Updated:", currentUserMetrics); // For debugging

        // 4. Update the UI with Results
        updateUI(metrics);
    }

    /**
     * Retrieves values from the form, validates them, and converts to metric units.
     * Shows error messages directly if validation fails.
     * @returns {object | null} An object containing validated form data (height in cm, weight in kg),
     * or null if any validation check fails.
     */
    function getFormValues() {
        const currentUnit = document.querySelector('.unit-btn.active').dataset.unit;
        let heightCm, weightKg;

        // --- Input Validation ---
        // Clear previous errors (optional, depends on error display method)
        // clearErrors();

        // Age
        const age = parseInt(ageInput.value, 10);
        if (isNaN(age) || age < 10 || age > 120) {
            return showError(ageInput, 'Please enter a valid age (10-120).');
        }

        // Height & Weight (based on selected unit)
        if (currentUnit === 'metric') {
            heightCm = parseFloat(heightCmInput.value);
            weightKg = parseFloat(weightKgInput.value);
            if (isNaN(heightCm) || heightCm < 100 || heightCm > 250) {
                return showError(heightCmInput, 'Please enter a valid height (100-250 cm).');
            }
            if (isNaN(weightKg) || weightKg < 30 || weightKg > 300) {
                return showError(weightKgInput, 'Please enter a valid weight (30-300 kg).');
            }
        } else { // Imperial units
            const feet = parseFloat(heightFtInput.value);
            const inches = parseFloat(heightInInput.value); // Allow 0 inches
            const pounds = parseFloat(weightLbsInput.value);

            // Check if feet/inches are valid numbers and within range
            if (isNaN(feet) || isNaN(inches) || feet < 3 || feet > 8 || inches < 0 || inches > 11.99) {
                 // Check inches >= 0 and < 12
                return showError(heightFtInput, 'Please enter a valid height (3-8 ft, 0-11 in).');
            }
             if (isNaN(pounds) || pounds < 66 || pounds > 660) {
                 return showError(weightLbsInput, 'Please enter a valid weight (66-660 lbs).');
            }

            // Convert valid imperial inputs to metric
            heightCm = (feet * 30.48) + (inches * 2.54);
            weightKg = pounds * 0.453592;
        }

        // --- Return Validated Data ---
        return {
            name: nameInput.value.trim() || "User", // Use "User" if name is empty
            height: heightCm, // Always store in cm
            weight: weightKg, // Always store in kg
            age: age,
            gender: genderSelect.value,
            activityLevel: parseFloat(activityLevelSelect.value),
            goal: goalSelect.value,
            unit: currentUnit // Keep track of the originally selected unit for context
        };
    }


    /**
     * Calculates all primary and secondary health metrics based on validated user input.
     * @param {number} heightCm - Height in centimeters.
     * @param {number} weightKg - Weight in kilograms.
     * @param {number} age - Age in years.
     * @param {string} gender - 'male' or 'female'.
     * @param {number} activityLevel - Activity factor (e.g., 1.2, 1.55).
     * @param {string} goal - 'lose', 'maintain', or 'gain'.
     * @returns {object} An object containing all calculated metrics.
     */
    function calculateAllMetrics(heightCm, weightKg, age, gender, activityLevel, goal) {
        // Calculate primary metrics
        const bmi = calculateBMI(heightCm, weightKg);
        const bmr = calculateBMR(weightKg, heightCm, age, gender); // Basal Metabolic Rate
        const tdee = calculateTDEE(bmr, activityLevel);            // Total Daily Energy Expenditure

        // Calculate goal-adjusted calories and secondary metrics
        const calories = adjustCaloriesForGoal(tdee, goal);
        const bodyFat = calculateBodyFat(bmi, age, gender);
        const water = calculateWaterIntake(weightKg);
        const micronutrients = calculateMicronutrients(gender, age); // Estimated micronutrient needs

        // Determine BMI category text
        const bmiCategory = getBMICategory(bmi);

        // Return all metrics in a single object
        return {
            bmi,
            bmr,
            tdee,
            calories,
            bodyFat,
            water,
            bmiCategory,
            micronutrients
        };
    }

    // --- Core Calculation Functions ---

    /** Calculates Body Mass Index (BMI). */
    function calculateBMI(heightCm, weightKg) {
        if (heightCm <= 0) return 0; // Avoid division by zero or invalid input
        const heightInM = heightCm / 100; // Convert cm to meters
        // BMI formula: weight (kg) / [height (m)]^2
        return weightKg / (heightInM * heightInM);
    }

    /** Calculates Basal Metabolic Rate (BMR) using Mifflin-St Jeor Equation (considered more accurate). */
    function calculateBMR(weightKg, heightCm, age, gender) {
        // Formula: (10 * weight_kg) + (6.25 * height_cm) - (5 * age_years) + S
        // S (sex factor) is +5 for males, -161 for females
        const S = (gender === 'male') ? 5 : -161;
        return (10 * weightKg) + (6.25 * heightCm) - (5 * age) + S;
    }

    /** Calculates Total Daily Energy Expenditure (TDEE) by multiplying BMR by activity level. */
    function calculateTDEE(bmr, activityLevel) {
        return bmr * activityLevel;
    }

    /** Adjusts TDEE based on the user's weight goal (lose, maintain, gain). */
    function adjustCaloriesForGoal(tdee, goal) {
        let calorieAdjustment = 0;
        switch (goal) {
            case 'lose':
                calorieAdjustment = -500; // Typical deficit for ~1 lb/week loss
                break;
            case 'gain':
                calorieAdjustment = 300;  // Moderate surplus for lean gain (~0.5 lb/week)
                break;
            case 'maintain': // Fallthrough intended
            default:
                calorieAdjustment = 0;
                break;
        }
        // Calculate target calories and ensure it doesn't fall below a safe minimum (e.g., 1200 kcal)
        const targetCalories = tdee + calorieAdjustment;
        return Math.max(1200, Math.round(targetCalories)); // Return rounded integer >= 1200
    }

    /** Estimates Body Fat Percentage using a common formula based on BMI, age, and gender. */
    function calculateBodyFat(bmi, age, gender) {
        // Formula based on BMI (often attributed to Deurenberg, revised):
        // For Adults: (1.20 * BMI) + (0.23 * Age) - (10.8 * sex) - 5.4
        // where sex = 1 for male, 0 for female
        const sexFactor = (gender === 'male') ? 1 : 0;
        const bodyFatPercentage = (1.20 * bmi) + (0.23 * age) - (10.8 * sexFactor) - 5.4;

        // Clamp the result to a realistic physiological range (e.g., 3% to 60%)
        return Math.max(3, Math.min(60, bodyFatPercentage));
    }

    /** Calculates estimated daily water intake needs based on weight. */
    function calculateWaterIntake(weightKg) {
        // General guideline: ~35 ml of water per kg of body weight
        // Convert ml to Liters and format to one decimal place
        return (weightKg * 35 / 1000).toFixed(1);
    }

    /**
     * Calculates estimated daily needs for selected micronutrients based on simplified RDAs.
     * Note: These are general estimates and individual needs vary significantly.
     * @param {string} gender - 'male' or 'female'.
     * @param {number} age - Age in years.
     * @returns {object} Object containing estimated daily needs for Zinc, Iron, Magnesium, Calcium (in mg).
     */
    function calculateMicronutrients(gender, age) {
        let zinc, iron, magnesium, calcium;

        // Simplified RDAs for adults (adjustments for age/gender where common)
        if (gender === 'male') {
            zinc = 11; // mg/day (RDA 19+ yrs)
            iron = 8;  // mg/day (RDA 19+ yrs)
            // Magnesium RDA varies slightly by age for men
            magnesium = (age >= 19 && age <= 30) ? 400 : 420; // mg/day (RDA 19-30 / 31+)
        } else { // female
            zinc = 8; // mg/day (RDA 19+ yrs)
            // Iron RDA is higher for pre-menopausal women
            iron = (age >= 19 && age <= 50) ? 18 : 8; // mg/day (RDA 19-50 / 51+)
            // Magnesium RDA varies slightly by age for women
            magnesium = (age >= 19 && age <= 30) ? 310 : 320; // mg/day (RDA 19-30 / 31+)
        }

        // Calcium RDA varies by age and slightly by gender in older adults
        if (age >= 19 && age <= 50) {
            calcium = 1000; // mg/day (RDA 19-50 yrs)
        } else if (age >= 51 && age <= 70) {
            calcium = (gender === 'male') ? 1000 : 1200; // mg/day (RDA 51-70 M / F)
        } else if (age > 70) {
            calcium = 1200; // mg/day (RDA 70+ yrs)
        } else { // Approximation for ages < 19 (RDA is higher)
            calcium = 1300; // mg/day (RDA 9-18 yrs) - Use as fallback if age < 19
        }

        return { zinc, iron, magnesium, calcium };
    }

    // --- UI Update ---

    /**
     * Updates the dashboard UI elements (result cards, charts) with the calculated metrics.
     * @param {object} metrics - The object containing all calculated health metrics.
     */
    function updateUI({ bmi, calories, bodyFat, water, bmiCategory, micronutrients }) {
        // --- Update Health Summary Card ---
        bmiResultEl.textContent = bmi.toFixed(1); // Format BMI to 1 decimal place
        bmiCategoryEl.textContent = bmiCategory;  // Display BMI category text
        caloriesResultEl.textContent = calories;  // Display calculated calorie goal
        // Display the selected goal text (e.g., "Lose Weight")
        caloriesGoalEl.textContent = `Goal: ${goalSelect.options[goalSelect.selectedIndex].text}`;
        bodyFatValueEl.textContent = `${bodyFat.toFixed(1)}%`; // Format body fat %
        waterIntakeEl.textContent = `${water} L`; // Display water intake in Liters

        // --- Update Micronutrients Card ---
        // Use nullish coalescing (??) to show '--' if a value is null or undefined
        zincResultEl.textContent = micronutrients.zinc ?? '--';
        ironResultEl.textContent = micronutrients.iron ?? '--';
        magnesiumResultEl.textContent = micronutrients.magnesium ?? '--';
        calciumResultEl.textContent = micronutrients.calcium ?? '--';

        // --- Control Visibility ---
        // Show the results and charts sections, hide the placeholder
        resultsSection.style.display = 'block';
        micronutrientsSection.style.display = 'block';
        chartsContainer.style.display = 'grid'; // Use 'grid' as defined in CSS
        chartPlaceholder.style.display = 'none';

        // --- Update Charts ---
        // Check if the updateCharts function (from charts.js) is available
        if (typeof updateCharts === 'function') {
            updateCharts(bmi, bodyFat, calories); // Call the function with necessary data
        } else {
            // Log an error if charts.js wasn't loaded correctly or before this script
            console.error("Error: updateCharts function is not defined. Make sure charts.js is loaded correctly.");
        }

        // --- Accessibility & User Experience ---
        // Optional: Scroll the view smoothly to the results section after calculation
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /**
     * Determines the textual BMI category based on the calculated BMI value.
     * @param {number} bmi - The calculated Body Mass Index.
     * @returns {string} The corresponding BMI category string (e.g., 'Normal weight', 'Obese').
     */
    function getBMICategory(bmi) {
        if (bmi < 18.5) return 'Underweight';
        if (bmi >= 18.5 && bmi < 25) return 'Normal weight';
        if (bmi >= 25 && bmi < 30) return 'Overweight';
        if (bmi >= 30) return 'Obese';
        return 'N/A'; // Fallback for invalid BMI values (e.g., 0)
    }

    // --- Utility Functions ---

    /**
     * Displays an error message associated with a specific input element.
     * (Currently uses alert, could be enhanced to show inline errors).
     * @param {HTMLElement} inputElement - The input element causing the error.
     * @param {string} message - The error message to display.
     * @returns {null} Always returns null to indicate validation failure in getFormValues.
     */
    function showError(inputElement, message) {
        // TODO: Implement a more user-friendly inline error display mechanism.
        // Example: Add an error class to the input, display message nearby.
        alert(`Input Error: ${message}`); // Simple alert for now
        if (inputElement) {
            inputElement.focus(); // Focus the problematic input field
            // Example of adding an error class (requires CSS definition)
            // inputElement.classList.add('input-error');
        }
        return null; // Return null to signal validation failure
    }

    // --- Event Listeners Setup ---
    // Attach event listeners to the relevant DOM elements.
    themeSwitch.addEventListener('click', handleThemeSwitch);
    unitBtns.forEach(btn => btn.addEventListener('click', handleUnitConversion));
    bioForm.addEventListener('submit', handleFormSubmit);

    // --- Initialization ---
    initTheme(); // Set the initial theme when the page loads.

    // Set initial visibility of unit inputs based on the default active button.
    const initialUnit = document.querySelector('.unit-btn.active')?.dataset.unit || 'metric';
    const showMetricInitially = initialUnit === 'metric';
    metricUnits.forEach(el => el.style.display = showMetricInitially ? 'block' : 'none');
    imperialUnits.forEach(el => el.style.display = showMetricInitially ? 'none' : 'block');

}); // End DOMContentLoaded wrapper
