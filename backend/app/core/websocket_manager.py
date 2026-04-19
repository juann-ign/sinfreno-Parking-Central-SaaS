from fastapi import WebSocket
from typing import List

class ConnectionManager:
    """
    Gestiona las conexiones activas de WebSockets para 
    notificaciones en tiempo real.
    """
    def __init__(self):
        # Lista de clientes conectados (navegadores abiertos)
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Envía un mensaje a todos los conectados."""
        for connection in self.active_connections:
            await connection.send_json(message)

# Instancia global para usar en toda la app
manager = ConnectionManager()