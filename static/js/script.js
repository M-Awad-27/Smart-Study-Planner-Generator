// ============================================================
// SMART STUDY PLANNER — FRONTEND LOGIC
// ============================================================
// Phase 3: Form handling, API calls, results rendering
// Phase 4: Countdown timers, Chart.js, CSV download
// ============================================================


// --- DOM Elements ---
const subjectCountInput = document.getElementById("subject-count");
const stepperMinus = document.getElementById("stepper-minus");
const stepperPlus = document.getElementById("stepper-plus");
const subjectsContainer = document.getElementById("subjects-container");
const studyForm = document.getElementById("study-form");
const dailyHoursInput = document.getElementById("daily-hours");
const hoursDisplay = document.getElementById("hours-display");
const generateBtn = document.getElementById("generate-btn");
const errorBanner = document.getElementById("error-banner");
const errorMessages = document.getElementById("error-messages");
const errorClose = document.getElementById("error-close");
const resultsSection = document.getElementById("results-section");


// --- State ---
let countdownInterval = null;   // Stores the setInterval ID for live exam timers
let liveBreakInterval = null;   // Stores the setInterval ID for live break reminders
let chartInstance = null;       // Stores the Chart.js instance (so we can destroy + recreate)
let breakdownChartInstance = null; // Stores the breakdown chart instance
let currentPlanData = null;     // Stores the latest plan for CSV download


// --- Initialize ---
document.addEventListener("DOMContentLoaded", () => {
    renderSubjectCards(parseInt(subjectCountInput.value));
    updateHoursDisplay();
    initInteractiveCards(); // Initialize 3D effects on initial cards
    initScrollReveal();     // Initialize scroll reveal observer
});


// --- Stepper Controls ---
stepperMinus.addEventListener("click", () => {
    const current = parseInt(subjectCountInput.value);
    if (current > 1) {
        subjectCountInput.value = current - 1;
        renderSubjectCards(current - 1);
    }
});

stepperPlus.addEventListener("click", () => {
    const current = parseInt(subjectCountInput.value);
    if (current < 10) {
        subjectCountInput.value = current + 1;
        renderSubjectCards(current + 1);
    }
});


// --- Render Subject Cards ---
function renderSubjectCards(count) {
    const existing = subjectsContainer.querySelectorAll(".subject-card");
    const existingData = [];

    existing.forEach(card => {
        existingData.push({
            name: card.querySelector(".subject-name-input").value,
            difficulty: card.querySelector(".subject-difficulty-select").value,
            exam_date: card.querySelector(".subject-date-input").value,
            is_weak: card.querySelector(".subject-weak-checkbox").checked,
        });
    });

    subjectsContainer.innerHTML = "";

    for (let i = 0; i < count; i++) {
        const data = existingData[i] || { name: "", difficulty: "medium", exam_date: "", is_weak: false };
        const card = createSubjectCard(i + 1, data);
        subjectsContainer.appendChild(card);
    }
}

function createSubjectCard(index, data) {
    const card = document.createElement("div");
    card.className = "subject-card";
    card.style.animationDelay = `${index * 0.05}s`;

    card.innerHTML = `
        <div class="subject-card-header">
            <span class="subject-number">Subject ${index}</span>
        </div>
        <div>
            <input type="text" class="subject-input subject-name-input"
                   placeholder="e.g. Mathematics" value="${escapeHtml(data.name)}"
                   id="subject-name-${index}" aria-label="Subject ${index} name">
        </div>
        <div>
            <select class="subject-select subject-difficulty-select"
                    id="subject-difficulty-${index}" aria-label="Subject ${index} difficulty">
                <option value="easy" ${data.difficulty === "easy" ? "selected" : ""}>Easy</option>
                <option value="medium" ${data.difficulty === "medium" ? "selected" : ""}>Medium</option>
                <option value="hard" ${data.difficulty === "hard" ? "selected" : ""}>Hard</option>
            </select>
        </div>
        <div>
            <input type="date" class="subject-input subject-date-input"
                   value="${data.exam_date}" id="subject-date-${index}"
                   aria-label="Subject ${index} exam date">
        </div>
        <div>
            <label class="weak-label">
                <input type="checkbox" class="weak-checkbox subject-weak-checkbox"
                       ${data.is_weak ? "checked" : ""} id="subject-weak-${index}">
                Weak subject
            </label>
        </div>
    `;

    return card;
}


