import React, { useEffect, useRef, useState } from 'react';
import { aiAPI } from '../services/api';
import NativeAdvisoryReport from './NativeAdvisoryReport';
import './native-advisory.css';

type DocumentSource = { id: string; title: string; currentVersion: number; jurisdiction: string; effectiveDate: string; hasOCR: boolean };
type MatterSource = { id: string; name: string; reference: string; jurisdiction: string; canAnalyze: boolean; documents: DocumentSource[] };
type TemplateSource = { id: string; name: string; jurisdiction: string; authority: string; sourceVersion: string; checksum: string; effectiveFrom: string; effectiveTo: string | null };
type Sources = { matters: MatterSource[]; templates: TemplateSource[] };
type DraftInput = { matterId: string; prompt: string; contractType: string; templateId: string; jurisdiction: string; effectiveDate: string };
type Artifact = { id: string; kind: string; matterId: string; matterName: string; documentId: string | null; documentVersion: number | null; jurisdiction: string; effectiveDate: string; output: unknown; model: string; modelVersion: string; provider: string; providerReceipt: string; status: string; inputChecksum: string; outputChecksum: string; createdAt: string; reviewerRationale: string | null; input: Record<string, string> | null; canReview: boolean; canDelete: false };
const utcDate = (value: string) => new Date(value && !/Z$|[+-]\d{2}:\d{2}$/.test(value) ? `${value}Z` : value);
const blankDraft: DraftInput = { matterId: '', prompt: '', contractType: '', templateId: '', jurisdiction: '', effectiveDate: '' };
const errorText = (error: any) => error.response?.data?.error || error.message || 'Request failed. Your existing evidence is unchanged.';
export const analysisPresets = [
  ['Evidence overview', 'Review the supplied document for material obligations, deadlines, ambiguities and missing facts. Cite only actual passages. Identify uncertainties and questions for independent counsel.'],
  ['Risk and compliance', 'Focus on risk allocation, termination, liability, compliance obligations and conflicting provisions in the supplied document. Quote actual evidence and identify source checks for counsel.'],
  ['Negotiation preparation', 'Identify clauses that warrant negotiation questions, unresolved factual assumptions and practical next steps. Separate actual document evidence from uncertainty. Preserve independent counsel review.'],
] as const;
export const draftPresets = [
  ['Initial draft', 'Prepare an advisory initial draft for the selected authoritative template reference. Keep every unknown party, amount, date and obligation as a clearly marked placeholder. Identify unresolved facts and require independent counsel to validate the actual template prose.'],
  ['Risk-aware draft', 'Prepare an advisory draft focused on balanced obligations, risk allocation and termination. Preserve unknown details as placeholders. Do not invent facts or template clauses. Identify negotiation questions and require independent counsel review against the actual authoritative source.'],
  ['Plain-language draft', 'Prepare a clear advisory working draft using the selected authoritative template reference. Keep unknown facts as placeholders, explain assumptions and list questions for independent counsel. Do not claim legal validity or reproduce unavailable template wording.'],
] as const;

