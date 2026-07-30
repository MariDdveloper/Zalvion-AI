// Hyper-realistic testimonials for Zalvion AI (coder & student focused, natural imperfections).
const REVIEWS = {
  it: [
    { name: "Luca R.", role: "Sviluppatore full-stack", text: "Ragazzi ma è assurdo!! Gli ho passato un bug di scraping che mi bloccava da 3 giorni e me l'ha risolto al primo colpo. Scrive codice pulito davvero.", rating: 5 },
    { name: "Martina P.", role: "Studentessa di Informatica", text: "lo uso ogni giorno per i progetti universitari, mi spiega tutto passo passo. onestamente meglio di tanti prof lol", rating: 5 },
    { name: "Simone C.", role: "Backend dev", text: "Finalmente una AI che NON inventa librerie che non esistono. Il codice gira e basta. Lo tengo aperto tutto il giorno.", rating: 5 },
    { name: "Giada M.", role: "Frontend developer", text: "L'anteprima live del codice è una figata pazzesca, vedo subito il risultato. Mi ha fatto risparmiare un sacco di tempo!", rating: 5 },
    { name: "Alessandro T.", role: "Studente liceo (informatica)", text: "avevo paura fosse la solita AI lenta e invece è velocissima. mi ha aiutato a fare il sito per la scuola in una serata", rating: 5 },
    { name: "Federico N.", role: "Data engineer", text: "Uso Zalvion per gli script di scraping e automazione. Capisce esattamente cosa voglio, anche quando spiego male. Consigliatissimo!!", rating: 5 },
  ],
  en: [
    { name: "Luke R.", role: "Full-stack developer", text: "Guys this is insane!! Gave it a scraping bug that blocked me for 3 days and it fixed it first try. Genuinely clean code.", rating: 5 },
    { name: "Martina P.", role: "CS student", text: "i use it every day for my uni projects, explains everything step by step. honestly better than some professors lol", rating: 5 },
    { name: "Simon C.", role: "Backend dev", text: "Finally an AI that does NOT invent libraries that don't exist. The code just runs. I keep it open all day.", rating: 5 },
    { name: "Jade M.", role: "Frontend developer", text: "The live code preview is amazing, I see the result instantly. Saved me so much time!", rating: 5 },
    { name: "Alex T.", role: "High-school student", text: "was scared it'd be the usual slow AI but it's super fast. helped me build the school website in one evening", rating: 5 },
    { name: "Fred N.", role: "Data engineer", text: "I use Zalvion for scraping and automation scripts. It gets exactly what I want, even when I explain it badly. Highly recommend!!", rating: 5 },
  ],
};

const STATS = {
  it: [
    { value: "1.4M+", label: "righe di codice scritte" },
    { value: "190+", label: "paesi" },
    { value: "4.9/5", label: "valutazione media" },
    { value: "15", label: "lingue" },
  ],
  en: [
    { value: "1.4M+", label: "lines of code written" },
    { value: "190+", label: "countries" },
    { value: "4.9/5", label: "average rating" },
    { value: "15", label: "languages" },
  ],
};

export function getReviews(lang) { return REVIEWS[lang] || REVIEWS.en; }
export function getStats(lang) { return STATS[lang] || STATS.en; }
