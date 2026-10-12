'use client'
import { useState, useRef, useEffect } from 'react'
import NativeAdvisoryReport from './NativeAdvisoryReport'
export type SavedAdvisory = { id: string; prompt: string; content: string; model: string; createdAt: string; canDelete: boolean; status?: string; matterId?: string; providerReceipt?: { id: string } }
type AdvisoryRequest = (method: 'GET' | 'POST' | 'DELETE', body: unknown, signal: AbortSignal) => Promise<any>
const nativeRequest = async (endpoint: string, method: 'GET' | 'POST' | 'DELETE', body: unknown, signal: AbortSignal) => { const response = await fetch(endpoint, { method, ...(method !== 'GET' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), signal }); const result = await response.json(); if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || 'AI request failed'); return result }
import './native-advisory.css'
export type AdvisoryPreset = { label: string; prompt: string }
export default function NativeAdvisoryWorkspace({ title, description, endpoint, presets, maxPrompt, retainedEvidence = false, requestImpl }: { title: string; description: string; endpoint: string; presets: AdvisoryPreset[]; maxPrompt: number; retainedEvidence?: boolean; requestImpl?: AdvisoryRequest }) {
  const request = (method: 'GET' | 'POST' | 'DELETE', body: unknown, signal: AbortSignal) => requestImpl ? requestImpl(method, body, signal) : nativeRequest(endpoint, method, body, signal)
  const [prompt, setPrompt] = useState(''), [items, setItems] = useState<SavedAdvisory[]>([]), [result, setResult] = useState<SavedAdvisory | null>(null), [selected, setSelected] = useState<SavedAdvisory | null>(null)
  const [busy, setBusy] = useState(false), [loadingHistory, setLoadingHistory] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState(''), [confirmDelete, setConfirmDelete] = useState(false)
  const pending = useRef<AbortController | null>(null), dialog = useRef<HTMLDialogElement | null>(null)
  useEffect(() => () => { pending.current?.abort(); pending.current = null }, [])
  useEffect(() => {
    const controller = new AbortController()
    void (async () => { try { const body = await request('GET', undefined, controller.signal); if (!controller.signal.aborted) setItems(Array.isArray(body.items) ? body.items : []) } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Report history could not be loaded') } finally { if (!controller.signal.aborted) setLoadingHistory(false) } })()
    return () => controller.abort()
  }, [endpoint, requestImpl])
  useEffect(() => { if (selected && dialog.current && !dialog.current.open) dialog.current.showModal(); else if (!selected && dialog.current?.open) dialog.current.close(); setConfirmDelete(false) }, [selected])
  const cancel = () => { pending.current?.abort(); pending.current = null; setBusy(false); setNotice('AI request cancelled.') }
  const generate = async () => {
    if (pending.current || !prompt.trim() || prompt.trim().length > maxPrompt) return
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError(''); setNotice(''); setResult(null)
    try {
      const body = await request('POST', { prompt }, controller.signal)
      if (pending.current !== controller || controller.signal.aborted) return
      const item = body.item as SavedAdvisory
      if (!item?.id || typeof item.content !== 'string' || typeof item.prompt !== 'string') throw new Error('The provider returned an invalid saved report')
      setResult(item); setItems(current => [item, ...current.filter(row => row.id !== item.id)].slice(0, 50)); setNotice('Advisory saved to your report history. Review its evidence before acting.')
    } catch (failure) { if (pending.current === controller && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'AI generation failed') }
    finally { if (pending.current === controller) { pending.current = null; setBusy(false) } }
  }
  const editInputs = () => { if (!selected) return; setPrompt(selected.prompt); setSelected(null); setNotice('Saved inputs loaded. Edit them, then generate a new report; the previous report remains retained.'); document.getElementById('native-advisory-prompt')?.focus() }
  const remove = async () => {
    if (!selected?.canDelete || pending.current) return
    const saved = selected, controller = new AbortController(); pending.current = controller; setBusy(true); setError('')
    try { await request('DELETE', { id: saved.id }, controller.signal); if (pending.current !== controller || controller.signal.aborted) return; setItems(current => current.filter(row => row.id !== saved.id)); if (result?.id === saved.id) setResult(null); setSelected(null); setNotice('Report deleted from your history.') }
    catch (failure) { if (pending.current === controller && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Report could not be deleted') }
    finally { if (pending.current === controller) { pending.current = null; setBusy(false) } }
  }
  const report = (item: SavedAdvisory) => <><NativeAdvisoryReport result={item.content} response={item.content} title={title} model={item.model} tokens={undefined} loading={false} error={undefined}/><p className="na-provenance">Saved report {item.id} · {new Date(item.createdAt).toLocaleString()}{item.matterId ? ` · Matter ${item.matterId}` : ''}{item.status ? ` · ${item.status}` : ''}{item.providerReceipt?.id ? ` · Provider receipt ${item.providerReceipt.id}` : ''}</p></>
  return <div className="na-workspace">
    <header className="na-heading"><span>AI OPERATIONS</span><h1>{title}</h1><p>{description}</p></header>
    {error && <div className="na-alert" role="alert">{error}</div>}{notice && <p className="na-notice" role="status">{notice}</p>}
    <div className="na-columns"><section className="na-card"><h2>Prepare your advisory</h2><p>Choose an example to fill the complete prompt, then review your actual evidence before generating.</p><div className="na-actions">{presets.map(preset => <button type="button" key={preset.label} disabled={busy} onClick={() => { setPrompt(preset.prompt); setError(''); setNotice('Example filled. Replace or extend it with verified context; no records or approvals were created.') }}>{preset.label}</button>)}</div><label htmlFor="native-advisory-prompt">Prompt and verified context</label><textarea id="native-advisory-prompt" rows={11} maxLength={maxPrompt} value={prompt} disabled={busy} onChange={event => setPrompt(event.target.value)} placeholder="Describe the operational question and include only verified source facts."/><small>{prompt.length}/{maxPrompt} characters · Avoid unnecessary sensitive personal information.</small><div className="na-actions"><button type="button" className="na-primary" disabled={busy || !prompt.trim() || prompt.trim().length > maxPrompt} onClick={() => void generate()}>{busy ? 'Preparing advisory…' : 'Generate with OpenRouter'}</button>{busy && <button type="button" onClick={cancel}>Cancel</button>}</div>{busy && <p role="status">OpenRouter is reviewing your prompt. Cancel stops this request.</p>}</section><section className="na-card"><h2>Advisory report</h2>{result ? <>{report(result)}<button type="button" onClick={() => setSelected(result)}>View saved report</button></> : <p className="na-empty">Your generated answer will appear as a readable report with source and provider details.</p>}</section></div>
    <section className="na-card"><h2>Your saved reports</h2><p>{retainedEvidence ? 'Provider receipts remain retained as evidence. Edit inputs creates a new advisory.' : 'Open a saved report to review it, edit its inputs, or delete your own report.'}</p>{loadingHistory ? <p role="status">Loading report history…</p> : !items.length ? <p className="na-empty">No saved reports yet.</p> : <div className="na-history">{items.map(item => <button type="button" key={item.id} onClick={() => setSelected(item)}><strong>{item.prompt.slice(0, 100) || 'Saved advisory'}</strong><span>{new Date(item.createdAt).toLocaleString()} · {item.model}</span></button>)}</div>}</section>
    <dialog ref={dialog} className="na-dialog" aria-labelledby="native-advisory-title" onCancel={event => { event.preventDefault(); if (busy) cancel(); setSelected(null) }} onClose={() => setSelected(null)}>{selected && <div className="na-dialog-inner"><header><h2 id="native-advisory-title">Saved advisory report</h2><p>{retainedEvidence ? 'Provider and approval evidence remains retained.' : 'Report actions are restricted to your own saved operational reports.'}</p></header><div className="na-dialog-body">{report(selected)}<details><summary>Submitted prompt</summary><p className="na-prompt">{selected.prompt}</p></details>{confirmDelete && <p className="na-alert">Delete this saved advisory? This removes the report from your history.</p>}{error && <p role="alert" className="na-alert">{error}</p>}</div><footer className="na-actions"><button type="button" disabled={busy || !selected.prompt} title={selected.prompt ? 'Load the submitted prompt for a new report' : 'This earlier evidence record did not retain its submitted prompt'} onClick={editInputs}>Edit inputs</button><button type="button" disabled={busy || !selected.canDelete} title={selected.canDelete ? 'Delete your saved operational report' : 'Provider and approval evidence is retained'} onClick={() => confirmDelete ? void remove() : setConfirmDelete(true)}>{confirmDelete ? 'Confirm delete' : 'Delete'}</button><button type="button" onClick={() => { if (busy) cancel(); setSelected(null) }}>Cancel</button></footer></div>}</dialog>
  </div>
}
