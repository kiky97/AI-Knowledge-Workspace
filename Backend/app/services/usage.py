import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.usage import UsageLog


async def log_usage(
    db: AsyncSession,
    user_id: uuid.UUID,
    endpoint: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> None:
    db.add(
        UsageLog(
            user_id=user_id,
            endpoint=endpoint,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
        )
    )
    await db.commit()
