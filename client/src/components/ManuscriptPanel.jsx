export default function ManuscriptPanel({ campaign, lead, leadData }) {
  const manuscript = campaign?.manuscripts?.[campaign?.manuscriptActive || 0];

  if (!manuscript) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>No call script configured for this campaign</p>
      </div>
    );
  }

  // Replace merge tags in manuscript content
  let content = manuscript.content || '';
  if (leadData) {
    Object.entries(leadData).forEach(([key, value]) => {
      content = content.replace(new RegExp(`\\{${key}\\}`, 'gi'), value || '');
    });
  }

  return (
    <div>
      <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">
        {manuscript.name || 'Call Script'}
      </h3>
      <div
        className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}
