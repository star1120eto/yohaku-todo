"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { isEmptyRichText, normalizeRichText } from "@/lib/richTextConfig";

export type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Cmd/Ctrl+Enter が押されたときに呼ばれる(コメント送信のショートカット等)。 */
  onModEnter?: () => void;
  "aria-label"?: string;
};

/**
 * URL の自動リンク化・リンク付きテキストの貼り付けに対応したリッチテキスト入力欄。
 * メモ・コメント欄で共通に使う。
 */
export function RichTextEditor({
  value,
  onChange,
  disabled,
  placeholder,
  className,
  onModEnter,
  "aria-label": ariaLabel,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        link: {
          openOnClick: false, // 編集中にクリックしても遷移しない
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: "https",
          protocols: ["http", "https", "mailto", "tel"],
          HTMLAttributes: {
            target: "_blank",
            rel: "noopener noreferrer",
          },
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: normalizeRichText(value),
    onUpdate: ({ editor: e }) => {
      onChange(isEmptyRichText(e.getHTML()) ? "" : e.getHTML());
    },
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && onModEnter) {
          event.preventDefault();
          onModEnter();
          return true;
        }
        return false;
      },
    },
  });

  // 外部(親コンポーネント)からの value 更新をエディタへ反映する。
  // 自分自身の onUpdate による無限ループ・カーソル位置リセットを避けるため、
  // 現在の内容と異なる場合のみ setContent する。
  useEffect(() => {
    if (!editor) return;
    const next = normalizeRichText(value);
    const current = editor.getHTML();
    if (next !== current && !(isEmptyRichText(next) && isEmptyRichText(current))) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <div
      className={`rte-content rte-editor ${disabled ? "rte-disabled" : ""} ${className ?? ""}`}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

export default RichTextEditor;
