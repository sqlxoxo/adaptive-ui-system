from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

# Import local models and rules
from models import init_db, SessionLocal, User, Task, TelemetryLog
from rules import analyze_user_level, get_ui_configuration

app = FastAPI(title="Adaptive Task API", description="Python FastAPI equivalent backend for Task Management")

# Setup CORS to allow React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session tracking current live metrics
live_session_metrics = {
    "errors_count": 0,
    "hover_time": 0.0,
    "first_task_duration": 0.0,
    "shortcut_count": 0,
    "actions_count": 0,
    "total_time": 0.0
}

# Dependency for DB sessions
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Schemas
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    status: Optional[str] = "todo"
    priority: Optional[str] = "medium"

class TaskResponse(BaseModel):
    id: str
    title: str
    description: str
    status: str
    priority: str
    
    class Config:
        orm_mode = True

class TelemetryPayload(BaseModel):
    errorsCount: int
    hoverTime: float
    firstTaskDuration: float
    shortcutCount: int
    actionsCount: int
    totalTime: float

# Routes

@app.on_event("startup")
def on_startup():
    init_db()
    # Create default user if not exists
    db = SessionLocal()
    demo_user = db.query(User).filter(User.id == "user-demo").first()
    if not demo_user:
        new_user = User(id="user-demo", name="user", level="Novice")
        db.add(new_user)
        db.commit()
    db.close()

@app.get("/api/tasks", response_model=List[TaskResponse])
def get_tasks(db=Depends(get_db)):
    tasks = db.query(Task).all()
    return tasks

@app.post("/api/tasks", response_model=TaskResponse)
def create_task(payload: TaskCreate, db=Depends(get_db)):
    if not payload.title or payload.title.strip() == "":
        live_session_metrics["errors_count"] += 1
        live_session_metrics["actions_count"] += 1
        raise HTTPException(status_code=400, detail="Назва задачі не може бути порожньою!")
        
    task_id = f"task-{int(SessionLocal().execute('SELECT strftime(\"%s\",\"now\")').fetchone()[0] * 1000)}"
    new_task = Task(
        id=task_id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        user_id="user-demo"
    )
    db.add(new_task)
    
    live_session_metrics["actions_count"] += 1
    db.commit()
    db.refresh(new_task)
    return new_task

@app.post("/api/telemetry")
def submit_telemetry(payload: TelemetryPayload, db=Depends(get_db))
    # Sync core state
    live_session_metrics["errors_count"] = payload.errorsCount
    live_session_metrics["hover_time"] = payload.hoverTime
    if payload.firstTaskDuration > 0:
        live_session_metrics["first_task_duration"] = payload.firstTaskDuration
    live_session_metrics["shortcut_count"] = payload.shortcutCount
    live_session_metrics["actions_count"] = payload.actionsCount
    live_session_metrics["total_time"] = payload.totalTime
    
    analysis = analyze_user_level(live_session_metrics)
    
    # Save log row to SQL database
    new_log = TelemetryLog(
        user_id="user-demo",
        errors_count=payload.errorsCount,
        hover_time=payload.hoverTime,
        first_task_duration=live_session_metrics["first_task_duration"],
        shortcut_count=payload.shortcutCount,
        actions_count=payload.actionsCount,
        total_time=payload.totalTime
    )
    db.add(new_log)
    
    # Sync level back to User profile
    user_model = db.query(User).filter(User.id == "user-demo").first()
    if user_model:
        user_model.level = analysis["level"]
        
    db.commit()
    return {
        "success": True,
        "score": analysis["score"],
        "level": analysis["level"],
        "activeTelemetry": live_session_metrics
    }

@app.get("/api/ui-config")
def get_ui_config():
    analysis = analyze_user_level(live_session_metrics)
    config = get_ui_configuration(analysis["level"], analysis["score"])
    return config

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
