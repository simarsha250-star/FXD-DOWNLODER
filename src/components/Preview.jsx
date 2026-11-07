export default function Preview({ state }) {
  if (!state || state.phase === 'idle') return null;

  if (state.phase === 'loading') {
    return (
      <div className="preview preview-loading" aria-busy="true">
        <span className="skeleton skeleton-thumb" />
        <span className="skeleton-lines">
          <span className="skeleton" />
          <span className="skeleton skeleton-short" />
        </span>
        <span className="sr-only">Looking up a preview</span>
      </div>
    );
  }

  if (state.phase === 'error') {
    return <p className="note">{state.message}</p>;
  }

  const { data } = state;
  if (!data.title && !data.author && !data.thumbnail) return null;
  return (
    <figure className="preview">
      {data.thumbnail && (
        <img className="preview-thumb" src={data.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
      )}
      <figcaption className="preview-text">
        {data.title && <span className="preview-title">{data.title}</span>}
        {data.author && <span className="preview-author">{data.author}</span>}
        <span className="preview-source">Preview from {data.provider}’s oEmbed service</span>
      </figcaption>
    </figure>
  );
}
