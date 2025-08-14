export default function Paywall({ title = 'Unlock Pro', features = [], onUpgrade, onClose }) {
  const compare = [
    { label: 'Teams', free: '1', pro: 'Up to 5' },
    { label: 'Players', free: '20', pro: '200' },
    { label: 'Templates', free: '—', pro: '✓' },
    { label: 'Analytics', free: '—', pro: '✓' },
    { label: 'Shareable PDFs', free: '—', pro: '✓' },
  ];
  return (
    <div className="modal-overlay">
      <div className="modal-content paywall">
        <h3 className="modal-title">{title}</h3>
        {features.length > 0 && (
          <ul className="paywall-bullets">
            {features.map((f, i) => (<li key={i}>{f}</li>))}
          </ul>
        )}
        <div className="paywall-grid">
          <div className="plan-card free">
            <div className="plan-title">Free</div>
            <div className="plan-price">$0</div>
          </div>
          <div className="plan-card pro">
            <div className="plan-title">Pro</div>
            <div className="plan-price">$19–29<span className="price-sub">/mo</span></div>
          </div>
        </div>
        <div className="feature-compare">
          {compare.map((row, i) => (
            <div key={i} className="feature-row">
              <div className="feature-name">{row.label}</div>
              <div className="feature-cell">{row.free}</div>
              <div className="feature-cell highlight">{row.pro}</div>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="button" onClick={onClose}>Close</button>
          <button className="button primary" onClick={onUpgrade}>Start Free Trial</button>
        </div>
      </div>
    </div>
  );
}


