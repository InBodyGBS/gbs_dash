'use client';

/**
 * RichTextEditor — TipTap 기반 WYSIWYG 에디터
 *
 * 지원 기능:
 *  - 굵게 / 기울임 / 밑줄(strike)
 *  - 헤딩(H2/H3) / 인용 / 코드
 *  - 글머리·번호 리스트
 *  - 표 삽입 / 행·열 추가·삭제
 *  - 이미지 업로드(Supabase Storage `announcement-images` 버킷)
 *  - 링크 삽입/해제
 *
 * 저장 형식: HTML 문자열 (announcements.content)
 * 렌더링: dangerouslySetInnerHTML (자체 staff 작성이므로 sanitize 생략)
 */

import { useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Unlink,
  Image as ImageIcon,
  Table as TableIcon,
  Trash2,
  Undo,
  Redo,
  RowsIcon,
  ColumnsIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

const BUCKET = 'announcement-images';

interface ToolbarBtnProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarBtn({ onClick, active, disabled, title, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`h-8 w-8 inline-flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? 'bg-gray-200 text-gray-900' : ''
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5" />;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = '본문을 입력하세요...',
  className = '',
  minHeight = 360,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: 'rounded-md max-w-full h-auto my-3' },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: 'text-blue-600 underline', rel: 'noopener noreferrer' },
      }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'tiptap-table' } }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'focus:outline-none px-4 py-3 leading-relaxed text-sm text-gray-800',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  // 외부에서 value가 바뀌면(예: 취소·재로딩) 에디터에도 반영
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== undefined) {
      editor.commands.setContent(value || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;
      if (!file.type.startsWith('image/')) {
        toast.error('이미지 파일만 업로드 가능합니다.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('이미지는 5MB 이하만 업로드 가능합니다.');
        return;
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${new Date().getFullYear()}/${uuidv4()}.${ext}`;
      const uploadingToast = toast.loading('이미지 업로드 중...');

      try {
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });
        if (error) {
          if (error.message?.includes('not found') || error.message?.includes('Bucket')) {
            throw new Error(
              `Storage 버킷 '${BUCKET}'이 없습니다. docs/announcement-images-bucket.sql 을 먼저 실행해 주세요.`,
            );
          }
          throw error;
        }
        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET).getPublicUrl(path);

        editor.chain().focus().setImage({ src: publicUrl }).run();
        toast.dismiss(uploadingToast);
        toast.success('이미지가 추가되었습니다.');
      } catch (e) {
        toast.dismiss(uploadingToast);
        const msg = e instanceof Error ? e.message : '알 수 없는 오류';
        toast.error('이미지 업로드 실패: ' + msg);
      }
    },
    [editor],
  );

  const handleAddLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('링크 URL', previous || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return (
      <div
        className={`rounded-md border border-gray-200 bg-gray-50 ${className}`}
        style={{ minHeight }}
      />
    );
  }

  return (
    <div
      className={`rounded-md border border-gray-200 bg-white overflow-hidden ${className}`}
      data-placeholder={placeholder}
    >
      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        <ToolbarBtn
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="되돌리기"
        >
          <Undo className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="다시 실행"
        >
          <Redo className="w-4 h-4" />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="제목 2"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="제목 3"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="굵게 (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="기울임 (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="취소선"
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="글머리 목록"
        >
          <List className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="번호 목록"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="인용"
        >
          <Quote className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="코드 블록"
        >
          <Code className="w-4 h-4" />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={handleAddLink} active={editor.isActive('link')} title="링크 삽입">
          <LinkIcon className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive('link')}
          title="링크 해제"
        >
          <Unlink className="w-4 h-4" />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => fileInputRef.current?.click()} title="이미지 업로드">
          <ImageIcon className="w-4 h-4" />
        </ToolbarBtn>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImageUpload(f);
            e.target.value = '';
          }}
        />
        <Divider />
        <ToolbarBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          title="표 삽입 (3x3)"
        >
          <TableIcon className="w-4 h-4" />
        </ToolbarBtn>
        {editor.isActive('table') && (
          <>
            <ToolbarBtn
              onClick={() => editor.chain().focus().addRowAfter().run()}
              title="행 추가"
            >
              <RowsIcon className="w-4 h-4" />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              title="열 추가"
            >
              <ColumnsIcon className="w-4 h-4" />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().deleteTable().run()}
              title="표 삭제"
            >
              <Trash2 className="w-4 h-4" />
            </ToolbarBtn>
          </>
        )}
      </div>

      <div
        onClick={() => editor.chain().focus().run()}
        className="cursor-text"
        style={{ minHeight }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* 표 / 이미지 기본 스타일 (Tailwind typography 플러그인 없이도 보이도록) */}
      <style jsx global>{`
        .ProseMirror {
          min-height: ${minHeight}px;
          outline: none;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror h2 {
          font-size: 1.25rem;
          font-weight: 700;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror h3 {
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 0.75rem;
          margin-bottom: 0.4rem;
        }
        .ProseMirror p {
          margin: 0.5rem 0;
          line-height: 1.7;
        }
        .ProseMirror ul {
          list-style: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .ProseMirror ol {
          list-style: decimal;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .ProseMirror blockquote {
          border-left: 3px solid #d1d5db;
          padding-left: 0.75rem;
          color: #6b7280;
          margin: 0.75rem 0;
        }
        .ProseMirror pre {
          background: #1f2937;
          color: #f9fafb;
          padding: 0.75rem 1rem;
          border-radius: 0.375rem;
          font-size: 0.85rem;
          overflow-x: auto;
        }
        .ProseMirror code {
          background: #f3f4f6;
          padding: 0.1rem 0.25rem;
          border-radius: 0.25rem;
          font-size: 0.85em;
        }
        .ProseMirror pre code {
          background: transparent;
          padding: 0;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
          margin: 0.75rem 0;
        }
        .ProseMirror table,
        .announcement-content table {
          border-collapse: collapse;
          margin: 0.75rem 0;
          width: 100%;
          table-layout: fixed;
        }
        .ProseMirror table td,
        .ProseMirror table th,
        .announcement-content table td,
        .announcement-content table th {
          border: 1px solid #d1d5db;
          padding: 0.45rem 0.6rem;
          vertical-align: top;
          position: relative;
          min-width: 60px;
        }
        .ProseMirror table th,
        .announcement-content table th {
          background: #f3f4f6;
          font-weight: 600;
          text-align: left;
        }
        .ProseMirror .selectedCell:after {
          background: rgba(151, 27, 47, 0.08);
          content: '';
          left: 0; right: 0; top: 0; bottom: 0;
          pointer-events: none;
          position: absolute;
          z-index: 2;
        }
        .ProseMirror .column-resize-handle {
          background-color: #971b2f;
          bottom: -2px;
          position: absolute;
          right: -2px;
          pointer-events: none;
          top: 0;
          width: 3px;
        }
      `}</style>
    </div>
  );
}

/**
 * AnnouncementContent — HTML로 저장된 본문을 표시.
 * 입력이 HTML이 아닌 평문(legacy)일 경우 줄바꿈을 유지해 노출.
 */
export function AnnouncementContent({ html, className = '' }: { html: string; className?: string }) {
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(html);
  if (!isHtml) {
    return (
      <p className={`text-gray-700 leading-relaxed whitespace-pre-wrap ${className}`}>{html}</p>
    );
  }
  return (
    <div
      className={`announcement-content text-gray-700 leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
