// Brand + translations for every page. Change the brand in ONE place: BRAND.
// Tajik (tg) and Uzbek (uz) texts should be checked by a native speaker before launch.
const BRAND = { name: 'Suvoz', domain: 'suvoz.io', legalName: 'HORIZON GATE COMMERCE FZE LLC' };

const LANGS = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'ru', label: 'Русский', dir: 'ltr' },
  { code: 'tg', label: 'Тоҷикӣ', dir: 'ltr' },
  { code: 'uz', label: "Oʻzbekcha", dir: 'ltr' },
];

const T = {
  en: {
    'nav.how': 'How it works', 'nav.features': 'Features', 'nav.languages': 'Languages', 'nav.faq': 'FAQ',
    'nav.try': 'Try it now',
    'hero.title': 'Turn a script into a conversation.',
    'hero.sub': 'Write who says what, pick a voice for each person, and download one finished audio file in over 90 languages.',
    'hero.cta1': 'Try it now', 'hero.cta2': 'See how it works',
    'demo.label': 'Your script', 'demo.out': 'One audio file, two voices',
    'demo.s1': 'Sara', 'demo.t1': 'Welcome back! Ready for today’s story?',
    'demo.s2': 'Omar', 'demo.t2': 'Always. Where did we stop?',
    'demo.s3': 'Sara', 'demo.t3': 'Right at the door.',
    'how.title': 'From text to finished audio in three steps.',
    'how.1.t': 'Write the script', 'how.1.d': 'One line per turn, like “Anna: Hello!”. Paste it or type it.',
    'how.2.t': 'Choose the voices', 'how.2.d': 'Pick a different voice for every speaker and listen to a preview first.',
    'how.3.t': 'Download the MP3', 'how.3.d': 'Get one audio file with every line in order, ready for your video or podcast.',
    'feat.title': 'Made for real conversations.',
    'feat.1.t': 'Several speakers', 'feat.1.d': 'Up to four people in one script, each with their own voice.',
    'feat.2.t': 'Your language', 'feat.2.d': 'Natural speech in more than 90 languages, including Arabic, Russian, Tajik and Uzbek.',
    'feat.3.t': 'Expressive voices', 'feat.3.d': 'Built on a leading voice model, so dialogue sounds like people, not a reading machine.',
    'feat.4.t': 'Ready to publish', 'feat.4.d': 'A single MP3 you can drop into a short video, a podcast, a lesson or an ad.',
    'lang.title': 'Speak every language your audience does.', 'lang.more': 'and 80+ more',
    'faq.title': 'Questions',
    'faq.1.q': 'What do I get?', 'faq.1.a': 'One MP3 file with all the voices in the order you wrote them.',
    'faq.2.q': 'How many speakers can I use?', 'faq.2.a': 'Up to 4 speakers and 60 lines in one script.',
    'faq.3.q': 'Which languages work?', 'faq.3.a': 'More than 90, including English, Arabic, Russian, Tajik and Uzbek. Voice quality can differ from one language to another, so listen to a preview first.',
    'faq.4.q': 'Do you keep my scripts?', 'faq.4.a': 'Yes, so you can find them again. Your finished audios and their text are saved in your History for 30 days, then deleted automatically. You can delete any item sooner.',
    'final.title': 'Hear your script.', 'final.cta': 'Try it now',
    'foot.rights': 'All rights reserved.',
    'app.title': 'Create your audio', 'app.sub': 'Write a dialogue, choose a *voice for each speaker*, and download *one MP3*.',
    'app.code': 'Access code', 'app.code.ph': 'Enter your access code',
    'app.script': 'Your script', 'app.script.hint': 'One line per turn: *Name: text*. No names? *One narrator* reads it.', 'app.narrator': 'Narrator',
    'app.chars': 'characters', 'app.voices': 'Voices',
    'app.speakers.empty': 'Add lines like “Name: text” and the speakers will appear here.',
    'app.preview': 'Preview', 'app.generate': 'Create audio', 'app.generating': 'Creating your audio. This can take up to a minute.',
    'app.done': 'Your audio is ready.', 'app.download': 'Download MP3',
    'app.loading': 'Loading voices…', 'app.entercode': 'Enter your access code to begin.',
    'app.maxspeakers': 'You can use up to {n} speakers.',
    'app.home': 'Home',
  },
  ar: {
    'nav.how': 'كيف يعمل', 'nav.features': 'المزايا', 'nav.languages': 'اللغات', 'nav.faq': 'الأسئلة',
    'nav.try': 'جرّبه الآن',
    'hero.title': 'حوّل نصّك إلى حوار.',
    'hero.sub': 'اكتب من يقول ماذا، واختر صوتًا لكل شخص، ثم نزّل ملفًا صوتيًا جاهزًا بأكثر من 90 لغة.',
    'hero.cta1': 'جرّبه الآن', 'hero.cta2': 'شاهد كيف يعمل',
    'demo.label': 'نصّك', 'demo.out': 'ملف صوتي واحد، صوتان',
    'demo.s1': 'سارة', 'demo.t1': 'أهلًا بعودتك! جاهز لحكاية اليوم؟',
    'demo.s2': 'عمر', 'demo.t2': 'دائمًا. أين توقفنا؟',
    'demo.s3': 'سارة', 'demo.t3': 'عند الباب تمامًا.',
    'how.title': 'من النص إلى صوت جاهز في ثلاث خطوات.',
    'how.1.t': 'اكتب النص', 'how.1.d': 'سطر لكل دور، مثل «أحمد: مرحبًا!». الصقه أو اكتبه.',
    'how.2.t': 'اختر الأصوات', 'how.2.d': 'اختر صوتًا مختلفًا لكل شخص واستمع إلى معاينة أولًا.',
    'how.3.t': 'نزّل ملف MP3', 'how.3.d': 'احصل على ملف صوتي واحد بكل الأسطر بالترتيب، جاهز لفيديو أو بودكاست.',
    'feat.title': 'صُمّم لحوارات حقيقية.',
    'feat.1.t': 'عدة متحدثين', 'feat.1.d': 'حتى أربعة أشخاص في نص واحد، لكل منهم صوته.',
    'feat.2.t': 'بلغتك', 'feat.2.d': 'كلام طبيعي بأكثر من 90 لغة، منها العربية والروسية والطاجيكية والأوزبكية.',
    'feat.3.t': 'أصوات معبّرة', 'feat.3.d': 'مبني على نموذج صوتي رائد، فيبدو الحوار كأشخاص حقيقيين لا كآلة قراءة.',
    'feat.4.t': 'جاهز للنشر', 'feat.4.d': 'ملف MP3 واحد يمكنك إضافته إلى فيديو قصير أو بودكاست أو درس أو إعلان.',
    'lang.title': 'تحدّث بكل لغة يتحدثها جمهورك.', 'lang.more': 'وأكثر من 80 لغة أخرى',
    'faq.title': 'أسئلة شائعة',
    'faq.1.q': 'ماذا سأحصل عليه؟', 'faq.1.a': 'ملف MP3 واحد يضم كل الأصوات بالترتيب الذي كتبته.',
    'faq.2.q': 'كم متحدثًا يمكنني استخدامه؟', 'faq.2.a': 'حتى 4 متحدثين و60 سطرًا في نص واحد.',
    'faq.3.q': 'ما اللغات المدعومة؟', 'faq.3.a': 'أكثر من 90 لغة، منها الإنجليزية والعربية والروسية والطاجيكية والأوزبكية. قد تختلف جودة الصوت من لغة لأخرى، لذا استمع إلى المعاينة أولًا.',
    'faq.4.q': 'هل تحتفظون بنصوصي؟', 'faq.4.a': 'نعم، لتتمكن من العثور عليها مجددًا. تُحفظ ملفاتك الصوتية المكتملة ونصوصها في سجلّك لمدة 30 يومًا ثم تُحذف تلقائيًا. يمكنك حذف أي عنصر قبل ذلك.',
    'final.title': 'اسمع نصّك.', 'final.cta': 'جرّبه الآن',
    'foot.rights': 'جميع الحقوق محفوظة.',
    'app.title': 'أنشئ صوتك', 'app.sub': 'اكتب حوارًا، واختر *صوتًا لكل متحدث*، ونزّل ملف *MP3 واحدًا*.',
    'app.code': 'رمز الدخول', 'app.code.ph': 'أدخل رمز الدخول',
    'app.script': 'نصّك', 'app.script.hint': 'سطر لكل دور: *الاسم: النص*. بدون أسماء؟ سيقرأه *راوٍ واحد*.', 'app.narrator': 'الراوي',
    'app.chars': 'حرفًا', 'app.voices': 'الأصوات',
    'app.speakers.empty': 'أضف أسطرًا مثل «الاسم: النص» وسيظهر المتحدثون هنا.',
    'app.preview': 'معاينة', 'app.generate': 'أنشئ الصوت', 'app.generating': 'جارٍ إنشاء الصوت. قد يستغرق ذلك حتى دقيقة.',
    'app.done': 'صوتك جاهز.', 'app.download': 'نزّل MP3',
    'app.loading': 'جارٍ تحميل الأصوات…', 'app.entercode': 'أدخل رمز الدخول للبدء.',
    'app.maxspeakers': 'يمكنك استخدام {n} متحدثين كحد أقصى.',
    'app.home': 'الرئيسية',
  },
  ru: {
    'nav.how': 'Как это работает', 'nav.features': 'Возможности', 'nav.languages': 'Языки', 'nav.faq': 'Вопросы',
    'nav.try': 'Попробовать',
    'hero.title': 'Превратите сценарий в разговор.',
    'hero.sub': 'Напишите, кто что говорит, выберите голос для каждого и скачайте готовый аудиофайл на более чем 90 языках.',
    'hero.cta1': 'Попробовать', 'hero.cta2': 'Как это работает',
    'demo.label': 'Ваш сценарий', 'demo.out': 'Один аудиофайл, два голоса',
    'demo.s1': 'Сара', 'demo.t1': 'С возвращением! Готов к сегодняшней истории?',
    'demo.s2': 'Омар', 'demo.t2': 'Всегда. На чём мы остановились?',
    'demo.s3': 'Сара', 'demo.t3': 'Прямо у двери.',
    'how.title': 'От текста до готового аудио за три шага.',
    'how.1.t': 'Напишите сценарий', 'how.1.d': 'Одна реплика на строку, например «Анна: Привет!». Вставьте текст или наберите его.',
    'how.2.t': 'Выберите голоса', 'how.2.d': 'Подберите свой голос каждому герою и сначала послушайте образец.',
    'how.3.t': 'Скачайте MP3', 'how.3.d': 'Получите один аудиофайл со всеми репликами по порядку, готовый для видео или подкаста.',
    'feat.title': 'Создано для настоящих диалогов.',
    'feat.1.t': 'Несколько героев', 'feat.1.d': 'До четырёх человек в одном сценарии, у каждого свой голос.',
    'feat.2.t': 'Ваш язык', 'feat.2.d': 'Естественная речь более чем на 90 языках, включая арабский, русский, таджикский и узбекский.',
    'feat.3.t': 'Живые голоса', 'feat.3.d': 'Работает на одной из лучших голосовых моделей, поэтому диалог звучит как разговор людей, а не как чтение машины.',
    'feat.4.t': 'Готово к публикации', 'feat.4.d': 'Один MP3, который можно добавить в короткое видео, подкаст, урок или рекламу.',
    'lang.title': 'Говорите на всех языках вашей аудитории.', 'lang.more': 'и ещё более 80',
    'faq.title': 'Вопросы',
    'faq.1.q': 'Что я получу?', 'faq.1.a': 'Один MP3-файл со всеми голосами в том порядке, в котором вы их написали.',
    'faq.2.q': 'Сколько героев можно использовать?', 'faq.2.a': 'До 4 героев и 60 реплик в одном сценарии.',
    'faq.3.q': 'Какие языки доступны?', 'faq.3.a': 'Более 90, включая английский, арабский, русский, таджикский и узбекский. Качество голоса может отличаться от языка к языку, поэтому сначала послушайте образец.',
    'faq.4.q': 'Вы храните мои тексты?', 'faq.4.a': 'Да, чтобы вы могли найти их снова. Готовые аудио и их тексты хранятся в вашей истории 30 дней, затем удаляются автоматически. Любой элемент можно удалить раньше.',
    'final.title': 'Услышьте свой сценарий.', 'final.cta': 'Попробовать',
    'foot.rights': 'Все права защищены.',
    'app.title': 'Создайте аудио', 'app.sub': 'Напишите диалог, выберите *голос для каждого героя* и скачайте *один MP3*.',
    'app.code': 'Код доступа', 'app.code.ph': 'Введите код доступа',
    'app.script': 'Ваш сценарий', 'app.script.hint': 'Одна реплика на строку: *Имя: текст*. Без имён? Весь текст прочтёт *один рассказчик*.', 'app.narrator': 'Рассказчик',
    'app.chars': 'символов', 'app.voices': 'Голоса',
    'app.speakers.empty': 'Добавьте строки вида «Имя: текст», и здесь появятся герои.',
    'app.preview': 'Прослушать', 'app.generate': 'Создать аудио', 'app.generating': 'Создаём аудио. Это может занять до минуты.',
    'app.done': 'Аудио готово.', 'app.download': 'Скачать MP3',
    'app.loading': 'Загружаем голоса…', 'app.entercode': 'Введите код доступа, чтобы начать.',
    'app.maxspeakers': 'Можно использовать не более {n} героев.',
    'app.home': 'Главная',
  },
  tg: {
    'nav.how': 'Чӣ тавр кор мекунад', 'nav.features': 'Имкониятҳо', 'nav.languages': 'Забонҳо', 'nav.faq': 'Саволҳо',
    'nav.try': 'Ҳозир озмоед',
    'hero.title': 'Сенарияро ба сӯҳбат табдил диҳед.',
    'hero.sub': 'Нависед, ки кӣ чӣ мегӯяд, барои ҳар кас овоз интихоб кунед ва файли аудиоии тайёрро бо зиёда аз 90 забон зеркашӣ кунед.',
    'hero.cta1': 'Ҳозир озмоед', 'hero.cta2': 'Чӣ тавр кор мекунад',
    'demo.label': 'Сенарияи шумо', 'demo.out': 'Як файли аудио, ду овоз',
    'demo.s1': 'Сара', 'demo.t1': 'Хуш омадед! Барои ҳикояи имрӯз тайёред?',
    'demo.s2': 'Умар', 'demo.t2': 'Ҳамеша. Мо дар куҷо монда будем?',
    'demo.s3': 'Сара', 'demo.t3': 'Дуруст назди дар.',
    'how.title': 'Аз матн то аудиои тайёр дар се қадам.',
    'how.1.t': 'Сенарияро нависед', 'how.1.d': 'Як сатр барои як нақл, масалан «Анна: Салом!». Матнро гузоред ё нависед.',
    'how.2.t': 'Овозҳоро интихоб кунед', 'how.2.d': 'Барои ҳар як шахс овози алоҳида интихоб кунед ва аввал намунаро гӯш кунед.',
    'how.3.t': 'MP3-ро зеркашӣ кунед', 'how.3.d': 'Як файли аудиоро бо ҳамаи сатрҳо аз рӯи тартиб гиред, барои видео ё подкаст тайёр.',
    'feat.title': 'Барои сӯҳбатҳои ҳақиқӣ сохта шудааст.',
    'feat.1.t': 'Якчанд гӯянда', 'feat.1.d': 'То чор нафар дар як сенария, ҳар кадом бо овози худ.',
    'feat.2.t': 'Забони шумо', 'feat.2.d': 'Гуфтори табиӣ бо зиёда аз 90 забон, аз ҷумла арабӣ, русӣ, тоҷикӣ ва ӯзбекӣ.',
    'feat.3.t': 'Овозҳои зинда', 'feat.3.d': 'Дар асоси як модели пешбари овозӣ сохта шудааст, бинобар ин сӯҳбат мисли гуфтугӯи одамон садо медиҳад.',
    'feat.4.t': 'Барои интишор тайёр', 'feat.4.d': 'Як MP3, ки онро ба видеои кӯтоҳ, подкаст, дарс ё реклама илова кардан мумкин аст.',
    'lang.title': 'Ба ҳамон забонҳое гап занед, ки шунавандагони шумо гап мезананд.', 'lang.more': 'ва зиёда аз 80 забони дигар',
    'faq.title': 'Саволҳо',
    'faq.1.q': 'Ман чӣ мегирам?', 'faq.1.a': 'Як файли MP3 бо ҳамаи овозҳо ба тартибе, ки шумо навиштаед.',
    'faq.2.q': 'Чандто гӯяндаро истифода бурдан мумкин аст?', 'faq.2.a': 'То 4 гӯянда ва 60 сатр дар як сенария.',
    'faq.3.q': 'Кадом забонҳо дастгирӣ мешаванд?', 'faq.3.a': 'Зиёда аз 90 забон, аз ҷумла англисӣ, арабӣ, русӣ, тоҷикӣ ва ӯзбекӣ. Сифати овоз метавонад аз забон ба забон фарқ кунад, бинобар ин аввал намунаро гӯш кунед.',
    'faq.4.q': 'Оё матнҳои маро нигоҳ медоред?', 'faq.4.a': 'Бале, то шумо онҳоро дубора ёфта тавонед. Аудиоҳои тайёр ва матни онҳо дар таърихи шумо 30 рӯз нигоҳ дошта мешаванд, баъд худкор нест карда мешаванд. Ҳар як ҷузъро пештар нест кардан мумкин аст.',
    'final.title': 'Сенарияи худро бишнавед.', 'final.cta': 'Ҳозир озмоед',
    'foot.rights': 'Ҳамаи ҳуқуқҳо ҳифз шудаанд.',
    'app.title': 'Аудиои худро созед', 'app.sub': 'Муколама нависед, *барои ҳар гӯянда овоз интихоб кунед* ва *як MP3* зеркашӣ кунед.',
    'app.code': 'Рамзи дастрасӣ', 'app.code.ph': 'Рамзи дастрасиро ворид кунед',
    'app.script': 'Сенарияи шумо', 'app.script.hint': 'Як сатр барои як нақл: *Ном: матн*. Бе ном? *Як нақлкунанда* онро мехонад.', 'app.narrator': 'Нақлкунанда',
    'app.chars': 'аломат', 'app.voices': 'Овозҳо',
    'app.speakers.empty': 'Сатрҳоро ба шакли «Ном: матн» илова кунед, ва гӯяндагон дар ин ҷо пайдо мешаванд.',
    'app.preview': 'Шунидан', 'app.generate': 'Аудио созед', 'app.generating': 'Аудио сохта истодааст. Ин метавонад то як дақиқа гирад.',
    'app.done': 'Аудиои шумо тайёр аст.', 'app.download': 'MP3-ро зеркашӣ кунед',
    'app.loading': 'Овозҳо бор мешаванд…', 'app.entercode': 'Барои оғоз рамзи дастрасиро ворид кунед.',
    'app.maxspeakers': 'Шумо то {n} гӯяндаро истифода бурда метавонед.',
    'app.home': 'Асосӣ',
  },
  uz: {
    'nav.how': 'Qanday ishlaydi', 'nav.features': 'Imkoniyatlar', 'nav.languages': 'Tillar', 'nav.faq': 'Savollar',
    'nav.try': 'Hozir sinab koʻring',
    'hero.title': 'Ssenariyni suhbatga aylantiring.',
    'hero.sub': 'Kim nima deyishini yozing, har bir kishi uchun ovoz tanlang va 90 dan ortiq tilda tayyor audio faylni yuklab oling.',
    'hero.cta1': 'Hozir sinab koʻring', 'hero.cta2': 'Qanday ishlaydi',
    'demo.label': 'Sizning ssenariyingiz', 'demo.out': 'Bitta audio fayl, ikki ovoz',
    'demo.s1': 'Sara', 'demo.t1': 'Xush kelibsiz! Bugungi hikoyaga tayyormisiz?',
    'demo.s2': 'Omar', 'demo.t2': 'Doim. Qayerda toʻxtagan edik?',
    'demo.s3': 'Sara', 'demo.t3': 'Aynan eshik oldida.',
    'how.title': 'Matndan tayyor audiogacha uch qadamda.',
    'how.1.t': 'Ssenariyni yozing', 'how.1.d': 'Har bir gap uchun bitta qator, masalan «Anna: Salom!». Matnni qoʻying yoki yozing.',
    'how.2.t': 'Ovozlarni tanlang', 'how.2.d': 'Har bir kishi uchun alohida ovoz tanlang va avval namunani eshiting.',
    'how.3.t': 'MP3 ni yuklab oling', 'how.3.d': 'Barcha qatorlar tartib bilan joylashgan bitta audio faylni oling, video yoki podkast uchun tayyor.',
    'feat.title': 'Haqiqiy suhbatlar uchun yaratilgan.',
    'feat.1.t': 'Bir nechta ishtirokchi', 'feat.1.d': 'Bitta ssenariyda toʻrt kishigacha, har birining oʻz ovozi bilan.',
    'feat.2.t': 'Sizning tilingiz', 'feat.2.d': '90 dan ortiq tilda tabiiy nutq, jumladan arab, rus, tojik va oʻzbek tillarida.',
    'feat.3.t': 'Jonli ovozlar', 'feat.3.d': 'Yetakchi ovoz modeli asosida ishlaydi, shuning uchun suhbat odamlar gapirayotgandek eshitiladi.',
    'feat.4.t': 'Eʼlon qilishga tayyor', 'feat.4.d': 'Qisqa video, podkast, dars yoki reklamaga qoʻshish mumkin boʻlgan bitta MP3.',
    'lang.title': 'Auditoriyangiz gapiradigan barcha tillarda gapiring.', 'lang.more': 'va yana 80 dan ortiq til',
    'faq.title': 'Savollar',
    'faq.1.q': 'Men nima olaman?', 'faq.1.a': 'Siz yozgan tartibda barcha ovozlar joylashgan bitta MP3 fayl.',
    'faq.2.q': 'Nechta ishtirokchidan foydalanish mumkin?', 'faq.2.a': 'Bitta ssenariyda 4 tagacha ishtirokchi va 60 qator.',
    'faq.3.q': 'Qaysi tillar ishlaydi?', 'faq.3.a': '90 dan ortiq til, jumladan ingliz, arab, rus, tojik va oʻzbek tillari. Ovoz sifati tildan tilga farq qilishi mumkin, shuning uchun avval namunani eshiting.',
    'faq.4.q': 'Matnlarimni saqlaysizlarmi?', 'faq.4.a': 'Ha, qayta topishingiz uchun. Tayyor audiolar va ularning matni tarixingizda 30 kun saqlanadi, keyin avtomatik oʻchiriladi. Istalgan elementni oldinroq oʻchirishingiz mumkin.',
    'final.title': 'Ssenariyingizni eshiting.', 'final.cta': 'Hozir sinab koʻring',
    'foot.rights': 'Barcha huquqlar himoyalangan.',
    'app.title': 'Audiongizni yarating', 'app.sub': 'Dialog yozing, *har bir ishtirokchi uchun ovoz tanlang* va *bitta MP3* yuklab oling.',
    'app.code': 'Kirish kodi', 'app.code.ph': 'Kirish kodini kiriting',
    'app.script': 'Sizning ssenariyingiz', 'app.script.hint': 'Har bir gap uchun bitta qator: *Ism: matn*. Ismsiz boʻlsa, *bitta hikoyachi* oʻqiydi.', 'app.narrator': 'Hikoyachi',
    'app.chars': 'belgi', 'app.voices': 'Ovozlar',
    'app.speakers.empty': '«Ism: matn» koʻrinishidagi qatorlarni qoʻshing, ishtirokchilar shu yerda paydo boʻladi.',
    'app.preview': 'Eshitish', 'app.generate': 'Audio yaratish', 'app.generating': 'Audio yaratilmoqda. Bu bir daqiqagacha vaqt olishi mumkin.',
    'app.done': 'Audiongiz tayyor.', 'app.download': 'MP3 ni yuklab olish',
    'app.loading': 'Ovozlar yuklanmoqda…', 'app.entercode': 'Boshlash uchun kirish kodini kiriting.',
    'app.maxspeakers': 'Eng koʻpi bilan {n} ishtirokchidan foydalanish mumkin.',
    'app.home': 'Bosh sahifa',
  },
};

