import { useEffect, useRef, useState } from "react";
import { Send, MessageCircle } from "lucide-react";
import { useApp } from "../../app/provider";
import { PageTitle, Empty } from "../../components/ui";
import { initials } from "../../lib/format";
export default function MessagesPage({ route }: { route: string }) {
  const { data, user, execute } = useApp();
  const [selected, setSelected] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const conversations = data.conversations.filter(
    (c) => c.ownerId === user?.id || c.tenantId === user?.id,
  );
  const listingId = new URLSearchParams(route.split("?")[1]).get("listing");
  const conversationId = new URLSearchParams(route.split("?")[1]).get(
    "conversation",
  );
  const openFromUrl = new URLSearchParams(route.split("?")[1]).get("open");
  useEffect(() => {
    if (conversationId) setSelected(conversationId);
  }, [conversationId, openFromUrl]);
  const conversation =
    conversations.find((c) => c.id === selected) ||
    conversations.find((c) => c.id === conversationId) ||
    conversations.find((c) => c.listingId === listingId) ||
    conversations[0];
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [conversation?.messages.length]);
  const person = (c: (typeof conversations)[number]) =>
    data.users.find(
      (u) => u.id === (c.ownerId === user?.id ? c.tenantId : c.ownerId),
    )!;
  return (
    <>
      <PageTitle
        title="Tin nhắn"
        description="Trao đổi trực tiếp, giữ lại thông tin thống nhất giữa hai bên."
      />
      {!conversations.length ? (
        <Empty
          title="Bắt đầu một cuộc trò chuyện"
          description="Người thuê có thể nhắn tin từ trang chi tiết phòng. Chủ trọ sẽ thấy cuộc hội thoại tại đây."
          action={
            <a href="#/" className="btn primary">
              Khám phá phòng
            </a>
          }
        />
      ) : (
        <section className="messaging">
          <aside>
            {conversations.map((c) => (
              <button
                className={conversation?.id === c.id ? "active" : ""}
                key={c.id}
                onClick={() => setSelected(c.id)}
              >
                <span className="avatar">{initials(person(c).name)}</span>
                <div>
                  <strong>{person(c).name}</strong>
                  <small>
                    {c.messages.at(-1)?.body || "Bắt đầu trao đổi về phòng"}
                  </small>
                </div>
              </button>
            ))}
          </aside>
          <div className="chat-panel">
            <header>
              <span className="avatar">
                {initials(person(conversation).name)}
              </span>
              <div>
                <strong>{person(conversation).name}</strong>
                <a href={`#/room/${conversation.listingId}`}>
                  {
                    data.listings.find((l) => l.id === conversation.listingId)
                      ?.title
                  }
                </a>
              </div>
            </header>
            <div className="chat-messages">
              {!conversation.messages.length && (
                <div className="chat-start">
                  <MessageCircle size={30} />
                  <p>Hãy bắt đầu bằng câu hỏi về phòng hoặc lịch xem.</p>
                </div>
              )}
              {conversation.messages.map((m) => (
                <div
                  className={`message ${m.senderId === user?.id ? "mine" : ""}`}
                  key={m.id}
                >
                  <div>{m.body}</div>
                  <small>
                    {new Date(m.createdAt).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </div>
              ))}
              <div ref={bottom} />
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!body.trim()) return;
                setBusy(true);
                if (
                  await execute({
                    type: "message.send",
                    payload: { id: conversation.id, body },
                  })
                )
                  setBody("");
                setBusy(false);
              }}
            >
              <input
                aria-label="Nội dung tin nhắn"
                placeholder="Viết tin nhắn của bạn…"
                value={body}
                maxLength={3000}
                onChange={(e) => setBody(e.target.value)}
              />
              <button
                disabled={busy || !body.trim()}
                className="btn primary"
                aria-label="Gửi tin nhắn"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </section>
      )}
    </>
  );
}
