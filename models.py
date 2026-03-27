from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Sucursal(Base):
    __tablename__ = "sucursales"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String)
    tarifa_hora = Column(Float)
    torres = relationship("Torre", back_populates="sucursal")

class Torre(Base):
    __tablename__ = "torres"
    id = Column(Integer, primary_key=True, index=True)
    numero = Column(Integer)
    sucursal_id = Column(Integer, ForeignKey("sucursales.id"))
    sucursal = relationship("Sucursal", back_populates="torres")

class Vehiculo(Base):
    __tablename__ = "vehiculos"
    id = Column(Integer, primary_key=True, index=True)
    patente = Column(String, unique=True, index=True)

class Estadia(Base):
    __tablename__ = "estadias"
    id = Column(Integer, primary_key=True, index=True)
    vehiculo_id = Column(Integer, ForeignKey("vehiculos.id"))
    torre_id = Column(Integer, ForeignKey("torres.id"))
    fecha_entrada = Column(DateTime, default=datetime.datetime.now)
    fecha_salida = Column(DateTime, nullable=True)
    monto = Column(Float, default=0.0)
    estado = Column(String, default="ACTIVO") # ACTIVO o FINALIZADO