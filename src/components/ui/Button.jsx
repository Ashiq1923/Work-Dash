import './Button.css';

export function Button({ children, variant = 'primary', size = 'md', onClick, type = 'button', disabled, className = '', style }) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  );
}
