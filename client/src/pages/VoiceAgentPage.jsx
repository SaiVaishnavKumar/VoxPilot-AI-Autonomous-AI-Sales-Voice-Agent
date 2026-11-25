import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  BookOpen,
  UserCheck,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Globe,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AudioWaveform from '../components/AudioWaveform';
import { formatDuration, formatINR, sentimentBadgeClass } from '../utils/formatters';

const QUICK_PROMPTS = {
  en: [
    'Hi, my name is Aarav Mehta. I am looking for a 3BHK in Gachibowli.',
    'My budget is around 95 lakhs and I plan to buy within 2 months.',
    'What amenities and booking token refund policy do you offer?',
    'Please schedule a property consultation tomorrow at 11:00 AM. My phone is 9876543210.',
  ],
  hi: [
    'नमस्ते, मेरा नाम आरव मेहता है। मुझे गच्चीबौली में 3BHK फ्लैट चाहिए।',
    'मेरा बजट लगभग 95 लाख रुपये है और मैं 2 महीने में खरीदना चाहता हूँ।',
    'बुकिंग टोकन और होम लोन की क्या प्रक्रिया है?',
    'हाँ, कृपया कल सुबह 11:00 बजे कंसल्टेशन बुक कर दें। मेरा नंबर 9876543210 है।',
  ],
};

