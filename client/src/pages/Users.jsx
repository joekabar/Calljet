import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Trash2, Shield, User, Edit2, Check, X } from 'lucide-react';

export default function Users() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const isAdmin = profile?.role === 'admin';

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    try { setUsers(await api.getUsers()); } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  function startEdit(user) {
    setEditingId(user.id);
    setEditForm({ name: user.name, display_name: user.display_name || '', role: user.role });
  }

  async function saveEdit(id) {
    try {
      await api.updateUser(id, editForm);
      setEditingId(null);
      loadUsers();
    } catch (err) { alert('Failed: ' + err.message); }
  }

  async function handleDelete(id, name) {
    if (id === profile?.id) return alert("You can't delete your own account");
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try { await api.deleteUser(id); loadUsers(); } catch (err) { alert('Failed: ' + err.message); }
  }

  function getStatusColor(status) {
    const c = { online: 'bg-green-100 text-green-700', in_call: 'bg-blue-100 text-blue-700', pause: 'bg-amber-100 text-amber-700', offline: 'bg-gray-100 text-gray-500' };
    return c[status] || c.offline;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-gray-500 mt-1">{users.length} users registered · New users sign up at the login page</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-calljet-600" /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                {isAdmin && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <input className="input-field py-1" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-calljet-100 text-calljet-600 rounded-full flex items-center justify-center text-xs font-bold">
                          {(u.display_name || u.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{u.name}</p>
                          {u.display_name && <p className="text-xs text-gray-400">{u.display_name}</p>}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <select className="input-field py-1 w-28" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                        <option value="agent">Agent</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`status-badge ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {u.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                        {u.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${getStatusColor(u.status)}`}>{u.status}</span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {editingId === u.id ? (
                          <>
                            <button onClick={() => saveEdit(u.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(u)} className="p-1.5 text-gray-400 hover:text-calljet-600 hover:bg-calljet-50 rounded"><Edit2 className="w-4 h-4" /></button>
                            {u.id !== profile?.id && (
                              <button onClick={() => handleDelete(u.id, u.name)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
