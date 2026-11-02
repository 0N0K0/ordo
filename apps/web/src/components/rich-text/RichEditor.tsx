import { Text } from '@mantine/core';
import { Link, RichTextEditor } from '@mantine/tiptap';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import { uploadAttachment } from '../../lib/attachments';
import { notifyError } from '../../lib/notify';
import classes from './RichEditor.module.css';

interface RichEditorProps {
  /** HTML content. */
  value: string;
  onChange: (html: string) => void;
  label?: string;
  /** Minimum height of the editing area, in px. */
  minHeight?: number;
  /** Shows the "HTML code" control (signatures). */
  sourceCode?: boolean;
  autoFocus?: boolean;
}

/**
 * Rich text editor producing HTML (mails, signatures): formatting, lists, links, alignment, images
 * (uploaded, then embedded in the sent mail) and, optionally, editing of the raw HTML.
 * @param {RichEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function RichEditor({ value, onChange, label, minHeight = 200, sourceCode, autoFocus }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value,
    autofocus: autoFocus ? 'start' : false,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });

  // Content replaced from outside (another signature, a reply…).
  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className={classes.root}>
      {label && (
        <Text size="sm" fw={500}>
          {label}
        </Text>
      )}
      <RichTextEditor
        editor={editor}
        onImageUpload={async (file) => (await uploadAttachment(file)).url}
        onImageUploadError={(_file, error) => notifyError(error instanceof Error ? error.message : 'Image non envoyée.')}
      >
        <RichTextEditor.Toolbar sticky stickyOffset={0}>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Underline />
            <RichTextEditor.Strikethrough />
            <RichTextEditor.ClearFormatting />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.H2 />
            <RichTextEditor.H3 />
            <RichTextEditor.Blockquote />
            <RichTextEditor.BulletList />
            <RichTextEditor.OrderedList />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Link />
            <RichTextEditor.Unlink />
            <RichTextEditor.ImageUpload />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.AlignLeft />
            <RichTextEditor.AlignCenter />
            <RichTextEditor.AlignRight />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Undo />
            <RichTextEditor.Redo />
            {sourceCode && <RichTextEditor.SourceCode />}
          </RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>
        <RichTextEditor.Content style={{ minHeight }} />
      </RichTextEditor>
    </div>
  );
}
