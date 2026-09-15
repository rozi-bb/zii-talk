"""Akun: daftar, masuk, keluar, dan cek siapa yang lagi login."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from server import auth, db

router = APIRouter(prefix="/api/auth", tags=["Akun"])


class CredentialsIn(BaseModel):
    # sengaja tanpa validasi pydantic: pesan error-nya dibikin sendiri biar kebaca
    email: str = ""
    password: str = ""


class UserOut(BaseModel):
    id: int
    email: str
    role: Literal["admin", "user"]


class MeOut(BaseModel):
    user: UserOut | None  # null = belum login
    firstAccount: bool  # belum ada akun sama sekali: yang daftar duluan jadi admin


def _out(u: auth.User) -> UserOut:
    return UserOut(id=u.id, email=u.email, role=u.role)


def _error(status: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": message})


@router.get("/me", response_model=MeOut, summary="Akun yang lagi login (null kalau belum)")
async def me(request: Request) -> MeOut:
    user = await auth.user_from(request)
    return MeOut(
        user=_out(user) if user else None,
        firstAccount=False if user else not await auth.has_users(),
    )


@router.post("/register", response_model=UserOut, status_code=201, summary="Daftar akun baru, langsung login")
async def register(body: CredentialsIn, request: Request, response: Response):
    email = auth.norm_email(body.email)
    problem = auth.check_credentials(email, body.password)
    if problem:
        return _error(400, problem)

    hashed = await auth.hash_password(body.password)
    async with (await db.pool()).connection() as conn, conn.transaction():
        user = await auth.create_user(conn, email, hashed)
        if user is None:
            return _error(409, "Email ini udah terdaftar. Masuk aja.")
        await auth.start_session(conn, user.id, request, response)
    return _out(user)


@router.post("/login", response_model=UserOut, summary="Masuk pakai email & password")
async def login(body: CredentialsIn, request: Request, response: Response):
    email = auth.norm_email(body.email)
    if not email or not body.password:
        return _error(400, "Isi email dan password-nya dulu")

    wait = auth.wait_seconds(email)
    if wait:
        return _error(429, f"Kebanyakan salah password. Coba lagi dalam {wait} detik.")

    row = await db.fetch_one("SELECT id, email, role, password_hash FROM users WHERE lower(email) = %s", (email,))
    stored = row["password_hash"] if row else None
    if len(body.password) > auth.MAX_PASSWORD or not await auth.verify_password(body.password, stored):
        auth.record_fail(email)
        wait = auth.wait_seconds(email)
        if wait:
            return _error(429, f"Email atau password salah. Kebanyakan salah — coba lagi dalam {wait} detik.")
        return _error(401, "Email atau password salah")

    assert row is not None
    auth.clear_fails(email)
    async with (await db.pool()).connection() as conn:
        await auth.start_session(conn, row["id"], request, response)
    return UserOut(id=row["id"], email=row["email"], role=row["role"])


@router.post("/logout", summary="Keluar: hapus sesi login di server & cookie-nya")
async def logout(request: Request, response: Response) -> dict[str, bool]:
    await auth.end_session(request, response)
    return {"ok": True}
