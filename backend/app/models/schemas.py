from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from app.core.access_policy import LOCAL_PERMISSIONS, OPERATOR_PERMISSIONS
from datetime import datetime
from typing import Annotated, Optional, List, Literal, Dict
from decimal import Decimal
from uuid import UUID

Money = Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2, allow_inf_nan=False)]
Rate = Annotated[Decimal, Field(gt=0, max_digits=14, decimal_places=2, allow_inf_nan=False)]
VehicleCategory = Literal["AUTO", "MOTO", "CAMIONETA"]
PaymentMethod = Literal["EFECTIVO", "DEBITO", "CREDITO", "QR", "TRANSFERENCIA"]

# --- SCHEMAS BASE (Atributos comunes) ---

class EmpresaBase(BaseModel):
    nombre: str
    cuit: str

class SucursalBase(BaseModel):
    nombre: str
    tarifa_auto: Rate
    tarifa_moto: Rate
    tarifa_camioneta: Rate
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
    model_config = ConfigDict(extra="forbid")
    patente: str = Field(..., min_length=6, max_length=10, example="ABC1234")
    torre_id: int = Field(gt=0, le=2147483647)
    caja_id: int = Field(gt=0, le=2147483647)
    tipo: VehicleCategory

    @field_validator("patente")
    @classmethod
    def valid_plate(cls, value):
        value = value.strip().upper()
        if not value.isascii() or not value.isalnum() or not 6 <= len(value) <= 10:
            raise ValueError("La patente debe tener entre 6 y 10 letras o números")
        return value

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
    fecha_entrada: datetime = Field(validation_alias=AliasChoices("fecha_entrada_publica", "fecha_entrada"))
    fecha_salida: Optional[datetime] = Field(None, validation_alias=AliasChoices("fecha_salida_publica", "fecha_salida"))
    monto: Money
    metodo_pago: Optional[str] = None   
    estado: str
    sucursal_id: int
    caja_ingreso_id: Optional[int] = None
    caja_id: Optional[int] = None
    cotizacion_id: Optional[str] = None
    
    class Config:
        from_attributes = True

class UsuarioOut(UsuarioBase):
    id: int
    sucursal_id: Optional[int]
    activo: bool = True
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
    recaudacion_hoy: Optional[Money] = None

    class Config:
        from_attributes = True

class HourlyRevenue(BaseModel):
    hora: int  # 0 a 23
    monto: Money

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
    tarifa_auto: Optional[Rate] = None
    tarifa_moto: Optional[Rate] = None
    tarifa_camioneta: Optional[Rate] = None
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

class CierreCajaCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    notas: Optional[str] = Field(None, max_length=1000)

class CierreCajaFinalizar(BaseModel):
    model_config = ConfigDict(extra="forbid")
    monto_real: Money
    notas: Optional[str] = Field(None, max_length=1000)

class CierreCajaOut(BaseModel):
    id: int
    fecha_apertura: datetime = Field(validation_alias=AliasChoices("fecha_apertura_publica", "fecha_apertura"))
    fecha_cierre: Optional[datetime] = Field(None, validation_alias=AliasChoices("fecha_cierre_publica", "fecha_cierre"))
    monto_esperado: Money
    monto_real: Optional[Money]
    estado: str
    usuario_id: int
    diferencia: Decimal
    fondo_inicial: Money
    recaudacion_total: Optional[Money] = None
    totales_por_medio: Optional[Dict[str, Money]] = None
    notas: Optional[str] = None
    origen_datos: str
    
    class Config:
        from_attributes = True

class CajaOperativaOut(BaseModel):
    id: int
    fecha_apertura: datetime = Field(validation_alias=AliasChoices("fecha_apertura_publica", "fecha_apertura"))
    fecha_cierre: Optional[datetime] = Field(None, validation_alias=AliasChoices("fecha_cierre_publica", "fecha_cierre"))
    estado: str
    usuario_id: int

    model_config = ConfigDict(from_attributes=True)


class SalidaConfirmar(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cotizacion_id: UUID
    caja_id: int = Field(gt=0, le=2147483647)
    metodo_pago: PaymentMethod


class CotizacionOut(BaseModel):
    id: str
    estadia_id: int
    sucursal_id: int
    usuario_id: int
    calculada_en: datetime
    vence_en: datetime
    monto: Money
    moneda: str = "ARS"
    origen_reglas: str
    explicacion: dict
    model_config = ConfigDict(from_attributes=True)


class FechaHeredadaRevision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    fecha_entrada_utc: datetime
    motivo: str = Field(min_length=8, max_length=500)

    @field_validator("fecha_entrada_utc")
    @classmethod
    def explicit_offset(cls, value):
        if value.utcoffset() is None:
            raise ValueError("La revisión debe indicar una zona u offset explícitos")
        return value

class UserCreateInternal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str
    rol: str = "OPERADOR"
    permisos: List[str] = Field(default_factory=lambda: ["ingreso", "salida"])

    @field_validator("rol")
    @classmethod
    def local_role(cls, value):
        role = value.strip().upper()
        if role not in {"ADMIN", "OPERADOR"}:
            raise ValueError("Sólo se pueden crear ADMIN u OPERADOR locales")
        return role

    @field_validator("permisos")
    @classmethod
    def known_permissions(cls, values):
        if any(value not in LOCAL_PERMISSIONS for value in values):
            raise ValueError("Permiso no concedible")
        return sorted(set(values))

    @model_validator(mode="after")
    def local_permissions(self):
        if self.rol == "OPERADOR" and not set(self.permisos) <= OPERATOR_PERMISSIONS:
            raise ValueError("Ese permiso requiere ADMIN local")
        return self

class TenantProvision(BaseModel):
    nombre_empresa: str
    cuit: str
    email_admin: str
    password_admin: str
