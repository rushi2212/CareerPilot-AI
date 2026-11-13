"""Small server-side provider adapter. Secrets are never exposed to the client."""
import json
import re
import httpx
from .config import settings


def configured_provider() -> str | None:
    name = settings.ai_provider.strip().lower()
    key = {"openai": settings.openai_api_key, "groq": settings.groq_api_key, "gemini": settings.gemini_api_key}.get(name)
    return name if key else None


def _extract_json(text: str) -> dict | None:
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.I)
    try:
        value = json.loads(cleaned)
        return value if isinstance(value, dict) else None
    except json.JSONDecodeError:
        return None


def generate_json(system: str, user: str, temperature: float = 0.2) -> dict | None:
    """Return validated-at-caller JSON when a supported provider is configured."""
    provider = configured_provider()
    if provider is None:
        return None
    try:
        if provider in ("openai", "groq"):
            key = settings.openai_api_key if provider == "openai" else settings.groq_api_key
            base = "https://api.openai.com/v1" if provider == "openai" else "https://api.groq.com/openai/v1"
            default_model = "gpt-4o-mini" if provider == "openai" else "openai/gpt-oss-20b"
            response = httpx.post(f"{base}/chat/completions", headers={"Authorization": f"Bearer {key}"}, json={"model": settings.ai_model or default_model, "temperature": temperature, "response_format": {"type": "json_object"}, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}, timeout=45)
            response.raise_for_status()
            return _extract_json(response.json()["choices"][0]["message"]["content"])
        response = httpx.post(f"https://generativelanguage.googleapis.com/v1beta/models/{settings.ai_model or 'gemini-2.0-flash'}:generateContent", params={"key": settings.gemini_api_key}, json={"system_instruction": {"parts": [{"text": system}]}, "contents": [{"parts": [{"text": user}]}], "generationConfig": {"responseMimeType": "application/json", "temperature": temperature}}, timeout=45)
        response.raise_for_status()
        return _extract_json(response.json()["candidates"][0]["content"]["parts"][0]["text"])
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        return None