// --- Hours Slider ---
dailyHoursInput.addEventListener("input", updateHoursDisplay);

function updateHoursDisplay() {
    const val = parseFloat(dailyHoursInput.value);
    hoursDisplay.textContent = val === 1 ? "1 hr" : `${val} hrs`;
}


// --- Form Submission ---
studyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const subjects = collectSubjects();
    const dailyHours = parseFloat(dailyHoursInput.value);
    const preferredTime = document.querySelector('input[name="preferred-time"]:checked').value;

    setBtnLoading(true);

    try {
        const response = await fetch("/generate-plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                subjects: subjects,
                daily_hours: dailyHours,
                preferred_time: preferredTime,
            }),
        });

        const result = await response.json();

        if (!response.ok || result.error) {
            const errors = Array.isArray(result.error) ? result.error : [result.error];
            showError(errors);
            return;
        }

        // Store the plan data for CSV download
        currentPlanData = result.plan;

        displayResults(result.plan);

    } catch (err) {
        showError(["Failed to connect to server. Make sure the Flask app is running."]);
    } finally {
        setBtnLoading(false);
    }
});


// --- Collect Form Data ---
function collectSubjects() {
    const cards = subjectsContainer.querySelectorAll(".subject-card");
    const subjects = [];

    cards.forEach(card => {
        subjects.push({
            name: card.querySelector(".subject-name-input").value.trim(),
            difficulty: card.querySelector(".subject-difficulty-select").value,
            exam_date: card.querySelector(".subject-date-input").value,
            is_weak: card.querySelector(".subject-weak-checkbox").checked,
        });
    });

    return subjects;
}


// ============================================================
// RESULTS DISPLAY
// ============================================================

function displayResults(plan) {
    renderCountdownTimers(plan.priority_ranking);
    renderPriorityTable(plan.priority_ranking);
    renderTimetable(plan.daily_timetable);
    renderSuggestions(plan.suggestions);
    renderWeeklyPlan(plan.weekly_plan);
    renderDistributionChart(plan.priority_ranking);
    renderBreakdownChart(plan.priority_ranking);
    renderBreaks(plan.breaks);

    resultsSection.style.display = "block";
    
    setTimeout(() => {
        resultsSection.classList.add("show-results");
        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
        initInteractiveCards(); // Initialize effects on newly rendered result cards
        triggerSuccessCelebration();
    }, 50);

    startLiveBreakTimer(plan.breaks);
}


// ============================================================
// PHASE 4 — EXAM COUNTDOWN TIMERS
// ============================================================

function renderCountdownTimers(ranking) {
    const grid = document.getElementById("countdowns-grid");
    grid.innerHTML = "";

    // Clear any previous interval
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    ranking.forEach((s, i) => {
        const item = document.createElement("div");
        item.className = "countdown-item";
        item.style.animationDelay = `${i * 0.08}s`;
        item.setAttribute("data-exam-date", s.exam_date);
        item.id = `countdown-${i}`;

        // Format the exam date for display
        const examDate = new Date(s.exam_date + "T00:00:00");
        const formattedDate = examDate.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
        });

        item.innerHTML = `
            <div class="countdown-header">
                <div class="countdown-subject">
                    ${escapeHtml(s.name)}
                </div>
                <span class="countdown-exam-date">Exam: ${formattedDate}</span>
            </div>
            <div class="countdown-timer" id="countdown-timer-${i}">
                <!-- Populated by updateCountdowns() -->
            </div>
            <div class="countdown-progress">
                <div class="countdown-progress-fill" id="countdown-progress-${i}"></div>
            </div>
        `;

        grid.appendChild(item);
    });

    // Initial render + start ticking every second
    updateCountdowns(ranking);
    countdownInterval = setInterval(() => updateCountdowns(ranking), 1000);
}


