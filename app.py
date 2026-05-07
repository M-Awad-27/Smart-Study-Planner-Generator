from flask import Flask, render_template, request, jsonify
from planner_engine import generate_study_plan
from datetime import datetime

app = Flask(__name__)


# --- Serve Main Page ---
@app.route("/")
def index():
    return render_template("index.html")


# --- Generate Study Plan API ---
@app.route("/generate-plan", methods=["POST"])
def generate_plan():
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "No data provided"}), 400

        subjects = data.get("subjects", [])
        daily_hours = data.get("daily_hours", 0)
        preferred_time = data.get("preferred_time", "morning")

        errors = validate_input(subjects, daily_hours, preferred_time)
        if errors:
            return jsonify({"error": errors}), 400

        plan = generate_study_plan(subjects, daily_hours, preferred_time)

        return jsonify({"success": True, "plan": plan})

    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


# --- Input Validation ---
def validate_input(subjects, daily_hours, preferred_time):
    errors = []

    if not subjects or len(subjects) == 0:
        errors.append("At least one subject is required.")

    if not isinstance(daily_hours, (int, float)) or daily_hours <= 0:
        errors.append("Daily study hours must be a positive number.")

    if daily_hours > 16:
        errors.append("Daily study hours cannot exceed 16.")

    valid_times = ["morning", "evening", "night"]
    if preferred_time.lower() not in valid_times:
        errors.append(f"Preferred time must be one of: {', '.join(valid_times)}.")

    valid_difficulties = ["easy", "medium", "hard"]
    for i, subject in enumerate(subjects):
        if not subject.get("name", "").strip():
            errors.append(f"Subject {i + 1}: Name is required.")

        difficulty = subject.get("difficulty", "").lower()
        if difficulty not in valid_difficulties:
            errors.append(f"Subject {i + 1}: Difficulty must be easy, medium, or hard.")

        exam_date = subject.get("exam_date", "")
        if not exam_date:
            errors.append(f"Subject {i + 1}: Exam date is required.")
        else:
            try:
                datetime.strptime(exam_date, "%Y-%m-%d")
            except ValueError:
                errors.append(f"Subject {i + 1}: Invalid date format (use YYYY-MM-DD).")

    return errors if errors else None


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
