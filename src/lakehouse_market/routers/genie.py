from fastapi import APIRouter
from pydantic import BaseModel

from ..config import get_settings
from ..genie import create_conversation, fetch_query_result, poll_message

router = APIRouter(prefix="/api/genie", tags=["genie"])

TAB_LABELS = {
    "labor": "Labor",
    "loyalty": "Loyalty",
    "supply": "Supply Chain",
    "sentiment": "Sentiment",
    "maintenance": "Maintenance",
}


class AskRequest(BaseModel):
    tab_id: str
    store_id: int
    question: str


class AskTable(BaseModel):
    headers: list[str]
    rows: list[list[str]]
    extra_rows: int = 0


class AskResponse(BaseModel):
    text: str
    table: AskTable | None = None
    conversation_id: str
    message_id: str


def _strip_markdown(text: str) -> str:
    """Minimal markdown bold/italic strip so the chat bubble doesn't show asterisks."""
    # **bold** → bold, *italic* → italic
    import re as _re
    text = _re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = _re.sub(r"(?<!\*)\*([^*]+?)\*(?!\*)", r"\1", text)
    return text


def _extract_answer(
    message: dict, conversation_id: str, message_id: str
) -> tuple[str, AskTable | None]:
    """Genie's reply lives in attachments — `message.content` is the USER prompt
    echoed back, not Genie's answer. Walk attachments and assemble prose from any
    text attachments + query descriptions; return the FIRST data preview as a
    structured table so the frontend can render it as an actual <table>."""
    chunks: list[str] = []
    table: AskTable | None = None
    for att in message.get("attachments") or []:
        t = att.get("text") or {}
        if isinstance(t, dict) and t.get("content"):
            chunks.append(t["content"])
        q = att.get("query") or {}
        if q:
            desc = q.get("description") or ""
            if desc:
                chunks.append(desc)
            attachment_id = att.get("attachment_id")
            if attachment_id and table is None:
                result = fetch_query_result(conversation_id, message_id, attachment_id)
                sr = result.get("statement_response") or {}
                rows = (sr.get("result") or {}).get("data_array") or result.get("data_array")
                cols = (sr.get("manifest") or {}).get("schema", {}).get("columns") or []
                if rows:
                    headers = [c.get("name", "?") for c in cols]
                    preview = [[_fmt(v) for v in row] for row in rows[:5]]
                    table = AskTable(
                        headers=headers,
                        rows=preview,
                        extra_rows=max(0, len(rows) - 5),
                    )
    # Last-resort fallback: only use message.content if it doesn't look like our prompt
    if not chunks:
        content = (message.get("content") or "").strip()
        if content and not content.startswith("Context: tab="):
            chunks.append(content)
    return _strip_markdown("\n\n".join(chunks)).strip(), table


def _fmt(v) -> str:
    """Compact value renderer for the data preview."""
    if v is None:
        return "—"
    try:
        f = float(v)
        if f != int(f):
            return f"{f:.2f}"
        return str(int(f))
    except (TypeError, ValueError):
        return str(v)


@router.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    if not get_settings().genie_space_id:
        return {
            "text": "Genie isn't configured yet. Create a Genie space and set GENIE_SPACE_ID on the app.",
            "conversation_id": "",
            "message_id": "",
        }
    label = TAB_LABELS.get(req.tab_id, req.tab_id)
    full = (
        f"Context: tab={label}, store_id={req.store_id}. "
        "Scope all answers to this store unless asked otherwise.\n\n"
        f"Question: {req.question}"
    )
    started = create_conversation(full)
    conv = started["conversation_id"]
    msg_id = started["message_id"]

    # Always poll: start-conversation typically returns before Genie has finished
    # composing its reply. Use the started envelope only if it's already terminal
    # AND already has attachments (rare).
    if started.get("status") in {"COMPLETED", "FAILED"} and started.get("attachments"):
        message = started
    else:
        message = poll_message(conv, msg_id)

    text, table = _extract_answer(message, conv, msg_id)
    if not text and table is None:
        text = f"(Genie returned status {message.get('status', 'UNKNOWN')} with no answer)"
    return {
        "text": text,
        "table": table,
        "conversation_id": conv,
        "message_id": msg_id,
    }
