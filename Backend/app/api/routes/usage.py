from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import cast, Date, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.usage import UsageLog
from app.models.user import User
from app.schemas.usage import DailyUsage, EndpointUsage, UsageSummary

router = APIRouter(prefix="/api/usage", tags=["usage"])


@router.get("/summary", response_model=UsageSummary)
async def usage_summary(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = func.now() - timedelta(days=days)

    totals_result = await db.execute(
        select(
            func.coalesce(func.sum(UsageLog.prompt_tokens), 0),
            func.coalesce(func.sum(UsageLog.completion_tokens), 0),
        ).where(UsageLog.user_id == current_user.id, UsageLog.created_at >= since)
    )
    prompt_tokens, completion_tokens = totals_result.one()

    by_day_result = await db.execute(
        select(
            cast(UsageLog.created_at, Date).label("day"),
            func.coalesce(func.sum(UsageLog.prompt_tokens), 0),
            func.coalesce(func.sum(UsageLog.completion_tokens), 0),
        )
        .where(UsageLog.user_id == current_user.id, UsageLog.created_at >= since)
        .group_by("day")
        .order_by("day")
    )
    by_day = [
        DailyUsage(day=row[0], prompt_tokens=row[1], completion_tokens=row[2], total_tokens=row[1] + row[2])
        for row in by_day_result.all()
    ]

    by_endpoint_result = await db.execute(
        select(UsageLog.endpoint, func.coalesce(func.sum(UsageLog.total_tokens), 0))
        .where(UsageLog.user_id == current_user.id, UsageLog.created_at >= since)
        .group_by(UsageLog.endpoint)
    )
    by_endpoint = [EndpointUsage(endpoint=row[0], total_tokens=row[1]) for row in by_endpoint_result.all()]

    return UsageSummary(
        total_tokens=prompt_tokens + completion_tokens,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        by_day=by_day,
        by_endpoint=by_endpoint,
    )