function updateCountdowns(ranking) {
    const now = new Date();

    ranking.forEach((s, i) => {
        const timerEl = document.getElementById(`countdown-timer-${i}`);
        const progressEl = document.getElementById(`countdown-progress-${i}`);
        const itemEl = document.getElementById(`countdown-${i}`);

        if (!timerEl || !progressEl || !itemEl) return;

        const examDate = new Date(s.exam_date + "T23:59:59");
        const diff = examDate - now;

        // Determine urgency class
        const daysLeft = diff / (1000 * 60 * 60 * 24);
        let urgencyClass;
        if (daysLeft <= 0) {
            urgencyClass = "urgency-urgent";
        } else if (daysLeft <= 3) {
            urgencyClass = "urgency-urgent";
        } else if (daysLeft <= 7) {
            urgencyClass = "urgency-moderate";
        } else {
            urgencyClass = "urgency-relaxed";
        }

        // Update item urgency border
        itemEl.className = "countdown-item";
        if (daysLeft <= 0) {
            itemEl.classList.add("exam-today");
        } else {
            itemEl.classList.add(urgencyClass);
        }

        if (diff <= 0) {
            // Exam is today or has passed
            timerEl.innerHTML = `<div class="countdown-exam-today-text">EXAM TODAY!</div>`;
            progressEl.style.width = "100%";
            progressEl.className = "countdown-progress-fill urgency-urgent";
            return;
        }

        // Calculate days, hours, minutes, seconds
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        timerEl.innerHTML = `
            <div class="countdown-unit">
                <span class="countdown-value ${urgencyClass}">${String(days).padStart(2, "0")}</span>
                <span class="countdown-label">Days</span>
            </div>
            <span class="countdown-separator">:</span>
            <div class="countdown-unit">
                <span class="countdown-value ${urgencyClass}">${String(hours).padStart(2, "0")}</span>
                <span class="countdown-label">Hours</span>
            </div>
            <span class="countdown-separator">:</span>
            <div class="countdown-unit">
                <span class="countdown-value ${urgencyClass}">${String(minutes).padStart(2, "0")}</span>
                <span class="countdown-label">Min</span>
            </div>
            <span class="countdown-separator">:</span>
            <div class="countdown-unit">
                <span class="countdown-value ${urgencyClass}">${String(seconds).padStart(2, "0")}</span>
                <span class="countdown-label">Sec</span>
            </div>
        `;

        // Progress bar: from today to exam date
        // Calculate how much of the total prep time has elapsed
        // We approximate "total time" as 30 days before the exam
        const totalPrepMs = 30 * 24 * 60 * 60 * 1000;
        const elapsed = totalPrepMs - diff;
        const progressPercent = Math.max(0, Math.min(100, (elapsed / totalPrepMs) * 100));

        progressEl.style.width = `${progressPercent}%`;
        progressEl.className = `countdown-progress-fill ${urgencyClass}`;
    });
}


// ============================================================
// PHASE 4 — CHART.JS PIE/DOUGHNUT CHART
// ============================================================

// Curated color palette for the chart — vibrant, distinct colors
const CHART_COLORS = [
    "#818cf8", // Indigo
    "#f472b6", // Pink
    "#34d399", // Emerald
    "#fbbf24", // Amber
    "#38bdf8", // Sky
    "#fb923c", // Orange
    "#a78bfa", // Violet
    "#f87171", // Red
    "#2dd4bf", // Teal
    "#e879f9", // Fuchsia
];


function renderDistributionChart(ranking) {
    const canvas = document.getElementById("distribution-chart");
    const legendContainer = document.getElementById("chart-legend");

    // Destroy previous chart if it exists
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    const labels = ranking.map(s => s.name);
    const data = ranking.map(s => s.allocated_hours);
    const colors = ranking.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

    chartInstance = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: function(context) {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    
                    if (!chartArea) {
                        // This case happens on initial chart load
                        return null;
                    }
                    const colorIndex = context.dataIndex % CHART_COLORS.length;
                    const baseColor = CHART_COLORS[colorIndex];
                    
                    // Create a gradient to give a 3D cylindrical feel
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, adjustColor(baseColor, 30));  // Lighter at top
                    gradient.addColorStop(0.5, baseColor);
                    gradient.addColorStop(1, adjustColor(baseColor, -30)); // Darker at bottom
                    return gradient;
                },
                borderColor: "rgba(10, 10, 26, 0.9)",
                borderWidth: 4,
                hoverBorderColor: "#fff",
                hoverBorderWidth: 3,
                hoverOffset: 15,
                // Add an inner shadow effect
                shadowOffsetX: 3,
                shadowOffsetY: 3,
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
            }],
        },
        plugins: [{
            id: 'customShadow',
            beforeDraw: (chart) => {
                const ctx = chart.ctx;
                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 5;
                ctx.shadowOffsetY = 8;
            },
            afterDraw: (chart) => {
                chart.ctx.restore();
            }
        }],
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: "62%",
            plugins: {
                legend: {
                    display: false, // We use a custom legend below
                },
                tooltip: {
                    backgroundColor: "rgba(17, 17, 40, 0.95)",
                    titleColor: "#e8e8f0",
                    bodyColor: "#9898b0",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    titleFont: { family: "'Inter', sans-serif", weight: "700" },
                    bodyFont: { family: "'Inter', sans-serif" },
                    callbacks: {
                        label: function(context) {
                            const hours = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = ((hours / total) * 100).toFixed(1);
                            return ` ${hours}h (${pct}%)`;
                        },
                    },
                },
            },
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1200,
                easing: "easeOutQuart",
            },
        },
    });

    // Build custom legend
    legendContainer.innerHTML = "";
    ranking.forEach((s, i) => {
        const color = CHART_COLORS[i % CHART_COLORS.length];
        const item = document.createElement("div");
        item.className = "legend-item";
        item.innerHTML = `
            <span class="legend-dot" style="background: ${color}"></span>
            <span>${escapeHtml(s.name)}</span>
            <span class="legend-hours">${s.allocated_hours}h (${s.percentage}%)</span>
        `;
        legendContainer.appendChild(item);
    });
}


