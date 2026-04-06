export default function ManuscriptPanel({ campaign, lead, leadData }) {
  const content = campaign?.manuscript;

  if (!content) {
    return <div className="text-center py-12 text-gray-400"><p>No call script configured for this campaign</p></div>;
  }

  // Replace merge tags like {Bedrijf} with lead data values
  let rendered = content;
  if (leadData) {
    Object.entries(leadData).forEach(([key, value]) => {
      rendered = rendered.replace(new RegExp(`\\{${key}\\}`, 'gi'), value || '');
    });
  }

  return (
    <div>
      <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">Call Script</h3>
      <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: rendered }} />
    </div>
  );
}
