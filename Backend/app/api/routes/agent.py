import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import AsyncSessionLocal, get_db
from app.models.user import User
from app.schemas.agent import AgentRequest
from app.services.llm import chat_completion_with_tools, stream_chat_completion
from app.services.tools import TOOL_DEFINITIONS, CalculatorError, calculate, web_search
from app.services.usage import log_usage

router = APIRouter(prefix="/api/agent", tags=["agent"])

SYSTEM_PROMPT = (
    "You are a helpful assistant with access to a calculator and web search tool. "
    "Use tools when they would make your answer more accurate, then explain the result clearly."
)

MAX_TOOL_ROUNDS = 3


async def _run_tool(name: str, arguments: dict) -> str:
    if name == "calculator":
        try:
            result = calculate(arguments["expression"])
            return json.dumps({"result": result})
        except CalculatorError as exc:
            return json.dumps({"error": str(exc)})
    if name == "web_search":
        try:
            results = await web_search(arguments["query"])
            return json.dumps({"results": results})
        except Exception as exc:  # noqa: BLE001
            return json.dumps({"error": str(exc)})
    return json.dumps({"error": f"Unknown tool {name}"})


@router.post("")
async def agent_chat(
    payload: AgentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += [{"role": m.role, "content": m.content} for m in payload.messages]

    async def event_stream():
        prompt_tokens_total = 0
        completion_tokens_total = 0

        for _ in range(MAX_TOOL_ROUNDS):
            message, usage = await chat_completion_with_tools(messages, TOOL_DEFINITIONS)
            prompt_tokens_total += usage.prompt_tokens
            completion_tokens_total += usage.completion_tokens

            if not message.tool_calls:
                messages.append({"role": "assistant", "content": message.content or ""})
                break

            messages.append(
                {
                    "role": "assistant",
                    "content": message.content or "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                        }
                        for tc in message.tool_calls
                    ],
                }
            )

            for tool_call in message.tool_calls:
                arguments = json.loads(tool_call.function.arguments or "{}")
                yield f"event: tool_call\ndata: {json.dumps({'name': tool_call.function.name, 'arguments': arguments})}\n\n"

                result = await _run_tool(tool_call.function.name, arguments)
                yield f"event: tool_result\ndata: {json.dumps({'name': tool_call.function.name, 'result': json.loads(result)})}\n\n"

                messages.append({"role": "tool", "tool_call_id": tool_call.id, "content": result})
        else:
            messages.append({"role": "assistant", "content": ""})

        full_response = ""
        async for event in stream_chat_completion(messages):
            if event["type"] == "token":
                full_response += event["text"]
                yield f"event: token\ndata: {json.dumps({'text': event['text']})}\n\n"
            elif event["type"] == "usage":
                prompt_tokens_total += event["prompt_tokens"]
                completion_tokens_total += event["completion_tokens"]

        async with AsyncSessionLocal() as save_db:
            await log_usage(
                save_db,
                current_user.id,
                endpoint="agent",
                model=settings.CHAT_MODEL,
                prompt_tokens=prompt_tokens_total,
                completion_tokens=completion_tokens_total,
            )

        yield f"event: done\ndata: {json.dumps({'content': full_response})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