let barChartInstance = null;

function renderBreakdownChart(ranking) {
    const canvas = document.getElementById("breakdown-chart");
    if (!canvas) return;

    if (barChartInstance) {
        barChartInstance.destroy();
        barChartInstance = null;
    }

    const labels = ranking.map(s => s.name);
    
    // Extract the individual components of the score (which we added to the python backend)
    // If the backend doesn't provide these, we'll gracefully fallback
    const difficultyData = ranking.map(s => s.difficulty_component !== undefined ? s.difficulty_component : 0);
    const urgencyData = ranking.map(s => s.urgency_component !== undefined ? s.urgency_component : 0);
    const weaknessData = ranking.map(s => s.weakness_component !== undefined ? s.weakness_component : 0);

    // Helper function to create 3D bar gradient
    function createBarGradient(ctx, chartArea, baseColor) {
        if (!chartArea) return baseColor;
        const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
        gradient.addColorStop(0, adjustColor(baseColor, -20)); // Darker left
        gradient.addColorStop(0.5, baseColor); // Base middle
        gradient.addColorStop(1, adjustColor(baseColor, 30));  // Lighter right
        return gradient;
    }

    barChartInstance = new Chart(canvas, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Exam Urgency",
                    data: urgencyData,
                    backgroundColor: function(context) {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        return createBarGradient(ctx, chartArea, "#f87171");
                    },
                    borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 },
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.2)",
                },
                {
                    label: "Difficulty",
                    data: difficultyData,
                    backgroundColor: function(context) {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        return createBarGradient(ctx, chartArea, "#fbbf24");
                    },
                    borderRadius: 0,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.2)",
                },
                {
                    label: "Weakness",
                    data: weaknessData,
                    backgroundColor: function(context) {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        return createBarGradient(ctx, chartArea, "#818cf8");
                    },
                    borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.2)",
                }
            ],
        },
        plugins: [{
            id: 'customShadow',
            beforeDraw: (chart) => {
                const ctx = chart.ctx;
                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 4;
            },
            afterDraw: (chart) => {
                chart.ctx.restore();
            }
        }],
        options: {
            responsive: true,
            maintainAspectRatio: false, // Important: allows the chart to stretch to wrapper height
            scales: {
                x: {
                    stacked: true,
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#9898b0", font: { family: "'Inter', sans-serif" } }
                },
                y: {
                    stacked: true,
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#9898b0", font: { family: "'Inter', sans-serif" } },
                    title: { display: true, text: "Score Contribution", color: "#6b6b85" }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: "#9898b0", usePointStyle: true, padding: 20, font: { family: "'Inter', sans-serif" } }
                },
                tooltip: {
                    backgroundColor: "rgba(17, 17, 40, 0.95)",
                    titleColor: "#e8e8f0",
                    bodyColor: "#9898b0",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    mode: 'index',
                    intersect: false,
                },
            },
            animation: {
                duration: 1200,
                easing: "easeOutQuart",
            },
        },
    });
    
    // Force a specific height for the wrapper so the chart has room
    canvas.parentElement.style.height = "300px";
}


