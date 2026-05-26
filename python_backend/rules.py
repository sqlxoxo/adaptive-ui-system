def analyze_user_level(metrics: dict) -> dict:

    score = 50  # Starting neutral midpoint score
    
    # Increase score for using quick actions (hotkeys/shortcuts)
    shortcut_count = metrics.get('shortcut_count', 0)
    score += shortcut_count * 12
    
    # Decrease score for user validation/interaction errors
    errors_count = metrics.get('errors_count', 0)
    score -= errors_count * 10
    
    # High mouse wander time indicates uncertainty/hesitation
    hover_time = metrics.get('hover_time', 0.0)
    if hover_time > 15.0:
        score -= 15
    elif 0 < hover_time < 6.0:
        score += 10
        
    # Swiftness in completing first task
    first_task_duration = metrics.get('first_task_duration', 0.0)
    if first_task_duration > 45.0:
        score -= 12
    elif 0 < first_task_duration < 20.0:
        score += 15
        
    # Engagement and action density
    actions_count = metrics.get('actions_count', 0)
    if actions_count > 25 and shortcut_count > 4:
        score += 10
        
    # Cap score boundaries
    score = max(0, min(100, score))
    
    # Determine the level
    if score < 45:
        level = "Novice"
    else:
        level = "Expert"
        
    return {
        "score": score,
        "level": level
    }

def get_ui_configuration(level: str, score: int) -> dict:

    if level == "Novice":
        return {
            "level": "Novice",
            "score": score,
            "showHelperTooltips": True,
            "showInteractiveGuide": True,
            "showSimpleView": True,
            "showDetailedAnalytics": False,
            "showAdvancedFilters": False,
            "showQuickActionsPanel": False,
            "buttonSize": "large",
            "message": "Спрощений інтерфейс з підказками для легкого старту."
        }
    else:
        return {
            "level": "Expert",
            "score": score,
            "showHelperTooltips": False,
            "showInteractiveGuide": False,
            "showSimpleView": False,
            "showDetailedAnalytics": True,
            "showAdvancedFilters": True,
            "showQuickActionsPanel": True,
            "buttonSize": "compact",
            "message": "Високопродуктивний компактний інтерфейс для швидкої роботи."
        }
