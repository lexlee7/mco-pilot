"""Connexion base de données.

En local : SQLite (aucune installation nécessaire).
Sur Render : PostgreSQL si la variable d'environnement DATABASE_URL est fournie.
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./mco.db")

# Render fournit des URL "postgres://" que SQLAlchemy 2.x n'accepte plus tel quel.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """Dépendance FastAPI : ouvre une session par requête et la referme."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
