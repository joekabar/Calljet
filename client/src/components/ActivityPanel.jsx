import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, Pin, Phone, FileText, Clock, CheckCircle, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ActivityPanel({ lead, onClose }) {
  const [activeTab, setActiveTab] = useState('timeline');
  const [activity, setActivity] = useState([]);
  const [notes, setNotes] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (lead?.id) loadActivity();
  }, [lead?.id]);

  async function loadActivity() {
    setLoading(true);
    try {
      const data = await api.getLead(lead.id);
      setActivity(data.activity || []);
      setNotes(data.notes || []);
      setCalls(data.calls || []);
    } catch (err) {
      console.error('Load activity error:', err);
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'notes', label: 'Notes' },
    { id: 'calls', label: 'Calls' },
  ];

  function getActionIcon(action) {
    switch (action) {
      case 'call': return <Phone className="w-3.5 h-3.5" />;
      case 'note': return <FileText className="w-3.5 h-3.5" />;
      case 'callback_set': return <Clock className="w-3.5 h-3.5" />;
      case 'lead_saved': return <CheckCircle className="w-3.5 h-3.5" />;
      default: return <MessageSquare className="w-3.5 h-3.5" />;
    }
  }

  function getActionColor(action) {
    switch (action) {
      case 'call': return 'bg-blue-100 text-blue-600';
      case 'lead_saved': return 'bg-green-100 text-green-600';
      case 'callback_set': return 'bg-amber-100 text-amber-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  function formatStatusLabel(status) {
    const labels = {
      success: 'Success',
      not_interested: 'Not interested',
      unqualified: 'Unqualified',
      invalid: 'Invalid',
      auto_redial: 'Automatic callback',
      private_callback: 'Private callback',
      shared_callback: 'Shared callback',
      vip_callback: 'VIP callback',
    };
    return labels[status] || status;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Activity</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b px-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-calljet-600 text-calljet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-calljet-600" />
          </div>
        ) : (
          <>
            {activeTab === 'timeline' && (
              <div className="space-y-4">
                {activity.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No activity yet</p>
                )}
                {activity.map(item => (
                  <div key={item.id} className="flex gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${getActionColor(item.action)}`}>
                      {getActionIcon(item.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{item.users?.name || 'System'}</span>
                        {item.action === 'lead_saved' && (
                          <> saved lead as <span className="font-medium">{formatStatusLabel(item.details?.status)}</span></>
                        )}
                        {item.action === 'call' && (
                          <> called <span className="font-mono text-xs">{item.details?.phone_number}</span></>
                        )}
                        {item.action === 'note' && ' left a note'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </p>
                      {item.details?.callback_time && (
                        <p className="text-xs text-blue-600 mt-1">
                          Next call @ {new Date(item.details.callback_time).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-3">
                {notes.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No notes yet</p>
                )}
                {notes.map(n => (
                  <div key={n.id} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm">{n.content}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <span className="font-medium text-gray-500">{n.users?.name}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'calls' && (
              <div className="space-y-3">
                {calls.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No calls yet</p>
                )}
                {calls.map(call => (
                  <div key={call.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      call.disposition === 'answered' ? 'bg-green-100 text-green-600' :
                      call.disposition === 'no_answer' ? 'bg-gray-100 text-gray-500' :
                      'bg-red-100 text-red-500'
                    }`}>
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono">{call.phone_number}</p>
                      <p className="text-xs text-gray-400">
                        {call.disposition || 'pending'} · {call.duration_seconds || 0}s
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(call.created_at).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
