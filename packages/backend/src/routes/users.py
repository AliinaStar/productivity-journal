from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select

from src.core.dependencies import get_current_user
from src.db.models import User
from src.db.session import get_async_sessionmaker

router = APIRouter(prefix="/users", tags=["users"])


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    language: str | None = None
    gender: str | None = None


class ProfileResponse(BaseModel):
    id: int
    name: str
    email: str
    language: str
    gender: str | None


@router.get("/me", response_model=ProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
) -> ProfileResponse:
    return ProfileResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        language=current_user.language,
        gender=current_user.gender,
    )


@router.patch("/me", response_model=ProfileResponse)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
) -> ProfileResponse:
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        result = await session.execute(select(User).where(User.id == current_user.id))
        user = result.scalars().first()

        if body.name is not None:
            user.name = body.name
        if body.language is not None:
            user.language = body.language
        if body.gender is not None:
            user.gender = body.gender

        await session.commit()
        await session.refresh(user)

    return ProfileResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        language=user.language,
        gender=user.gender,
    )
