from fastapi import WebSocket
from typing import List, Dict

class ConnectionManager:
    """
    Gestiona las conexiones activas de WebSockets para 
    notificaciones en tiempo real.
    """
    def __init__(self):
        # Lista de clientes conectados (navegadores abiertos)
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, sucursal_id: int):
        await websocket.accept()

        # Si la sucursal no tiene lista de conexiones, la creamos
        if sucursal_id not in self.active_connections:
            self.active_connections[sucursal_id] = []

        # Agregamos este navegador a la "habitación" de su sucursal
        self.active_connections[sucursal_id].append(websocket)

    def disconnect(self, websocket: WebSocket, sucursal_id: int):
         # Quitamos el navegador de la lista para no enviar mensajes a un fantasma
        if sucursal_id in self.active_connections:
            self.active_connections[sucursal_id].remove(websocket)

    async def broadcast(self, message: dict, sucursal_id: int):
        # Solo buscamos a los conectados en ESA sucursal específica
        if sucursal_id in self.active_connections:
            for connection in self.active_connections[sucursal_id]:
                # Enviamos el mensaje en formato JSON (texto que entiende JS
                await connection.send_json(message)

# Instancia global para usar en toda la app
manager = ConnectionManager()