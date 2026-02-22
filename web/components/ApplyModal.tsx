"use client";

import { useRef, useState } from "react";
import type { RankedScheme } from "@/types/scheme";
import type { Application, ApplicationStatus } from "@/types/citizen";

interface ApplyModalProps {
  scheme: RankedScheme;
  citizenData: { age: number; income: number; state: string; category: string; email?: string };
  citizenId?: string | null;
  onClose: () => void;
  onApplied?: (applicationId: string, schemeId: string, schemeName: string) => void;
}

const STATUS_STEPS: { key: ApplicationStatus; label: string; desc: string }[] = [
  { key: "started",             label: "Application Started",  desc: "Your application has been created" },
  { key: "documents_submitted", label: "Docs Submitted",       desc: "Documents submitted for review" },
  { key: "under_review",        label: "Under Review",         desc: "Officials are verifying your case" },
  { key: "approved",            label: "Approved",             desc: "Application approved!" },
];

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png";
const MAX_FILE_MB = 5;

function FileUploadSlot({
  label,
  hint,
  required,
  file,
  onChange,
}: {
  label: string;
  hint: string;
  required?: boolean;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`border-3 rounded-2xl p-3 flex items-center gap-3 cursor-pointer transition-all ${
        file
          ? "border-black bg-[#d9ff00]"
          : "border-dashed border-black/30 bg-white hover:border-black/60"
      }`}
      onClick={() => ref.current?.click()}
    >
      <div className="text-2xl">{file ? "ðŸ“„" : "ðŸ“Ž"}</div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-xs uppercase">
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
          {!required && <span className="text-black/30 ml-1">(optional)</span>}
        </p>
        <p className="font-bold text-[10px] text-black/40 truncate">
          {file ? file.name : hint}
        </p>
      </div>
      {file ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(null); }}
          className="text-black/40 hover:text-black font-black text-lg"
        >
          Ã—
        </button>
      ) : (
        <span className="text-[10px] font-black uppercase bg-black text-white px-2 py-1 rounded-full">
          Upload
        </span>
      )}
      <input
        ref={ref}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f && f.size > MAX_FILE_MB * 1024 * 1024) {
            alert(`File too large. Max ${MAX_FILE_MB} MB allowed.`);
            return;
          }
          onChange(f);
        }}
      />
    </div>
  );
}

