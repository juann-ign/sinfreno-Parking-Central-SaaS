from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base
import datetime

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
    tarifa_auto = Column(Float, default=1000.0)
    tarifa_moto = Column(Float, default=500.0)
    tarifa_camioneta = Column(Float, default=1500.0)

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
    # Guardaremos una lista separada por comas: "ingreso,salida,stats,config"
    permisos = Column(String, default="ingreso,salida")
    rol = Column(String) # superAdmin, adminSede o operador
    sucursal_id = Column(Integer, ForeignKey("sucursales.id"))

    sucursal = relationship("Sucursal", back_populates="usuarios")
    # Relaciones de auditoría
    estadias_ingresadas = relationship("Estadia", foreign_keys="[Estadia.usuario_ingreso_id]", back_populates="usuario_ingreso")
    estadias_finalizadas = relationship("Estadia", foreign_keys="[Estadia.usuario_salida_id]", back_populates="usuario_salida")

class Torre(Base):
    __tablename__ = "torres"
    id = Column(Integer, primary_key=True, index=True)
    numero = Column(Integer)
    capacidad = Column(Integer)
    porcentaje_descuento = Column(Float, default=0.0) # Ejemplo: 0.15 para 15%
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
    id = Column(Integer, primary_key=True, index=True)
    vehiculo_id = Column(Integer, ForeignKey("vehiculos.id"))
    torre_id = Column(Integer, ForeignKey("torres.id"))
    
    # Auditoría de empleados
    usuario_ingreso_id = Column(Integer, ForeignKey("usuarios.id")) 
    usuario_salida_id = Column(Integer, ForeignKey("usuarios.id"))
    
    fecha_entrada = Column(DateTime, default=datetime.datetime.utcnow)
    fecha_salida = Column(DateTime, nullable=True)
    monto = Column(Float, default=0.0)
    estado = Column(String, default="ACTIVO") # ACTIVO o FINALIZADO

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
        return self.vehiculo.tipo if self.vehiculo else "AUTO"

class Auditoria(Base):
    __tablename__ = "auditoria"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    sucursal_id = Column(Integer, ForeignKey("sucursales.id"))
    accion = Column(String)
    detalles = Column(String)
    fecha = Column(DateTime, default=datetime.datetime.utcnow)

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