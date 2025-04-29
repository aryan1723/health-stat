// Global chart variables to hold chart instances
// This allows us to destroy previous charts before creating new ones, preventing memory leaks.
let bmiChart, bodyFatChart, macroChart, calorieChart;

/**
 * Updates all charts on the dashboard with new data.
 * Destroys existing chart instances before creating new ones to ensure clean rendering.
 * @param {number} bmi - Calculated Body Mass Index.
 * @param {number} bodyFat - Calculated Body Fat Percentage.
 * @param {number} calories - Calculated daily calorie goal (this is the key input for macros).
 */
function updateCharts(bmi, bodyFat, calories) {
    // --- Destroy Existing Charts ---
    // Check if each chart instance exists and call destroy() if it does.
    if (bmiChart) bmiChart.destroy();
    if (bodyFatChart) bodyFatChart.destroy();
    if (macroChart) macroChart.destroy();
    if (calorieChart) calorieChart.destroy();

    // --- Chart Configuration ---

    // Get theme-dependent colors for consistent styling
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#ecf0f1' : '#2c3e50'; // For labels, ticks, etc.
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'; // Grid lines
    const gaugeBackgroundColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e9ecef'; // Background for unused gauge parts
    const chartBgColor = 'transparent'; // Make chart background transparent to show card bg

    // --- Common Chart Options ---
    // Define options shared across multiple charts for consistency and maintainability.
    const commonChartOptions = {
        responsive: true,       // Charts resize automatically with their container
        maintainAspectRatio: false, // Allows charts to fill container height better
        plugins: {
            legend: {
                position: 'bottom',   // Place legend below the chart
                labels: {
                    boxWidth: 12,     // Size of the colored boxes in the legend
                    padding: 15,      // Spacing around legend items
                    font: { size: 11 }, // Font size for legend text
                    color: textColor  // Use theme-based text color
                }
            },
            tooltip: { // Configure tooltips shown on hover
                enabled: true, // Ensure tooltips are enabled by default
                backgroundColor: isDark ? '#34495e' : 'rgba(0, 0, 0, 0.8)', // Tooltip background color
                titleColor: '#ffffff',      // Tooltip title text color
                bodyColor: '#ffffff',       // Tooltip body text color
                bodyFont: { size: 11 },     // Font size for tooltip body
                titleFont: { size: 13, weight: 'bold' }, // Font size/weight for tooltip title
                padding: 10,                // Padding inside the tooltip box
                cornerRadius: 4,            // Rounded corners for the tooltip box
                displayColors: false,       // Hide the small color boxes within the tooltip
                borderColor: 'rgba(255,255,255,0.1)', // Optional border for tooltip
                borderWidth: 1
            }
        },
        layout: {
            // Padding inside the chart area (around the drawing space)
            padding: { top: 10, bottom: 5, left: 10, right: 10 }
        },
    };

    // --- 1. BMI Chart (Gauge Style Doughnut) ---
    const bmiCtx = document.getElementById('bmi-chart')?.getContext('2d');
    if (!bmiCtx) {
        console.error("BMI chart canvas element not found.");
        return; // Stop if canvas isn't found
    }
    bmiChart = new Chart(bmiCtx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [bmi, Math.max(0, 40 - bmi)], // BMI value and the remainder up to a max of 40
                backgroundColor: [
                    getBMIColor(bmi),      // Color the BMI segment based on its category
                    gaugeBackgroundColor   // Color for the unused background part of the gauge
                ],
                borderWidth: 0,            // No borders between segments
                circumference: 180,        // Make it a half-circle (180 degrees)
                rotation: -90,             // Start the gauge at the top (12 o'clock position)
                cutout: '75%'              // Adjust the thickness of the doughnut ring (percentage of radius)
            }]
        },
        options: {
            ...commonChartOptions,         // Apply common styling options
            rotation: -90,                 // Ensure rotation is set in options as well
            circumference: 180,
            plugins: {
                ...commonChartOptions.plugins, // Keep common plugin settings (like tooltip defaults)
                legend: { display: false }, // Hide the default legend for this gauge chart
                tooltip: { enabled: false }, // Disable tooltips for the gauge segments
            }
        },
        // Custom Chart.js Plugin to draw text in the center of the doughnut gauge
        plugins: [{
            id: 'doughnutLabel', // Unique ID for this custom plugin
            beforeDraw: (chart) => {
                const { width, height, ctx } = chart;
                ctx.save(); // Save the current canvas context state
                const valueText = bmi.toFixed(1); // Format BMI to one decimal place
                ctx.font = "bold 22px sans-serif"; // Font style for the main value
                ctx.fillStyle = textColor;         // Use theme-based text color
                ctx.textAlign = 'center';        // Center align text horizontally
                ctx.textBaseline = 'middle';     // Center align text vertically
                ctx.fillText(valueText, width / 2, height * 0.8 - 10); // Adjusted y-position for half-doughnut
                const labelText = getBMICategory(bmi); // Get the text category (e.g., "Normal")
                ctx.font = "13px sans-serif";       // Font style for the category label
                ctx.fillText(labelText, width / 2, height * 0.8 + 10); // Adjusted y-position
                ctx.restore(); // Restore the canvas context state
            }
        }]
    });

    // --- 2. Body Fat Chart (Horizontal Bar) ---
    const bodyFatCtx = document.getElementById('body-fat-chart')?.getContext('2d');
    if (!bodyFatCtx) {
        console.error("Body Fat chart canvas element not found.");
        return;
    }
    bodyFatChart = new Chart(bodyFatCtx, {
        type: 'bar',
        data: {
            labels: ['Body Fat %'], // Label for the category axis (Y-axis in horizontal bar)
            datasets: [{
                label: 'Estimated Body Fat', // Label used in tooltips
                data: [bodyFat.toFixed(1)], // The calculated body fat percentage, formatted
                backgroundColor: ['#5dade2'], // Bar color (e.g., light blue)
                borderColor: ['#3498db'],   // Border color for the bar
                borderWidth: 1,
                barThickness: 35,          // Adjust thickness of the bar
                borderRadius: 5            // Add rounded corners to the bar
            }]
        },
        options: {
            ...commonChartOptions, // Apply common styling options
            indexAxis: 'y',       // Make the bar chart horizontal (Y becomes category axis)
            scales: {
                x: { // Value axis (Percentage)
                    beginAtZero: true, // Start the axis at 0%
                    max: 45, // Set a reasonable maximum for the body fat scale (e.g., 45%)
                    grid: { color: gridColor, drawBorder: false }, // Style grid lines
                    ticks: {
                        color: textColor, font: { size: 10 },
                        callback: value => value + '%' // Add '%' suffix to ticks
                    }
                },
                y: { // Category axis
                    grid: { display: false, drawBorder: false }, // Hide grid lines
                    ticks: { color: textColor, font: { size: 11 } }
                }
            },
            plugins: {
                ...commonChartOptions.plugins,
                legend: { display: false } // Hide legend for single-bar chart
            }
        }
    });

    // --- 3. Macronutrient Chart (Pie Chart) ---
    // **Macronutrient Calculation based on the 'calories' argument (Goal Calories)**
    // Using a standard 40% Carb, 30% Protein, 30% Fat split of the *goal calories*.
    const proteinCalories = calories * 0.30;
    const carbsCalories = calories * 0.40;
    const fatsCalories = calories * 0.30;
    // Calculate grams (Protein & Carbs: 4 kcal/g, Fat: 9 kcal/g)
    const proteinGrams = Math.round(proteinCalories / 4);
    const carbsGrams = Math.round(carbsCalories / 4);
    const fatsGrams = Math.round(fatsCalories / 9);

    const macroCtx = document.getElementById('macro-chart')?.getContext('2d');
    if (!macroCtx) {
        console.error("Macronutrient chart canvas element not found.");
        return;
    }
    macroChart = new Chart(macroCtx, {
        type: 'pie',
        data: {
            // Labels include calculated grams for better user context
            labels: [
                `Protein (${proteinGrams}g)`,
                `Carbs (${carbsGrams}g)`,
                `Fats (${fatsGrams}g)`
            ],
            datasets: [{
                label: 'Macronutrient Split (Calories)', // Dataset label for tooltips
                // Data represents the calorie contribution of each macronutrient based on the goal calories
                data: [proteinCalories, carbsCalories, fatsCalories],
                backgroundColor: [ // Assign distinct, visually appealing colors
                    '#3498db', // Blue for Protein
                    '#2ecc71', // Green for Carbs
                    '#f1c40f'  // Yellow for Fats
                ],
                borderColor: isDark ? '#1a1a2e' : '#ffffff', // Border color matches theme background
                borderWidth: 2,
                hoverOffset: 8 // Slightly enlarges a segment on hover
            }]
        },
        options: {
            ...commonChartOptions, // Apply common styling options
            plugins: {
                ...commonChartOptions.plugins,
                legend: { // Customize legend for the pie chart
                    position: 'right', // Position legend to the right
                     labels: {
                        ...commonChartOptions.plugins.legend.labels, // Inherit common label styles
                        padding: 20, // Add more padding for a right-aligned legend
                        usePointStyle: true, // Use circular point styles
                        pointStyle: 'circle'
                    }
                },
                tooltip: { // Customize tooltips for the pie chart
                    ...commonChartOptions.plugins.tooltip, // Inherit common tooltip styles
                    callbacks: {
                        // Modify the tooltip label to show percentage, kcal, and grams
                        label: (context) => {
                            const label = context.label || ''; // Original label (e.g., "Protein (XXg)")
                            const value = context.raw || 0; // Calorie value for this segment
                            const totalCalories = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const percentage = totalCalories > 0 ? ((value / totalCalories) * 100).toFixed(0) : 0;
                            const gramsMatch = label.match(/\((\d+)g\)/);
                            const grams = gramsMatch ? gramsMatch[1] : '?'; // Extract grams
                            return `${label.split('(')[0].trim()}: ${percentage}% (${Math.round(value)} kcal / ${grams}g)`;
                        }
                    }
                }
            }
        }
    });

    // --- 4. Calorie Breakdown Chart (Line Chart) ---
    // Estimate BMR and TDEE for context against the calorie goal.
    const activityMultiplier = parseFloat(document.getElementById('activity-level')?.value) || 1.55;
    const goalType = document.getElementById('goal')?.value;
    let estimatedTDEE;
    // Estimate TDEE based on the goal calories (reverse calculation)
     if (goalType === 'maintain') {
        estimatedTDEE = calories;
    } else if (goalType === 'lose') {
        estimatedTDEE = calories + 500; // Add back the typical deficit
    } else { // gain
        estimatedTDEE = calories - 300; // Subtract the typical surplus
    }
    const estimatedBMR = estimatedTDEE / activityMultiplier;

    const calorieCtx = document.getElementById('calorie-chart')?.getContext('2d');
     if (!calorieCtx) {
        console.error("Calorie chart canvas element not found.");
        return;
    }
    calorieChart = new Chart(calorieCtx, {
        type: 'line',
        data: {
            labels: ['BMR (Est.)', 'Maintenance (TDEE Est.)', 'Your Goal'], // Points on the X-axis
            datasets: [{
                label: 'Estimated Calorie Levels',
                data: [Math.round(estimatedBMR), Math.round(estimatedTDEE), calories], // Corresponding Y values
                borderColor: '#e74c3c', // Line color (e.g., red)
                backgroundColor: isDark ? 'rgba(231, 76, 60, 0.2)' : 'rgba(231, 76, 60, 0.1)', // Fill color
                fill: 'origin', // Fill area below the line
                tension: 0.2, // Line curve
                pointBackgroundColor: '#e74c3c',
                pointBorderColor: '#ffffff',
                pointHoverRadius: 7,
                pointHoverBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: {
            ...commonChartOptions, // Apply common styling options
            scales: {
                y: { // Y-axis (Calories)
                    beginAtZero: false, // Y-axis might not start at 0
                    grid: { color: gridColor, drawBorder: false },
                    ticks: { color: textColor, font: { size: 10 } }
                },
                x: { // X-axis (Categories)
                    grid: { display: false, drawBorder: false }, // Hide X-axis grid lines
                    ticks: { color: textColor, font: { size: 11 } }
                }
            },
             plugins: {
                 ...commonChartOptions.plugins,
                 legend: { display: false } // Hide legend for single dataset line chart
             }
        }
    });
}

// --- Helper Functions ---

/**
 * Determines the color for the BMI gauge based on standard BMI categories.
 * @param {number} bmi - The calculated BMI value.
 * @returns {string} Hex color code representing the BMI category.
 */
function getBMIColor(bmi) {
    if (bmi < 18.5) return '#3498db';  // Underweight (Blue)
    if (bmi < 25) return '#2ecc71';    // Normal weight (Green)
    if (bmi < 30) return '#f39c12';    // Overweight (Orange)
    return '#e74c3c';                 // Obese (Red)
}

/**
 * Gets the textual category name for a given BMI value.
 * @param {number} bmi - The calculated BMI value.
 * @returns {string} Text description of the BMI category (e.g., "Normal", "Overweight").
 */
function getBMICategory(bmi) {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Overweight';
    return 'Obese'; // Assume >= 30 is Obese
}
