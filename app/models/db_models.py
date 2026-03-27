from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base
import datetime

class Empresa(Base):
    __tablename__ = "empresas"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True)
    cuit = Column(String, unique=True)
    
    sucursales = relationship("Sucursal", back_populates="empresa")

class Sucursal(Base):
    __tablename__ = "sucursales"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String)
    tarifa_hora = Column(Float)
    empresa_id = Column(Integer, ForeignKey("empresas.id"))

    empresa = relationship("Empresa", back_populates="sucursales")
    torres = relationship("Torre", back_populates="sucursal")
    usuarios = relationship("Usuario", back_populates="sucursal")

class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True)
    password_hash = Column(String)
    rol = Column(String) # superAdmin, adminSede o operador
    sucursal_id = Column(Integer, ForeignKey("sucursales.id"))

    sucursal = relationship("Sucursal", back_populates="usuarios")
    # Relaciones de auditoría
    estadias_ingresadas = relationship("Estadia", foreign_keys="[Estadia.usuario_ingreso_id]", back_populates="usuario_ingreso")

class Torre(Base):
    __tablename__ = "torres"
    id = Column(Integer, primary_key=True, index=True)
    numero = Column(Integer)
    capacidad = Column(Integer)
    tiene_descuento = Column(Integer, default=False) 
    sucursal_id = Column(Integer, ForeignKey("sucursales.id"))
    
    sucursal = relationship("Sucursal", back_populates="torres")
    estadias = relationship("Estadia", back_populates="torre")

class Vehiculo(Base):
    __tablename__ = "vehiculos"
    id = Column(Integer, primary_key=True, index=True)
    patente = Column(String, unique=True, index=True)

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