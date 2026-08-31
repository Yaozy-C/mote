export function PluginSection({ icon: Icon, title, meta, actions, className = "", children }) {
  return <section className={`detail-plugin ${className}`}>
    <header className="detail-plugin-header">
      <span className="detail-plugin-title">{Icon && <Icon size={15} stroke={1.75} aria-hidden="true" />}<strong>{title}</strong>{meta && <small>{meta}</small>}</span>
      {actions && <div className="detail-plugin-actions">{actions}</div>}
    </header>
    <div className="detail-plugin-body">{children}</div>
  </section>;
}

export function ContextButton({ icon: Icon, label, onClick, onError, compact = false }) {
  const run = async () => {
    try { await onClick(); }
    catch (cause) { onError?.(String(cause)); }
  };
  return <button className={`context-action ${compact ? "compact" : ""}`} onClick={run} aria-label={compact ? label : undefined} title={compact ? label : undefined}>
    <Icon size={16} stroke={1.75} />{!compact && label}
  </button>;
}
