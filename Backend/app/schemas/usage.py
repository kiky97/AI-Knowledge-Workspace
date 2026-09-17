from datetime import date

from pydantic import BaseModel


class DailyUsage(BaseModel):
    day: date
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class EndpointUsage(BaseModel):
    endpoint: str
    total_tokens: int


class UsageSummary(BaseModel):
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    by_day: list[DailyUsage]
    by_endpoint: list[EndpointUsage]
