// Moving texts shown on the main button while a tool is working. Loaded after i18n.js.
// Tajik (tg) and Uzbek (uz) texts should be checked by a native speaker before launch.
// Each tool has 3 lines that change every few seconds.
const BUSY_TEXTS = {
  en: {
    gen: ['Generating…', 'Giving voices to your words…', 'Almost there…'],
    stt: ['Listening…', 'Writing it down…', 'Almost there…'],
    tr: ['Translating…', 'Choosing the right words…', 'Almost there…'],
    clone: ['Listening to your voice…', 'Learning how you sound…', 'Almost there…'],
    design: ['Designing voices…', 'Shaping the sound…', 'Almost there…'],
    dub: ['Sending your video…', 'Getting the dubbing ready…', 'Almost there…'],
    send: ['Sending…', 'Almost there…'],
  },
  ar: {
    gen: ['جارٍ الإنشاء…', 'نمنح أصواتًا لكلماتك…', 'اقتربنا…'],
    stt: ['نستمع…', 'نكتب ما قيل…', 'اقتربنا…'],
    tr: ['جارٍ الترجمة…', 'نختار الكلمات المناسبة…', 'اقتربنا…'],
    clone: ['نستمع إلى صوتك…', 'نتعلّم كيف يبدو صوتك…', 'اقتربنا…'],
    design: ['نصمّم الأصوات…', 'نصوغ الصوت…', 'اقتربنا…'],
    dub: ['نرسل الفيديو…', 'نجهّز الدبلجة…', 'اقتربنا…'],
    send: ['جارٍ الإرسال…', 'اقتربنا…'],
  },
  ru: {
    gen: ['Создаём…', 'Даём голоса вашим словам…', 'Почти готово…'],
    stt: ['Слушаем…', 'Записываем текст…', 'Почти готово…'],
    tr: ['Переводим…', 'Подбираем нужные слова…', 'Почти готово…'],
    clone: ['Слушаем ваш голос…', 'Изучаем, как вы звучите…', 'Почти готово…'],
    design: ['Придумываем голоса…', 'Формируем звучание…', 'Почти готово…'],
    dub: ['Отправляем видео…', 'Готовим дубляж…', 'Почти готово…'],
    send: ['Отправляем…', 'Почти готово…'],
  },
  tg: {
    gen: ['Сохта истодаем…', 'Ба суханони шумо овоз медиҳем…', 'Қариб омода…'],
    stt: ['Гӯш карда истодаем…', 'Матнро менависем…', 'Қариб омода…'],
    tr: ['Тарҷума мекунем…', 'Калимаҳои дурустро интихоб мекунем…', 'Қариб омода…'],
    clone: ['Овози шуморо гӯш мекунем…', 'Тарзи садои шуморо меомӯзем…', 'Қариб омода…'],
    design: ['Овозҳоро тарроҳӣ мекунем…', 'Садоро ташаккул медиҳем…', 'Қариб омода…'],
    dub: ['Видеоро мефиристем…', 'Дубляжро омода мекунем…', 'Қариб омода…'],
    send: ['Фиристода истодаем…', 'Қариб омода…'],
  },
  uz: {
    gen: ['Yaratilmoqda…', 'Soʻzlaringizga ovoz berilmoqda…', 'Deyarli tayyor…'],
    stt: ['Tinglanmoqda…', 'Matn yozilmoqda…', 'Deyarli tayyor…'],
    tr: ['Tarjima qilinmoqda…', 'Toʻgʻri soʻzlar tanlanmoqda…', 'Deyarli tayyor…'],
    clone: ['Ovozingiz tinglanmoqda…', 'Ovozingiz oʻrganilmoqda…', 'Deyarli tayyor…'],
    design: ['Ovozlar yaratilmoqda…', 'Tovush shakllantirilmoqda…', 'Deyarli tayyor…'],
    dub: ['Video yuborilmoqda…', 'Dublyaj tayyorlanmoqda…', 'Deyarli tayyor…'],
    send: ['Yuborilmoqda…', 'Deyarli tayyor…'],
  },
};
