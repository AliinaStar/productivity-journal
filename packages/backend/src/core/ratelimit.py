"""Shared rate limiter.

Backed by slowapi. The limiter keys requests by client IP. For multi-instance
production deployments, configure ``storage_uri`` (e.g. Redis) so limits are
shared across processes; the in-memory default is per-process only.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
