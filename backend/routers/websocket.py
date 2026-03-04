"""WebSocket router for real-time federation updates."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from gnn.federated_engine import federation_state

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/federation")
async def federation_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time training updates."""
    await websocket.accept()
    federation_state._ws_connections.add(websocket)
    
    try:
        while True:
            # Keep connection alive, handle client messages
            data = await websocket.receive_text()
            # Client can send ping/pong or commands
            if data == "ping":
                await websocket.send_text('{"event": "pong"}')
    except WebSocketDisconnect:
        federation_state._ws_connections.discard(websocket)
    except Exception:
        federation_state._ws_connections.discard(websocket)