export default function GovernedAIWorkspace({ requestedDocumentId = '' }: { requestedDocumentId?: string }) {
  const [feature, setFeature] = useState<'analysis' | 'draft'>('analysis');
  const [sources, setSources] = useState<Sources>({ matters: [], templates: [] });
  const [sourceLoading, setSourceLoading] = useState(true);
  const [sourceError, setSourceError] = useState('');
  const [sourcePage, setSourcePage] = useState(0);
  const [documentId, setDocumentId] = useState('');
  const [reviewFocus, setReviewFocus] = useState('');
  const [draft, setDraft] = useState<DraftInput>(blankDraft);
  const [items, setItems] = useState<Artifact[]>([]);
  const [reviewQueue, setReviewQueue] = useState<Artifact[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [result, setResult] = useState<Artifact | null>(null);
  const [selected, setSelected] = useState<Artifact | null>(null);
  const [rationale, setRationale] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const active = useRef<{ controller: AbortController; sequence: number } | null>(null);
  const sequence = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setSourceLoading(true); setSourceError('');
    aiAPI.governedSources(controller.signal).then(response => {
      if (controller.signal.aborted) return;
      setSources(response.data);
      if (requestedDocumentId) {
        const actual = response.data.matters.flatMap((matter: MatterSource) => matter.documents).find((document: DocumentSource) => document.id === requestedDocumentId);
        if (actual) { setFeature('analysis'); setDocumentId(actual.id); }
        else setSourceError('The requested document is not available to this session. Select a document you can access.');
      }
    }).catch(error => { if (!controller.signal.aborted) setSourceError(errorText(error)); }).finally(() => { if (!controller.signal.aborted) setSourceLoading(false); });
    aiAPI.governedHistory(controller.signal).then(response => { if (!controller.signal.aborted) { setItems(response.data.items); setReviewQueue(response.data.reviewQueue); setHistoryError(''); } }).catch(error => { if (!controller.signal.aborted) setHistoryError(errorText(error)); });
    return () => controller.abort();
  }, [requestedDocumentId, sourcePage]);
  useEffect(() => () => { sequence.current++; active.current?.controller.abort(); }, []);
  useEffect(() => { if (selected && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [selected]);

  const allDocuments = sources.matters.flatMap(matter => matter.documents.map(document => ({ ...document, matter })));
  const eligibleDocuments = allDocuments.filter(document => document.hasOCR && document.matter.canAnalyze);
  const selectedDocument = allDocuments.find(document => document.id === documentId);
  const selectedMatter = sources.matters.find(matter => matter.id === draft.matterId);
  const templates = sources.templates.filter(template => template.jurisdiction === selectedMatter?.jurisdiction);
  const selectedTemplate = templates.find(template => template.id === draft.templateId);
  const effective = utcDate(draft.effectiveDate);
  const validTemplate = selectedTemplate && Number.isFinite(effective.getTime()) && effective >= new Date(selectedTemplate.effectiveFrom) && (!selectedTemplate.effectiveTo || effective <= new Date(selectedTemplate.effectiveTo));
  const canRun = feature === 'analysis' ? selectedDocument?.hasOCR && selectedDocument.matter.canAnalyze : Boolean(selectedMatter && validTemplate && draft.prompt.trim() && draft.contractType.trim());

  const cancel = () => { sequence.current++; active.current?.controller.abort(); active.current = null; setPending(false); setNotice('Request cancelled. Any unfinished generation is discarded.'); };
  const changeFeature = (next: 'analysis' | 'draft') => { if (pending) cancel(); setFeature(next); setResult(null); setError(''); setNotice(''); };
  const analysisPreset = (index: number) => {
    const actual = eligibleDocuments.find(document => document.id === documentId) || eligibleDocuments[0];
    if (!actual) return;
    setDocumentId(actual.id); setReviewFocus(analysisPresets[index][1]); setError(''); setNotice('Example filled using your actual selected document. Review the inputs, then Generate.');
  };
  const draftPreset = (index: number) => {
    const matter = selectedMatter || sources.matters.find(matter => sources.templates.some(template => template.jurisdiction === matter.jurisdiction));
    if (!matter) return;
    const available = sources.templates.filter(template => template.jurisdiction === matter.jurisdiction);
    const template = available.find(template => template.id === draft.templateId) || available[0];
    if (!template) return;
    const today = new Date().toISOString().slice(0, -1);
    const currentDate = utcDate(draft.effectiveDate);
    const within = (date: Date) => Number.isFinite(date.getTime()) && date >= new Date(template.effectiveFrom) && (!template.effectiveTo || date <= new Date(template.effectiveTo));
    const effectiveDate = within(currentDate) ? draft.effectiveDate : within(utcDate(today)) ? today : template.effectiveFrom.replace(/Z$/, '');
    setDraft({ matterId: matter.id, templateId: template.id, jurisdiction: matter.jurisdiction, effectiveDate, contractType: template.name, prompt: draftPresets[index][1] });
    setError(''); setNotice('All draft inputs filled from an actual matter and authoritative template. Verify the effective date and replace placeholders before use.');
  };

  const generate = async () => {
    if (!canRun || pending) return;
    const controller = new AbortController(), requestSequence = ++sequence.current;
    active.current = { controller, sequence: requestSequence }; setPending(true); setError(''); setNotice(''); setResult(null);
    try {
      const response = feature === 'analysis' ? await aiAPI.analyzeDocument(documentId, reviewFocus, controller.signal) : await aiAPI.generateContract({ ...draft, effectiveDate: utcDate(draft.effectiveDate).toISOString() }, controller.signal);
      if (controller.signal.aborted || sequence.current !== requestSequence) return;
      if (!response.data.item?.id || !response.data.item?.output) throw new Error('The server did not return a complete saved artifact.');
      const artifact = response.data.item;
      setResult(artifact); setItems(current => [artifact, ...current.filter(item => item.id !== artifact.id)]);
      setNotice('Advisory artifact saved as pending review. Independent counsel must review it before any legal reliance.');
    } catch (error) { if (!controller.signal.aborted && sequence.current === requestSequence) setError(errorText(error)); }
    finally { if (sequence.current === requestSequence) { active.current = null; setPending(false); } }
  };
  const editInputs = (artifact: Artifact) => {
    if (!artifact.input) return;
    if (pending) cancel();
    if (artifact.kind === 'document-analysis') { setFeature('analysis'); setDocumentId(artifact.input.documentId || artifact.documentId || ''); setReviewFocus(artifact.input.reviewFocus || ''); }
    else { setFeature('draft'); setDraft({ matterId: artifact.input.matterId || '', templateId: artifact.input.templateId || '', jurisdiction: artifact.input.jurisdiction || '', effectiveDate: (artifact.input.effectiveDate || '').replace(/Z$/, ''), contractType: artifact.input.contractType || '', prompt: artifact.input.prompt || '' }); }
    setSelected(null); setResult(null); setError(''); setNotice('Saved inputs loaded for a new generation. The retained artifact stays unchanged.');
  };
  const review = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!selected?.canReview || rationale.trim().length < 20 || reviewing) return;
    const id = selected.id; setReviewing(true); setError('');
    try {
      await aiAPI.reviewArtifact(id, decision, rationale);
      setSelected(null); setRationale(''); setSourcePage(page => page + 1); setNotice(`Independent review recorded: ${decision.toLowerCase()}. Other document, signer and filing gates still apply.`);
    } catch (error) { setError(errorText(error)); }
    finally { setReviewing(false); }
  };
  const open = (artifact: Artifact) => { setSelected(artifact); setRationale(''); setError(''); };
  const report = (artifact: Artifact) => <NativeAdvisoryReport response={artifact.output} result={artifact.output} tokens={undefined} loading={false} error={undefined} title={artifact.kind === 'document-analysis' ? 'Document analysis' : 'Advisory contract draft'} model={artifact.model} label="OpenRouter advisory · independent counsel review" />;

  return <section className="na-workspace ga-workspace" aria-label="Governed document AI">
    <header className="na-heading"><span>GOVERNED DOCUMENT AI</span><h1>Analyze documents and draft contracts</h1><p>Use actual uploaded evidence and authoritative template references. Every answer is an advisory artifact subject to independent counsel review.</p></header>
    <nav className="na-actions" aria-label="Native AI features"><button type="button" aria-pressed={feature === 'analysis'} onClick={() => changeFeature('analysis')}>Document analysis</button><button type="button" aria-pressed={feature === 'draft'} onClick={() => changeFeature('draft')}>Contract drafting</button></nav>
    {notice && <p className="na-notice" role="status">{notice}</p>}{error && <p className="na-alert" role="alert">{error}</p>}
    <div className="na-columns"><div className="na-card"><h2>{feature === 'analysis' ? 'Analyze actual document evidence' : 'Prepare an advisory contract draft'}</h2>
      {sourceLoading && <p role="status">Loading your accessible matters, uploaded documents and authoritative templates…</p>}
      {sourceError && <p className="na-alert" role="alert">{sourceError}</p>}
      <button type="button" disabled={sourceLoading || pending} onClick={() => setSourcePage(page => page + 1)}>Refresh sources and history</button>
      <div className="na-actions" aria-label="Complete input examples">{(feature === 'analysis' ? analysisPresets : draftPresets).map(([label], index) => <button key={label} type="button" disabled={pending || sourceLoading || (feature === 'analysis' ? !eligibleDocuments.length : !sources.matters.some(matter => sources.templates.some(template => template.jurisdiction === matter.jurisdiction)))} onClick={() => feature === 'analysis' ? analysisPreset(index) : draftPreset(index)}>{label}</button>)}</div>
      {feature === 'analysis' ? <>
        <label htmlFor="ga-document">Uploaded document</label><select id="ga-document" required disabled={pending} value={documentId} onChange={event => setDocumentId(event.target.value)}><option value="">Select actual document</option>{allDocuments.map(document => <option key={document.id} value={document.id} disabled={!document.hasOCR || !document.matter.canAnalyze}>{document.title} · {document.matter.name} · v{document.currentVersion}{!document.hasOCR ? ' · OCR required' : !document.matter.canAnalyze ? ' · write access required' : ''}</option>)}</select>
        {selectedDocument && <p className="na-provenance">{selectedDocument.matter.reference} · {selectedDocument.jurisdiction} · effective {selectedDocument.effectiveDate.slice(0, 10)} · actual version {selectedDocument.currentVersion}</p>}
        <label htmlFor="ga-focus">Review focus (optional)</label><textarea id="ga-focus" rows={5} maxLength={2000} disabled={pending} value={reviewFocus} onChange={event => setReviewFocus(event.target.value)} /><small>Up to 2000 bytes. Presets fill this optional field and select an actual eligible document. OCR must already exist for the current uploaded version.</small>
        {!eligibleDocuments.length && !sourceLoading && <p className="na-notice">No accessible document currently has both OCR evidence and native write permission. Complete the existing document/OCR workflow before generating.</p>}
      </> : <>
        <label htmlFor="ga-matter">Matter</label><select id="ga-matter" required disabled={pending} value={draft.matterId} onChange={event => { const matter = sources.matters.find(matter => matter.id === event.target.value); setDraft(current => ({ ...current, matterId: matter?.id || '', jurisdiction: matter?.jurisdiction || '', templateId: '' })); }}><option value="">Select actual matter</option>{sources.matters.map(matter => <option key={matter.id} value={matter.id}>{matter.name} · {matter.reference}</option>)}</select>
        <label htmlFor="ga-template">Authoritative template</label><select id="ga-template" required disabled={pending} value={draft.templateId} onChange={event => setDraft(current => ({ ...current, templateId: event.target.value }))}><option value="">Select authoritative source</option>{templates.map(template => <option key={template.id} value={template.id}>{template.name} · {template.sourceVersion}</option>)}</select>
        {selectedTemplate && <p className="na-provenance">Authority: {selectedTemplate.authority} · source {selectedTemplate.sourceVersion} · checksum {selectedTemplate.checksum}<br />Effective {selectedTemplate.effectiveFrom.slice(0, 10)} through {selectedTemplate.effectiveTo?.slice(0, 10) || 'no recorded end date'}.</p>}
        <label htmlFor="ga-jurisdiction">Matter jurisdiction</label><input id="ga-jurisdiction" required readOnly value={draft.jurisdiction} />
        <label htmlFor="ga-date">Requested effective date and time (UTC)</label><input id="ga-date" type="datetime-local" step="0.001" required disabled={pending} value={draft.effectiveDate} onChange={event => setDraft(current => ({ ...current, effectiveDate: event.target.value }))} />
        <label htmlFor="ga-type">Contract type</label><input id="ga-type" required maxLength={150} disabled={pending} value={draft.contractType} onChange={event => setDraft(current => ({ ...current, contractType: event.target.value }))} />
        <label htmlFor="ga-prompt">Drafting instructions</label><textarea id="ga-prompt" required rows={7} maxLength={20000} disabled={pending} value={draft.prompt} onChange={event => setDraft(current => ({ ...current, prompt: event.target.value }))} />
        <small>All six native inputs are visible. Template metadata establishes provenance; the model does not receive full template prose. Unknown facts must stay placeholders for counsel to resolve.</small>
        {selectedTemplate && !validTemplate && <p className="na-alert">Choose an effective date within the authoritative template’s recorded validity period.</p>}
        {!templates.length && !sourceLoading && <p className="na-notice">Select a matter with an actual authoritative template in its jurisdiction. Draft templates and invented IDs are not eligible.</p>}
      </>}
      <div className="na-actions"><button type="button" className="na-primary" disabled={pending || !canRun} onClick={generate}>{pending ? 'Generating…' : 'Generate with OpenRouter'}</button>{pending && <button type="button" onClick={cancel}>Cancel generation</button>}</div>
    </div><div className="na-card"><h2>Advisory answer</h2>{pending ? <p role="status">OpenRouter is reviewing the submitted evidence. Cancel stops the request and discards unfinished work.</p> : result ? <>{report(result)}<p className="na-notice">Status: {result.status}. This artifact does not approve a document, authorize signatures or file a contract.</p><button type="button" onClick={() => open(result)}>Open saved artifact</button></> : <p className="na-empty">Fill a complete example, verify your sources, then Generate.</p>}</div></div>
    <section className="na-card"><h2>Your retained AI artifacts</h2>{historyError && <p className="na-alert" role="alert">{historyError}</p>}<div className="na-history">{items.map(artifact => <button type="button" key={artifact.id} onClick={() => open(artifact)}>{artifact.kind === 'document-analysis' ? 'Document analysis' : 'Contract draft'} · {artifact.matterName}<span>{artifact.status} · {new Date(artifact.createdAt).toLocaleString()} · {artifact.jurisdiction}</span></button>)}</div>{!items.length && <p className="na-empty">No owned governed artifacts were returned for this session.</p>}</section>
    {!!reviewQueue.length && <section className="na-card"><h2>Independent counsel review queue</h2><p>Only native authorized reviewers can see eligible artifacts from another author. Review requires a meaningful rationale and current source evidence.</p><div className="na-history">{reviewQueue.map(artifact => <button key={artifact.id} type="button" onClick={() => open(artifact)}>{artifact.kind === 'document-analysis' ? 'Document analysis' : 'Contract draft'} · {artifact.matterName}<span>{artifact.status} · independent review required</span></button>)}</div></section>}
    {selected && <dialog ref={dialog} className="na-dialog" aria-label="Governed artifact details" onCancel={event => { if (reviewing) event.preventDefault(); else setSelected(null); }}><div className="na-dialog-inner"><header><h2>{selected.kind === 'document-analysis' ? 'Document analysis' : 'Advisory contract draft'}</h2><p>{selected.matterName} · {selected.status} · {selected.jurisdiction} · effective {selected.effectiveDate.slice(0, 10)}</p><p className="na-provenance">Actual artifact {selected.id} · source document version {selected.documentVersion ?? 'template reference'} · model {selected.model} · version {selected.modelVersion}</p></header><div className="na-dialog-body">{report(selected)}<p className="na-notice">This evidence is retained. Editing inputs creates a new artifact. Independent counsel review and all document/signature/filing gates remain required.</p>{selected.reviewerRationale && <p>Reviewer rationale: {selected.reviewerRationale}</p>}{error && <p className="na-alert" role="alert">{error}</p>}{selected.canReview && <><label htmlFor="ga-rationale">Independent review rationale</label><textarea id="ga-rationale" rows={4} minLength={20} disabled={reviewing} value={rationale} onChange={event => setRationale(event.target.value)} /><small>At least 20 characters. The author cannot approve their own artifact.</small><div className="na-actions"><button type="button" disabled={reviewing || rationale.trim().length < 20} onClick={() => review('APPROVED')}>Record independent approval</button><button type="button" disabled={reviewing || rationale.trim().length < 20} onClick={() => review('REJECTED')}>Record rejection</button></div></>}</div><footer className="na-actions"><button type="button" disabled={!selected.input || reviewing} title={selected.input ? 'Reuse saved inputs for a new artifact' : 'Historical artifact has no retained submitted inputs'} onClick={() => editInputs(selected)}>Edit inputs</button><button type="button" disabled title="Retained AI evidence has no native deletion authority">Delete</button><button type="button" disabled={reviewing} onClick={() => setSelected(null)}>Cancel</button></footer></div></dialog>}
  </section>;
}
