from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List

# --- SCHEMAS BASE (Atributos comunes) ---

class EmpresaBase(BaseModel):
    nombre: str
    cuit: str

class SucursalBase(BaseModel):
    nombre: str
    tarifa_hora: float = Field(gt=0, description="La tarifa debe ser mayor a cero")

class TorreBase(BaseModel):
    numero: int
    capacidad: int
    aplica_descuento: bool = False

class UsuarioBase(BaseModel):
    email: EmailStr
    rol: str # "superAdmin", "adminSede", "operador"

class VehiculoBase(BaseModel):
    patente: str = Field(..., min_length=6, max_length=10)

# --- SCHEMAS PARA CREACIÓN (Lo que entra por POST) ---

class EmpresaCreate(EmpresaBase):
    pass

class SucursalCreate(SucursalBase):
    empresa_id: int

class TorreCreate(TorreBase):
    sucursal_id: int

class UsuarioCreate(UsuarioBase):
    password: str
    sucursal_id: Optional[int] = None

class EstadiaCreate(BaseModel):
    patente: str = Field(..., min_length=6, max_length=10, example="ABC1234")
    torre_id: int

class EstadiaUpdate(BaseModel):
    # Usado para el cierre de estadía
    usuario_egreso_id: int

# --- SCHEMAS DE RESPUESTA (Lo que sale hacia el cliente) ---
# Incluyen el ID y heredan de la base.

class TorreOut(TorreBase):
    id: int
    class Config:
        from_attributes = True # Permite leer objetos de SQLAlchemy

class SucursalOut(SucursalBase):
    id: int
    empresa_id: int
    torres: List[TorreOut] = [] # Anidamos las torres que tiene la sede
    class Config:
        from_attributes = True

class EstadiaOut(BaseModel):
    id: int
    vehiculo_id: int
    torre_id: int
    usuario_ingreso_id: int
    usuario_salida_id: Optional[int] = None
    fecha_entrada: datetime
    fecha_salida: Optional[datetime] = None
    monto: float
    estado: str
    
    class Config:
        from_attributes = True

class UsuarioOut(UsuarioBase):
    id: int
    sucursal_id: Optional[int]
    class Config:
        from_attributes = True

class EstadiaDetallada(BaseModel):
    id: int
    patente: str
    fecha_entrada: datetime
    torre_numero: int
    estado: str

    class Config:
        from_attributes = True

class DashboardSummary(BaseModel):
    autos_adentro: int
    capacidad_disponible: int
    porcentaje_ocupacion: float
    recaudacion_hoy: float

    class Config:
        from_attributes = True