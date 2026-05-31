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


def _extract_answer(message: dict, conversation_id: str, message_id: str) -> str:
    """Genie attachments may contain a plain `text.content` OR a `query` with
    a description + SQL + rows fetched separately. Stitch them into a single
    chat-friendly string."""
    chunks: list[str] = []
    for att in message.get("attachments", []) or []:
        t = att.get("text") or {}
        if isinstance(t, dict) and t.get("content"):
            chunks.append(t["content"])
        q = att.get("query") or {}
        if q:
            desc = q.get("description") or ""
            if desc:
                chunks.append(desc)
            # Try to fetch the data and render a compact table preview
            attachment_id = att.get("attachment_id")
            if attachment_id:
                result = fetch_query_result(conversation_id, message_id, attachment_id)
                rows = (
                    result.get("statement_response", {})
                    .get("result", {})
                    .get("data_array")
                ) or result.get("data_array")
                schema_cols = (
                    result.get("statement_response", {})
                    .get("manifest", {})
                    .get("schema", {})
                    .get("columns", [])
                )
                if rows:
                    headers = [c.get("name", "?") for c in schema_cols] if schema_cols else []
                    preview = []
                    if headers:
                        preview.append(" · ".join(headers))
                    for row in rows[:5]:
                        preview.append(" · ".join(str(v) for v in row))
                    if len(rows) > 5:
                        preview.append(f"… {len(rows) - 5} more rows")
                    chunks.append("\n".join(preview))
    # Fallback to message.content if no attachments
    if not chunks and message.get("content"):
        chunks.append(message["content"])
    return "\n\n".join(chunks).strip()


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
