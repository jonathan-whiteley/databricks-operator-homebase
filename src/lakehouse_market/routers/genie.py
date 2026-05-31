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


class AskResponse(BaseModel):
    text: str
    conversation_id: str
    message_id: str


def _strip_markdown(text: str) -> str:
    """Minimal markdown bold/italic strip so the chat bubble doesn't show asterisks."""
    # **bold** → bold, *italic* → italic
    import re as _re
    text = _re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = _re.sub(r"(?<!\*)\*([^*]+?)\*(?!\*)", r"\1", text)
    return text


def _extract_answer(message: dict, conversation_id: str, message_id: str) -> str:
    """Genie returns its natural-language answer in message.content (with markdown);
    attachments carry the SQL + raw data. For the chat surface we show only the
    polished answer — the SQL/rows are debug-grade for the demo."""
    # Primary: the polished narrative answer
    content = (message.get("content") or "").strip()

    # Fallback: if content is empty, paraphrase from the query description
    if not content:
        for att in message.get("attachments", []) or []:
            t = att.get("text") or {}
            if isinstance(t, dict) and t.get("content"):
                content = t["content"]
                break
            q = att.get("query") or {}
            desc = q.get("description") or ""
            if desc:
                content = desc
                break

    return _strip_markdown(content).strip()


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

    # start-conversation often returns COMPLETED synchronously; only poll if not.
    if started.get("status") in {"COMPLETED", "FAILED"} and started.get("attachments"):
        message = started
    else:
        message = poll_message(conv, msg_id)

    text = _extract_answer(message, conv, msg_id)
    if not text:
        text = f"(Genie returned status {message.get('status', 'UNKNOWN')} with no content)"
    return {"text": text, "conversation_id": conv, "message_id": msg_id}
