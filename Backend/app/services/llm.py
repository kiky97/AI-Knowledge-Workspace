from typing import Any, AsyncIterator

from openai import AsyncOpenAI

from app.core.config import settings

_client = AsyncOpenAI(
    api_key=settings.OPENAI_API_KEY,
    base_url=settings.OPENAI_BASE_URL or None,
)


async def embed_texts(texts: list[str]) -> tuple[list[list[float]], int]:
    response = await _client.embeddings.create(model=settings.EMBEDDING_MODEL, input=texts)
    return [item.embedding for item in response.data], response.usage.total_tokens


async def stream_chat_completion(
    messages: list[dict[str, str]],
) -> AsyncIterator[dict[str, Any]]:
    """Yields {'type': 'token', 'text': str} for each delta, then a final
    {'type': 'usage', 'prompt_tokens': int, 'completion_tokens': int}."""
    stream = await _client.chat.completions.create(
        model=settings.CHAT_MODEL,
        messages=messages,
        stream=True,
        stream_options={"include_usage": True},
    )
    async for chunk in stream:
        if chunk.usage is not None:
            yield {
                "type": "usage",
                "prompt_tokens": chunk.usage.prompt_tokens,
                "completion_tokens": chunk.usage.completion_tokens,
            }
        if chunk.choices:
            delta = chunk.choices[0].delta.content
            if delta:
                yield {"type": "token", "text": delta}


async def chat_completion_with_tools(
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
):
    """Non-streaming call used to let the model decide whether to call a tool."""
    response = await _client.chat.completions.create(
        model=settings.CHAT_MODEL,
        messages=messages,
        tools=tools,
        tool_choice="auto",
    )
    return response.choices[0].message, response.usage
