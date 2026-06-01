import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, Radio, ClipboardCheck,
  AlertTriangle, TrendingUp, Plus, ChevronRight,
} from 'lucide-react';
import { orgsApi } from '../api/organizations';
import { FullPageSpinner } from '../components/Spinner';
import { ErrorBanner }     from '../components/ErrorBanner';
import { StatCard }        from '../components/StatCard';
import { Modal }           from '../components/Modal';
import { useToast }        from '../context/ToastContext';
import { formatDateTime, ORG_STATUS_META, ORG_PLAN_META } from '../lib/utils';
import type { Organization } from '../types/api';

// ── Create Org Modal ──────────────────────────────────────────────────────────

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara',
];

function CreateOrgModal({ onClose }: { onClose: () => void }) {
  const toast = useToast().toast;
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', description: '', region: '', state: '',
    contactEmail: '', phoneNumber: '', plan: 'basic',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit() {
    setError('');
    setLoading(true);
    try {
      const org = await orgsApi.create({
        name: form.name, description: form.description || undefined,
        region: form.region, state: form.state,
        contactEmail: form.contactEmail, phoneNumber: form.phoneNumber || undefined,
        plan: form.plan,
      });
      toast.success('Organization created', `${org.name} is ready. Now create an Org Admin.`);
      onClose();
      navigate(`/organizations/${org._id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to create organization.');
    } finally { setLoading(false); }
  }

  const field = (label: string, key: string, type = 'text', placeholder = '') => (
    <div key={key}>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[key as keyof typeof form]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {field('Organization Name *', 'name', 'text', 'e.g. Lagos State PHC')}
        {field('Contact Email *', 'contactEmail', 'email', 'admin@health.gov.ng')}
        {field('Region / LGA *', 'region', 'text', 'e.g. Lagos Island')}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">State *</label>
          <select
            value={form.state}
            onChange={(e) => set('state', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select state</option>
            {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {field('Phone Number', 'phoneNumber', 'tel', '+234 ...')}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
          <select
            value={form.plan}
            onChange={(e) => set('plan', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          rows={2}
          placeholder="Brief description of this health center…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        <button
          onClick={submit}
          disabled={loading || !form.name || !form.contactEmail || !form.region || !form.state}
          className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? 'Creating…' : 'Create Organization'}
        </button>
      </div>
    </div>
  );
}

// ── Org row in table ──────────────────────────────────────────────────────────

function OrgRow({ org }: { org: Organization & { postsToday: number; hitlPending: number } }) {
  const navigate = useNavigate();
  const status   = ORG_STATUS_META[org.status] ?? ORG_STATUS_META.active;
  const plan     = ORG_PLAN_META[org.plan]     ?? ORG_PLAN_META.basic;

  return (
    <tr
      onClick={() => navigate(`/organizations/${org._id}`)}
      className="hover:bg-gray-50 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">{org.name}</p>
            <p className="text-xs text-gray-400">{org.region}, {org.state}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${status.color}`}>{status.label}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${plan.color}`}>{plan.label}</span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-600 text-center">{org.userCount}</td>
      <td className="px-4 py-3 text-xs text-gray-600 text-center">{org.postsToday.toLocaleString()}</td>
      <td className="px-4 py-3 text-center">
        {org.hitlPending > 0 ? (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
            {org.hitlPending}
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(org.createdAt)}</td>
      <td className="px-4 py-3">
        <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlatformOverview() {
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['platform-overview'],
    queryFn:  () => orgsApi.platformOverview(),
    refetchInterval: 60_000,
  });

  if (isLoading) return <FullPageSpinner />;
  if (isError || !data) return <ErrorBanner message="Failed to load platform overview." />;

  const { summary, organizations } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Platform Overview</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">All health center organizations</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" /> Add Organization
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total organizations" value={summary.totalOrgs}   icon={Building2}      color="green" />
        <StatCard label="Total users"          value={summary.totalUsers}  icon={Users}          color="indigo" />
        <StatCard label="Posts today"          value={summary.postsToday}  icon={Radio}          color="yellow" />
        <StatCard label="HITL pending"         value={summary.hitlPending} icon={ClipboardCheck} color="red" />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Active orgs"    value={summary.activeOrgs}  icon={TrendingUp}     color="green" />
        <StatCard label="Total posts"    value={summary.postsTotal}  icon={Radio}          color="indigo" />
        <StatCard label="Open alerts"    value={summary.openAlerts}  icon={AlertTriangle}  color="red" />
        <StatCard label="Inactive orgs"  value={summary.totalOrgs - summary.activeOrgs} icon={Building2} color="yellow" />
      </div>

      {/* Organizations table */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-700">
            Health Center Organizations ({organizations.length})
          </h2>
        </div>
        {organizations.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Building2 className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No organizations yet</p>
            <p className="text-xs text-gray-400 mt-1">Create the first health center to get started.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Create Organization
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Organization</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Plan</th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Users</th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Posts today</th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">HITL</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {organizations.map((o) => <OrgRow key={o._id} org={o} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => { setShowCreate(false); void refetch(); }} title="Create Organization" size="md">
        <CreateOrgModal onClose={() => { setShowCreate(false); void refetch(); }} />
      </Modal>
    </div>
  );
}
