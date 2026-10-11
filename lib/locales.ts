/**
 * The site in other languages, for the people who search in them.
 *
 * What this is, and just as importantly what it is not.
 *
 * It is a real page per language, at its own URL, explaining what YepItsHalal
 * is and what each label means, so that somebody searching "مطاعم حلال لندن"
 * or "লন্ডনে হালাল রেস্তোরাঁ" lands on something written for them rather than
 * on an English page they have to work through. Distinct URLs plus hreflang is
 * the only thing search engines actually act on; a switcher that swaps words
 * on one URL does nothing for them.
 *
 * It is NOT a machine translation of eleven thousand listings. Two reasons,
 * both serious. The listings quote what a restaurant published about its own
 * meat, in the restaurant's own words, and a translated quotation is no longer
 * a quotation: on a site whose whole argument is "here is exactly what was
 * said and who said it", that is the one thing we cannot do. And thousands of
 * auto-translated near-duplicate pages is the pattern search engines demote
 * domains for, so it would cost us the ranking it was meant to buy.
 *
 * So each translated page says plainly that the listings and the search are in
 * English, and sends people into them with the vocabulary explained. Every
 * label name is given in the local language AND in the English the badge
 * actually shows, because a reader needs to recognise the badge when they get
 * there.
 *
 * Adding a language means adding one entry here. Nothing else changes.
 */

export interface LocaleCopy {
  /** BCP 47 code, and the URL segment: /ar, /ur, /bn, /tr, /fr. */
  code: string;
  /** The language's own name for itself, for the switcher. */
  endonym: string;
  dir: 'ltr' | 'rtl';
  title: string;
  description: string;
  beta: string;
  h1: string;
  intro: string;
  /** "The site itself is in English." Said near the top, not buried. */
  englishNote: string;
  ctaSearch: string;
  ctaHow: string;
  labelsHeading: string;
  labels: { en: string; name: string; body: string }[];
  evidenceHeading: string;
  evidence: string[];
  browseHeading: string;
  browseBody: string;
  notifyHeading: string;
  notifyBody: string;
  notifyButton: string;
  notifyEmailPlaceholder: string;
  notifyCityPlaceholder: string;
  /** Read out by a screen reader, so translated with everything else. */
  notifyEmailLabel: string;
  notifyCityLabel: string;
  notifySending: string;
  notifyDoneTitle: string;
  notifyDoneBody: string;
  notifyPrivacy: string;
}