// ============================================================
// PHASE 4 — CSV DOWNLOAD
// ============================================================

document.getElementById("csv-download-btn").addEventListener("click", () => {
    if (!currentPlanData) return;
    downloadCSV(currentPlanData);
});

document.getElementById("print-btn").addEventListener("click", () => {
    window.print();
});


function downloadCSV(plan) {
    const rows = [];

    // --- Section 1: Priority Ranking ---
    rows.push(["=== PRIORITY RANKING ==="]);
    rows.push(["Rank", "Subject", "Priority", "Score", "Hours", "Percentage", "Exam In (days)", "Difficulty", "Weak"]);
    plan.priority_ranking.forEach((s, i) => {
        rows.push([
            i + 1,
            s.name,
            s.priority_level,
            s.priority_score,
            s.allocated_hours,
            `${s.percentage}%`,
            s.days_until_exam,
            s.difficulty,
            s.is_weak ? "Yes" : "No",
        ]);
    });

    rows.push([]); // Blank separator

    // --- Section 2: Daily Timetable ---
    rows.push(["=== DAILY TIMETABLE ==="]);
    rows.push(["Time", "Subject", "Duration (hours)", "Type"]);
    plan.daily_timetable.forEach(slot => {
        rows.push([
            slot.time,
            slot.subject,
            slot.duration,
            slot.is_break ? "Break" : "Study",
        ]);
    });

    rows.push([]);

    // --- Section 3: Suggestions ---
    rows.push(["=== SUGGESTIONS ==="]);
    rows.push(["Suggestion"]);
    plan.suggestions.forEach(s => {
        // Strip markdown bold markers for CSV
        rows.push([s.replace(/\*\*/g, "")]);
    });

    rows.push([]);

    // --- Section 4: Weekly Plan ---
    rows.push(["=== WEEKLY PLAN ==="]);
    rows.push(["Day", "Subject", "Hours"]);
    plan.weekly_plan.forEach(day => {
        day.subjects.forEach(s => {
            rows.push([day.day, s.name, s.hours]);
        });
    });

    rows.push([]);

    // --- Section 5: Breaks ---
    rows.push(["=== BREAK SCHEDULE ==="]);
    rows.push(["Time", "Tip"]);
    plan.breaks.forEach(b => {
        rows.push([b.time, b.tip]);
    });

    // Convert to CSV string
    const csvContent = rows.map(row =>
        row.map(cell => {
            const str = String(cell);
            // Escape quotes and wrap in quotes if contains comma/quote/newline
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(",")
    ).join("\n");

    // Trigger download
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `study_plan_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}


// ============================================================
// EXISTING RESULT RENDERERS (Phase 3)
// ============================================================

// --- Priority Ranking Table ---
function renderPriorityTable(ranking) {
    const tbody = document.getElementById("priority-body");
    tbody.innerHTML = "";

    ranking.forEach((s, i) => {
        const priorityClass = s.priority_level.toLowerCase();
        const daysClass = s.days_until_exam <= 3 ? "urgent" :
                          s.days_until_exam <= 7 ? "moderate" : "relaxed";
        const daysText = s.days_until_exam === 0 ? "TODAY" : `${s.days_until_exam}d`;

        const tr = document.createElement("tr");
        tr.style.animationDelay = `${i * 0.05}s`;

        tr.innerHTML = `
            <td><span class="rank-badge">${i + 1}</span></td>
            <td><strong>${escapeHtml(s.name)}</strong></td>
            <td><span class="priority-badge ${priorityClass}">${s.priority_level}</span></td>
            <td>
                <div class="score-bar-wrapper">
                    <div class="score-bar">
                        <div class="score-bar-fill" style="width: ${s.priority_score}%"></div>
                    </div>
                    <span class="score-text">${s.priority_score}</span>
                </div>
            </td>
            <td><span class="hours-text">${s.allocated_hours}h</span></td>
            <td><span class="days-text ${daysClass}">${daysText}</span></td>
        `;

        tbody.appendChild(tr);
    });
}


// --- Daily Timetable ---
function renderTimetable(timetable) {
    const grid = document.getElementById("timetable-grid");
    grid.innerHTML = "";

    timetable.forEach((slot, i) => {
        const div = document.createElement("div");
        div.className = `timetable-slot ${slot.is_break ? "break-slot" : ""}`;
        div.style.animationDelay = `${i * 0.04}s`;

        const durationMin = Math.round(slot.duration * 60);
        const durationText = durationMin >= 60
            ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`
            : `${durationMin}m`;

        div.innerHTML = `
            <span class="slot-time">${escapeHtml(slot.time)}</span>
            <span class="slot-subject">${escapeHtml(slot.subject)}</span>
            <span class="slot-duration">${durationText}</span>
        `;

        grid.appendChild(div);
    });
}


