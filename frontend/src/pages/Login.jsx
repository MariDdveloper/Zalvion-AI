import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mail, ArrowRight, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { apiPost } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { getT } from "../lib/i18n";
import LanguageMenu from "../components/LanguageMenu";

const AUTH_BG = "https://images.pexels.com/photos/5506215/pexels-photo-5506215.jpeg";

// Metti qui lo stesso Client ID che hai nel .env del backend (GOOGLE_CLIENT_ID).
// Meglio ancora: leggilo da process.env.REACT_APP_GOOGLE_CLIENT_ID se lo hai
// gia' definito nel .env del frontend.
const GOOGLE_CLIENT_ID =
  process.env.REACT_APP_GOOGLE_CLIENT_ID || "IL_TUO_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

/**
 * Bottone "Continua con Google" - flusso reale (Google Identity Services),
 * incluso direttamente qui dentro per non dover gestire un file/percorso separato.
 *
 * IMPORTANTE (Google Cloud Console -> Credenziali -> il tuo Client ID OAuth):
 * in "Authorized JavaScript origins" deve comparire l'ORIGINE ESATTA (schema +
 * dominio + porta) da cui l'app viene servita quando la testi (es. l'URL della
 * preview). Se non e' in lista, Google rifiuta silenziosamente il bottone.
 */
function GoogleLoginButton({ onSuccess, onError }) {
  const buttonDivRef = useRef(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    function initGoogleButton() {
      if (!window.google || !buttonDivRef.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(buttonDivRef.current, {
        theme: "outline",
        size: "large",
        width: 280,
        text: "continue_with",
        shape: "pill",
      });
    }

    async function handleCredentialResponse(response) {
      // response.credential e' il JWT firmato da Google (email, nome, foto).
      try {
        const data = await apiPost("/auth/google/verify", { credential: response.credential });
        onSuccess?.(data.user);
      } catch (err) {
        onError?.(err);
      }
    }

    if (!scriptLoadedRef.current) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogleButton;
      document.body.appendChild(script);
      scriptLoadedRef.current = true;
    } else {
      initGoogleButton();
    }
  }, []);

  return <div ref={buttonDivRef} />;
}

export default function Login() {
  const [lang, setLang] = useState(localStorage.getItem("claus_lang") || "it");
  const t = getT(lang);
  const [step, setStep] = useState("welcome"); // welcome | email | otp
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleLang = (c) => { setLang(c); localStorage.setItem("claus_lang", c); };

  const handleGoogleSuccess = (user) => {
    setUser(user);
    navigate("/");
  };

  const handleGoogleError = (err) => {
    toast.error(err.message || "Google sign-in failed");
  };

  const sendCode = async () => {
    if (!email.includes("@")) return toast.error("Enter a valid email");
    setBusy(true);
    try {
      await apiPost("/auth/otp/request", { email });
      setStep("otp");
      toast.success(t.otpSub + " " + email);
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const verify = async () => {
    if (code.length < 6) return toast.error("Enter the 6-digit code");
    setBusy(true);
    try {
      const data = await apiPost("/auth/otp/verify", { email, code });
      if (data.token) localStorage.setItem("claus_token", data.token);
      setUser(data.user);
      navigate("/");
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <div className="h-screen w-screen flex bg-[#FDFDF9] overflow-hidden">
      {/* Left visual */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <img src={AUTH_BG} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2D2A26]/55 via-[#2D2A26]/15 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <div className="flex items-center gap-3 mb-5">
            <div className="claus-orb" style={{ width: 38, height: 38 }} />
            <span className="font-serif text-2xl">Zalvion AI</span>
          </div>
          <h2 className="font-serif text-4xl leading-tight max-w-md">{t.welcome}</h2>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col">
        <div className="flex justify-end p-5">
          <LanguageMenu lang={lang} onChange={handleLang} t={t} />
        </div>
        <div className="flex-1 flex items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm fade-up">
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div className="claus-orb" style={{ width: 36, height: 36 }} />
              <span className="font-serif text-2xl">Zalvion AI</span>
            </div>

            {step === "welcome" && (
              <div>
                <h1 className="font-serif text-4xl tracking-tight mb-2">Zalvion AI</h1>
                <p className="text-[var(--text-secondary)] mb-8">{t.welcomeSub}</p>

                {/* Bottone Google reale (Google Identity Services), incluso sopra in questo stesso file */}
                <div className="flex justify-center" data-testid="login-google-button">
                  <GoogleLoginButton onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
                </div>

                <div className="flex items-center gap-3 my-5 text-[var(--text-secondary)] text-sm">
                  <div className="h-px flex-1 bg-[var(--border-subtle)]" /> {t.or} <div className="h-px flex-1 bg-[var(--border-subtle)]" />
                </div>
                <button data-testid="login-email-button" onClick={() => setStep("email")}
                  className="w-full flex items-center justify-center gap-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-full py-3 px-4 font-medium transition-colors">
                  <Mail size={18} strokeWidth={1.8} /> {t.withEmail}
                </button>
              </div>
            )}

            {step === "email" && (
              <div className="fade-up">
                <button onClick={() => setStep("welcome")} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] mb-6 hover:text-[var(--text-primary)]">
                  <ArrowLeft size={16} /> {t.back}
                </button>
                <h1 className="font-serif text-3xl mb-2">{t.withEmail}</h1>
                <p className="text-[var(--text-secondary)] mb-6">{t.welcomeSub}</p>
                <label className="text-sm font-medium">{t.email}</label>
                <input data-testid="login-email-input" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendCode()}
                  placeholder="name@email.com" autoFocus
                  className="w-full mt-2 mb-5 rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3 outline-none focus:border-[var(--primary)] transition-colors" />
                <button data-testid="send-code-button" onClick={sendCode} disabled={busy}
                  className="w-full flex items-center justify-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-full py-3 font-medium transition-colors disabled:opacity-60">
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <>{t.sendCode} <ArrowRight size={18} /></>}
                </button>
              </div>
            )}

            {step === "otp" && (
              <div className="fade-up">
                <button onClick={() => setStep("email")} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] mb-6 hover:text-[var(--text-primary)]">
                  <ArrowLeft size={16} /> {t.back}
                </button>
                <h1 className="font-serif text-3xl mb-2">{t.otpTitle}</h1>
                <p className="text-[var(--text-secondary)] mb-6">{t.otpSub} <span className="font-medium text-[var(--text-primary)]">{email}</span></p>
                <input data-testid="otp-input-field" inputMode="numeric" maxLength={6} value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && verify()}
                  placeholder="......" autoFocus
                  className="w-full mb-5 rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono outline-none focus:border-[var(--primary)] transition-colors" />
                <button data-testid="verify-otp-button" onClick={verify} disabled={busy}
                  className="w-full flex items-center justify-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-full py-3 font-medium transition-colors disabled:opacity-60">
                  {busy ? <Loader2 size={18} className="animate-spin" /> : t.verify}
                </button>
                <button onClick={sendCode} className="w-full text-sm text-[var(--text-secondary)] mt-4 hover:text-[var(--primary)]">{t.resend}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}