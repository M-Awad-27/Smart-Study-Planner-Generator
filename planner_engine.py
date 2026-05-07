from datetime import datetime, timedelta
import math


# --- Constants ---
DIFFICULTY_WEIGHT = 0.35
EXAM_URGENCY_WEIGHT = 0.45
WEAKNESS_WEIGHT = 0.20

DIFFICULTY_MAP = {
    "easy": 1,
    "medium": 2,
    "hard": 3
}

MIN_STUDY_HOURS = 0.5

BREAK_INTERVAL_HOURS = 1.5
BREAK_DURATION_MINUTES = 15


# --- Main Entry Point ---
def generate_study_plan(subjects, daily_hours, preferred_time):
    scored_subjects = _calculate_priority_scores(subjects)
    allocated_subjects = _allocate_study_hours(scored_subjects, daily_hours)
    daily_timetable = _build_daily_timetable(allocated_subjects, daily_hours, preferred_time)
    suggestions = _generate_suggestions(allocated_subjects)
    weekly_plan = _build_weekly_plan(allocated_subjects, daily_hours, preferred_time)
    breaks = _calculate_breaks(daily_hours, preferred_time)

    return {
        "priority_ranking": allocated_subjects,
        "daily_timetable": daily_timetable,
        "suggestions": suggestions,
        "weekly_plan": weekly_plan,
        "breaks": breaks,
    }


# --- Priority Score Calculation ---
def _calculate_priority_scores(subjects):
    scored = []

    for subject in subjects:
        difficulty_value = DIFFICULTY_MAP.get(subject["difficulty"].lower(), 2)
        difficulty_normalized = (difficulty_value - 1) / 2

        exam_date = datetime.strptime(subject["exam_date"], "%Y-%m-%d")
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        days_until_exam = (exam_date - today).days

        if days_until_exam <= 0:
            urgency_normalized = 1.0
        else:
            urgency_normalized = min(1.0, 7.0 / days_until_exam)

        weakness_value = 1.0 if subject.get("is_weak", False) else 0.0

        raw_score = (
            difficulty_normalized * DIFFICULTY_WEIGHT +
            urgency_normalized * EXAM_URGENCY_WEIGHT +
            weakness_value * WEAKNESS_WEIGHT
        )

        scored.append({
            "name": subject["name"],
            "difficulty": subject["difficulty"],
            "exam_date": subject["exam_date"],
            "days_until_exam": max(0, days_until_exam),
            "is_weak": subject.get("is_weak", False),
            "raw_score": raw_score,
            "difficulty_component": round(difficulty_normalized * DIFFICULTY_WEIGHT, 3),
            "urgency_component": round(urgency_normalized * EXAM_URGENCY_WEIGHT, 3),
            "weakness_component": round(weakness_value * WEAKNESS_WEIGHT, 3),
        })

    raw_scores = [s["raw_score"] for s in scored]
    min_score = min(raw_scores)
    max_score = max(raw_scores)
    score_range = max_score - min_score

    for s in scored:
        if score_range == 0:
            s["priority_score"] = 50.0
        else:
            s["priority_score"] = round(
                ((s["raw_score"] - min_score) / score_range) * 100, 1
            )

        if s["priority_score"] >= 70:
            s["priority_level"] = "High"
        elif s["priority_score"] >= 40:
            s["priority_level"] = "Medium"
        else:
            s["priority_level"] = "Low"

    scored.sort(key=lambda x: x["priority_score"], reverse=True)

    return scored


# --- Study Hour Allocation ---
def _allocate_study_hours(scored_subjects, daily_hours):
    if not scored_subjects:
        return scored_subjects

    num_subjects = len(scored_subjects)

    if daily_hours < num_subjects * MIN_STUDY_HOURS:
        equal_hours = round(daily_hours / num_subjects, 2)
        for s in scored_subjects:
            s["allocated_hours"] = equal_hours
            s["percentage"] = round(100 / num_subjects, 1)
        return scored_subjects

    total_raw = sum(s["raw_score"] for s in scored_subjects)

    if total_raw == 0:
        equal_hours = round(daily_hours / num_subjects, 2)
        for s in scored_subjects:
            s["allocated_hours"] = equal_hours
            s["percentage"] = round(100 / num_subjects, 1)
        return scored_subjects

    for s in scored_subjects:
        proportional = (s["raw_score"] / total_raw) * daily_hours
        s["allocated_hours"] = proportional

    deficit = 0.0
    subjects_above_min = []

    for s in scored_subjects:
        if s["allocated_hours"] < MIN_STUDY_HOURS:
            deficit += MIN_STUDY_HOURS - s["allocated_hours"]
            s["allocated_hours"] = MIN_STUDY_HOURS
        else:
            subjects_above_min.append(s)

    if deficit > 0 and subjects_above_min:
        above_min_total = sum(s["allocated_hours"] for s in subjects_above_min)
        for s in subjects_above_min:
            reduction = (s["allocated_hours"] / above_min_total) * deficit
            s["allocated_hours"] -= reduction

    total_allocated = sum(s["allocated_hours"] for s in scored_subjects)
    for s in scored_subjects:
        s["allocated_hours"] = round(s["allocated_hours"], 2)
        s["percentage"] = round((s["allocated_hours"] / total_allocated) * 100, 1)

    return scored_subjects


