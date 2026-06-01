import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Pencil, KeyRound, Trash2, Eye } from 'lucide-react';
import { usersApi } from '../api/users';
import { Modal } from '../components/Modal';
import { FullPageSpinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDateTime, ROLE_LABELS } from '../lib/utils';
import type { User, UserRole } from '../types/api';

function apiMsg(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

// Roles that can be created by org_admin — not org_admin itself, not super_admin
const ORG_ASSIGNABLE = (Object.keys(ROLE_LABELS) as UserRole[])
  .filter((r) => r !== 'super_admin' && r !== 'org_admin');
// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin:    'bg-purple-100 text-purple-700',
  org_admin:      'bg-emerald-100 text-emerald-700',
  supervisor:     'bg-blue-100 text-blue-700',
  senior_analyst: 'bg-indigo-100 text-indigo-700',
  analyst:        'bg-gray-100 text-gray-600',
};

// ── Create user modal ─────────────────────────────────────────────────────────

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const qc    = useQueryClient();
  const toast = useToast().toast;
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [role,     setRole]     = useState<UserRole>('analyst');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => usersApi.invite({ name, email, role, password }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created', `${name} has been added as ${ROLE_LABELS[role]}.`);
      onClose();
    },
    onError: (err: unknown) => {
      setError(apiMsg(err, 'Failed to create user. Email may already be in use.'));
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Full Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Amina Danladi"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Email Address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@nphcda.gov.ng"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {ORG_ASSIGNABLE.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Initial Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 8 characters"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        <button
          onClick={() => { setError(''); mutate(); }}
          disabled={isPending || !name.trim() || !email.trim() || !password}
          className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60"
        >
          {isPending ? 'Creating…' : 'Create User'}
        </button>
      </div>
    </div>
  );
}

// ── Edit user modal ───────────────────────────────────────────────────────────

function EditUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const qc    = useQueryClient();
  const toast = useToast().toast;
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<UserRole>(user.role);
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => usersApi.update(user._id, { name: name.trim(), role }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated', `${name} is now ${ROLE_LABELS[role]}.`);
      onClose();
    },
    onError: (err) => setError(apiMsg(err, 'Failed to update user.')),
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Full Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {ORG_ASSIGNABLE.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>
      <div className="bg-gray-50 rounded-lg px-3 py-2">
        <p className="text-[11px] text-gray-500">Email: <span className="font-medium text-gray-700">{user.email}</span></p>
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        <button
          onClick={() => { setError(''); mutate(); }}
          disabled={isPending || !name.trim()}
          className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ── Reset password modal ──────────────────────────────────────────────────────

function ResetPasswordModal({ user, onClose }: { user: User; onClose: () => void }) {
  const toast = useToast().toast;
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [error,     setError]     = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => usersApi.resetPassword(user._id, password),
    onSuccess: () => {
      toast.success('Password reset', `${user.name}'s password has been updated and all sessions invalidated.`);
      onClose();
    },
    onError: (err) => setError(apiMsg(err, 'Failed to reset password.')),
  });

  function submit() {
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    mutate();
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Set a new password for <span className="font-medium text-gray-800">{user.name}</span>.
        Their current sessions will be invalidated.
      </p>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">New Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 8 characters"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Confirm Password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat password"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        <button
          onClick={submit}
          disabled={isPending || !password || !confirm}
          className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60"
        >
          {isPending ? 'Resetting…' : 'Reset Password'}
        </button>
      </div>
    </div>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────

function DeleteUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const qc    = useQueryClient();
  const toast = useToast().toast;
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => usersApi.delete(user._id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted', `${user.name} has been permanently removed.`);
      onClose();
    },
    onError: (err) => setError(apiMsg(err, 'Failed to delete user.')),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        Are you sure you want to permanently delete{' '}
        <span className="font-semibold">{user.name}</span> ({user.email})?
        This action cannot be undone.
      </p>
      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        <button
          onClick={() => mutate()}
          disabled={isPending}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? 'Deleting…' : 'Delete User'}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ActiveModal =
  | { type: 'create' }
  | { type: 'edit';           user: User }
  | { type: 'reset-password'; user: User }
  | { type: 'delete';         user: User }
  | null;

export default function Users() {
  const { user: me } = useAuth();
  const qc           = useQueryClient();
  const toast        = useToast().toast;
  const isSuperAdmin = me?.role === 'super_admin';
  const isOrgAdmin   = me?.role === 'org_admin';
  const canEdit      = isSuperAdmin || isOrgAdmin;
  const canView      = canEdit || me?.role === 'supervisor';

  const [modal, setModal] = useState<ActiveModal>(null);

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn:  () => usersApi.list(),
    enabled:  canView,
  });

  const { mutate: toggleActive } = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      usersApi.update(id, { active }),
    onSuccess: (_data, { active }) => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(active ? 'User activated' : 'User deactivated');
    },
    onError: (err) => toast.error('Update failed', apiMsg(err, 'Could not update user status.')),
  });

  const closeModal = () => setModal(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">User Management</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {canEdit ? 'Create accounts and manage roles' : 'View team members'}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setModal({ type: 'create' })}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <UserPlus className="h-4 w-4" /> Add User
          </button>
        )}
      </div>

      {isError && <ErrorBanner message="Failed to load users." />}

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <FullPageSpinner />
        ) : users.length === 0 ? (
          <EmptyState title="No users" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => {
                const isSelf = me?.id === u._id;
                return (
                  <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{u.name}</span>
                        {isSelf && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">You</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && !isSelf && (
                          <>
                            {/* Edit name / role */}
                            <button
                              onClick={() => setModal({ type: 'edit', user: u })}
                              title="Edit name / role"
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>

                            {/* Reset password */}
                            <button
                              onClick={() => setModal({ type: 'reset-password', user: u })}
                              title="Reset password"
                              className="p-1.5 rounded hover:bg-amber-50 text-gray-500 hover:text-amber-700 transition-colors"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </button>

                            {/* Toggle active */}
                            <button
                              onClick={() => toggleActive({ id: u._id, active: !u.isActive })}
                              title={u.isActive ? 'Deactivate' : 'Activate'}
                              className={`text-[11px] font-medium px-2 py-1 rounded border transition-colors ${
                                u.isActive
                                  ? 'border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600'
                                  : 'border-gray-200 text-gray-500 hover:border-green-200 hover:text-green-700'
                              }`}
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => setModal({ type: 'delete', user: u })}
                              title="Delete user"
                              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {!canEdit && (
                          <span title="Read-only">
                            <Eye className="h-3.5 w-3.5 text-gray-300" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <Modal open={modal?.type === 'create'} onClose={closeModal} title="Add User" size="sm">
        <CreateUserModal onClose={closeModal} />
      </Modal>

      <Modal
        open={modal?.type === 'edit'}
        onClose={closeModal}
        title="Edit User"
        size="sm"
      >
        {modal?.type === 'edit' && <EditUserModal user={modal.user} onClose={closeModal} />}
      </Modal>

      <Modal
        open={modal?.type === 'reset-password'}
        onClose={closeModal}
        title="Reset Password"
        size="sm"
      >
        {modal?.type === 'reset-password' && <ResetPasswordModal user={modal.user} onClose={closeModal} />}
      </Modal>

      <Modal
        open={modal?.type === 'delete'}
        onClose={closeModal}
        title="Delete User"
        size="sm"
      >
        {modal?.type === 'delete' && <DeleteUserModal user={modal.user} onClose={closeModal} />}
      </Modal>
    </div>
  );
}
