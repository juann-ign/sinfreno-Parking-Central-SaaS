from fastapi import WebSocket
from typing import List, Dict
import asyncio
import logging

logger = logging.getLogger("sinfreno")

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
        s_id = int(sucursal_id)

        # Si la sucursal no tiene lista de conexiones, la creamos
        if s_id not in self.active_connections:
            self.active_connections[s_id] = []

        # Agregamos este navegador a la "habitación" de su sucursal
        self.active_connections[s_id].append(websocket)
        logger.info (f"🔌 WebSocket conectado: Sucursal {s_id}. Total activos: {len(self.active_connections[s_id])}")

    def disconnect(self, websocket: WebSocket, sucursal_id: int):
         # Quitamos el navegador de la lista para no enviar mensajes a un fantasma
        s_id = int(sucursal_id)
        if s_id in self.active_connections:
            if websocket in self.active_connections[s_id]:
                self.active_connections[s_id].remove(websocket)
                logger.info(f"❌ WebSocket desconectado: Sucursal {s_id}")


    async def broadcast(self, message: dict, sucursal_id: int):
        s_id = int(sucursal_id)
        # Creamos una lista de tareas para enviar a todos en paralelo
        if s_id in self.active_connections:
            logger.info(f"📡 Enviando Broadcast a sucursal {s_id}: {message['event']}")
            for connection in self.active_connections[s_id][:]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"⚠️ Error enviando a un socket: {e}")
                    self.active_connections[s_id].remove(connection)
# Instancia global para usar en toda la app
manager = ConnectionManager()