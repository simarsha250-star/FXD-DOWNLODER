// The FXD mark: an X over a download tray. Drawn in currentColor so it can sit on any surface.
export default function Mark({ size = 32 }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <g stroke="currentColor" strokeLinecap="square" fill="none">
        <path d="M160 128 L352 320 M352 128 L160 320" strokeWidth="64" />
        <path d="M148 396 H364" strokeWidth="28" />
      </g>
    </svg>
  );
}
