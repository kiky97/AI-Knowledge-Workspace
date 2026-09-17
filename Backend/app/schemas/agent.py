from pydantic import BaseModel


class AgentMessage(BaseModel):
    role: str
    content: str


class AgentRequest(BaseModel):
    messages: list[AgentMessage]
