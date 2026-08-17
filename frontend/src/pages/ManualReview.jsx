import React, { useState, useEffect } from 'react';
import { UserCheck, ShieldAlert, Loader2, Sparkles, Check, RefreshCw, HelpCircle, Eye, AlertTriangle } from 'lucide-react';
import { getPendingReviews, resolveReview, getAllTigers } from '../services/api';

export default function ManualReview() {
  const [reviews, setReviews] = useState([]);
  const [tigers, setTigers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [reassignTargets, setReassignTargets] = useState({}); // Stores chosen target tiger ID per review item
  const [message, setMessage] = useState(null);

  const loadReviewData = async () => {
    setLoading(true);
    try {
      const [reviewRes, tigerRes] = await Promise.all([
        getPendingReviews(),
        getAllTigers()
      ]);
      if (reviewRes.data) setReviews(reviewRes.data);
      if (tigerRes.data) setTigers(tigerRes.data);
    } catch (err) {
      console.error('Error fetching human review dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviewData();
  }, []);

  const handleResolve = async (captureId, action, targetTigerId = null) => {
    setSubmittingId(captureId);
    setMessage(null);
    try {
      const payload = {
        capture_id: captureId,
        action
      };
      if (action === 'reassign' && targetTigerId) {
        payload.target_tiger_id = targetTigerId;
      }
      
      const res = await resolveReview(payload);
      if (res.data && res.data.status === 'success') {
        setMessage({ type: 'success', text: `Review resolved. Decision: ${action.toUpperCase()} - ${res.data.message || 'Done'}` });
        // Refresh listings
        loadReviewData();
      } else {
        setMessage({ type: 'error', text: res.data?.message || 'Resolution failed.' });
      }
    } catch (err) {
      console.error('Error resolving review decision:', err);
      setMessage({ type: 'error', text: 'Failed to transmit decision to server.' });
    } finally {
      setSubmittingId(null);
    }
  };

  const handleSelectReassign = (reviewId, val) => {
    setReassignTargets(prev => ({
      ...prev,
      [reviewId]: val
    }));
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADING */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-800 tracking-wider uppercase">
            Human-in-the-Loop Review Hub
          </div>
          <h1 className="text-2xl font-extrabold text-forest-950 tracking-tight">
            Biometric Matches Awaiting Verification
          </h1>
          
        </div>

        <div>
          <button
            onClick={loadReviewData}
            className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold"
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Sync Review queue
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-xs border ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950'
        }`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="panel flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
          <Loader2 className="animate-spin text-emerald-800" size={24} />
          <span className="text-xs font-medium">Scanning database for pending reviews...</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <UserCheck size={48} className="text-emerald-700" />
          <div className="text-center">
            <div className="text-sm font-bold text-forest-950">Zero Reviews Pending</div>
            <p className="text-xs text-slate-500 mt-1">Stripe Re-ID confidence is running above threshold limit. No reviews needed.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((rev) => {
            const selectedReassignId = reassignTargets[rev.id] || '';
            return (
              <div key={rev.id} className="panel grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
                
                {/* COLUMN 1 (5 Cols): CANDIDATE CAPTURE */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="flex justify-between items-start border-b border-surface-border pb-3">
                    <div>
                      <span className="badge-tag badge-warning text-[10px] uppercase font-bold flex items-center gap-1">
                        <AlertTriangle size={10} /> Review Queue
                      </span>
                      <h3 className="text-sm font-bold text-forest-950 mt-1">Capture Event: CPT-{rev.id}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-mono block">Match Score</span>
                      <span className="text-xs font-extrabold text-amber-700 font-mono">{(rev.confidence * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* PREVIEW IMAGE CONTAINER */}
                  <div className="aspect-video relative bg-slate-900 border border-surface-border rounded-xl overflow-hidden group">
                    <img
                      src={`http://127.0.0.1:8000${rev.raw_url}`}
                      alt="Candidate capture"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-sm text-[10px] text-white px-2 py-0.5 rounded font-mono">
                      Candidate Crop View
                    </div>
                  </div>

                  {/* TELEMETRY */}
                  <div className="grid grid-cols-2 gap-3 text-[11px] bg-surface-subtle p-3 rounded-lg border border-surface-border">
                    <div>
                      <span className="text-slate-400 block uppercase text-[9px] font-bold">Matched ID</span>
                      <strong className="text-forest-950 font-bold font-mono">{rev.candidate_tiger_id || 'Unknown'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block uppercase text-[9px] font-bold">Camera Node</span>
                      <strong className="text-forest-950 font-bold">{rev.station}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block uppercase text-[9px] font-bold">Timestamp (IST)</span>
                      <strong className="text-forest-950 font-semibold">{new Date(rev.timestamp).toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                {/* COLUMN 2 (7 Cols): MATCH COMPARISON AND REVIEW DECISIONS */}
                <div className="lg:col-span-7 flex flex-col justify-between space-y-6 lg:border-l lg:border-surface-border lg:pl-6">
                  
                  {/* COMPARISON SLIDES */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-forest-950 flex items-center gap-1.5">
                        <Eye size={14} className="text-emerald-700" />
                        Matched Reference Catalogue Comparisons
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">Faiss Database</span>
                    </div>

                    {rev.reference_images && rev.reference_images.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3">
                        {rev.reference_images.map((ref, idx) => (
                          <div key={idx} className="aspect-square bg-slate-800 border border-surface-border rounded-lg overflow-hidden relative group">
                            <img
                              src={`http://127.0.0.1:8000${ref.flank_url || ref.raw_url}`}
                              alt={`Reference ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-1 right-1 bg-forest-950/70 backdrop-blur-sm text-[9px] text-white px-1.5 py-0.5 rounded font-mono">
                              Ref {idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 border border-dashed border-surface-border rounded-xl text-slate-400 text-xs flex flex-col items-center justify-center gap-1">
                        <HelpCircle size={16} />
                        <span>No reference images available for matching template</span>
                      </div>
                    )}
                  </div>

                  {/* HUMAN DECISION CONTROLS */}
                  <div className="bg-surface-subtle border border-surface-border rounded-xl p-4 space-y-4">
                    <div className="text-xs font-bold text-forest-950 border-b border-surface-border/50 pb-2">
                      Resolve Capture Classification
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* Action 1: Confirm */}
                      <button
                        onClick={() => handleResolve(rev.id, 'confirm')}
                        disabled={submittingId === rev.id}
                        className="btn btn-primary text-xs font-bold py-2 px-4 flex-1 flex items-center justify-center gap-1.5"
                      >
                        <Check size={14} />
                        <span>Confirm Match ({rev.candidate_tiger_id})</span>
                      </button>

                      {/* Action 3: New Tiger */}
                      <button
                        onClick={() => handleResolve(rev.id, 'new_tiger')}
                        disabled={submittingId === rev.id}
                        className="btn btn-tiger text-xs font-bold py-2 px-4 flex-1 flex items-center justify-center gap-1.5"
                      >
                        <Sparkles size={14} />
                        <span>Enroll New Tiger</span>
                      </button>
                    </div>

                    {/* Action 2: Reassign Dropdown */}
                    <div className="border-t border-surface-border/50 pt-3 flex flex-col sm:flex-row items-center gap-3">
                      <div className="text-[11px] text-slate-600 font-medium whitespace-nowrap">
                        Or reassign to another individual:
                      </div>
                      <div className="flex gap-2 w-full">
                        <select
                          value={selectedReassignId}
                          onChange={(e) => handleSelectReassign(rev.id, e.target.value)}
                          className="flex-1 bg-white border border-surface-border rounded-lg text-xs px-3 py-1.5 outline-none font-bold text-forest-950"
                        >
                          <option value="">-- Choose Resident Tiger --</option>
                          {tigers
                            .filter(t => t.id !== rev.candidate_tiger_id)
                            .map(t => (
                              <option key={t.id} value={t.id}>
                                {t.id} ({t.name})
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={() => handleResolve(rev.id, 'reassign', selectedReassignId)}
                          disabled={submittingId === rev.id || !selectedReassignId}
                          className="btn btn-secondary text-xs font-bold px-4 py-1.5 whitespace-nowrap"
                        >
                          Reassign
                        </button>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