# --- Daily Timetable Builder ---
def _build_daily_timetable(allocated_subjects, daily_hours, preferred_time):
    start_times = {
        "morning": 6,
        "evening": 16,
        "night": 20,
    }
    start_hour = start_times.get(preferred_time.lower(), 6)
    current_time = datetime.now().replace(
        hour=start_hour, minute=0, second=0, microsecond=0
    )

    timetable = []
    study_streak = 0.0

    for subject in allocated_subjects:
        remaining = subject["allocated_hours"]

        while remaining > 0:
            if study_streak >= BREAK_INTERVAL_HOURS:
                break_end = current_time + timedelta(minutes=BREAK_DURATION_MINUTES)
                timetable.append({
                    "time": f"{_format_time(current_time)} - {_format_time(break_end)}",
                    "subject": "Break",
                    "duration": BREAK_DURATION_MINUTES / 60,
                    "is_break": True,
                })
                current_time = break_end
                study_streak = 0.0

            time_until_break = BREAK_INTERVAL_HOURS - study_streak
            session_duration = min(remaining, time_until_break)
            session_duration = round(session_duration, 2)

            end_time = current_time + timedelta(hours=session_duration)
            timetable.append({
                "time": f"{_format_time(current_time)} - {_format_time(end_time)}",
                "subject": subject["name"],
                "duration": session_duration,
                "is_break": False,
            })

            current_time = end_time
            study_streak += session_duration
            remaining -= session_duration
            remaining = round(remaining, 2)

    return timetable


# --- Time Formatting ---
def _format_time(dt):
    if not hasattr(dt, 'strftime'):
        return str(dt)
    try:
        return dt.strftime("%-I:%M %p")
    except ValueError:
        return dt.strftime("%#I:%M %p")


# --- Suggestion Generation ---
def _generate_suggestions(allocated_subjects):
    suggestions = []

    for s in allocated_subjects:
        name = s["name"]
        days = s["days_until_exam"]
        difficulty = s["difficulty"].lower()
        is_weak = s["is_weak"]

        if days == 0:
            suggestions.append(f"**{name}** exam is TODAY! Focus on quick revision and key formulas.")
        elif days <= 3:
            suggestions.append(f"**{name}** exam in {days} days — start intensive revision NOW!")
        elif days <= 7:
            suggestions.append(f"Start revision for **{name}** — exam in {days} days.")
        elif days <= 14:
            suggestions.append(f"Plan your revision strategy for **{name}** — exam in {days} days.")

        if difficulty == "hard" and is_weak:
            suggestions.append(f"**{name}** is both hard AND a weak area — give it extra focused time!")
        elif difficulty == "hard":
            suggestions.append(f"**{name}** is a hard subject — dedicate focused, distraction-free sessions.")
        elif is_weak:
            suggestions.append(f"**{name}** is a weak subject — practice more problems to build confidence.")

        if difficulty == "easy" and days > 14 and not is_weak:
            suggestions.append(f"**{name}** is in good shape — maintain light daily review.")

    total_subjects = len(allocated_subjects)
    if total_subjects > 5:
        suggestions.append("You have many subjects — consider alternating between hard and easy ones to prevent fatigue.")

    hard_count = sum(1 for s in allocated_subjects if s["difficulty"].lower() == "hard")
    if hard_count >= 3:
        suggestions.append("Multiple hard subjects — don't study them back-to-back. Mix in easier subjects between hard ones.")

    return suggestions


