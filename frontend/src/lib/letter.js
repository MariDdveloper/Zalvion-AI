// Open letter from the developer, Mari_Developer, in 15 languages.
export const LETTER_LANGS = [
  { code: "it", label: "Italiano", cta: "Inizia ora", greeting: "Una lettera dallo sviluppatore",
    letter: "Buongiorno, sono Mari_Developer, lo sviluppatore ufficiale di questa AI, la vostra IA perfetta, soprattutto per scrivere codice. All'inizio sembrava un'idea stupida ma in realtà poi si è trasformata in un vero sogno che pian piano si sta avverando." },
  { code: "en", label: "English", cta: "Get Started", greeting: "A letter from the developer",
    letter: "Good morning, I am Mari_Developer, the official developer of this AI, your perfect AI, especially for writing code. At first it seemed like a stupid idea but in reality it then turned into a real dream that is slowly coming true." },
  { code: "es", label: "Español", cta: "Empezar", greeting: "Una carta del desarrollador",
    letter: "Buenos días, soy Mari_Developer, el desarrollador oficial de esta IA, su IA perfecta, especialmente para escribir código. Al principio parecía una idea estúpida pero en realidad luego se transformó en un verdadero sueño que poco a poco se está haciendo realidad." },
  { code: "fr", label: "Français", cta: "Commencer", greeting: "Une lettre du développeur",
    letter: "Bonjour, je suis Mari_Developer, le développeur officiel de cette IA, votre IA parfaite, surtout pour écrire du code. Au début cela semblait être une idée stupide mais en réalité elle s'est ensuite transformée en un véritable rêve qui est en train de se réaliser petit à petit." },
  { code: "de", label: "Deutsch", cta: "Loslegen", greeting: "Ein Brief vom Entwickler",
    letter: "Guten Morgen, ich bin Mari_Developer, der offizielle Entwickler dieser KI, Ihre perfekte KI, insbesondere zum Schreiben von Code. Anfangs schien es eine dämliche Idee zu sein, aber in Wirklichkeit hat es sich dann in einen echten Traum verwandelt, der Schritt für Schritt in Erfüllung geht." },
  { code: "pt", label: "Português", cta: "Começar", greeting: "Uma carta do programador",
    letter: "Bom dia, sou Mari_Developer, o desenvolvedor oficial desta IA, a sua IA perfeita, especialmente para escrever código. No início parecia uma ideia estúpida, mas na verdade transformou-se num verdadeiro sonho que aos poucos se está a realizar." },
  { code: "nl", label: "Nederlands", cta: "Aan de slag", greeting: "Een brief van de ontwikkelaar",
    letter: "Goedemorgen, ik ben Mari_Developer, de officiële ontwikkelaar van deze AI, uw perfecte AI, vooral voor het schrijven van code. In het begin leek het een stom idee, maar in werkelijkheid is het veranderd in een echte droom die langzaam uitkomt." },
  { code: "ru", label: "Русский", cta: "Начать", greeting: "Письмо от разработчика",
    letter: "Доброе утро, я Mari_Developer, официальный разработчик этого ИИ, вашего идеального ИИ, особенно для написания кода. Сначала это казалось глупой идеей, но на самом деле потом это превратилось в настоящую мечту, которая потихоньку сбывается." },
  { code: "zh", label: "中文", cta: "开始使用", greeting: "来自开发者的一封信",
    letter: "早上好，我是 Mari_Developer，这款人工智能的官方开发者，它是您完美的 AI，尤其擅长编写代码。起初这似乎是一个愚蠢的想法，但实际上它后来变成了一个真正的梦想，并正在一步步实现。" },
  { code: "ja", label: "日本語", cta: "始める", greeting: "開発者からの手紙",
    letter: "おはようございます。私はこのAIの公式開発者、Mari_Developerです。特にコードを書くのに最適な、あなたにとって完璧なAIです。最初は馬鹿げたアイデアのように見えましたが、実際には少しずつ実現していく本物の夢に変わりました。" },
  { code: "ar", label: "العربية", cta: "ابدأ الآن", greeting: "رسالة من المطوّر", rtl: true,
    letter: "صباح الخير، أنا Mari_Developer، المطوّر الرسمي لهذا الذكاء الاصطناعي، ذكاؤكم الاصطناعي المثالي، خاصةً لكتابة الشيفرة البرمجية. في البداية بدت الفكرة غبية، لكنها في الواقع تحوّلت إلى حلم حقيقي يتحقق شيئًا فشيئًا." },
  { code: "hi", label: "हिन्दी", cta: "शुरू करें", greeting: "डेवलपर की ओर से एक पत्र",
    letter: "शुभ प्रभात, मैं Mari_Developer हूँ, इस एआई का आधिकारिक डेवलपर, आपका आदर्श एआई, विशेष रूप से कोड लिखने के लिए। शुरू में यह एक मूर्खतापूर्ण विचार लग रहा था, लेकिन असल में बाद में यह एक वास्तविक सपने में बदल गया जो धीरे-धीरे सच हो रहा है।" },
  { code: "ko", label: "한국어", cta: "시작하기", greeting: "개발자가 보내는 편지",
    letter: "안녕하세요, 저는 이 AI의 공식 개발자인 Mari_Developer입니다. 특히 코딩에 최적화된 여러분의 완벽한 AI입니다. 처음에는 바보 같은 생각처럼 보였지만, 실제로는 조금씩 이뤄지고 있는 진짜 꿈으로 변했습니다." },
  { code: "tr", label: "Türkçe", cta: "Başla", greeting: "Geliştiriciden bir mektup",
    letter: "Günaydın, ben Mari_Developer, bu yapay zekânın resmi geliştiricisiyim; özellikle kod yazmak için mükemmel yapay zekânız. Başta saçma bir fikir gibi görünse de aslında zamanla yavaş yavaş gerçekleşen gerçek bir rüyaya dönüştü." },
  { code: "pl", label: "Polski", cta: "Zacznij", greeting: "List od twórcy",
    letter: "Dzień dobry, nazywam się Mari_Developer i jestem oficjalnym twórcą tej sztucznej inteligencji, Waszego idealnego AI, szczególnie do pisania kodu. Na początku wydawało się to głupim pomysłem, ale w rzeczywistości przerodziło się w prawdziwe marzenie, które powoli się spełnia." },
];

export function getLetterLang(code) {
  return LETTER_LANGS.find((l) => l.code === code) || LETTER_LANGS[0];
}

export function detectLetterLang() {
  const stored = localStorage.getItem("claus_lang");
  if (stored && LETTER_LANGS.some((l) => l.code === stored)) return stored;
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  return LETTER_LANGS.some((l) => l.code === nav) ? nav : "it";
}