// ---- Tiny language engine ----
let currentLang = 'en';
function t(key, vars) {
  let s = (T[currentLang] && T[currentLang][key]) || T.en[key] || key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}
function detectLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && T[q]) return q;
    const saved = localStorage.getItem('lang');
    if (saved && T[saved]) return saved;
  } catch (e) {}
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return T[nav] ? nav : 'en';
}
function applyLang(code) {
  currentLang = T[code] ? code : 'en';
  const meta = LANGS.find((l) => l.code === currentLang);
  document.documentElement.lang = currentLang;
  document.documentElement.dir = meta.dir;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-brand]').forEach((el) => { el.textContent = BRAND.name; });
  const sel = document.getElementById('langSel');
  if (sel) sel.value = currentLang;
  try { localStorage.setItem('lang', currentLang); } catch (e) {}
  document.dispatchEvent(new CustomEvent('langchange', { detail: currentLang }));
}
// One shared copy of /api/config per page (and per tab for a few minutes), so pages do not each wait for it.
let __cfgP = null;
function getConfig() {
  if (__cfgP) return __cfgP;
  try {
    const c = JSON.parse(sessionStorage.getItem('suvoz_cfg') || 'null');
    if (c && c.v && Date.now() - c.t < 600000) { __cfgP = Promise.resolve(c.v); return __cfgP; }
  } catch (e) {}
  __cfgP = fetch('/api/config').then((r) => r.json()).then((v) => {
    try { sessionStorage.setItem('suvoz_cfg', JSON.stringify({ t: Date.now(), v })); } catch (e) {}
    return v;
  }).catch((e) => { __cfgP = null; throw e; });
  return __cfgP;
}
function initLang() {
  const sel = document.getElementById('langSel');
  if (sel) {
    LANGS.forEach((l) => {
      const o = document.createElement('option');
      o.value = l.code; o.textContent = l.label; sel.appendChild(o);
    });
    sel.addEventListener('change', () => applyLang(sel.value));
  }
  applyLang(detectLang());
  // Visitors who are not logged in have nothing more to wait for: show the top bar now.
  if (document.documentElement.classList.contains('out')) document.documentElement.classList.remove('pre');
}
