import { useState } from 'react';
import { useCall } from '../contexts/CallContext';

const STATUS_OPTIONS = [
  { value: '', label: 'Select status', color: '' },
  { value: 'success', label: 'Success', color: 'text-green-600' },
  { value: 'not_interested', label: 'Not interested', color: 'text-red-600' },
  { value: 'unqualified', label: 'Unqualified', color: 'text-orange-600' },
  { value: 'invalid', label: 'Invalid', color: 'text-red-700' },
  { value: 'private_callback', label: 'Private callback', color: 'text-blue-600' },
  { value: 'shared_callback', label: 'Shared callback', color: 'text-purple-600' },
  { value: 'vip_callback', label: 'VIP callback', color: 'text-amber-600' },
  { value: 'auto_redial', label: 'Automatic redial', color: 'text-cyan-600' },
];

const CALLBACK_PRESETS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '3 hours', minutes: 180 },
  { label: '1 day', minutes: 1440 },
  { label: '2 days', minutes: 2880 },
  { label: '1 week', minutes: 10080 },
];

export default function ResultPanel({ lead, campaign, onSave, onPostpone }) {
  const { callState } = useCall();
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackTime, setCallbackTime] = useState('');
  const [callbackType, setCallbackType] = useState('private');
  const [blocklist, setBlocklist] = useState(false);
  const [saving, setSaving] = useState(false);

  const isCallback = status.includes('callback');

  function applyPreset(minutes) {
    const d = new Date(Date.now() + minutes * 60000);
    setCallbackDate(d.toISOString().split('T')[0]);
    setCallbackTime(d.toTimeString().slice(0, 5));
  }

  async function handleSave() {
    if (!status) {
      alert('Please select a status');
      return;
    }

    if (isCallback && (!callbackDate || !callbackTime)) {
      alert('Please set a callback time');
      return;
    }

    setSaving(true);
    try {
      const saveData = {
        status,
        note,
        blocklist,
      };

      if (isCallback && callbackDate && callbackTime) {
        saveData.callback_time = new Date(`${callbackDate}T${callbackTime}`).toISOString();
        saveData.callback_type = callbackType;
      }

      await onSave(saveData);

      // Reset form
      setStatus('');
      setNote('');
      setCallbackDate('');
      setCallbackTime('');
      setCallbackType('private');
      setBlocklist(false);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  }

  if (!lead) {
    return (
      <div className="p-6 text-center text-gray-400 text-sm">
        <p>No active lead</p>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col h-full">
      <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">Result data</h3>

      {/* Note */}
      <div className="mb-4">
        <label className="label">Note</label>
        <textarea
          className="input-field min-h-[80px] resize-y"
          placeholder="Add a note..."
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>

      {/* Callback time (shown when callback status selected) */}
      {isCallback && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <label className="label">Callback time</label>
          <div className="flex gap-2 mb-3">
            <input
              type="date"
              className="input-field flex-1"
              value={callbackDate}
              onChange={e => setCallbackDate(e.target.value)}
            />
            <input
              type="time"
              className="input-field w-28"
              value={callbackTime}
              onChange={e => setCallbackTime(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {CALLBACK_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.minutes)}
                className="px-2.5 py-1 text-xs bg-white border rounded-md hover:bg-gray-50"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="cbtype"
                value="private"
                checked={callbackType === 'private'}
                onChange={() => setCallbackType('private')}
              />
              Private
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="cbtype"
                value="shared"
                checked={callbackType === 'shared'}
                onChange={() => setCallbackType('shared')}
              />
              Shared
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="cbtype"
                value="vip"
                checked={callbackType === 'vip'}
                onChange={() => setCallbackType('vip')}
              />
              VIP
            </label>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="mb-4">
        <label className="label">Status</label>
        <select
          className="input-field"
          value={status}
          onChange={e => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} className={opt.color}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Blocklist */}
      <label className="flex items-center gap-2 text-sm text-gray-600 mb-4">
        <input
          type="checkbox"
          checked={blocklist}
          onChange={e => setBlocklist(e.target.checked)}
          className="rounded"
        />
        Blocklist this lead
      </label>

      {/* Action buttons */}
      <div className="mt-auto space-y-2">
        <button
          onClick={handleSave}
          disabled={!status || saving}
          className="btn-success w-full py-3 text-base"
        >
          {saving ? 'Saving...' : 'Save lead'}
        </button>

        <button
          onClick={onPostpone}
          disabled={callState === 'active'}
          className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors text-sm"
        >
          Answering machine (aut. callback)
        </button>

        <label className="flex items-center gap-2 text-xs text-gray-400 mt-2">
          <input type="checkbox" className="rounded" />
          Close dialer after this lead
        </label>
      </div>
    </div>
  );
}