export default function VoiceAgentPage() {
  const { systemStatus } = useAuth();
  const navigate = useNavigate();

  const [callId, setCallId] = useState(null);
  const [callStatus, setCallStatus] = useState('Idle'); // Idle | Ready | Listening | Processing | Speaking | Ended
  const [language, setLanguage] = useState('en');
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const [transcript, setTranscript] = useState([]);
  const [interimText, setInterimText] = useState('');
  const [textInput, setTextInput] = useState('');
  const [extracted, setExtracted] = useState({});
  const [ragSources, setRagSources] = useState([]);
  const [bookedAppointment, setBookedAppointment] = useState(null);
  const [syncedLead, setSyncedLead] = useState(null);
  const [callSummary, setCallSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);

  const [analyserNode, setAnalyserNode] = useState(null);
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const callActiveRef = useRef(false);

  // Load browser TTS voices
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRec));

    const loadVoices = () => {
      const list = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
      setVoices(list);
      if (list.length > 0 && !selectedVoiceURI) {
        const preferred =
          list.find((v) => v.lang.toLowerCase().includes(language === 'hi' ? 'hi' : 'en-in')) ||
          list.find((v) => v.lang.toLowerCase().startsWith(language)) ||
          list[0];
        if (preferred) setSelectedVoiceURI(preferred.voiceURI);
      }
    };

    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [language]);

  // Call duration timer
  useEffect(() => {
    if (!callId || callStatus === 'Ended' || callStatus === 'Idle') return;
    const timer = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [callId, callStatus]);

  // Auto scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimText]);

  // Cleanup mic/speech on unmount
  useEffect(() => {
    return () => {
      stopMicrophoneStream();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const stopMicrophoneStream = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        // ignore
      }
      audioCtxRef.current = null;
    }
    setAnalyserNode(null);
    setIsListening(false);
  };

  const speakText = (text) => {
    if (isMuted || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    const voiceObj = voices.find((v) => v.voiceURI === selectedVoiceURI);
    if (voiceObj) utterance.voice = voiceObj;
    utterance.rate = 1.02;

    utterance.onstart = () => {
      setIsSpeaking(true);
      if (callActiveRef.current) setCallStatus('Speaking');
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      if (callActiveRef.current) setCallStatus('Ready');
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      if (callActiveRef.current) setCallStatus('Ready');
    };
    window.speechSynthesis.speak(utterance);
  };

  const startCall = async () => {
    setErrorMsg('');
    setCallSummary(null);
    setBookedAppointment(null);
    setSyncedLead(null);
    setExtracted({});
    setRagSources([]);
    setDurationSeconds(0);

    try {
      const res = await api.startCall({ language, industry: 'real-estate' });
      setCallId(res.call.id);
      setTranscript(res.call.transcript || []);
      callActiveRef.current = true;
      setCallStatus('Ready');
      speakText(res.openingGreeting);
    } catch (err) {
      setErrorMsg(err.message || 'Unable to start call session.');
    }
  };

  const endCall = async () => {
    if (!callId) return;
    stopMicrophoneStream();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    callActiveRef.current = false;
    setCallStatus('Processing');
    try {
      const res = await api.endCall(callId, { durationSeconds });
      setCallStatus('Ended');
      setCallSummary({
        summary: res.summary,
        recommendedNextAction: res.recommendedNextAction,
        call: res.call,
      });
      if (res.lead) setSyncedLead(res.lead);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to finalize call.');
      setCallStatus('Ended');
    }
  };

  const sendMessageToAI = async (msgText) => {
    const clean = String(msgText || '').trim();
    if (!clean) return;
    if (!callId) {
      setErrorMsg('Please click "Start AI Call" first.');
      return;
    }

    setErrorMsg('');
    setCallStatus('Processing');
    const optimisticCustomer = {
      speaker: 'customer',
      text: clean,
      timestamp: new Date().toISOString(),
    };
    setTranscript((prev) => [...prev, optimisticCustomer]);

    try {
      const res = await api.aiChat({
        callId,
        message: clean,
        language,
        industry: 'real-estate',
      });

      setTranscript(res.call.transcript || []);
      setExtracted(res.extracted || {});
      if (res.rag?.sources?.length > 0) {
        setRagSources(res.rag.sources);
      }
      if (res.appointment) setBookedAppointment(res.appointment);
      if (res.lead) setSyncedLead(res.lead);

      setCallStatus('Ready');
      speakText(res.reply);
    } catch (err) {
      setErrorMsg(err.message || 'AI processing failed.');
      setCallStatus('Ready');
    }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const msg = textInput;
    setTextInput('');
    sendMessageToAI(msg);
  };

  const toggleMicrophone = async () => {
    if (!callId || callStatus === 'Ended') {
      setErrorMsg('Start an AI Call before activating the microphone.');
      return;
    }

    if (isListening) {
      stopMicrophoneStream();
      setCallStatus('Ready');
      return;
    }

    setErrorMsg('');
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setErrorMsg(
        'Web Speech Recognition is not supported in this browser. Please use Chrome/Edge or the text input fallback below.'
      );
      return;
    }

    try {
      // Request mic stream for real-time audio waveform & permission check
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      setAnalyserNode(analyser);

      const recognition = new SpeechRec();
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
        setCallStatus('Listening');
      };

      recognition.onresult = (event) => {
        let interim = '';
        let finalStr = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalStr += piece;
          } else {
            interim += piece;
          }
        }
        setInterimText(interim);
        if (finalStr.trim()) {
          setInterimText('');
          stopMicrophoneStream();
          sendMessageToAI(finalStr.trim());
        }
      };

      recognition.onerror = (ev) => {
        setInterimText('');
        stopMicrophoneStream();
        if (ev.error === 'not-allowed') {
          setErrorMsg(
            'Microphone permission was denied. Allow microphone access in browser settings or use the text input fallback.'
          );
        } else if (ev.error !== 'aborted' && ev.error !== 'no-speech') {
          setErrorMsg(`Speech recognition error (${ev.error}). You can use text input anytime.`);
        }
        if (callActiveRef.current) setCallStatus('Ready');
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimText('');
        if (callActiveRef.current && callStatus === 'Listening') {
          setCallStatus('Ready');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      stopMicrophoneStream();
      setErrorMsg(
        'Microphone access unavailable or blocked. Please use the text input fallback below.'
      );
    }
  };

  const isCallActive = Boolean(callId) && callStatus !== 'Ended' && callStatus !== 'Idle';
  const filteredVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(language === 'hi' ? 'hi' : 'en')
  );
  const voiceOptions = filteredVoices.length > 0 ? filteredVoices : voices;

  return (
    <div className="space-y-5">
      {/* Top Control Bar */}
      <div className="rounded-2xl bg-navy-900 text-white p-5 sm:p-6 shadow-lg border border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  callStatus === 'Listening'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : callStatus === 'Speaking'
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-400/30'
                      : callStatus === 'Processing'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                        : callStatus === 'Ended'
                          ? 'bg-slate-600/40 text-slate-300'
                          : 'bg-white/10 text-slate-200'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
                Status: {callStatus}
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-mono text-slate-200">
                <Clock className="h-3.5 w-3.5 text-blue-300" />
                {formatDuration(durationSeconds)}
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 border border-blue-400/25 px-3 py-1 text-xs text-blue-200">
                <Sparkles className="h-3.5 w-3.5" />
                {systemStatus?.ai?.mode === 'gemini' ? 'Gemini AI' : 'Demo Mode'}
              </span>
            </div>
            <p className="text-xs text-slate-400 pt-1">
              {speechSupported
                ? 'Browser Speech Recognition & Synthesis ready. Text fallback always active.'
                : 'Speech Recognition unavailable in this browser — use Text Input Fallback below.'}
            </p>
          </div>

          {/* Language, Voice & Call Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-xl bg-navy-800 border border-white/10 px-3 py-2 text-xs">
              <Globe className="h-3.5 w-3.5 text-blue-300" />
              <select
                value={language}
                disabled={isCallActive}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-transparent text-white focus:outline-none disabled:opacity-60"
                aria-label="Select Language"
              >
                <option value="en" className="text-slate-900">
                  English (en-IN)
                </option>
                <option value="hi" className="text-slate-900">
                  Hindi (hi-IN)
                </option>
              </select>
            </div>

            {voiceOptions.length > 0 && (
              <select
                value={selectedVoiceURI}
                onChange={(e) => setSelectedVoiceURI(e.target.value)}
                className="max-w-[190px] rounded-xl bg-navy-800 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none"
                aria-label="Select TTS Voice"
              >
                {voiceOptions.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI} className="text-slate-900">
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => {
                if (!isMuted && window.speechSynthesis) window.speechSynthesis.cancel();
                setIsMuted(!isMuted);
              }}
              className={`rounded-xl border p-2.5 transition-colors ${
                isMuted
                  ? 'bg-rose-500/20 border-rose-400/30 text-rose-300'
                  : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/20'
              }`}
              title={isMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            {!isCallActive ? (
              <button
                type="button"
                onClick={startCall}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:from-emerald-600 hover:to-teal-700"
              >
                <Phone className="h-4 w-4" />
                <span>{callStatus === 'Ended' ? 'Start New AI Call' : 'Start AI Call'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={endCall}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700"
              >
                <PhoneOff className="h-4 w-4" />
                <span>Stop & Summarize</span>
              </button>
            )}
          </div>
        </div>

        {/* Waveform */}
        <div className="mt-4">
          <AudioWaveform
            isListening={isListening}
            isSpeaking={isSpeaking}
            isCallActive={isCallActive}
            analyser={analyserNode}
          />
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Live Transcript & Voice/Text Controls */}
        <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col h-[560px]">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Live Conversation Transcript</h2>
            <span className="text-xs text-slate-500">
              {transcript.length} {transcript.length === 1 ? 'message' : 'messages'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
            {transcript.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <div className="h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <Mic className="h-7 w-7" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  Click &ldquo;Start AI Call&rdquo; to begin a voice consultation
                </p>
                <p className="mt-1 text-xs text-slate-500 max-w-md">
                  VoxPilot AI will greet the buyer, answer verified property questions from the RAG
                  Knowledge Base, qualify the lead, and book appointments automatically.
                </p>
              </div>
            ) : (
              transcript.map((entry, idx) => {
                const isAI = entry.speaker === 'ai';
                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${isAI ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                        isAI
                          ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                          : 'bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-tr-sm'
                      }`}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wider mb-1 opacity-70">
                        {isAI ? 'VoxPilot AI Representative' : 'Customer'}
                      </div>
                      <p>{entry.text}</p>
                      {isAI && entry.retrievedSources && entry.retrievedSources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                          {entry.retrievedSources.map((src, sIdx) => (
                            <span
                              key={sIdx}
                              className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700"
                            >
                              <BookOpen className="h-2.5 w-2.5" />
                              {src}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {interimText && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl bg-blue-100 text-blue-900 px-4 py-2 text-xs italic">
                  Listening: &ldquo;{interimText}...&rdquo;
                </div>
              </div>
            )}

            {callStatus === 'Processing' && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                <span>Analyzing intent, querying Knowledge Base & updating CRM...</span>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Quick Demo Sample Prompts */}
          {isCallActive && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center gap-2 overflow-x-auto">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">
                Quick Try:
              </span>
              {(QUICK_PROMPTS[language] || QUICK_PROMPTS.en).map((sample, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendMessageToAI(sample)}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
                >
                  {sample.length > 44 ? `${sample.slice(0, 44)}...` : sample}
                </button>
              ))}
            </div>
          )}

          {/* Voice Mic + Text Input Fallback Bar */}
          <form
            onSubmit={handleTextSubmit}
            className="p-3.5 border-t border-slate-200 bg-white rounded-b-2xl flex items-center gap-2.5"
          >
            <button
              type="button"
              onClick={toggleMicrophone}
              disabled={!isCallActive}
              className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all disabled:opacity-40 ${
                isListening
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 animate-pulse'
                  : 'bg-navy-900 text-white hover:bg-navy-800'
              }`}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              <span className="hidden sm:inline">{isListening ? 'Stop Mic' : 'Speak'}</span>
            </button>

            <input
              type="text"
              value={textInput}
              disabled={!isCallActive || callStatus === 'Processing'}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={
                isCallActive
                  ? 'Speak via mic or type customer message here...'
                  : 'Start AI Call to send voice or text messages'
              }
              className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
            />

            <button
              type="submit"
              disabled={!isCallActive || !textInput.trim() || callStatus === 'Processing'}
              className="shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 p-2.5 text-white hover:from-blue-700 hover:to-violet-700 disabled:opacity-40 transition-all"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Right: Real-time AI Extraction, Lead Score, RAG & Summary */}
        <div className="space-y-4">
          {/* Lead Score & Qualification Card */}
          <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-blue-600" />
                Live Lead Qualification
              </h3>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                  extracted.qualified
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {extracted.qualified ? 'Qualified' : 'Qualifying'}
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-end justify-between text-xs mb-1.5">
                <span className="text-slate-500 font-medium">Lead Score</span>
                <span className="text-lg font-extrabold text-slate-900">
                  {extracted.leadScore ?? 0}
                  <span className="text-xs font-normal text-slate-400">/100</span>
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all duration-500"
                  style={{ width: `${extracted.leadScore ?? 0}%` }}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl bg-slate-50 p-2.5">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Name</div>
                <div className="font-semibold text-slate-800 truncate">
                  {extracted.name || '—'}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Phone</div>
                <div className="font-semibold text-slate-800 truncate">
                  {extracted.phone || '—'}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Property</div>
                <div className="font-semibold text-slate-800 truncate">
                  {extracted.propertyType || '—'}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Location</div>
                <div className="font-semibold text-slate-800 truncate">
                  {extracted.location || '—'}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Budget</div>
                <div className="font-semibold text-slate-800 truncate">
                  {extracted.budgetLabel || (extracted.budget ? formatINR(extracted.budget) : '—')}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Timeline</div>
                <div className="font-semibold text-slate-800 truncate">
                  {extracted.purchaseTimeline || '—'}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs pt-3 border-t border-slate-100">
              <span className="text-slate-500">Sentiment / Intent:</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sentimentBadgeClass(
                    extracted.sentiment
                  )}`}
                >
                  {extracted.sentiment || 'Neutral'}
                </span>
                <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  {extracted.intent || 'Medium'} Intent
                </span>
              </div>
            </div>
          </div>

          {/* Booked Appointment / Synced CRM Status */}
          {bookedAppointment && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CalendarCheck className="h-4 w-4" />
                Appointment Confirmed in CRM
              </div>
              <p>
                <strong>Date & Time:</strong> {bookedAppointment.date} at {bookedAppointment.time}
              </p>
              <p>
                <strong>Purpose:</strong> {bookedAppointment.purpose}
              </p>
              <button
                type="button"
                onClick={() => navigate('/appointments')}
                className="mt-1 inline-block font-semibold text-emerald-700 underline"
              >
                View in Appointments →
              </button>
            </div>
          )}

          {syncedLead && (
            <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                <span>
                  Lead synced to CRM: <strong>{syncedLead.name}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/leads')}
                className="font-semibold text-blue-700 underline shrink-0"
              >
                Open CRM
              </button>
            </div>
          )}

          {/* RAG Sources */}
          <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-violet-600" />
              Retrieved Knowledge Citations
            </h3>
            {ragSources.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">
                Ask about pricing, locations, amenities, or booking procedures to see live RAG
                grounding.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {ragSources.map((src, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-violet-50/70 border border-violet-100 px-2.5 py-1.5 text-xs font-medium text-violet-800"
                  >
                    {src}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Post-Call Summary */}
          {callSummary && (
            <div className="rounded-2xl bg-navy-900 text-white p-4 shadow-md space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-300">
                Post-Call AI Summary
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{callSummary.summary}</p>
              <div className="pt-2 border-t border-white/10 text-xs">
                <span className="text-violet-300 font-semibold">Next Action: </span>
                <span className="text-slate-200">{callSummary.recommendedNextAction}</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/calls')}
                className="mt-2 w-full rounded-xl bg-white/10 hover:bg-white/20 py-2 text-xs font-semibold text-white transition-colors"
              >
                Inspect Full Call Record
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
