'use client';

import { useState } from 'react';

type Props = {
  onCancel: () => void;
  onSave: (body: string) => void;
  placeholder?: string;
  submitLabel?: string;
};

export default function InlineCommentForm({
  onCancel,
  onSave,
  placeholder = 'leave a comment',
  submitLabel = 'Add comment',
}: Props) {
  const [body, setBody] = useState('');

  return (
    <div className="inline-form">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
      />
      <div className="inline-form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!body.trim()}
          onClick={() => onSave(body.trim())}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
