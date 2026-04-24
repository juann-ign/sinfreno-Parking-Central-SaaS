class SinfrenoException(Exception):
    """Base para todas las excepciones del sistema"""
    pass

class VehiculoYaPresenteError(SinfrenoException):
    def __init__(self, patente: str):
        self.message = f"El vehículo con patente {patente} ya se encuentra en el predio."
        super().__init__(self.message)

class EstadiaNoEncontradaError(SinfrenoException):
    def __init__(self, patente: str):
        self.message = f"No hay registros de ingreso activos para la patente {patente}."
        super().__init__(self.message)