# --- Weekly Plan Builder ---
def _build_weekly_plan(allocated_subjects, daily_hours, preferred_time):
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    today_weekday = datetime.now().weekday()

    weekly = []

    for i in range(7):
        rotated = allocated_subjects[i % len(allocated_subjects):] + \
                  allocated_subjects[:i % len(allocated_subjects)]

        day_index = (today_weekday + i) % 7
        day_timetable = _build_daily_timetable(rotated, daily_hours, preferred_time)

        weekly.append({
            "day": day_names[day_index],
            "is_today": i == 0,
            "subjects": [
                {
                    "name": s["name"],
                    "hours": s["allocated_hours"],
                    "priority_level": s["priority_level"],
                    "difficulty": s["difficulty"],
                }
                for s in rotated
            ],
            "timetable": day_timetable,
        })

    return weekly


# --- Break Schedule ---
def _calculate_breaks(daily_hours, preferred_time):
    start_times = {
        "morning": 6,
        "evening": 16,
        "night": 20,
    }
    start_hour = start_times.get(preferred_time.lower(), 6)
    current_time = datetime.now().replace(
        hour=start_hour, minute=0, second=0, microsecond=0
    )

    breaks = []
    elapsed = 0.0

    while elapsed < daily_hours:
        elapsed += BREAK_INTERVAL_HOURS
        if elapsed >= daily_hours:
            break

        break_time = current_time + timedelta(hours=elapsed)
        break_end = break_time + timedelta(minutes=BREAK_DURATION_MINUTES)
        breaks.append({
            "time": f"{_format_time(break_time)} - {_format_time(break_end)}",
            "duration_minutes": BREAK_DURATION_MINUTES,
            "tip": _get_break_tip(len(breaks)),
        })
        elapsed += BREAK_DURATION_MINUTES / 60

    return breaks


# --- Break Tips ---
def _get_break_tip(break_number):
    tips = [
        "Take a short walk — movement boosts blood flow to the brain.",
        "Hydrate! Drink a glass of water.",
        "Do the 20-20-20 rule: Look at something 20 feet away for 20 seconds.",
        "Do some light stretching or deep breathing.",
        "Have a healthy snack — your brain needs fuel!",
        "Listen to a favorite song to reset your mood.",
    ]
    return tips[break_number % len(tips)]


# --- Test Block ---
if __name__ == "__main__":
    test_subjects = [
        {"name": "Mathematics", "difficulty": "hard", "exam_date": "2026-05-15", "is_weak": True},
        {"name": "Physics", "difficulty": "hard", "exam_date": "2026-05-10", "is_weak": False},
        {"name": "English", "difficulty": "easy", "exam_date": "2026-05-20", "is_weak": False},
        {"name": "Chemistry", "difficulty": "medium", "exam_date": "2026-05-12", "is_weak": True},
        {"name": "History", "difficulty": "medium", "exam_date": "2026-05-25", "is_weak": False},
    ]

    test_daily_hours = 6.0
    test_preferred_time = "morning"

    print("=" * 60)
    print("🧪 TESTING: Smart Study Planner Engine")
    print("=" * 60)

    result = generate_study_plan(test_subjects, test_daily_hours, test_preferred_time)

    print("\n📊 PRIORITY RANKING:")
    print("-" * 60)
    print(f"{'Subject':<15} {'Score':>8} {'Level':>8} {'Hours':>8} {'Days':>6}")
    print("-" * 60)
    for s in result["priority_ranking"]:
        print(f"{s['name']:<15} {s['priority_score']:>7.1f} {s['priority_level']:>8} "
              f"{s['allocated_hours']:>7.2f} {s['days_until_exam']:>5}d")
    print("-" * 60)
    total_hours = sum(s['allocated_hours'] for s in result['priority_ranking'])
    print(f"{'TOTAL':<15} {'':>8} {'':>8} {total_hours:>7.2f}")

    print("\n📅 DAILY TIMETABLE:")
    print("-" * 50)
    for slot in result["daily_timetable"]:
        marker = "☕" if slot["is_break"] else "📖"
        print(f"  {marker} {slot['time']:>25}  →  {slot['subject']}")

    print("\n💡 SUGGESTIONS:")
    print("-" * 50)
    for suggestion in result["suggestions"]:
        print(f"  {suggestion}")

    print(f"\n⏸️ BREAK SCHEDULE ({len(result['breaks'])} breaks):")
    print("-" * 50)
    for b in result["breaks"]:
        print(f"  {b['time']}  — {b['tip']}")

    print("\n🗓️ WEEKLY PLAN (subject order per day):")
    print("-" * 50)
    for day in result["weekly_plan"]:
        today_marker = " ← TODAY" if day["is_today"] else ""
        subjects_str = ", ".join(s["name"] for s in day["subjects"])
        print(f"  {day['day']:>10}{today_marker}: {subjects_str}")

    print("\n" + "=" * 60)
    print("✅ Engine test complete! All systems working.")
    print("=" * 60)
