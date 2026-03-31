from __future__ import annotations

import base64
import hashlib
import hmac
import time

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings

_bearer = HTTPBearer(auto_error=False)


def _sign(payload: str, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def create_access_token(username: str, settings: Settings) -> tuple[str, int]:
    exp = int(time.time()) + settings.auth_token_ttl_seconds
    payload = f"{username}|{exp}"
    sig = _sign(payload, settings.auth_secret_key)
    token_raw = f"{username}|{exp}|{sig}"
    token = base64.urlsafe_b64encode(token_raw.encode("utf-8")).decode("utf-8")
    return token, exp


def verify_access_token(token: str, settings: Settings) -> dict:
    try:
        decoded = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
        username, exp_s, sig = decoded.split("|", 2)
        exp = int(exp_s)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido") from exc

    expected = _sign(f"{username}|{exp}", settings.auth_secret_key)
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Assinatura inválida")

    if exp < int(time.time()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")

    return {"username": username, "exp": exp}


def require_admin(
    cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> dict:
    if cred is None or cred.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token obrigatório")
    data = verify_access_token(cred.credentials, settings)
    if data["username"] != settings.admin_user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário sem permissão")
    return data

