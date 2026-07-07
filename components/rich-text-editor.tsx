"use client";

import {
  useEditor,
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type Editor,
  type NodeViewProps,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch, API_BASE_URL } from "@/lib/api";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  disableImageUpload?: boolean;
}

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!editor) {
    return null;
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const tempId = Math.random().toString(36).substring(2, 10);
    const tempUrl = URL.createObjectURL(file);

    try {
      setIsUploading(true);
      // setImage's base type only knows { src, alt, title }; our CustomImage
      // extension adds id/isUploading at runtime, so widen the attrs object.
      const placeholderAttrs: Record<string, unknown> = { src: tempUrl, id: tempId, isUploading: true };
      editor.chain().focus().setImage(placeholderAttrs as { src: string }).run();

      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch(`${API_BASE_URL}/quizzes/upload-image`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to upload image");
      const data = await res.json();
      
      if (data.key) {
        const imageUrl = `${API_BASE_URL}/quizzes/images?key=${encodeURIComponent(data.key)}`;
        
        let pos = -1;
        editor.state.doc.descendants((node, p) => {
          if (node.type.name === 'image' && node.attrs.id === tempId) {
            pos = p;
            return false;
          }
        });

        if (pos !== -1) {
          editor.commands.command(({ tr }) => {
            const node = editor.state.doc.nodeAt(pos);
            if (node) {
              tr.setNodeMarkup(pos, null, {
                ...node.attrs,
                src: imageUrl,
                isUploading: false,
              });
            }
            return true;
          });
        }
      }
    } catch {
      toast.error("Failed to upload image. Please try again.");

      let pos = -1;
      editor.state.doc.descendants((node, p) => {
        if (node.type.name === 'image' && node.attrs.id === tempId) {
          pos = p;
          return false;
        }
      });
      if (pos !== -1) {
        editor.commands.command(({ tr }) => {
          const node = editor.state.doc.nodeAt(pos);
          if (node) {
            tr.delete(pos, pos + node.nodeSize);
          }
          return true;
        });
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div style={{ padding: "8px", borderBottom: "1px solid rgba(3,72,82,0.1)", background: "rgba(3,72,82,0.02)", display: "flex", alignItems: "center" }}>
      <button
        type="button"
        onClick={handleUploadClick}
        disabled={isUploading}
        style={{
          background: "rgba(3,72,82,0.05)",
          border: "1px solid rgba(3,72,82,0.15)",
          borderRadius: "4px",
          padding: "6px 12px",
          fontSize: "12px",
          fontWeight: 600,
          color: "#034852",
          cursor: isUploading ? "not-allowed" : "pointer",
          opacity: isUploading ? 0.6 : 1,
        }}
      >
        {isUploading ? "Uploading..." : "Upload Image"}
      </button>
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </div>
  );
};

const ImagePillComponent = (props: NodeViewProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const isUploading = props.node.attrs.isUploading;

  return (
    <NodeViewWrapper as="span" style={{ display: "inline-block", position: "relative", margin: "0 4px", verticalAlign: "middle" }}>
      <span
        onMouseEnter={() => !isUploading && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: props.selected ? "rgba(10, 190, 98, 0.15)" : "rgba(3,72,82,0.08)",
          color: props.selected ? "#0abe62" : "#034852",
          padding: "4px 10px",
          borderRadius: "16px",
          fontSize: "12px",
          fontWeight: 600,
          cursor: isUploading ? "wait" : "pointer",
          border: props.selected ? "1.5px solid #0abe62" : "1.5px solid rgba(3,72,82,0.1)",
          transition: "all 0.2s ease",
          userSelect: "none",
          opacity: isUploading ? 0.7 : 1,
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
        {isUploading ? "Uploading..." : "Image"}
        {isUploading ? (
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", marginLeft: "2px", padding: "2px" }}>
            <svg style={{ animation: "spin 1s linear infinite" }} xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </span>
        ) : (
        <span
          onClick={(e) => {
            e.stopPropagation();
            if (typeof props.deleteNode === "function") {
              props.deleteNode();
            }
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(229, 62, 62, 0.15)";
            e.currentTarget.style.color = "#c53030";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#e53e3e";
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: "2px",
            padding: "2px",
            borderRadius: "50%",
            color: "#e53e3e",
            background: "transparent",
            transition: "all 0.15s ease",
          }}
          title="Remove Image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </span>
        )}
      </span>
      {isHovered && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: "0",
          marginTop: "8px",
          background: "#fff",
          border: "1px solid rgba(3,72,82,0.15)",
          borderRadius: "8px",
          padding: "4px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          zIndex: 1000,
          pointerEvents: "none",
        }}>
          <img 
            src={props.node.attrs.src} 
            alt={props.node.attrs.alt || "Image preview"} 
            style={{ maxWidth: "240px", maxHeight: "240px", display: "block", borderRadius: "4px", objectFit: "contain" }} 
          />
        </div>
      )}
    </NodeViewWrapper>
  );
};

const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
      },
      isUploading: {
        default: false,
      }
    }
  },
  renderHTML({ HTMLAttributes }) {
    // Only serialize the src and alt to avoid DOMPurify stripping issues, and skip if still uploading
    if (HTMLAttributes.isUploading) {
      return ['span', { class: 'image-uploading-placeholder' }, 'Uploading image...'];
    }
    return ['img', { 
      src: HTMLAttributes.src, 
      alt: HTMLAttributes.alt || 'Inline image', 
      class: 'inline-image',
      style: 'max-width: 100%; height: auto; border-radius: 6px; vertical-align: middle; display: inline-block;'
    }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImagePillComponent);
  }
});

export function RichTextEditor({ value, onChange, placeholder, minHeight = 100, disableImageUpload = false }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      CustomImage.configure({
        inline: true,
        allowBase64: true,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        style: `min-height: ${minHeight}px; padding: 12px; outline: none; font-size: 13px; font-family: inherit; color: #034852;`,
        placeholder: placeholder || "",
      },
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  return (
    <div style={{ border: "1.5px solid rgba(3,72,82,0.15)", borderRadius: "8px", background: "#fff" }}>
      {!disableImageUpload && (
        <div style={{ borderTopLeftRadius: "6px", borderTopRightRadius: "6px", overflow: "hidden" }}>
          <MenuBar editor={editor} />
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
