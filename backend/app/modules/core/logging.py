import logging
import contextvars
from typing import Optional

request_id_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("request_id", default=None)
user_id_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("user_id", default=None)
booking_id_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("booking_id", default=None)
venue_id_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("venue_id", default=None)

class StructuredLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        req_id = request_id_ctx.get()
        user_id = user_id_ctx.get()
        booking_id = booking_id_ctx.get()
        venue_id = venue_id_ctx.get()

        extras = []
        if req_id:
            extras.append(f"req_id={req_id}")
        if user_id:
            extras.append(f"user_id={user_id}")
        if booking_id:
            extras.append(f"booking_id={booking_id}")
        if venue_id:
            extras.append(f"venue_id={venue_id}")

        record.structured_info = "[" + " ".join(extras) + "] " if extras else ""

        # Format time and message properly
        record.asctime = self.formatTime(record, self.datefmt)
        msg = record.getMessage()
        return f"{record.asctime} {record.name} {record.levelname} {record.structured_info}{msg}"

def setup_logging():
    root_logger = logging.getLogger()
    if not root_logger.handlers:
        handler = logging.StreamHandler()
        root_logger.addHandler(handler)
        root_logger.setLevel(logging.INFO)
    
    formatter = StructuredLogFormatter()
    for handler in root_logger.handlers:
        handler.setFormatter(formatter)
        
    for logger_name in ("uvicorn", "uvicorn.access", "uvicorn.error", "groundkart"):
        logger = logging.getLogger(logger_name)
        if not logger.handlers:
            logger.addHandler(logging.StreamHandler())
        for handler in logger.handlers:
            handler.setFormatter(formatter)
        logger.setLevel(logging.INFO)
        # Prevent double logging
        logger.propagate = False
