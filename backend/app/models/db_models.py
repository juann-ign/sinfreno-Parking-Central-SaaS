from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Boolean, JSON, Index, CheckConstraint, UniqueConstraint, text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.timezone_utils import get_now_local
from datetime import datetime, timezone
from decimal import Decimal


def utc_now():
    return datetime.now(timezone.utc)

class Empresa(Base):
    __tablename__ = "empresas"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True)
    cuit = Column(String, unique=True)
    # --- Campos White Label  ---
    logo_url = Column(String, nullable=True) 
    color_primario = Column(String, default="#2563eb") 
    # --------------------------
    sucursales = relationship("Sucursal", back_populates="empresa")

class Sucursal(Base):
    __tablename__ = "sucursales"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String)

    # Tarifas por categoría (Flexibilidad total)
    tarifa_auto = Column(Numeric(14, 2), default=Decimal("1000.00"))
    tarifa_moto = Column(Numeric(14, 2), default=Decimal("500.00"))
    tarifa_camioneta = Column(Numeric(14, 2), default=Decimal("1500.00"))

     # Configuración de fracciones
    tiempo_cortesia_min = Column(Integer, default=10)
    fraccion_minutos = Column(Integer, default=15) # Cada cuánto se cobra la fracción (ej: 15 min)

    empresa_id = Column(Integer, ForeignKey("empresas.id"))
    empresa = relationship("Empresa", back_populates="sucursales")
    torres = relationship("Torre", back_populates="sucursal")
    usuarios = relationship("Usuario", back_populates="sucursal")

class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True)
    password_hash = Column(String)
    permisos = Column(String, default="ingreso,salida")
    rol = Column(String) # superAdmin, adminSede o operador
    sucursal_id = Column(Integer, ForeignKey("sucursales.id"), nullable=True)
    activo = Column(Boolean, nullable=False, default=True, server_default=text("true"))

    sucursal = relationship("Sucursal", back_populates="usuarios")
    # Relaciones de auditoría
    estadias_ingresadas = relationship("Estadia", foreign_keys="[Estadia.usuario_ingreso_id]", back_populates="usuario_ingreso")
    estadias_finalizadas = relationship("Estadia", foreign_keys="[Estadia.usuario_salida_id]", back_populates="usuario_salida")

class Torre(Base):
    __tablename__ = "torres"
    id = Column(Integer, primary_key=True, index=True)
    numero = Column(Integer)
    capacidad = Column(Integer)
    porcentaje_descuento = Column(Numeric(7, 6), default=Decimal("0"))
    sucursal_id = Column(Integer, ForeignKey("sucursales.id"))
    
    sucursal = relationship("Sucursal", back_populates="torres")
    estadias = relationship("Estadia", back_populates="torre")

class Vehiculo(Base):
    __tablename__ = "vehiculos"
    id = Column(Integer, primary_key=True, index=True)
    patente = Column(String, unique=True, index=True)
    tipo = Column(String, default="AUTO") # Auto, Moto, Camioneta, etc.

    estadias = relationship("Estadia", back_populates="vehiculo")

class Estadia(Base):
    __tablename__ = "estadias"
    __table_args__ = (
        Index("uq_estadia_activa_sucursal_vehiculo", "sucursal_id", "vehiculo_id", unique=True,
              postgresql_where=text("estado = 'ACTIVO'")),
        CheckConstraint("monto >= 0", name="ck_estadia_monto_no_negativo"),
    )
    id = Column(Integer, primary_key=True, index=True)
    vehiculo_id = Column(Integer, ForeignKey("vehiculos.id"))
    torre_id = Column(Integer, ForeignKey("torres.id"))
    sucursal_id = Column(Integer, ForeignKey("sucursales.id"), nullable=False)
    caja_ingreso_id = Column(Integer, ForeignKey("cierres_caja.id"), nullable=True)
    caja_id = Column(Integer, ForeignKey("cierres_caja.id"), nullable=True)
    
    # Auditoría de empleados
    usuario_ingreso_id = Column(Integer, ForeignKey("usuarios.id")) 
    usuario_salida_id = Column(Integer, ForeignKey("usuarios.id"))
    
    fecha_entrada = Column(DateTime, default=lambda: utc_now().replace(tzinfo=None))
    fecha_salida = Column(DateTime, nullable=True)
    fecha_entrada_utc = Column(DateTime(timezone=True), nullable=True)
    fecha_salida_utc = Column(DateTime(timezone=True), nullable=True)
    monto = Column(Numeric(14, 2), default=Decimal("0.00"))
    metodo_pago = Column(String, nullable=True) # "EFECTIVO", "DEBITO", "QR"
    estado = Column(String, default="ACTIVO") # ACTIVO o FINALIZADO
    # El registro global de patente no puede cambiar la categoría de otra sede.
    tipo_vehiculo_registrado = Column(String, nullable=True)
    reglas_ingreso = Column(JSON, nullable=True)
    cotizacion_id = Column(String(36), nullable=True)

    # Relationships inversos (necesarios para acceder a estadia.vehiculo.patente)
    vehiculo = relationship("Vehiculo", back_populates="estadias")
    torre = relationship("Torre", back_populates="estadias")
    usuario_ingreso = relationship("Usuario", foreign_keys=[usuario_ingreso_id], back_populates="estadias_ingresadas")
    usuario_salida = relationship("Usuario", foreign_keys=[usuario_salida_id], back_populates="estadias_finalizadas")
    
    # Añadimos esto para que la estadía sepa responder su patente directamente
    @property
    def patente(self):
        return self.vehiculo.patente if self.vehiculo else "S/D"
        
    @property
    def tipo_vehiculo(self):
        if self.tipo_vehiculo_registrado is not None:
            return self.tipo_vehiculo_registrado
        return self.vehiculo.tipo if self.vehiculo else None

    @property
    def fecha_entrada_publica(self):
        return self.fecha_entrada_utc if self.fecha_entrada_utc is not None else self.fecha_entrada

    @property
    def fecha_salida_publica(self):
        return self.fecha_salida_utc if self.fecha_salida_utc is not None else self.fecha_salida

