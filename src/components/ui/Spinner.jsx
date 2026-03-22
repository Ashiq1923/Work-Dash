import './Spinner.css';

export function Spinner({ size = 'md', text = 'Loading...' }) {
  return (
    <div className={`spinner-container spinner-container--${size}`}>
      <div className="spinner" />
      {text && <p className="spinner-text">{text}</p>}
    </div>
  );
}

export function PageLoader({ text }) {
  return (
    <div className="page-loader">
      <div className="page-loader__inner">
        <div className="spinner spinner--lg" />
        <p className="spinner-text">{text || 'Loading data...'}</p>
      </div>
    </div>
  );
}
