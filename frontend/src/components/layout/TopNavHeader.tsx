import { useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import { Users,ScrollText,LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ConfirmationModal } from '../common/ConfirmationModal';
export function TopNavHeader() {
  const { logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata' }).format(new Date());
  return <header className="vault-header"><Link to="/" className="vault-brand" aria-label="Vault Ledger home"><img src="/logo.jpeg" alt="Marudhar" /><span><strong>Vault Ledger</strong><small>Marudhar Safe &amp; Secure Pvt. Ltd.</small></span></Link><div className="vault-header-actions"><span className="vault-today">Today: {date}</span>{hasPermission('users.view') && <button type="button" onClick={() => navigate('/users')}><Users size={17} /> Staff</button>}{hasPermission('audit.view') && <button type="button" onClick={() => navigate('/audit')}><ScrollText size={17} /> Audit Log</button>}<button type="button" onClick={() => setConfirm(true)}><LogOut size={17} /> Logout</button></div>
    {confirm && <ConfirmationModal isOpen={confirm} onClose={() => setConfirm(false)} onConfirm={async () => { setBusy(true); try { await logout(); navigate('/login'); } finally { setBusy(false); setConfirm(false); } }} title="Logout" description="End this vault session?" confirmLabel="Logout" isLoading={busy} />}
  </header>;
}
