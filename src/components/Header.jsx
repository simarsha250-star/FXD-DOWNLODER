import Mark from './Mark.jsx';

export default function Header({ online }) {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="FXD Downloader, home">
        <Mark size={36} />
        <span className="brand-text">
          <span className="brand-name">FXD Downloader</span>
          <span className="brand-by">by Future X Design</span>
        </span>
      </a>
      <p className={`net ${online ? 'net-on' : 'net-off'}`} role="status">
        <span className="net-dot" aria-hidden="true" />
        {online ? 'Online' : 'Offline'}
      </p>
    </header>
  );
}
