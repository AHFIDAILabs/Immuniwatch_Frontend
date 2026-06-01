import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Building2, Users, Radio, ClipboardCheck,
  AlertTriangle, UserPlus, Pencil, ShieldCheck, KeyRound,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import { orgsApi } from '../api/organizations';
import { FullPageSpinner } from '../components/Spinner';
import { ErrorBanner }     from '../components/ErrorBanner';
import { Modal }           from '../components/Modal';
import { StatCard }        from '../components/StatCard';
import { useToast }        from '../context/ToastContext';
import { formatDateTime, ROLE_LABELS, ROLE_COLORS, ORG_STATUS_META, ORG_PLAN_META } from '../lib/utils';
import type { User } from '../types/api';

// ── Create org admin modal ────────────────────────────────────────────────────

function CreateAdminModal({ orgId, orgName, onClose }: { orgId: string; orgName: string; onClose: () => void }) {
  const qc    = useQueryClient();
  const toast = useToast().toast;
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => orgsApi.createAdmin(orgId, { name, email, password }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['org', orgId] });
      toast.success('Org Admin created', `${name} can now log in and manage ${orgName}.`);
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to create admin.');
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        This admin can log in to <strong>{orgName}</strong> and create analysts, senior analysts, and supervisors.
      </p>
      {[
        { label: 'Full Name',  type: 'text',     val: name,     set: setName },
        { label: 'Email',      type: 'email',    val: email,    set: setEmail },
        { label: 'Password',   type: 'password', val: password, set: setPassword, hint: 'Min 8 characters' },
      ].map(({ label, type, val, set, hint }) => (
        <div key={label}>
          <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
          <input
            type={type} value={val}
            onChange={(e) => set(e.target.value)}
            placeholder={hint}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      ))}
      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        <button
          onClick={() => { setError(''); mutate(); }}
          disabled={isPending || !name || !email || password.length < 8}
          className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60"
        >
          {isPending ? 'Creating…' : 'Create Admin'}
        </button>
      </div>
    </div>
  );
}

// ── Edit org modal ────────────────────────────────────────────────────────────

function EditOrgModal({ orgId, defaultValues, onClose }: {
  orgId: string;
  defaultValues: { name: string; contactEmail: string; region: string; description?: string };
  onClose: () => void;
}) {
  const qc    = useQueryClient();
  const toast = useToast().toast;
  const [form, setForm] = useState(defaultValues);
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => orgsApi.update(orgId, form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['org', orgId] });
      void qc.invalidateQueries({ queryKey: ['platform-overview'] });
      toast.success('Organization updated');
      onClose();
    },
    onError: () => setError('Failed to update organization.'),
  });

  return (
    <div className="space-y-3">
      {[
        { label: 'Name',          key: 'name' },
        { label: 'Contact Email', key: 'contactEmail', type: 'email' },
        { label: 'Region / LGA',  key: 'region' },
        { label: 'Description',   key: 'description' },
      ].map(({ label, key, type = 'text' }) => (
        <div key={key}>
          <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
          <input
            type={type}
            value={(form as Record<string, string>)[key] ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      ))}
      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        <button
          onClick={() => mutate()}
          disabled={isPending || !form.name}
          className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type ModalType = 'create-admin' | 'edit' | null;

export default function OrganizationDetail() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const toast     = useToast().toast;
  const [modal, setModal] = useState<ModalType>(null);

  const { data: org, isLoading, isError } = useQuery({
    queryKey: ['org', id],
    queryFn:  () => orgsApi.get(id!),
    enabled:  !!id,
  });

  const { mutate: setStatus } = useMutation({
    mutationFn: (status: 'active' | 'suspended') => orgsApi.setStatus(id!, status),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ['org', id] });
      void qc.invalidateQueries({ queryKey: ['platform-overview'] });
      toast.success(`Organization ${updated.status}`, `${updated.name} status updated.`);
    },
    onError: () => toast.error('Failed to update status'),
  });

  if (isLoading) return <FullPageSpinner />;
  if (isError || !org) return <ErrorBanner message="Failed to load organization." />;

  const statusMeta = ORG_STATUS_META[org.status];
  const planMeta   = ORG_PLAN_META[org.plan];
  const isActive   = org.status === 'active';

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/organizations')}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-gray-900">{org.name}</h1>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${statusMeta.color}`}>{statusMeta.label}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${planMeta.color}`}>{planMeta.label}</span>
            </div>
            <p className="text-xs text-gray-400">{org.region}, {org.state} · {org.contactEmail}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setModal('edit')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            onClick={() => setStatus(isActive ? 'suspended' : 'active')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              isActive
                ? 'border-red-200 text-red-600 hover:bg-red-50'
                : 'border-green-200 text-green-600 hover:bg-green-50'
            }`}
          >
            {isActive ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
            {isActive ? 'Suspend' : 'Activate'}
          </button>
          <button
            onClick={() => setModal('create-admin')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <UserPlus className="h-3.5 w-3.5" /> Add Admin
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard label="Users"        value={org.stats.postsTotal  > 0 ? org.users.length   : org.userCount} icon={Users}          color="indigo" />
        <StatCard label="Posts today"  value={org.stats.postsToday}  icon={Radio}          color="yellow" />
        <StatCard label="Total posts"  value={org.stats.postsTotal}  icon={Radio}          color="green"  />
        <StatCard label="HITL pending" value={org.stats.hitlPending} icon={ClipboardCheck} color="red"    />
        <StatCard label="Open alerts"  value={org.stats.openAlerts}  icon={AlertTriangle}  color="red"    />
      </div>

      {/* Users table */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-700">Users ({org.users.length})</h2>
        </div>
        {org.users.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Users className="h-7 w-7 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No users yet</p>
            <p className="text-xs text-gray-400 mt-1">Create an Org Admin first so they can onboard their team.</p>
            <button
              onClick={() => setModal('create-admin')}
              className="mt-3 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Create Org Admin
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Email', 'Role', 'Status', 'Last Active'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {org.users.map((u: User) => (
                <tr key={u._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{u.name}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${ROLE_COLORS[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">
                    {u.lastActive ? formatDateTime(u.lastActive) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Description */}
      {org.description && (
        <div className="glass-card p-4">
          <h2 className="text-xs font-semibold text-gray-700 mb-2">About</h2>
          <p className="text-xs text-gray-600 leading-relaxed">{org.description}</p>
        </div>
      )}

      {/* Modals */}
      <Modal open={modal === 'create-admin'} onClose={() => setModal(null)} title="Add Organization Admin" size="sm">
        <CreateAdminModal orgId={id!} orgName={org.name} onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Edit Organization" size="sm">
        <EditOrgModal
          orgId={id!}
          defaultValues={{ name: org.name, contactEmail: org.contactEmail, region: org.region, description: org.description }}
          onClose={() => setModal(null)}
        />
      </Modal>
    </div>
  );
}