export const LOCALES: LocaleCopy[] = [
  {
    code: 'ar',
    endonym: 'العربية',
    dir: 'rtl',
    title: 'مطاعم حلال في لندن',
    description:
      'أماكن الطعام الحلال في لندن، مع الدليل وراء كل تصنيف وتاريخ آخر تحقّق. مجانًا وبدون حساب.',
    beta: 'نسخة تجريبية',
    h1: 'مطاعم حلال في لندن',
    intro:
      'يعرض YepItsHalal أماكن الطعام الحلال في لندن، مع الدليل وراء كل تصنيف وتاريخ آخر تحقّق. مجانًا وبدون حساب.',
    englishNote:
      'الموقع والبحث وصفحات المطاعم باللغة الإنجليزية. هذه الصفحة تشرح ما يعنيه كل تصنيف قبل أن تبدأ.',
    ctaSearch: 'ابحث في لندن',
    ctaHow: 'كيف نصنّف الأماكن',
    labelsHeading: 'ماذا تعني التصنيفات',
    labels: [
      { en: 'Fully Halal', name: 'حلال بالكامل', body: 'أدلة قوية على أن كل اللحوم حلال.' },
      { en: 'Halal food available', name: 'خيارات حلال', body: 'يقدّم طعامًا حلالًا إلى جانب طعام غير حلال.' },
      {
        en: 'Unverified',
        name: 'غير مؤكد',
        body: 'هناك ما يشير إلى طعام حلال، لكنه غير مؤكد. هذا لا يعني أبدًا أنه غير حلال.',
      },
    ],
    evidenceHeading: 'كيف نعرف',
    evidence: [
      'نقرأ ما ينشره المطعم عن نفسه، ونقتبسه مع رابط وتاريخ القراءة.',
      'لا نُظهر شهادة حلال إلا بعد تأكيدها مع الجهة المانحة. أما قول المطعم إنه حاصل على شهادة فيُعرض على أنه قول المطعم.',
      'لم يزر أحد من YepItsHalal أي مطعم حتى الآن، والموقع يقول ذلك في كل صفحة.',
    ],
    browseHeading: 'من أين تبدأ',
    browseBody: 'تصفّح حسب المنطقة أو حسب نوع الطعام، أو ابحث بالرمز البريدي.',
    notifyHeading: "لست في لندن؟ أخبرنا أين تبحث.",
    notifyBody: "سنراسلك فور وصولنا إلى هناك. ونتوسّع أولًا حيث يطلبنا أكبر عدد من الناس.",
    notifyButton: 'أبلغوني',
    notifyEmailPlaceholder: 'you@example.com',
    notifyCityPlaceholder: 'أي مدينة؟ (اختياري)',
    notifyEmailLabel: "بريدك الإلكتروني",
    notifyCityLabel: "أي مدينة نغطّيها بعدك؟",
    notifySending: "جارٍ الإرسال…",
    notifyDoneTitle: 'تم تسجيلك',
    notifyDoneBody: 'سنراسلك عندما نصل إلى مدينة جديدة. لا شيء آخر، ولن نعطي بريدك لأحد.',
    notifyPrivacy: 'بريد واحد، لهذا الغرض فقط. لن يُباع أبدًا، ويمكنك إلغاء الاشتراك بنقرة.',
  },
  {
    code: 'ur',
    endonym: 'اردو',
    dir: 'rtl',
    title: 'لندن میں حلال ریستوران',
    description:
      'لندن میں حلال کھانے کی جگہیں، ہر لیبل کے پیچھے کا ثبوت اور جانچ کی تاریخ کے ساتھ۔ مفت، بغیر اکاؤنٹ کے۔',
    beta: 'بیٹا',
    h1: 'لندن میں حلال ریستوران',
    intro:
      'YepItsHalal لندن میں حلال کھانے کی جگہیں دکھاتا ہے، ہر لیبل کے پیچھے کا ثبوت اور جانچ کی تاریخ کے ساتھ۔ مفت، بغیر کسی اکاؤنٹ کے۔',
    englishNote:
      'سائٹ، تلاش اور ریستوران کے صفحات انگریزی میں ہیں۔ یہ صفحہ شروع کرنے سے پہلے بتاتا ہے کہ ہر لیبل کا مطلب کیا ہے۔',
    ctaSearch: 'لندن میں تلاش کریں',
    ctaHow: 'ہم جگہوں کو کیسے لیبل کرتے ہیں',
    labelsHeading: 'لیبل کا مطلب کیا ہے',
    labels: [
      { en: 'Fully Halal', name: 'مکمل حلال', body: 'مضبوط ثبوت کہ سارا گوشت حلال ہے۔' },
      { en: 'Halal food available', name: 'حلال آپشنز', body: 'یہاں حلال کھانا بھی ملتا ہے اور غیر حلال بھی۔' },
      {
        en: 'Unverified',
        name: 'غیر تصدیق شدہ',
        body: 'حلال ہونے کے آثار ہیں، مگر تصدیق نہیں ہوئی۔ اس کا مطلب کبھی یہ نہیں کہ حرام ہے۔',
      },
    ],
    evidenceHeading: 'ہمیں کیسے پتہ چلتا ہے',
    evidence: [
      'ریستوران خود جو کچھ شائع کرتا ہے، ہم وہی پڑھتے ہیں اور لنک اور تاریخ کے ساتھ نقل کرتے ہیں۔',
      'حلال سرٹیفکیٹ صرف اس وقت دکھایا جاتا ہے جب متعلقہ ادارے سے تصدیق ہو جائے۔ ریستوران کا اپنا دعویٰ اسی طرح دکھایا جاتا ہے، دعوے کے طور پر۔',
      'YepItsHalal کی طرف سے ابھی تک کوئی خود جا کر کسی ریستوران کو نہیں دیکھ سکا، اور سائٹ ہر صفحے پر یہ بات کہتی ہے۔',
    ],
    browseHeading: 'کہاں سے شروع کریں',
    browseBody: 'علاقے کے حساب سے یا کھانے کی قسم کے حساب سے دیکھیں، یا پوسٹ کوڈ سے تلاش کریں۔',
    notifyHeading: "لندن میں نہیں ہیں؟ بتائیں آپ کہاں تلاش کر رہے ہیں۔",
    notifyBody: "جیسے ہی ہم وہاں پہنچیں گے، آپ کو ای میل کریں گے۔ ہم وہیں سے پھیلتے ہیں جہاں سب سے زیادہ لوگ کہتے ہیں۔",
    notifyButton: 'مجھے اطلاع دیں',
    notifyEmailPlaceholder: 'you@example.com',
    notifyCityPlaceholder: 'کون سا شہر؟ (اختیاری)',
    notifyEmailLabel: "آپ کا ای میل",
    notifyCityLabel: "ہم اگلا کون سا شہر شامل کریں؟",
    notifySending: "بھیجا جا رہا ہے…",
    notifyDoneTitle: 'آپ فہرست میں شامل ہیں',
    notifyDoneBody: 'نیا شہر شامل ہونے پر ہم ای میل کریں گے۔ اور کچھ نہیں، اور کسی کو نہیں دیں گے۔',
    notifyPrivacy: 'ایک ای میل، صرف اسی کام کے لیے۔ کبھی فروخت نہیں ہوگی، ایک کلک میں ان سبسکرائب۔',
  },
  {
    code: 'bn',
    endonym: 'বাংলা',
    dir: 'ltr',
    title: 'লন্ডনের হালাল রেস্তোরাঁ',
    description:
      'লন্ডনে হালাল খাবারের জায়গা, প্রতিটি লেবেলের পেছনের প্রমাণ আর যাচাইয়ের তারিখসহ। বিনামূল্যে, অ্যাকাউন্ট ছাড়াই।',
    beta: 'বেটা',
    h1: 'লন্ডনের হালাল রেস্তোরাঁ',
    intro:
      'YepItsHalal লন্ডনের হালাল খাবারের জায়গা দেখায়, প্রতিটি লেবেলের পেছনের প্রমাণ আর কবে যাচাই হয়েছে তার তারিখসহ। বিনামূল্যে, অ্যাকাউন্ট ছাড়াই।',
    englishNote:
      'সাইট, সার্চ আর রেস্তোরাঁর পাতাগুলো ইংরেজিতে। শুরু করার আগে এই পাতাটি বুঝিয়ে দেয় কোন লেবেলের মানে কী।',
    ctaSearch: 'লন্ডনে খুঁজুন',
    ctaHow: 'আমরা কীভাবে লেবেল দিই',
    labelsHeading: 'লেবেলগুলোর মানে কী',
    labels: [
      { en: 'Fully Halal', name: 'সম্পূর্ণ হালাল', body: 'শক্ত প্রমাণ আছে যে সব মাংস হালাল।' },
      {
        en: 'Halal food available',
        name: 'হালাল অপশন',
        body: 'এখানে হালাল খাবারের পাশাপাশি হালাল নয় এমন খাবারও দেওয়া হয়।',
      },
      {
        en: 'Unverified',
        name: 'যাচাই করা হয়নি',
        body: 'হালাল হওয়ার লক্ষণ আছে, কিন্তু নিশ্চিত করা হয়নি। এর মানে কখনোই এই নয় যে হালাল নয়।',
      },
    ],
    evidenceHeading: 'আমরা কীভাবে জানি',
    evidence: [
      'রেস্তোরাঁ নিজে যা প্রকাশ করে আমরা তাই পড়ি, আর লিংক ও পড়ার তারিখসহ উদ্ধৃত করি।',
      'হালাল সার্টিফিকেট কেবল তখনই দেখানো হয় যখন সংস্থার সঙ্গে নিশ্চিত করা যায়। রেস্তোরাঁর নিজের দাবি ঠিক দাবি হিসেবেই দেখানো হয়।',
      'YepItsHalal থেকে কেউ এখনো কোনো রেস্তোরাঁয় নিজে যায়নি, আর সাইট প্রতিটি পাতায় সেটা বলে।',
    ],
    browseHeading: 'কোথা থেকে শুরু করবেন',
    browseBody: 'এলাকা ধরে বা খাবারের ধরন ধরে দেখুন, কিংবা পোস্টকোড দিয়ে খুঁজুন।',
    notifyHeading: "লন্ডনে নেই? কোথায় খুঁজছেন জানান।",
    notifyBody: "সেখানে পৌঁছনোর সঙ্গে সঙ্গেই আমরা ইমেইল করব। যেখানে সবচেয়ে বেশি মানুষ চান, আমরা সেখান থেকেই শুরু করি।",
    notifyButton: 'জানিয়ে দিন',
    notifyEmailPlaceholder: 'you@example.com',
    notifyCityPlaceholder: 'কোন শহর? (ঐচ্ছিক)',
    notifyEmailLabel: "আপনার ইমেইল",
    notifyCityLabel: "আমরা পরের কোন শহর করব?",
    notifySending: "পাঠানো হচ্ছে…",
    notifyDoneTitle: 'আপনি তালিকায় আছেন',
    notifyDoneBody: 'নতুন শহরে পৌঁছলে আমরা ইমেইল করব। আর কিছু নয়, আর কাউকে দেওয়া হবে না।',
    notifyPrivacy: 'একটি ঠিকানা, শুধু এই কাজের জন্য। কখনো বিক্রি হবে না, এক ক্লিকে আনসাবস্ক্রাইব।',
  },
  {
    code: 'tr',
    endonym: 'Türkçe',
    dir: 'ltr',
    title: "Londra'da helal restoranlar",
    description:
      "Londra'daki helal yemek mekanları, her etiketin arkasındaki kanıt ve kontrol tarihiyle. Ücretsiz, hesap gerekmez.",
    beta: 'Beta',
    h1: "Londra'da helal restoranlar",
    intro:
      "YepItsHalal, Londra'daki helal yemek mekanlarını, her etiketin arkasındaki kanıt ve en son ne zaman kontrol edildiğiyle birlikte gösterir. Ücretsiz, hesap gerekmez.",
    englishNote:
      'Site, arama ve restoran sayfaları İngilizce. Bu sayfa, başlamadan önce her etiketin ne anlama geldiğini anlatır.',
    ctaSearch: "Londra'da ara",
    ctaHow: 'Mekanları nasıl etiketliyoruz',
    labelsHeading: 'Etiketler ne anlama geliyor',
    labels: [
      { en: 'Fully Halal', name: 'Tamamen helal', body: 'Bütün etin helal olduğuna dair güçlü kanıt var.' },
      {
        en: 'Halal food available',
        name: 'Helal seçenekler',
        body: 'Burada helal yiyeceklerin yanında helal olmayanlar da var.',
      },
      {
        en: 'Unverified',
        name: 'Doğrulanmadı',
        body: 'Helal olduğuna dair işaretler var ama doğrulanmadı. Bu asla helal değil anlamına gelmez.',
      },
    ],
    evidenceHeading: 'Nereden biliyoruz',
    evidence: [
      'Restoranın kendi yayımladıklarını okuyup, bağlantı ve okuduğumuz tarihle birlikte alıntılıyoruz.',
      'Helal sertifikası yalnızca sertifika kuruluşuyla doğrulandığında gösterilir. Restoranın kendi iddiası da tam olarak iddia olarak gösterilir.',
      "YepItsHalal'dan hiç kimse henüz bir restorana gitmedi ve site bunu her sayfada söylüyor.",
    ],
    browseHeading: 'Nereden başlamalı',
    browseBody: 'Semte göre veya yemek türüne göre gezin, ya da posta koduyla arayın.',
    notifyHeading: "Londra’da değil misiniz? Nerede aradığınızı yazın.",
    notifyBody: "Oraya varır varmaz size e-posta atacağız. En çok istenen yerden başlayarak büyüyoruz.",
    notifyButton: 'Haber verin',
    notifyEmailPlaceholder: 'you@example.com',
    notifyCityPlaceholder: 'Hangi şehir? (isteğe bağlı)',
    notifyEmailLabel: "E-posta adresiniz",
    notifyCityLabel: "Sırada hangi şehir olsun?",
    notifySending: "Gönderiliyor…",
    notifyDoneTitle: 'Listedesiniz',
    notifyDoneBody: 'Yeni bir şehre geldiğimizde e-posta atacağız. Başka bir şey yok, kimseyle paylaşılmaz.',
    notifyPrivacy: 'Tek adres, sadece bunun için. Asla satılmaz, tek tıkla abonelikten çıkabilirsiniz.',
  },
  {
    code: 'fr',
    endonym: 'Français',
    dir: 'ltr',
    title: 'Restaurants halal à Londres',
    description:
      "Les adresses halal à Londres, avec la preuve derrière chaque étiquette et la date de vérification. Gratuit, sans compte.",
    beta: 'Bêta',
    h1: 'Restaurants halal à Londres',
    intro:
      "YepItsHalal recense les adresses halal à Londres, avec la preuve derrière chaque étiquette et la date de la dernière vérification. Gratuit, sans compte.",
    englishNote:
      "Le site, la recherche et les fiches des restaurants sont en anglais. Cette page explique ce que veut dire chaque étiquette avant que vous commenciez.",
    ctaSearch: 'Chercher à Londres',
    ctaHow: 'Comment nous étiquetons',
    labelsHeading: 'Ce que signifient les étiquettes',
    labels: [
      { en: 'Fully Halal', name: 'Entièrement halal', body: 'Preuve solide que toute la viande est halal.' },
      {
        en: 'Halal food available',
        name: 'Options halal',
        body: "On y sert du halal à côté de plats qui ne le sont pas.",
      },
      {
        en: 'Unverified',
        name: 'Non vérifié',
        body: "Des indices de halal, mais rien de confirmé. Cela ne veut jamais dire que ce n'est pas halal.",
      },
    ],
    evidenceHeading: 'Comment nous le savons',
    evidence: [
      "Nous lisons ce que le restaurant publie lui-même et nous le citons, avec le lien et la date de lecture.",
      "Une certification halal n'est affichée comme telle que lorsqu'elle a été confirmée auprès de l'organisme. Si c'est le restaurant qui l'affirme, c'est présenté comme son affirmation.",
      "Personne de YepItsHalal n'a encore visité un restaurant, et le site le dit sur chaque page.",
    ],
    browseHeading: 'Par où commencer',
    browseBody: 'Parcourez par quartier ou par type de cuisine, ou cherchez par code postal.',
    notifyHeading: "Pas à Londres ? Dites-nous où vous cherchez.",
    notifyBody: "Nous vous écrirons dès notre arrivée. Nous nous développons là où le plus de gens le demandent.",
    notifyButton: 'Prévenez-moi',
    notifyEmailPlaceholder: 'you@example.com',
    notifyCityPlaceholder: 'Quelle ville ? (facultatif)',
    notifyEmailLabel: "Votre adresse e-mail",
    notifyCityLabel: "Quelle ville ensuite ?",
    notifySending: "Envoi…",
    notifyDoneTitle: 'Vous êtes sur la liste',
    notifyDoneBody: "Nous vous écrirons quand nous ouvrirons une nouvelle ville. Rien d'autre, et jamais à quelqu'un d'autre.",
    notifyPrivacy: "Une adresse, pour cela seulement. Jamais revendue, désabonnement en un clic.",
  },
  {
    code: "so",
    endonym: "Soomaali",
    dir: "ltr",
    title: "Maqaayadaha xalaasha ah ee London",
    description: "Meelaha cuntada xalaasha ah ee London, iyo caddaynta ka dambaysa calaamad kasta iyo taariikhda la hubiyay. Bilaash, koonto looma baahna.",
    beta: "Tijaabo",
    h1: "Maqaayadaha xalaasha ah ee London",
    intro: "YepItsHalal wuxuu tusayaa meelaha cuntada xalaasha ah ee London. Calaamad kasta waxaa la siiyaa caddayntii ka dambaysay iyo taariikhdii la hubiyay. Bilaash, koonto looma baahna.",
    englishNote: "Bogga, raadinta iyo bogagga maqaayadaha waa Ingiriisi. Boggan wuxuu sharxayaa micnaha calaamad kasta intaadan bilaabin.",
    ctaSearch: "Ka raadi London",
    ctaHow: "Sida aan meelaha u calaamadayno",
    labelsHeading: "Maxay calaamaduhu ka dhigan yihiin",
    labels: [
      {
        en: "Fully Halal",
        name: "Xalaal buuxa",
        body: "Caddayn adag oo muujinaysa in hilibka oo dhan xalaal yahay."
      },
      {
        en: "Halal food available",
        name: "Doorasho xalaal ah",
        body: "Halkan waxaa laga helaa cunto xalaal ah iyo cunto aan xalaal ahayn labadaba."
      },
      {
        en: "Unverified",
        name: "La ma xaqiijin",
        body: "Waxaa jira calaamado muujinaya cunto xalaal ah, laakiin lama xaqiijin. Taasi weligeed macnaheedu ma aha inay xaaraan tahay."
      }
    ],
    evidenceHeading: "Sidee bay noo ogaannaa",
    evidence: [
      "Waxaan akhrinnaa waxa maqaayaddu iyadu daabacdo, waxaanan soo xiginnaa iyadoo ay la socoto xiriiriye iyo taariikhda aan akhrinnay.",
      "Shahaadada xalaalka waxaa la tusaa marka laga xaqiijiyo hayadda bixisay. Haddii maqaayaddu iyadu sheegato, waxaa loo tusaa sidaas oo kale, sheegasho ahaan.",
      "Qof ka socda YepItsHalal weli ma booqan maqaayad, bogguna bog kasta ayuu taas ku sheegayaa."
    ],
    browseHeading: "Halkee ka bilow",
    browseBody: "Ka eeg degmada ama nooca cuntada, ama ka raadi koodhka boostada.",
    notifyHeading: "Ma joogtid London? Noo sheeg halka aad ka raadinayso.",
    notifyBody: "Isla marka aan halkaas gaarno waan ku soo emayli doonnaa. Waxaan ka bilownaa meesha dadka ugu badan ay weydiistaan.",
    notifyButton: "I soo ogeysii",
    notifyEmailPlaceholder: "you@example.com",
    notifyCityPlaceholder: "Magaalo kee? (ikhtiyaari)",
    notifyEmailLabel: "Emaylkaaga",
    notifyCityLabel: "Magaalo kee ayaa xigta?",
    notifySending: "Waa la dirayaa…",
    notifyDoneTitle: "Waad ku jirtaa liiska",
    notifyDoneBody: "Waan ku soo emayli doonnaa marka aan gaarno magaalo cusub. Wax kale ma jiro, cidna lama siinayo.",
    notifyPrivacy: "Hal emayl, arrintan oo keliya. Weligeed lama iibinayo, hal gujin ayaad kaga bixi kartaa."
  },
  {
    code: "fa",
    endonym: "فارسی",
    dir: "rtl",
    title: "رستوران‌های حلال در لندن",
    description: "جاهای غذای حلال در لندن، همراه با مدرکی که پشت هر برچسب است و تاریخ بررسی. رایگان، بدون حساب کاربری.",
    beta: "نسخهٔ آزمایشی",
    h1: "رستوران‌های حلال در لندن",
    intro: "YepItsHalal جاهای غذای حلال لندن را نشان می‌دهد، همراه با مدرکی که پشت هر برچسب است و تاریخ آخرین بررسی. رایگان، بدون حساب کاربری.",
    englishNote: "سایت، جست‌وجو و صفحه‌های رستوران‌ها به انگلیسی است. این صفحه پیش از شروع توضیح می‌دهد هر برچسب چه معنایی دارد.",
    ctaSearch: "در لندن جست‌وجو کنید",
    ctaHow: "چطور برچسب می‌زنیم",
    labelsHeading: "برچسب‌ها یعنی چه",
    labels: [
      {
        en: "Fully Halal",
        name: "کاملاً حلال",
        body: "مدرک محکمی هست که تمام گوشت حلال است."
      },
      {
        en: "Halal food available",
        name: "گزینه‌های حلال",
        body: "اینجا هم غذای حلال سرو می‌شود و هم غذایی که حلال نیست."
      },
      {
        en: "Unverified",
        name: "تأیید نشده",
        body: "نشانه‌هایی از حلال بودن هست، اما تأیید نشده. این هرگز به معنای حرام بودن نیست."
      }
    ],
    evidenceHeading: "از کجا می‌دانیم",
    evidence: [
      "آنچه را خود رستوران منتشر می‌کند می‌خوانیم و با پیوند و تاریخ خواندن نقل می‌کنیم.",
      "گواهی حلال تنها وقتی نشان داده می‌شود که با نهاد صادرکننده تأیید شده باشد. ادعای خود رستوران دقیقاً به عنوان ادعا نشان داده می‌شود.",
      "هنوز هیچ‌کس از YepItsHalal به رستورانی نرفته است، و سایت این را در هر صفحه می‌گوید."
    ],
    browseHeading: "از کجا شروع کنیم",
    browseBody: "بر اساس منطقه یا نوع غذا ببینید، یا با کد پستی جست‌وجو کنید.",
    notifyHeading: "در لندن نیستید؟ بگویید کجا دنبالش می‌گردید.",
    notifyBody: "به‌محض رسیدن به آنجا ایمیل می‌زنیم. از جایی گسترش می‌دهیم که بیشترین درخواست را دارد.",
    notifyButton: "خبرم کنید",
    notifyEmailPlaceholder: "you@example.com",
    notifyCityPlaceholder: "کدام شهر؟ (اختیاری)",
    notifyEmailLabel: "ایمیل شما",
    notifyCityLabel: "شهر بعدی کدام باشد؟",
    notifySending: "در حال ارسال…",
    notifyDoneTitle: "در فهرست هستید",
    notifyDoneBody: "وقتی به شهر تازه‌ای برسیم ایمیل می‌زنیم. چیز دیگری نه، و به کسی هم داده نمی‌شود.",
    notifyPrivacy: "یک نشانی، فقط برای همین. هرگز فروخته نمی‌شود، با یک کلیک لغو کنید."
  },
  {
    code: "sq",
    endonym: "Shqip",
    dir: "ltr",
    title: "Restorante hallall në Londër",
    description: "Vendet me ushqim hallall në Londër, me provën pas çdo etikete dhe datën e kontrollit. Falas, pa llogari.",
    beta: "Beta",
    h1: "Restorante hallall në Londër",
    intro: "YepItsHalal tregon vendet me ushqim hallall në Londër, me provën pas çdo etikete dhe datën e kontrollit të fundit. Falas, pa llogari.",
    englishNote: "Faqja, kërkimi dhe faqet e restoranteve janë në anglisht. Kjo faqe shpjegon se çfarë do të thotë secila etiketë para se të nisni.",
    ctaSearch: "Kërko në Londër",
    ctaHow: "Si i etiketojmë vendet",
    labelsHeading: "Çfarë do të thonë etiketat",
    labels: [
      {
        en: "Fully Halal",
        name: "Plotësisht hallall",
        body: "Provë e fortë se i gjithë mishi është hallall."
      },
      {
        en: "Halal food available",
        name: "Opsione hallall",
        body: "Këtu shërbehet ushqim hallall krahas ushqimit që nuk është hallall."
      },
      {
        en: "Unverified",
        name: "E paverifikuar",
        body: "Ka shenja ushqimi hallall, por nuk është konfirmuar. Kjo kurrë nuk do të thotë se nuk është hallall."
      }
    ],
    evidenceHeading: "Si e dimë",
    evidence: [
      "Lexojmë atë që restoranti publikon vetë dhe e citojmë, me lidhjen dhe datën kur e lexuam.",
      "Certifikata hallall shfaqet vetëm kur është konfirmuar me organin që e ka lëshuar. Pretendimi i vetë restorantit shfaqet pikërisht si pretendim.",
      "Askush nga YepItsHalal nuk ka vizituar ende asnjë restorant, dhe faqja e thotë këtë në çdo faqe."
    ],
    browseHeading: "Nga ta nisësh",
    browseBody: "Shfleto sipas lagjes ose sipas llojit të ushqimit, ose kërko me kodin postar.",
    notifyHeading: "Nuk je në Londër? Na thuaj ku po kërkon.",
    notifyBody: "Do të të shkruajmë sapo të arrijmë atje. Zgjerohemi aty ku e kërkojnë më shumë njerëz.",
    notifyButton: "Më njofto",
    notifyEmailPlaceholder: "you@example.com",
    notifyCityPlaceholder: "Cili qytet? (opsionale)",
    notifyEmailLabel: "Email-i yt",
    notifyCityLabel: "Cili qytet duhet të jetë i radhës?",
    notifySending: "Duke dërguar…",
    notifyDoneTitle: "Je në listë",
    notifyDoneBody: "Do të të shkruajmë kur të hapim një qytet të ri. Asgjë tjetër, dhe kurrë askujt tjetër.",
    notifyPrivacy: "Një adresë, vetëm për këtë. Kurrë e shitur, çregjistrohu me një klikim."
  },
  {
    code: "id",
    endonym: "Bahasa Indonesia",
    dir: "ltr",
    title: "Restoran halal di London",
    description: "Tempat makan halal di London, lengkap dengan bukti di balik setiap label dan tanggal pemeriksaannya. Gratis, tanpa akun.",
    beta: "Beta",
    h1: "Restoran halal di London",
    intro: "YepItsHalal menunjukkan tempat makan halal di London, lengkap dengan bukti di balik setiap label dan kapan terakhir diperiksa. Gratis, tanpa akun.",
    englishNote: "Situs, pencarian, dan halaman restoran berbahasa Inggris. Halaman ini menjelaskan arti setiap label sebelum Anda mulai.",
    ctaSearch: "Cari di London",
    ctaHow: "Cara kami memberi label",
    labelsHeading: "Arti setiap label",
    labels: [
      {
        en: "Fully Halal",
        name: "Halal sepenuhnya",
        body: "Ada bukti kuat bahwa semua dagingnya halal."
      },
      {
        en: "Halal food available",
        name: "Ada pilihan halal",
        body: "Di sini disajikan makanan halal berdampingan dengan makanan yang tidak halal."
      },
      {
        en: "Unverified",
        name: "Belum diverifikasi",
        body: "Ada tanda-tanda makanan halal, tetapi belum dipastikan. Ini tidak pernah berarti tidak halal."
      }
    ],
    evidenceHeading: "Dari mana kami tahu",
    evidence: [
      "Kami membaca apa yang diterbitkan restoran itu sendiri, lalu mengutipnya beserta tautan dan tanggal kami membacanya.",
      "Sertifikat halal hanya ditampilkan setelah dipastikan ke lembaga penerbitnya. Klaim dari restoran sendiri ditampilkan persis sebagai klaim.",
      "Belum ada orang dari YepItsHalal yang mendatangi restoran mana pun, dan situs ini menyatakannya di setiap halaman."
    ],
    browseHeading: "Mulai dari mana",
    browseBody: "Telusuri per wilayah atau per jenis makanan, atau cari dengan kode pos.",
    notifyHeading: "Tidak di London? Beri tahu kami Anda mencari di mana.",
    notifyBody: "Kami akan mengirim email begitu kami sampai di sana. Kami berkembang ke tempat yang paling banyak diminta.",
    notifyButton: "Beri tahu saya",
    notifyEmailPlaceholder: "you@example.com",
    notifyCityPlaceholder: "Kota mana? (opsional)",
    notifyEmailLabel: "Email Anda",
    notifyCityLabel: "Kota mana berikutnya?",
    notifySending: "Mengirim…",
    notifyDoneTitle: "Anda sudah terdaftar",
    notifyDoneBody: "Kami akan mengirim email saat kami membuka kota baru. Tidak ada yang lain, dan tidak akan diberikan ke siapa pun.",
    notifyPrivacy: "Satu alamat, hanya untuk ini. Tidak pernah dijual, berhenti berlangganan dengan sekali klik."
  },
];

export const LOCALE_CODES = LOCALES.map((l) => l.code);

export function localeByCode(code: string): LocaleCopy | null {
  return LOCALES.find((l) => l.code === code) ?? null;
}

/**
 * The hreflang set, for the English pages and every translated one. x-default
 * points at English because that is where the actual directory lives.
 */
export function hreflangAlternates(siteUrl: string): Record<string, string> {
  const languages: Record<string, string> = { 'en-GB': siteUrl, en: siteUrl };
  for (const l of LOCALES) languages[l.code] = `${siteUrl}/${l.code}`;
  languages['x-default'] = siteUrl;
  return languages;
}
