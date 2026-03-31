from __future__ import annotations

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import create_access_token, require_admin
from app.core.config import Settings, get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginInput(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(data: LoginInput, settings: Settings = Depends(get_settings)):
    if data.username != settings.admin_user or data.password != settings.admin_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")

    token, exp = create_access_token(settings.admin_user, settings)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_at": exp,
        "user": settings.admin_user,
    }


@router.get("/me")
async def me(user=Depends(require_admin)):
    return {"user": user["username"], "exp": user["exp"]}

