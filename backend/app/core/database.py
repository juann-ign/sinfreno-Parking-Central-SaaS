from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# The same validated URL is used by authentication, migrations and API sessions.
DATABASE_URL = settings.DATABASE_URL

engine = create_engine(
    DATABASE_URL, 
    # check_same_thread solo es necesario para SQLite
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
