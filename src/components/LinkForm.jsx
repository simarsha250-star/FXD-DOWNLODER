export default function LinkForm({ value, onChange, onSubmit, onClear, onPasteButton, onPasteEvent, canPasteButton, message }) {
  const hasError = Boolean(message && message.tone === 'error');
  return (
    <form
      className="link-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label className="field-label" htmlFor="link">
        Link
      </label>
      <input
        id="link"
        className="field"
        type="text"
        inputMode="url"
        enterKeyHint="go"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Paste a YouTube, TikTok, Instagram, Facebook or file link"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPasteEvent}
        aria-invalid={hasError}
        aria-describedby="link-message"
      />
      <div className="actions">
        <button type="submit" className="btn btn-primary">
          Check link
        </button>
        {canPasteButton && (
          <button type="button" className="btn btn-ghost" onClick={onPasteButton}>
            Paste from clipboard
          </button>
        )}
        {value && (
          <button type="button" className="btn btn-quiet" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <p
        id="link-message"
        className={`message ${message ? `message-${message.tone}` : ''}`}
        role={hasError ? 'alert' : 'status'}
      >
        {message ? message.text : ''}
      </p>
      {!canPasteButton && (
        <p className="hint">Touch and hold the field, then choose Paste. FXD checks the link as soon as you paste it.</p>
      )}
    </form>
  );
}
