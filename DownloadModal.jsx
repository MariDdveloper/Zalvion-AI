import { useState, useEffect } from "react";
import { X, Monitor, Apple, Laptop, Download, Check } from "lucide-react";
import { toast } from "sonner";

const PROMO = "https://images.pexels.com/photos/3747070/pexels-photo-3747070.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function DownloadModal({ open, onClose, t }) {
  const [deferred, setDeferred] = useState(typeof window !== "undefined" ? window.__deferredInstallPrompt : null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); window.__deferredInstallPrompt = e; setDeferred(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    if (window.__deferredInstallPrompt) setDeferred(window.__deferredInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!open) return null;

  const install = async () => {
    if (installed) return toast.success(t.installed);
    const prompt = deferred || window.__deferredInstallPrompt;
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") { setInstalled(true); toast.success(t.installed); }
      window.__deferredInstallPrompt = null;
      setDeferred(null);
    } else if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      toast.success(t.installed);
    } else {
      toast.error("Install unavailable in this browser. Open Zalvion AI in Chrome or Edge on desktop to install the app.");
    }
  };

  const platforms = [
    { icon: Monitor, name: "Windows" },
    { icon: Apple, name: "macOS" },
    { icon: Laptop, name: "Linux" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xl" onClick={onClose}>
      <div data-testid="download-modal" className="bg-[#FDFDF9] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-40">
          <img src={PROMO} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#2D2A26]/60 to-transparent" />
          <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-full bg-white/85 hover:bg-white transition-colors">
            <X size={18} />
          </button>
          <h2 className="absolute bottom-4 left-6 font-serif text-3xl text-white">{t.dlTitle}</h2>
        </div>
        <div className="p-6">
          <p className="text-[var(--text-secondary)] mb-5">{t.dlSub}</p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {platforms.map((p) => (
              <div key={p.name} className="flex flex-col items-center gap-2 border border-[var(--border-subtle)] rounded-2xl py-4 bg-white">
                <p.icon size={26} strokeWidth={1.5} className="text-[var(--text-primary)]" />
                <span className="text-sm font-medium">{p.name}</span>
              </div>
            ))}
          </div>
          <button data-testid="download-app-button" onClick={install}
            className="w-full flex items-center justify-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-full py-3.5 font-medium transition-colors">
            {installed ? <><Check size={18} /> {t.installed}</> : <><Download size={18} /> {t.install}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
