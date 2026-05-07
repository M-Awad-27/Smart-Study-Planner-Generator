# 🎓 Smart Study Planner Generator

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com)

A premium, AI-powered study schedule generator designed to optimize exam preparation. This application uses a weighted scoring algorithm to prioritize subjects based on difficulty, exam proximity, and personal weaknesses, all wrapped in a stunning, high-performance "Glassmorphism" interface.

## 🧠 Smart Priority Engine

### Priority Scoring Formula
The application uses a weighted multi-factor scoring system to determine which subjects require more attention. The **Raw Score** for each subject is calculated as follows:

$$S_{raw} = (D_{norm} \times 0.35) + (U_{norm} \times 0.45) + (W_{val} \times 0.20)$$

Where:
- **$D_{norm}$ (Difficulty)**: Normalized difficulty level (Easy=0, Medium=0.5, Hard=1.0).
- **$U_{norm}$ (Urgency)**: Calculated as $\min(1.0, \frac{7}{DaysUntilExam})$. Subjects with exams in less than 7 days receive maximum urgency.
- **$W_{val}$ (Weakness)**: A binary multiplier (1.0 if marked as a "weak subject", 0.0 otherwise).

The final **Priority Score (0-100)** is then normalized across all subjects:
$$S_{final} = \left( \frac{S_{raw} - S_{min}}{S_{max} - S_{min}} \right) \times 100$$

### Key Features
- **Smart Priority Ranking**: Subjects are automatically sorted and assigned "High", "Medium", or "Low" priority levels.
- **Dynamic Time Allocation**: Automatically distributes available study hours based on the calculated priority scores.

### 📊 Data Visualization & Insights
- **Interactive Charts**: Visual breakdown of time distribution and score components using Chart.js.
- **Live Countdown Timers**: Real-time tracking of exam deadlines.
- **Weekly Intensity Heatmap**: A 7-day rotating schedule that color-codes days based on study load intensity.

### 🎨 Premium Visual Experience
- **Interactive 3D Elements**: Result cards feature 3D tilting and magnetic neon glow effects that follow your cursor.
- **Scroll Reveal System**: Content glides smoothly into view as you navigate the dashboard.
- **Productivity Reminders**: A live banner system that tracks your next scheduled break with helpful hydration and rest tips.

## 🛠️ Core Procedure & Workflow

The Smart Study Planner operates through a structured four-step process:

1.  **Data Collection**: The user inputs subject details (name, difficulty, exam date) and daily availability preferences.
2.  **Priority Calculation**: The `planner_engine.py` calculates a **Priority Score (0-100)** for each subject using a multi-factor weighted formula.
3.  **Schedule Synthesis**:
    *   **Daily Timetable**: Generates a slot-by-slot daily schedule including study sessions and optimized breaks.
    *   **Weekly Roadmap**: Creates a balanced 7-day coverage plan to ensure no subject is neglected.
4.  **Interactive Rendering**: The frontend (`script.js`) dynamically renders the results with staggered animations and real-time countdown updates.

## 💻 Technology Stack
- **Backend**: Python (Flask)
- **Frontend**: HTML5, Vanilla CSS3 (Custom Design System), JavaScript (ES6+)
- **Charts**: Chart.js
- **Deployment**: Render (Blueprint optimized)

## 📦 Local Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/M-Awad-27/Smart-Study-Planner-Generator.git
   cd Smart-Study-Planner-Generator
   ```

2. **Setup Virtual Environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run**:
   ```bash
   python app.py
   ```
   Visit `http://127.0.0.1:5000` in your browser.

## 🌐 Deployment to Render
This repository includes a `render.yaml` file for instant deployment:
1. Connect your GitHub repository to [Render](https://render.com).
2. Choose the **Blueprint** option.
3. Render will deploy the app on the **Free Tier** automatically.

---
**Developed by [Muhammad Awad](https://github.com/M-Awad-27)**