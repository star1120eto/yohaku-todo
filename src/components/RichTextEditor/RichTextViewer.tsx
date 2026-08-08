"use client";

import { useMemo } from "react";
import { normalizeRichText } from "@/lib/richTextConfig";
import { sanitizeForDisplay } from "./sanitizeClient";

export type RichTextViewerProps = {
  html: string;
  className?: string;
};

/**
 * 保存済みのリッチテキスト(HTML)を安全に表示する。
 * 旧形式のプレーンテキスト(タグを含まない保存値)もそのまま表示できる。
 */
export function RichTextViewer({ html, className }: RichTextViewerProps) {
  const safeHtml = useMemo(
    () => sanitizeForDisplay(normalizeRichText(html)),
    [html]
  );
  if (!safeHtml) return null;
  return (
    <div
      className={`rte-content text-sm whitespace-normal ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}

export default RichTextViewer;