class Auditoria(Base):
    __tablename__ = "auditoria"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    sucursal_id = Column(Integer, ForeignKey("sucursales.id"))
    accion = Column(String)
    detalles = Column(String)
    fecha = Column(DateTime, default=lambda: utc_now().replace(tzinfo=None))

    usuario = relationship("Usuario")
    sucursal = relationship("Sucursal")
    id: int
    usuario_id: int
    sucursal_id: int
    accion: str
    detalles: str
    fecha: datetime

    class Config:
        from_attributes = True

class CierreCaja(Base):
    __tablename__ = "cierres_caja"
    __table_args__ = (
        Index("uq_caja_abierta_sucursal", "sucursal_id", unique=True,
              postgresql_where=text("estado = 'ABIERTA'")),
        CheckConstraint("monto_esperado >= 0 AND (monto_real IS NULL OR monto_real >= 0)", name="ck_caja_importes_no_negativos"),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    sucursal_id = Column(Integer, ForeignKey("sucursales.id"))
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    
    fecha_apertura = Column(DateTime, default=lambda: utc_now().replace(tzinfo=None))
    fecha_cierre = Column(DateTime, nullable=True)
    fecha_apertura_utc = Column(DateTime(timezone=True), nullable=True)
    fecha_cierre_utc = Column(DateTime(timezone=True), nullable=True)
    
    monto_esperado = Column(Numeric(14, 2), default=Decimal("0.00"))
    monto_real = Column(Numeric(14, 2), nullable=True)
    diferencia = Column(Numeric(14, 2), default=Decimal("0.00"))
    fondo_inicial = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"), server_default="0")
    recaudacion_total = Column(Numeric(14, 2), nullable=True)
    totales_por_medio = Column(JSON, nullable=True)
    origen_datos = Column(String(24), nullable=False, default="UTC_POR_TURNO", server_default="HEREDADO_SIN_VINCULO")
    
    estado = Column(String, default="ABIERTA") # ABIERTA, CERRADA
    notas = Column(String, nullable=True)

    usuario = relationship("Usuario")
    sucursal = relationship("Sucursal")

    @property
    def fecha_apertura_publica(self):
        return self.fecha_apertura_utc if self.fecha_apertura_utc is not None else self.fecha_apertura

    @property
    def fecha_cierre_publica(self):
        return self.fecha_cierre_utc if self.fecha_cierre_utc is not None else self.fecha_cierre


class Cotizacion(Base):
    __tablename__ = "cotizaciones"
    id = Column(String(36), primary_key=True)
    estadia_id = Column(Integer, ForeignKey("estadias.id"), nullable=False)
    sucursal_id = Column(Integer, ForeignKey("sucursales.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    calculada_en = Column(DateTime(timezone=True), nullable=False)
    vence_en = Column(DateTime(timezone=True), nullable=False)
    monto = Column(Numeric(14, 2), nullable=False)
    origen_reglas = Column(String(32), nullable=False)
    explicacion = Column(JSON, nullable=False)
    reglas = Column(JSON, nullable=False)


class OperacionIdempotente(Base):
    __tablename__ = "operaciones_idempotentes"
    __table_args__ = (UniqueConstraint("sucursal_id", "tipo", "clave", name="uq_operacion_idempotente"),)
    id = Column(Integer, primary_key=True)
    sucursal_id = Column(Integer, ForeignKey("sucursales.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    tipo = Column(String(24), nullable=False)
    clave = Column(String(128), nullable=False)
    huella = Column(String(64), nullable=False)
    respuesta = Column(JSON, nullable=False)
    creada_en = Column(DateTime(timezone=True), nullable=False, default=utc_now)
