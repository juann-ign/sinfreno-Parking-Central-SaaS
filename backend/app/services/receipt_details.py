from datetime import timedelta, timezone


def duracion_estadia(entrada, salida):
    """Duración entre marcas confirmadas, independiente del corte de la cotización."""
    if entrada is None or salida is None or entrada.utcoffset() is None or salida.utcoffset() is None:
        return None
    elapsed = salida.astimezone(timezone.utc) - entrada.astimezone(timezone.utc)
    if elapsed < timedelta(0):
        return None
    minutes = elapsed // timedelta(minutes=1)
    if minutes == 0:
        return "Menos de 1 min"
    hours, remainder = divmod(minutes, 60)
    return f"{hours} h {remainder:02d} min" if hours else f"{minutes} min"
