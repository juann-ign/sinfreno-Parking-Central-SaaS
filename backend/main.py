from fastapi import FastAPI
from backend.app.api.v1 import parking


app = FastAPI(title="Sinfreno Parking Central")

# Incluimos las rutas versionadas
app.include_router(parking.router, prefix="/api/v1")

@app.get("/")
def health_check():
    return {"status": "online", "version": "v1"}