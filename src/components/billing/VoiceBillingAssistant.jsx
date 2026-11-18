import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Sparkles, HelpCircle, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';
import { Button, Card } from '../ui';
import { parseVoiceDraft } from '../../lib/voiceBilling';

const speechApi = () => window.SpeechRecognition || window.webkitSpeechRecognition;

export default function VoiceBillingAssistant({ inventory, onApply }) {
  const [transcript, setTranscript] = useState('');
  const [language, setLanguage] = useState('hi-IN');
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const recognitionRef = useRef(null);
  const nativeListenerRef = useRef(null);
  const nativeStateListenerRef = useRef(null);
  const Recognition = typeof window !== 'undefined' ? speechApi() : null;
  const isNative = Capacitor.isNativePlatform();
  const parsed = parseVoiceDraft(transcript, inventory);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    nativeListenerRef.current?.remove();
    nativeStateListenerRef.current?.remove();
  }, []);

  const toggleListening = async () => {
    if (listening) {
      recognitionRef.current?.stop();
      try {
        await SpeechRecognition.stop();
      } catch {
        // The native recognizer may already have stopped after a silence timeout.
      }
      await nativeListenerRef.current?.remove();
      await nativeStateListenerRef.current?.remove();
      nativeListenerRef.current = null;
      nativeStateListenerRef.current = null;
      setListening(false);
      return;
    }

    if (isNative) {
      try {
        const permission = await SpeechRecognition.requestPermissions();
        if (permission.speechRecognition !== 'granted') {
          setMessage('Microphone permission is required for voice entry. You can type the bill instead.');
          return;
        }
        nativeListenerRef.current = await SpeechRecognition.addListener('partialResults', (event) => {
          const spoken = event.accumulatedText || [event.accumulated, ...(event.matches || [])].filter(Boolean).join(' ');
          if (spoken) setTranscript(spoken.trim());
          setMessage('Review the detected customer and products before adding them to the bill.');
        });
        nativeStateListenerRef.current = await SpeechRecognition.addListener('listeningState', (event) => {
          if (event.status === 'stopped' || event.state === 'stopped') {
            setListening(false);
            setMessage('Voice capture ended. Review the transcript and draft before adding it.');
          }
        });
        await SpeechRecognition.start({ language, partialResults: true, keepListeningMs: 30000, maxResults: 5 });
        setListening(true);
        setMessage('Listening… speak the customer and medicine names clearly.');
      } catch (error) {
        await nativeListenerRef.current?.remove();
        await nativeStateListenerRef.current?.remove();
        nativeListenerRef.current = null;
        nativeStateListenerRef.current = null;
        setListening(false);
        setMessage(error?.message || 'Voice recognition is not available on this device. You can type the command below.');
      }
      return;
    }

    if (!Recognition) {
      setMessage('Voice input is not supported in this browser. You can type the command below.');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const spoken = Array.from(event.results).map((result) => result[0]?.transcript || '').join(' ');
      setTranscript(spoken.trim());
      setMessage('Review the detected customer and products before adding them to the bill.');
    };
    recognition.onerror = () => {
      setListening(false);
      setMessage('Microphone access was interrupted. Check browser permissions or type the command.');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setMessage('Listening… speak the customer and medicine names clearly.');
  };

  const applyDraft = () => {
    if (!parsed.matchedItems.length) {
      setMessage('No inventory items matched. Try the exact medicine name from your stock list.');
      return;
    }
    onApply(parsed);
    setMessage(`${parsed.matchedItems.length} item${parsed.matchedItems.length > 1 ? 's' : ''} added. Check prices, quantities and the invoice before saving.`);
  };

  return (
    <Card className="p-4 sm:p-5 border-brand-sky/20 bg-gradient-to-br from-sky-500/[0.08] to-transparent">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-brand-sky/10 border border-brand-sky/20 text-brand-sky flex items-center justify-center shrink-0"><Mic size={20} /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-white">Voice bill assistant</h2>
              <span className="text-[10px] rounded-full border border-brand-sky/25 px-2 py-0.5 text-brand-sky font-semibold">REVIEW BEFORE SAVE</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Speak in Hindi or English. We&apos;ll prepare an editable draft; nothing is saved until you check and save it.</p>
            <p className="text-[11px] text-slate-500 mt-1">Voice input needs microphone permission and your device&apos;s speech service. You can always type instead.</p>
          </div>
        </div>
        <label className="text-xs text-slate-400 flex items-center gap-2 shrink-0">
          Voice language
          <select value={language} onChange={(event) => setLanguage(event.target.value)} className="bg-ink-950 border border-white/10 rounded-lg px-2 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky">
            <option value="hi-IN">Hindi</option>
            <option value="en-IN">English (India)</option>
          </select>
        </label>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)] gap-3 mt-4">
        <div>
          <label htmlFor="voice-command" className="sr-only">Voice command transcript</label>
          <textarea id="voice-command" rows={3} value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="उदाहरण: ग्राहक Rahul, 2 Paracetamol 650mg और दो ORS Sachet" className="field resize-y min-h-24" />
          <div className="flex flex-wrap gap-2 mt-2">
            <Button variant={listening ? 'danger' : 'secondary'} onClick={toggleListening} aria-pressed={listening}>
              {listening ? <><MicOff size={16} /> Stop listening</> : <><Mic size={16} /> Speak bill</>}
            </Button>
            <Button onClick={applyDraft} disabled={!parsed.matchedItems.length}><Check size={16} /> Add draft items</Button>
          </div>
          <p role="status" aria-live="polite" className="text-xs text-slate-400 mt-2 min-h-4">{message}</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-ink-950/60 p-3" aria-live="polite">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300"><Sparkles size={14} className="text-brand-sky" /> Draft check</div>
          {parsed.buyerName && <p className="text-sm text-white mt-2">Customer: <strong>{parsed.buyerName}</strong></p>}
          {parsed.matchedItems.length ? (
            <ul className="mt-2 space-y-1.5">
              {parsed.matchedItems.map(({ item, quantity }) => <li key={item.id} className="text-sm text-slate-200 flex justify-between gap-3"><span className="truncate">{item.name}</span><span className="text-brand-green shrink-0">× {quantity}</span></li>)}
            </ul>
          ) : <p className="text-xs text-slate-500 mt-2">Matching stock items will appear here.</p>}
          <p className="flex gap-1.5 text-[11px] text-slate-500 mt-3"><HelpCircle size={13} className="shrink-0" /> Verify batch, expiry, price and tax in the bill editor.</p>
        </div>
      </div>
    </Card>
  );
}
