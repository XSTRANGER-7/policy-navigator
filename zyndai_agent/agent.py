"""
zyndai_agent/agent.py
=====================
Local implementation of ZyndAIAgent.

This file provides a real Flask-based HTTP webhook server so every agent
actually listens on its configured port and handles:
  GET  /health          → {"status": "ok", "agent": "...", "agent_id": "..."}
  POST /webhook         → fire-and-forget, calls registered message handler
  POST /webhook/sync    → synchronous, waits for set_response() and returns it

The Flask server starts in a background daemon thread when
add_message_handler() is called, so agents only need to call:
    agent.add_message_handler(my_handler)
    while True: time.sleep(60)   ← keeps the process alive
"""

from dataclasses import dataclass, field
from typing import Any, Dict, Callable, Optional
import uuid
import threading
import json
import logging


@dataclass
class AgentConfig:
    name: str = "StubAgent"
    description: str = ""
    capabilities: Dict = field(default_factory=dict)
    mode: str = "webhook"
    webhook_host: str = "0.0.0.0"
    webhook_port: int = 5000
    registry_url: Optional[str] = None
    api_key: Optional[str] = None
    # Optional fields used by premium/x402 agents — ignored by the local server
    price: Optional[str] = None
    config_dir: Optional[str] = None


class ZyndAIAgent:
    """
    ZyndAI Agent — real Flask HTTP server implementation.

    Starts a threaded Flask app on `config.webhook_host:config.webhook_port`
    when `add_message_handler()` is called. Exposes:
      GET  /health
      POST /webhook        (async – no wait for handler result)
      POST /webhook/sync   (sync  – blocks until set_response() is called, max 30 s)
    """

    def __init__(self, agent_config: AgentConfig = None, **kwargs):
        cfg = agent_config or AgentConfig()
        self.config = cfg
        self.agent_id = f"agent:{cfg.name.lower().replace(' ', '-')}:{uuid.uuid4().hex[:6]}"
        self._handler: Optional[Callable] = None
        self._responses: Dict[str, Any] = {}
        self._events: Dict[str, threading.Event] = {}
        self._lock = threading.Lock()
        self._server_started = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def add_message_handler(self, handler: Callable[[Any, str], None]) -> None:
        """Register the message handler and start the HTTP server."""
        self._handler = handler
        self._start_server()

    def set_response(self, message_id: str, response: Any) -> None:
        """Called by the handler to deliver a synchronous response."""
        with self._lock:
            self._responses[message_id] = response
            event = self._events.get(message_id)
        if event:
            event.set()

    # ------------------------------------------------------------------
    # Internal HTTP server
    # ------------------------------------------------------------------

    def _start_server(self) -> None:
        if self._server_started:
            return
        self._server_started = True

        # Import Flask lazily so agents can still import agent.py without
        # Flask installed (although it must be present at runtime).
        try:
            from flask import Flask, request, jsonify
        except ImportError as e:
            raise ImportError(
                "flask is required by ZyndAIAgent. "
                "Run: pip install flask"
            ) from e

        from zyndai_agent.message import AgentMessage

        app = Flask(self.config.name)
        # Suppress verbose werkzeug request logs
        logging.getLogger("werkzeug").setLevel(logging.ERROR)

        agent_ref = self  # capture self for closures

        # ── /health ──────────────────────────────────────────────────
        @app.get("/health")
        def health():
            return jsonify({
                "status":   "ok",
                "agent":    agent_ref.config.name,
                "agent_id": agent_ref.agent_id,
            })

        # ── /webhook (fire-and-forget) ────────────────────────────────
        @app.post("/webhook")
        def webhook():
            body = request.get_json(force=True, silent=True) or {}
            message_id = body.get("message_id") or str(uuid.uuid4())
            msg = AgentMessage(
                message_id=message_id,
                sender_id=body.get("sender_id", ""),
                content=body,
                metadata=body.get("metadata") or {},
            )
            if agent_ref._handler:
                t = threading.Thread(
                    target=_safe_call,
                    args=(agent_ref._handler, msg, body.get("topic", "webhook"), agent_ref.config.name),
                    daemon=True,
                )
                t.start()
            return jsonify({"status": "ok", "message_id": message_id})

        # ── /webhook/sync (synchronous) ───────────────────────────────
        @app.post("/webhook/sync")
        def webhook_sync():
            body = request.get_json(force=True, silent=True) or {}
            message_id = body.get("message_id") or str(uuid.uuid4())

            event = threading.Event()
            with agent_ref._lock:
                agent_ref._events[message_id] = event

            msg = AgentMessage(
                message_id=message_id,
                sender_id=body.get("sender_id", ""),
                content=body,
                metadata=body.get("metadata") or {},
            )

            if agent_ref._handler:
                t = threading.Thread(
                    target=_safe_call,
                    args=(agent_ref._handler, msg, body.get("topic", "webhook"), agent_ref.config.name),
                    daemon=True,
                )
                t.start()
            else:
                return jsonify({"status": "error", "error": "No handler registered", "response": None}), 500

            # Wait up to 60 seconds for set_response() to be called
            finished = event.wait(timeout=60)

            with agent_ref._lock:
                response = agent_ref._responses.pop(message_id, None)
                agent_ref._events.pop(message_id, None)

            if not finished:
                return jsonify({
                    "status":     "timeout",
                    "message_id": message_id,
                    "response":   None,
                }), 504

            return jsonify({
                "status":     "ok",
                "message_id": message_id,
                "response":   response,
            })

        # ── Start Flask in a background thread ────────────────────────
        def _run():
            app.run(
                host=agent_ref.config.webhook_host,
                port=agent_ref.config.webhook_port,
                threaded=True,
                use_reloader=False,
                debug=False,
            )

        t = threading.Thread(target=_run, daemon=True, name=f"{self.config.name}-server")
        t.start()
        print(
            f"[{self.config.name}] HTTP server started → "
            f"http://{self.config.webhook_host}:{self.config.webhook_port}"
        )


# ── Helper ─────────────────────────────────────────────────────────────────────

def _safe_call(handler, msg, topic, agent_name):
    try:
        handler(msg, topic)
    except Exception as exc:
        print(f"[{agent_name}] Handler exception: {exc}")
