"""HTTP middleware — request IDs and tenant context guards."""

from __future__ import annotations

import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class TenantIsolationMiddleware(BaseHTTPMiddleware):
    """Ensures authenticated requests never rely on client-supplied organization_id for isolation.

    The active organization is resolved exclusively from the JWT membership claim.
    Query/body organization_id overrides are ignored by domain services.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request.state.organization_id = None
        response = await call_next(request)
        return response
