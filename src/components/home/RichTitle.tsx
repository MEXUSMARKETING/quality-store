import { Fragment } from "react";

/** Admin title text: "\n" = line break, *text* = gold highlight (e.g. "מגפוני חורף\n*מ־₪140* בלבד"). */
export default function RichTitle({ text, accent = "text-gold" }: { text: string; accent?: string }) {
  const lines = String(text || "").split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.split(/(\*[^*]+\*)/g).map((part, j) =>
            /^\*[^*]+\*$/.test(part) ? (
              <span key={j} className={accent}>{part.slice(1, -1)}</span>
            ) : (
              <Fragment key={j}>{part}</Fragment>
            )
          )}
        </Fragment>
      ))}
    </>
  );
}
