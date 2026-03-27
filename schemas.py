from pydantic import BaseModel
from typing import Optional

class IngresoVehiculo(BaseModel):
    patente: str
    torre_id: int

class EstadiaResponse(BaseModel):
    id: int
    vehiculo_id: int
    torre_id: int
    estado: str
    class Config:
        from_attributes = True