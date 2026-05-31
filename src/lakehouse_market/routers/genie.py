from fastapi import APIRouter
from pydantic import BaseModel

from ..config import get_settings
from ..genie import create_conversation, poll_message

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


@router.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    if not get_settings().genie_space_id:
        return {
            "text": "Genie isn't configured yet. Create a Genie space in the workspace UI and set GENIE_SPACE_ID on the app.",
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
    final = poll_message(started["conversation_id"], started["message_id"])
    text = ""
    for att in final.get("attachments", []):
        if "text" in att:
            text += att["text"].get("content", "")
    return {
        "text": text or "(no answer)",
        "conversation_id": started["conversation_id"],
        "message_id": started["message_id"],
    }