export default function ApplyModal({ scheme, citizenData, citizenId, onClose, onApplied }: ApplyModalProps) {
  const [step, setStep]           = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<Application | null>(null);
  const [error, setError]         = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);

  // â”€â”€ Credentials state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [aadhaar, setAadhaar]   = useState("");
  const [pan, setPan]           = useState("");
  const [bankAcc, setBankAcc]   = useState("");
  const [ifsc, setIfsc]         = useState("");
  const [voterID, setVoterID]   = useState("");
  const [rationCard, setRationCard] = useState("");

  // â”€â”€ File uploads â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [fileAadhaar,      setFileAadhaar]      = useState<File | null>(null);
  const [fileIncome,       setFileIncome]       = useState<File | null>(null);
  const [fileBankPassbook, setFileBankPassbook] = useState<File | null>(null);
  const [fileCaste,        setFileCaste]        = useState<File | null>(null);
  const [fileOther,        setFileOther]        = useState<File | null>(null);

  // Fetch required docs on mount
  useState(() => {
    fetch("/api/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_docs", scheme_id: scheme.scheme_id, category: citizenData.category }),
    })
      .then((r) => r.json())
      .then((d) => setRequiredDocs(d.required_docs ?? []))
      .catch(() => setRequiredDocs(["Aadhaar Card", "Income Certificate", "Bank Account"]));
  });

  // Aadhaar validation: 12 digits
  const aadhaarValid = /^\d{12}$/.test(aadhaar.replace(/\s/g, ""));

  async function submitApplication() {
    setLoading(true);
    setError("");
    try {
      const uploadedFiles = [
        fileAadhaar      && { label: "Aadhaar Card",    name: fileAadhaar.name,      size: fileAadhaar.size },
        fileIncome       && { label: "Income Cert",     name: fileIncome.name,       size: fileIncome.size },
        fileBankPassbook && { label: "Bank Passbook",   name: fileBankPassbook.name, size: fileBankPassbook.size },
        fileCaste        && { label: "Caste Cert",      name: fileCaste.name,        size: fileCaste.size },
        fileOther        && { label: "Other Document",  name: fileOther.name,        size: fileOther.size },
      ].filter(Boolean);

      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:      "submit",
          scheme_id:   scheme.scheme_id,
          scheme_name: scheme.name,
          category:    citizenData.category,
          age:         citizenData.age,
          income:      citizenData.income,
          state:       citizenData.state,
          citizen_id:  citizenId ?? null,
          credentials: {
            aadhaar:    aadhaar.replace(/\s/g, ""),
            pan:        pan.trim().toUpperCase() || null,
            bank_account: bankAcc.trim() || null,
            ifsc:       ifsc.trim().toUpperCase() || null,
            voter_id:   voterID.trim().toUpperCase() || null,
            ration_card: rationCard.trim() || null,
          },
          docs: {
            confirmed:     true,
            required_docs: requiredDocs,
            uploaded_files: uploadedFiles,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setResult(data);
      setStep(4);
      onApplied?.(data.application_id, scheme.scheme_id, scheme.name);
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to submit");
    }
    setLoading(false);
  }

  const currentStatusIndex = result
    ? STATUS_STEPS.findIndex((s) => s.key === result.status)
    : 0;

  const totalSteps = 4;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#e4e4db] border-4 border-black rounded-t-3xl sm:rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="sticky top-0 bg-[#e4e4db] border-b-4 border-black px-6 pt-5 pb-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-0.5">
              Apply â€” Step {step} of {totalSteps}
            </p>
            <h2 className="font-black text-xl uppercase tracking-tight">{scheme.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-black text-white rounded-full flex items-center justify-center font-black text-lg hover:bg-black/70"
          >
            Ã—
          </button>
        </div>

        {/* Step progress */}
        <div className="flex gap-1.5 px-6 pt-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                i + 1 <= step ? "bg-black" : "bg-black/20"
              }`}
            />
          ))}
        </div>

        <div className="px-6 py-5">

          {/* â”€â”€ Step 1: Documents checklist â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-black text-lg uppercase mb-1">Documents Required</h3>
                <p className="text-sm font-bold text-black/50">
                  Keep these ready. Originals + 1 photocopy each.
                </p>
              </div>

              <ul className="space-y-2">
                {(requiredDocs.length ? requiredDocs : ["Aadhaar Card", "Income Certificate", "Bank Account"]).map(
                  (doc, i) => (
                    <li key={i} className="flex items-center gap-3 bg-white border-2 border-black rounded-xl px-4 py-3">
                      <span className="w-7 h-7 rounded-full bg-[#d9ff00] border-2 border-black flex items-center justify-center text-xs font-black">
                        {i + 1}
                      </span>
                      <span className="font-bold text-sm">{doc}</span>
                    </li>
                  ),
                )}
              </ul>

              <label className="flex items-start gap-3 bg-[#d9ff00] border-3 border-black rounded-2xl p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-5 w-5 accent-black"
                />
                <span className="font-bold text-sm">
                  I confirm I have the above documents and will submit them when required by the scheme authority.
                </span>
              </label>

              <button
                onClick={() => setStep(2)}
                disabled={!confirmed}
                className="civis-btn w-full rounded-full py-3 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue â†’
              </button>
            </div>
          )}

          {/* â”€â”€ Step 2: Credentials + Document Upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-black text-lg uppercase mb-1">Your Credentials</h3>
                <p className="text-sm font-bold text-black/50">
                  Aadhaar is required. All other fields are optional but help speed up verification.
                </p>
              </div>

              {/* Aadhaar â€” required */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
                  Aadhaar Number <span className="text-red-600">*</span>
                </label>
                <input
                  className="civis-input w-full rounded-lg font-mono tracking-widest text-lg"
                  placeholder="XXXX XXXX XXXX"
                  maxLength={14}
                  value={aadhaar}
                  onChange={(e) => {
                    // auto-format with spaces
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 12);
                    setAadhaar(raw.replace(/(\d{4})(?=\d)/g, "$1 ").trim());
                  }}
                />
                {aadhaar && !aadhaarValid && (
                  <p className="text-red-600 text-[11px] font-bold mt-1">Must be exactly 12 digits.</p>
                )}
              </div>

              {/* PAN */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
                  PAN Card Number <span className="text-black/30 font-bold">(optional)</span>
                </label>
                <input
                  className="civis-input w-full rounded-lg font-mono uppercase tracking-widest"
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Bank Account */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
                    Bank Account No. <span className="text-black/30">(opt)</span>
                  </label>
                  <input
                    className="civis-input w-full rounded-lg font-mono"
                    placeholder="XXXXXXXXXXXXXXX"
                    value={bankAcc}
                    onChange={(e) => setBankAcc(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                {/* IFSC */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
                    IFSC Code <span className="text-black/30">(opt)</span>
                  </label>
                  <input
                    className="civis-input w-full rounded-lg font-mono uppercase"
                    placeholder="SBIN0001234"
                    maxLength={11}
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  />
                </div>
                {/* Voter ID */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
                    Voter ID <span className="text-black/30">(opt)</span>
                  </label>
                  <input
                    className="civis-input w-full rounded-lg font-mono uppercase"
                    placeholder="ABC1234567"
                    maxLength={10}
                    value={voterID}
                    onChange={(e) => setVoterID(e.target.value.toUpperCase())}
                  />
                </div>
                {/* Ration Card */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
                    Ration Card No. <span className="text-black/30">(opt)</span>
                  </label>
                  <input
                    className="civis-input w-full rounded-lg font-mono"
                    placeholder="RC-XXXXXXXXXX"
                    value={rationCard}
                    onChange={(e) => setRationCard(e.target.value)}
                  />
                </div>
              </div>

              {/* Document uploads */}
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-black/50 mb-2">
                  Upload Documents <span className="text-black/30 normal-case font-bold">(PDF/JPG/PNG, max 5 MB each)</span>
                </p>
                <div className="space-y-2">
                  <FileUploadSlot
                    label="Aadhaar Card"
                    hint="Front + back scan or photo"
                    required
                    file={fileAadhaar}
                    onChange={setFileAadhaar}
                  />
                  <FileUploadSlot
                    label="Income Certificate"
                    hint="Issued by Tehsildar / revenue authority"
                    file={fileIncome}
                    onChange={setFileIncome}
                  />
                  <FileUploadSlot
                    label="Bank Passbook / Statement"
                    hint="First page showing account details"
                    file={fileBankPassbook}
                    onChange={setFileBankPassbook}
                  />
                  <FileUploadSlot
                    label="Caste Certificate"
                    hint="Required for SC/ST/OBC schemes"
                    file={fileCaste}
                    onChange={setFileCaste}
                  />
                  <FileUploadSlot
                    label="Any Other Document"
                    hint="Land record, disability cert, etc."
                    file={fileOther}
                    onChange={setFileOther}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-3 bg-white border-3 border-black rounded-full font-black uppercase text-sm hover:bg-black/5 transition-colors"
                >
                  â† Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!aadhaarValid}
                  className="flex-1 civis-btn rounded-full py-3 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Review Application â†’
                </button>
              </div>
            </div>
          )}

          {/* â”€â”€ Step 3: Review & Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-black text-lg uppercase mb-1">Review & Submit</h3>
                <p className="text-sm font-bold text-black/50">Check details before final submission.</p>
              </div>

              {/* Profile */}
              <div className="bg-white border-3 border-black rounded-2xl p-4 grid grid-cols-2 gap-3">
                {[
                  { label: "Age",       value: citizenData.age },
                  { label: "Income",    value: `â‚¹${Number(citizenData.income).toLocaleString("en-IN")}` },
                  { label: "State",     value: citizenData.state || "â€”" },
                  { label: "Category",  value: citizenData.category || "General" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-black uppercase text-black/40">{label}</p>
                    <p className="font-black capitalize">{String(value)}</p>
                  </div>
                ))}
              </div>

              {/* Scheme */}
              <div className="bg-[#d9ff00] border-3 border-black rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase text-black/40 mb-1">Applying for</p>
                <p className="font-black text-lg">{scheme.name}</p>
                <p className="font-bold text-black/60 text-sm mt-1">{scheme.benefits}</p>
              </div>

              {/* Submitted credentials summary */}
              <div className="bg-white border-3 border-black rounded-2xl p-4 space-y-2">
                <p className="text-[10px] font-black uppercase text-black/40 mb-1">Credentials Submitted</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <div>
                    <span className="font-bold text-black/40">Aadhaar: </span>
                    <span className="font-black">
                      {"X".repeat(8) + aadhaar.replace(/\s/g, "").slice(-4)}
                    </span>
                  </div>
                  {pan      && <div><span className="font-bold text-black/40">PAN: </span><span className="font-black">{pan}</span></div>}
                  {bankAcc  && <div><span className="font-bold text-black/40">Bank A/c: </span><span className="font-black">{"X".repeat(Math.max(0, bankAcc.length - 4)) + bankAcc.slice(-4)}</span></div>}
                  {ifsc     && <div><span className="font-bold text-black/40">IFSC: </span><span className="font-black">{ifsc}</span></div>}
                  {voterID  && <div><span className="font-bold text-black/40">Voter ID: </span><span className="font-black">{voterID}</span></div>}
                  {rationCard && <div><span className="font-bold text-black/40">Ration: </span><span className="font-black">{rationCard}</span></div>}
                </div>

                {/* Uploaded files */}
                {[fileAadhaar, fileIncome, fileBankPassbook, fileCaste, fileOther].some(Boolean) && (
                  <div className="mt-2 pt-2 border-t border-black/10">
                    <p className="text-[10px] font-black uppercase text-black/40 mb-1">Uploaded Files</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        fileAadhaar      && { label: "Aadhaar",    f: fileAadhaar },
                        fileIncome       && { label: "Income",     f: fileIncome },
                        fileBankPassbook && { label: "Bank",       f: fileBankPassbook },
                        fileCaste        && { label: "Caste Cert", f: fileCaste },
                        fileOther        && { label: "Other",      f: fileOther },
                      ].filter(Boolean).map((item) => (
                        <span key={(item as { label: string }).label} className="bg-black text-[#d9ff00] text-[10px] font-black px-2 py-0.5 rounded-full">
                          ðŸ“„ {(item as { label: string }).label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 text-red-700 font-bold text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="px-5 py-3 bg-white border-3 border-black rounded-full font-black uppercase text-sm hover:bg-black/5 transition-colors"
                >
                  â† Back
                </button>
                <button
                  onClick={submitApplication}
                  disabled={loading}
                  className="flex-1 civis-btn rounded-full py-3"
                >
                  {loading ? "Submittingâ€¦" : "Confirm & Submit â†’"}
                </button>
              </div>
            </div>
          )}

          {/* â”€â”€ Step 4: Success + Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 4 && result && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 bg-[#d9ff00] border-4 border-black rounded-full flex items-center justify-center text-2xl mx-auto mb-3">
                  âœ“
                </div>
                <h3 className="font-black text-xl uppercase">Application Submitted!</h3>
                <p className="font-bold text-black/50 text-sm mt-1">{result.message}</p>
              </div>

              {/* Application ID */}
              <div className="bg-black text-[#d9ff00] rounded-2xl p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Application ID</p>
                <p className="font-black text-lg tracking-widest">{String(result.application_id).toUpperCase().slice(0, 12)}</p>
                <p className="text-[10px] font-bold opacity-50 mt-1">Save this for tracking</p>
              </div>

              {/* Status timeline */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-black/40 mb-3">Application Progress</p>
                <div className="space-y-0">
                  {STATUS_STEPS.map((s, idx) => {
                    const done    = idx <= currentStatusIndex;
                    const current = idx === currentStatusIndex;
                    return (
                      <div key={s.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full border-3 flex items-center justify-center text-xs font-black flex-shrink-0 ${
                            done ? "bg-black border-black text-[#d9ff00]" : "bg-white border-black/30 text-black/30"
                          }`}>
                            {done ? "âœ“" : idx + 1}
                          </div>
                          {idx < STATUS_STEPS.length - 1 && (
                            <div className={`w-0.5 h-6 ${done ? "bg-black" : "bg-black/20"}`} />
                          )}
                        </div>
                        <div className="pb-4">
                          <p className={`font-black text-sm ${current ? "text-black" : done ? "text-black/60" : "text-black/30"}`}>
                            {s.label}
                            {current && (
                              <span className="ml-2 text-[9px] bg-[#d9ff00] border border-black px-1.5 py-0.5 rounded-full uppercase">
                                Current
                              </span>
                            )}
                          </p>
                          <p className="text-xs font-bold text-black/40">{s.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Next steps */}
              {result.next_steps && result.next_steps.length > 0 && (
                <div className="bg-white border-3 border-black rounded-2xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">Next Steps</p>
                  <ol className="space-y-2">
                    {result.next_steps.map((ns, i) => (
                      <li key={i} className="flex gap-2 text-sm font-bold text-black/70">
                        <span className="font-black text-black">{i + 1}.</span> {ns}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full bg-black text-[#d9ff00] font-black uppercase py-3 rounded-full text-sm hover:bg-black/80 transition-colors"
              >
                Done
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