// --- Suggestions ---
function renderSuggestions(suggestions) {
    const list = document.getElementById("suggestions-list");
    list.innerHTML = "";

    suggestions.forEach((text, i) => {
        const div = document.createElement("div");
        div.className = "suggestion-item";
        div.style.animationDelay = `${i * 0.05}s`;
        div.innerHTML = formatMarkdownBold(escapeHtml(text));
        list.appendChild(div);
    });
}


// --- Weekly Plan ---
function renderWeeklyPlan(weekly) {
    const grid = document.getElementById("weekly-grid");
    grid.innerHTML = "";

    weekly.forEach((day, i) => {
        const totalHours = day.subjects.reduce((sum, s) => sum + s.hours, 0);
        
        let intensityClass = "intensity-low";
        if (totalHours > 8) intensityClass = "intensity-max";
        else if (totalHours > 5) intensityClass = "intensity-high";
        else if (totalHours > 3) intensityClass = "intensity-medium";

        const card = document.createElement("div");
        card.className = `day-card ${day.is_today ? "today" : ""} ${intensityClass}`;
        card.style.animationDelay = `${i * 0.06}s`;

        let subjectsHtml = "";
        day.subjects.forEach(s => {
            subjectsHtml += `
                <div class="day-subject-item">
                    <span class="day-subject-name">${escapeHtml(s.name)}</span>
                    <span class="day-subject-hours">${s.hours}h</span>
                </div>
            `;
        });

        card.innerHTML = `
            <div class="day-name">
                ${day.day}
                ${day.is_today ? '<span class="today-badge">TODAY</span>' : ""}
            </div>
            <div class="day-subjects">${subjectsHtml}</div>
            <div class="day-footer" style="margin-top: 10px; font-size: 0.75rem; color: var(--text-muted); text-align: right;">
                Total: ${totalHours.toFixed(1)}h
            </div>
        `;

        grid.appendChild(card);
    });
}


// --- Breaks ---
function renderBreaks(breaks) {
    const list = document.getElementById("breaks-list");
    list.innerHTML = "";

    if (breaks.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No breaks needed for short study sessions.</p>';
        return;
    }

    breaks.forEach((b, i) => {
        const div = document.createElement("div");
        div.className = "break-item";
        div.style.animationDelay = `${i * 0.06}s`;

        div.innerHTML = `
            <span class="break-time">${escapeHtml(b.time)}</span>
            <span class="break-tip">${escapeHtml(b.tip)}</span>
        `;

        list.appendChild(div);
    });
}

function startLiveBreakTimer(breaks) {
    const banner = document.getElementById("live-break-banner");
    const timerText = document.getElementById("break-timer-text");
    const tipText = document.getElementById("break-banner-tip");

    if (liveBreakInterval) {
        clearInterval(liveBreakInterval);
        liveBreakInterval = null;
    }

    if (!breaks || breaks.length === 0) {
        banner.style.display = "none";
        return;
    }

    banner.style.display = "flex";

    // Helper to convert "09:00 AM - 09:15 AM" into Date objects for today
    function parseTimeRange(timeStr) {
        const parts = timeStr.split(" - ");
        const parseDate = (t) => {
            const date = new Date();
            const match = t.match(/(\d+):(\d+)\s+(AM|PM)/);
            if (!match) return date;
            let [_, h, m, modifier] = match;
            h = parseInt(h);
            if (modifier === "PM" && h < 12) h += 12;
            if (modifier === "AM" && h === 12) h = 0;
            date.setHours(h, parseInt(m), 0, 0);
            return date;
        };
        return { start: parseDate(parts[0]), end: parseDate(parts[1]) };
    }

    const breakDates = breaks.map(b => ({
        ...b,
        ...parseTimeRange(b.time)
    }));

    function update() {
        const now = new Date();
        
        // Find current active break
        const activeBreak = breakDates.find(b => now >= b.start && now < b.end);
        
        if (activeBreak) {
            banner.classList.add("active-break");
            document.querySelector(".break-banner-title").innerHTML = `ACTIVE BREAK: <span>Time to recharge!</span>`;
            tipText.textContent = activeBreak.tip;
            return;
        }

        // Otherwise find next upcoming break
        const nextBreak = breakDates.find(b => b.start > now);
        
        if (nextBreak) {
            banner.classList.remove("active-break");
            document.querySelector(".break-banner-title").innerHTML = `Next Break In: <span id="break-timer-text">--:--</span>`;
            
            const diff = nextBreak.start - now;
            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            
            const timeStr = [
                h > 0 ? h.toString().padStart(2, '0') : null,
                m.toString().padStart(2, '0'),
                s.toString().padStart(2, '0')
            ].filter(Boolean).join(':');

            document.getElementById("break-timer-text").textContent = timeStr;
            tipText.textContent = `Coming up: ${nextBreak.time}`;
        } else {
            banner.classList.remove("active-break");
            document.querySelector(".break-banner-title").innerHTML = `All breaks completed! <span>Great job today.</span>`;
            tipText.textContent = "You've finished all your scheduled breaks.";
            clearInterval(liveBreakInterval);
        }
    }

    update();
    liveBreakInterval = setInterval(update, 1000);
}

