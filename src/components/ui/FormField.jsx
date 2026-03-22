import './FormField.css';

export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="form-field">
      {label && <label className="form-field__label">{label}</label>}
      <input className={`form-input ${error ? 'form-input--error' : ''} ${className}`} {...props} />
      {error && <span className="form-field__error">{error}</span>}
    </div>
  );
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="form-field">
      {label && <label className="form-field__label">{label}</label>}
      <select className={`form-input ${error ? 'form-input--error' : ''} ${className}`} {...props}>
        {children}
      </select>
      {error && <span className="form-field__error">{error}</span>}
    </div>
  );
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className="form-field">
      {label && <label className="form-field__label">{label}</label>}
      <textarea className={`form-input ${error ? 'form-input--error' : ''} ${className}`} rows={3} {...props} />
      {error && <span className="form-field__error">{error}</span>}
    </div>
  );
}
