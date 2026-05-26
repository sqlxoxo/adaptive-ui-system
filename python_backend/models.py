from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    level = Column(String, default="Novice") # Novice or Expert
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    tasks = relationship("Task", back_populates="owner")
    logs = relationship("TelemetryLog", back_populates="user")

class Task(Base):
    __tablename__ = 'tasks'
    
    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, default="")
    status = Column(String, default="todo") # todo, inprogress, done
    priority = Column(String, default="medium") # low, medium, high
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    user_id = Column(String, ForeignKey('users.id'))
    
    owner = relationship("User", back_populates="tasks")

class TelemetryLog(Base):
    __tablename__ = 'telemetry_logs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey('users.id'), index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Behavior metrics
    errors_count = Column(Integer, default=0)
    hover_time = Column(Float, default=0.0)
    first_task_duration = Column(Float, default=0.0)
    shortcut_count = Column(Integer, default=0)
    actions_count = Column(Integer, default=0)
    total_time = Column(Float, default=0.0)
    
    user = relationship("User", back_populates="logs")

# Helper to initiate local sandbox database
DATABASE_URL = "sqlite:///./adaptive_tasks.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
