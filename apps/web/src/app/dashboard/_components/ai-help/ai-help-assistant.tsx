"use client";

import {
  FormEvent,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { askAiHelpAction } from "../../_lib/ai-help/actions";
import { ORBIQ_AI_HELP_FAQ } from "../../_lib/ai-help/faq";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  meta?: string;
};

function sourceLabel(
  source: "faq" | "llm" | "memory",
  cached: boolean,
) {
  if (cached || source === "memory") {
    return "Memória da oficina";
  }
  if (source === "llm") {
    return "Assistente Orbiq";
  }
  return "Guia Orbiq";
}

function renderAnswerText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

export function AiHelpAssistant() {
  const panelId = useId();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement | null>(null);

  const suggestions = useMemo(
    () => ORBIQ_AI_HELP_FAQ.slice(0, 4).map((entry) => entry.question),
    [],
  );

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  const submitQuestion = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || pending) {
        return;
      }

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: trimmed,
      };

      setMessages((current) => [...current, userMessage]);
      setQuestion("");
      setError(null);
      scrollToBottom();

      startTransition(async () => {
        const result = await askAiHelpAction(trimmed);
        if (!result.ok) {
          setError(result.error);
          scrollToBottom();
          return;
        }

        setMessages((current) => [
          ...current,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: result.answer,
            meta: sourceLabel(result.source, result.cached),
          },
        ]);
        scrollToBottom();
      });
    },
    [pending, scrollToBottom],
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitQuestion(question);
  }

  return (
    <div className="orbiq-ai-help" data-testid="orbiq-ai-help">
      {open ? (
        <section
          id={panelId}
          className="orbiq-ai-help-panel"
          data-testid="orbiq-ai-help-panel"
          aria-label="Assistente Orbiq"
        >
          <header className="orbiq-ai-help-header">
            <div>
              <p className="orbiq-ai-help-eyebrow">Ajuda Orbiq</p>
              <h2>Assistente da oficina</h2>
              <p className="orbiq-ai-help-subtitle">
                Pergunte como criar orçamento, cotar peças, falar com o cliente
                ou navegar o painel.
              </p>
            </div>
            <button
              type="button"
              className="orbiq-ai-help-close"
              aria-label="Fechar ajuda"
              data-testid="orbiq-ai-help-close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>

          <div
            className="orbiq-ai-help-messages"
            ref={listRef}
            data-testid="orbiq-ai-help-messages"
          >
            {messages.length === 0 ? (
              <div className="orbiq-ai-help-empty">
                <p>
                  Exemplos rápidos — toque para perguntar:
                </p>
                <ul>
                  {suggestions.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        className="orbiq-ai-help-suggestion"
                        data-testid="orbiq-ai-help-suggestion"
                        onClick={() => submitQuestion(suggestion)}
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "orbiq-ai-help-bubble is-user"
                      : "orbiq-ai-help-bubble is-assistant"
                  }
                  data-testid={
                    message.role === "user"
                      ? "orbiq-ai-help-user-message"
                      : "orbiq-ai-help-assistant-message"
                  }
                >
                  {message.meta ? (
                    <span className="orbiq-ai-help-meta">{message.meta}</span>
                  ) : null}
                  <p>{renderAnswerText(message.text)}</p>
                </article>
              ))
            )}
            {pending ? (
              <p
                className="orbiq-ai-help-pending"
                data-testid="orbiq-ai-help-pending"
              >
                Consultando…
              </p>
            ) : null}
            {error ? (
              <p
                className="orbiq-ai-help-error"
                data-testid="orbiq-ai-help-error"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </div>

          <form className="orbiq-ai-help-form" onSubmit={onSubmit}>
            <label className="visually-hidden" htmlFor={inputId}>
              Sua pergunta
            </label>
            <textarea
              id={inputId}
              name="question"
              rows={2}
              maxLength={1000}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Como faço para…?"
              data-testid="orbiq-ai-help-input"
              disabled={pending}
            />
            <button
              type="submit"
              className="orbiq-ai-help-send"
              data-testid="orbiq-ai-help-send"
              disabled={pending || question.trim().length < 3}
            >
              Perguntar
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className="orbiq-ai-help-fab"
        data-testid="orbiq-ai-help-fab"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="orbiq-ai-help-fab-label">
          {open ? "Fechar ajuda" : "Ajuda"}
        </span>
      </button>
    </div>
  );
}