// ============================================================
// PHASE 5 — ADVANCED ANIMATIONS & INTERACTIVE EFFECTS
// ============================================================

function initInteractiveCards() {
    const cards = document.querySelectorAll(".card, .subject-card, .countdown-item, .day-card");
    
    cards.forEach(card => {
        // Add glow element if not exists
        if (!card.querySelector(".card-glow-effect")) {
            const glow = document.createElement("div");
            glow.className = "card-glow-effect";
            card.style.position = "relative";
            card.appendChild(glow);
        }

        card.classList.add("card-interactive");

        card.addEventListener("mousemove", (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Update glow position
            card.style.setProperty("--mouse-x", `${(x / rect.width) * 100}%`);
            card.style.setProperty("--mouse-y", `${(y / rect.height) * 100}%`);

            // Calculate 3D tilt
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (centerY - y) / 15; // Vertical tilt
            const rotateY = (x - centerX) / 15; // Horizontal tilt

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
        });

        card.addEventListener("mouseleave", () => {
            card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)`;
        });
    });
}

function triggerSuccessCelebration() {
    const headerTitle = document.querySelector(".header-title");
    headerTitle.classList.add("shimmer-text");
    
    setTimeout(() => {
        headerTitle.classList.remove("shimmer-text");
    }, 3000);

    // Refresh scroll reveal for new elements
    initScrollReveal();
}

function initScrollReveal() {
    const reveals = document.querySelectorAll(".card, .result-card, .suggestion-item, .countdown-item");
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("active");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    reveals.forEach(el => {
        el.classList.add("reveal");
        observer.observe(el);
    });
}

// ============================================================
// ERROR HANDLING & UTILITIES
// ============================================================

function showError(messages) {
    errorMessages.innerHTML = messages.map(m => `<div>• ${escapeHtml(m)}</div>`).join("");
    errorBanner.style.display = "flex";
    errorBanner.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideError() {
    errorBanner.style.display = "none";
}

if (errorClose) {
    errorClose.addEventListener("click", hideError);
}


// --- Button Loading State ---
function setBtnLoading(loading) {
    const btnText = generateBtn.querySelector(".btn-text");
    const btnLoading = generateBtn.querySelector(".btn-loading");

    if (loading) {
        btnText.style.display = "none";
        btnLoading.style.display = "inline";
        generateBtn.disabled = true;
    } else {
        btnText.style.display = "inline";
        btnLoading.style.display = "none";
        generateBtn.disabled = false;
    }
}


// --- Utilities ---
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function formatMarkdownBold(text) {
    return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

function adjustColor(color, amount) {
    let usePound = false;
    if (color[0] == "#") {
        color = color.slice(1);
        usePound = true;
    }
    let num = parseInt(color, 16);
    let r = (num >> 16) + amount;
    if (r > 255) r = 255;
    else if (r < 0) r = 0;
    let b = ((num >> 8) & 0x00FF) + amount;
    if (b > 255) b = 255;
    else if (b < 0) b = 0;
    let g = (num & 0x0000FF) + amount;
    if (g > 255) g = 255;
    else if (g < 0) g = 0;
    return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}
