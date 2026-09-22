import { useState, useEffect } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { X, Check, Sparkles, Zap, Star, Crown } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../lib/api";
import { getReviews } from "../lib/marketing";

export default function Pricing({ open, onClose, t, lang, user, onUpgraded }) {
  const [billing, setBilling] = useState("yearly");
  const [cfg, setCfg] = useState(null);
  const reviews = getReviews(lang).slice(0, 3);

  useEffect(() => {
    if (open) apiGet("/billing/config").then(setCfg).catch(() => setCfg({ configured: false }));
  }, [open]);

  if (!open) return null;

  const isPro = user?.plan === "pro";
  const prices = cfg?.prices || { monthly: "10", yearly: "100", currency: "EUR" };
  const planId = cfg?.configured ? (billing === "yearly" ? cfg.yearly_plan_id : cfg.monthly_plan_id) : null;

  const freeFeatures = t.freeFeatures || ["5 messages/day", "Standard reasoning", "Web search & images", "15 languages", "Voice input"];
  const proFeatures = t.proFeatures || ["10 messages/day (2×)", "⚡ Advanced Reasoning", "Priority responses", "Web search & images", "15 languages + voice"];

  const activate = async (subscriptionID) => {
    try {
      await apiPost("/billing/activate", { subscription_id: subscriptionID, plan_type: billing });
      toast.success(t.upgradeSuccess || "Welcome to Pro! 🎉");
      await onUpgraded?.();
      onClose();
    } catch (e) {
      toast.error(e.message || "Activation failed");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 bg-black/50 backdrop-blur-xl" onClick={onClose}>
      <div data-testid="pricing-modal" className="bg-[#FDFDF9] rounded-3xl max-w-4xl w-full my-8 shadow-2xl fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="relative px-8 pt-8 pb-4 text-center">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5"><X size={20} /></button>
          <div className="inline-flex items-center gap-2 text-[var(--primary)] text-sm font-medium mb-2"><Sparkles size={15} /> {t.pricingTag || "Upgrade your intelligence"}</div>
          <h2 className="font-serif text-4xl">{t.pricingTitle || "Choose your plan"}</h2>
          <p className="text-[var(--text-secondary)] mt-2 max-w-lg mx-auto">{t.pricingSub || "Join thousands using Zalvion AI every day. Unlock double the power with Pro."}</p>

          <div className="inline-flex items-center gap-1 bg-black/[0.05] rounded-full p-1 mt-5">
            <button data-testid="billing-monthly" onClick={() => setBilling("monthly")}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${billing === "monthly" ? "bg-white shadow-sm font-medium" : "text-[var(--text-secondary)]"}`}>
              {t.monthly || "Monthly"}
            </button>
            <button data-testid="billing-yearly" onClick={() => setBilling("yearly")}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${billing === "yearly" ? "bg-white shadow-sm font-medium" : "text-[var(--text-secondary)]"}`}>
              {t.yearly || "Yearly"} <span className="text-[var(--primary)] font-semibold">-17%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 px-8 pb-4">
          {/* FREE */}
          <div className="border border-[var(--border-subtle)] rounded-2xl p-6 bg-white">
            <h3 className="font-serif text-2xl">Free</h3>
            <p className="text-3xl font-semibold mt-2">€0<span className="text-base font-normal text-[var(--text-secondary)]">/{billing === "yearly" ? (t.year || "year") : (t.month || "month")}</span></p>
            <p className="text-sm text-[var(--text-secondary)] mt-1 mb-4">{t.freeTag || "Great to get started"}</p>
            <ul className="space-y-2.5">
              {freeFeatures.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm"><Check size={16} className="text-[var(--text-secondary)] mt-0.5 flex-shrink-0" /> {f}</li>
              ))}
            </ul>
            <div className="mt-6 text-center text-sm text-[var(--text-secondary)] py-2.5 border border-[var(--border-subtle)] rounded-full">
              {!isPro ? (t.currentPlan || "Current plan") : "Free"}
            </div>
          </div>

          {/* PRO */}
          <div className="relative border-2 border-[var(--primary)] rounded-2xl p-6 bg-[var(--bg-accent)] shadow-lg">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--primary)] text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1"><Crown size={12} /> {t.mostPopular || "Most popular"}</span>
            <h3 className="font-serif text-2xl flex items-center gap-2">Pro <Zap size={18} className="text-[var(--primary)]" /></h3>
            <p className="text-3xl font-semibold mt-2">
              €{billing === "yearly" ? prices.yearly : prices.monthly}
              <span className="text-base font-normal text-[var(--text-secondary)]">/{billing === "yearly" ? (t.year || "year") : (t.month || "month")}</span>
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-1 mb-4">{t.proTag || "For power users who want the best"}</p>
            <ul className="space-y-2.5">
              {proFeatures.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm font-medium"><Check size={16} className="text-[var(--primary)] mt-0.5 flex-shrink-0" /> {f}</li>
              ))}
            </ul>

            <div className="mt-6" data-testid="pro-checkout">
              {isPro ? (
                <div className="text-center text-sm font-medium text-[var(--primary)] py-2.5 border border-[var(--primary)] rounded-full">{t.currentPlan || "Current plan"} ✓</div>
              ) : cfg?.configured && planId ? (
                <PayPalScriptProvider options={{ "client-id": cfg.client_id, vault: true, intent: "subscription", currency: "EUR" }}>
                  <PayPalButtons
                    key={billing}
                    style={{ layout: "vertical", color: "gold", shape: "pill", label: "subscribe" }}
                    createSubscription={(data, actions) => actions.subscription.create({ plan_id: planId })}
                    onApprove={(data) => activate(data.subscriptionID)}
                    onError={() => toast.error("PayPal error. Please try again.")}
                  />
                </PayPalScriptProvider>
              ) : (
                <div className="text-center text-xs text-[var(--text-secondary)] py-3 px-3 border border-dashed border-[var(--border-subtle)] rounded-xl" data-testid="paypal-not-configured">
                  {t.paypalPending || "Payments activate as soon as PayPal credentials are added (sandbox)."}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div className="px-8 pb-8 pt-2">
          <p className="text-center text-sm text-[var(--text-secondary)] mb-4">{t.lovedBy || "Loved by thousands worldwide"}</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {reviews.map((r, i) => (
              <div key={i} className="bg-white border border-[var(--border-subtle)] rounded-2xl p-4">
                <div className="flex gap-0.5 mb-2">{Array.from({ length: r.rating }).map((_, j) => <Star key={j} size={13} className="fill-[var(--primary)] text-[var(--primary)]" />)}</div>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed">“{r.text}”</p>
                <p className="text-xs text-[var(--text-secondary)] mt-2 font-medium">{r.name} · {r.role}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
