from fastapi import FastAPI
from app.api.v1 import parking
from app.core.database import engine, Base

# Crea las tablas
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ParkingCentral SaaS")

# Incluimos las rutas versionadas
app.include_router(parking.router, prefix="/api/v1")

@app.get("/")
def health_check():
    return {"status": "online", "version": "v1"}