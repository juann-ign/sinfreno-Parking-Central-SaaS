from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List

# --- SCHEMAS BASE (Atributos comunes) ---

class EmpresaBase(BaseModel):
    nombre: str
    cuit: str

class SucursalBase(BaseModel):
    nombre: str
    tarifa_auto: float = Field(gt=0)
    tarifa_moto: float = Field(gt=0)
    tarifa_camioneta: float = Field(gt=0)
    tiempo_cortesia_min: int = Field(default=10, ge=0)
    fraccion_minutos: int = Field(default=15, ge=1)
    
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
    tipo: str

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
    patente: str
    tipo_vehiculo: str
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

class EstadiaPaginated(BaseModel): 
    total: int 
    page: int 
    pages: int 
    items: List[EstadiaOut] 
    
    class Config: 
        from_attributes = True

class DashboardSummary(BaseModel):
    autos_adentro: int
    capacidad_disponible: int
    porcentaje_ocupacion: float
    recaudacion_hoy: float

    class Config:
        from_attributes = True

class HourlyRevenue(BaseModel):
    hora: int  # 0 a 23
    monto: float

    class Config:
        from_attributes = True

class PeakHour(BaseModel):
    hora_pico: Optional[int]  # Puede ser None si no hay datos
    volumen: int
    
    class Config:
        from_attributes = True

# Nuevo esquema para actualizar la sucursal
class SucursalUpdate(BaseModel):
    nombre: Optional[str] = None
    tarifa_auto: Optional[float] = Field(None, gt=0)
    tarifa_moto: Optional[float] = Field(None, gt=0)
    tarifa_camioneta: Optional[float] = Field(None, gt=0)
    tiempo_cortesia_min: Optional[int] = Field(None, ge=0)
    fraccion_minutos: Optional[int] = Field(None, ge=1)
    logo_url: Optional[str] = None
    color_primario: Optional[str] = None

class AuditoriaOut(BaseModel):
    id: int
    usuario_id: int
    sucursal_id: int
    accion: str
    detalles: str
    fecha: datetime

    class Config:
        from_attributes = True