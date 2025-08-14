export default function UpgradeButton({ onClick, children = 'Upgrade to Pro' }) {
  return (
    <button className="button primary" onClick={onClick}>{children}</button>
  );
}


