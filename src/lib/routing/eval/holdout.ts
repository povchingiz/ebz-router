/**
 * Отложенная выборка (held-out): формулировки написаны отдельно от 30 тестов бенчмарка,
 * лексикон под них не подгонялся. expect — допустимые id органов (префиксы).
 */
export interface HoldoutCase {
  lang: 'RU' | 'KK';
  text: string;
  expect: string[];
  kato?: string;
  region?: string; // ожидаемый 2-значный префикс КАТО, если в тексте назван населённый пункт
}

export const HOLDOUT: HoldoutCase[] = [
  { lang: 'RU', text: 'Сосед сверху затопил мою квартиру из-за прорыва трубы, управляющая компания отказывается составлять акт.', expect: ['mps', 'komitet-po-delam-stroitelstva-i-zhkh', 'akimat'] },
  { lang: 'RU', text: 'Уже месяц в нашем селе нет газа, баллоны привозят раз в неделю и цена на них выросла вдвое.', expect: ['me', 'komitet-gosudarstvennogo-energeticheskogo-na'] },
  { lang: 'RU', text: 'Мой сын отслужил по призыву, но военный билет до сих пор не выдали, в военкомате отмахиваются.', expect: ['mo'] },
  { lang: 'RU', text: 'В паспортном столе отказываются менять удостоверение личности из-за истекшего срока действия.', expect: ['mvd'] },
  { lang: 'RU', text: 'При ввозе автомобиля из Кыргызстана таможня насчитала огромный утилизационный сбор и пошлину.', expect: ['mf', 'komitet-gosudarstvennyh-dohodov'] },
  { lang: 'RU', text: 'Ребенку с инвалидностью отказали в назначении индивидуального помощника и технических средств реабилитации.', expect: ['mtszn', 'komitet-regulirovaniya-i-kontrolya-v-sfere-s'] },
  { lang: 'RU', text: 'В аптеках нет жизненно важного инсулина, а в поликлинике говорят, что его не завозили уже полгода.', expect: ['mz', 'komitet-medicinskogo-i-farmacevticheskogo-ko'] },
  { lang: 'RU', text: 'Микрофинансовая организация начисляет огромные штрафы за просрочку, а коллекторы звонят родственникам и угрожают.', expect: ['arrfr', 'mvd'] },
  { lang: 'RU', text: 'Авиакомпания отменила рейс и не вернула деньги за билет, на претензии не отвечает.', expect: ['mt', 'komitet-grazhdanskoi-aviacii', 'komitet-po-zaschite-prav-potrebitelei', 'mti'] },
  { lang: 'RU', text: 'Лесорубы вырубают сосновый бор возле нашего поселка, лесничество бездействует.', expect: ['mepr', 'komitet-lesnogo-hozyai-stva-i-zhivotnogo-mir'] },
  { lang: 'RU', text: 'Паводок подтопил огороды и подвалы домов, вода стоит уже неделю, просим помощи спасателей.', expect: ['mchs', 'mvri', 'akimat', 'komitet-preduprezhdeniya'] },
  { lang: 'RU', text: 'Учитель физкультуры унижает детей на уроках, директор школы игнорирует жалобы родителей.', expect: ['mp'] },
  { lang: 'RU', text: 'Студента отчислили из университета без объяснения причин и не вернули деньги за обучение.', expect: ['mnvo', 'mp'] },
  { lang: 'RU', text: 'Хозяин квартиры не вернул залог, а участковый отказывается принимать заявление о мошенничестве.', expect: ['mvd', 'generalnaya-prokuratura'] },
  { lang: 'RU', text: 'Многодетной семье до сих пор не выделили земельный участок под строительство дома, стоим в очереди девять лет.', expect: ['akimat', 'komitet-po-upravleniyu-zemelnymi-resursami', 'msh'] },
  { lang: 'RU', text: 'Магазин продал холодильник с браком, гарантийный ремонт не делают и деньги отказываются возвращать.', expect: ['mti', 'komitet-po-zaschite-prav-potrebitelei'] },
  { lang: 'RU', text: 'Центр занятости не помогает безработному, вакансии на портале оказались фиктивными.', expect: ['mtszn'] },
  { lang: 'RU', text: 'Нужно заверить документы апостилем для выезда за границу, а консульство не отвечает на письма.', expect: ['mid', 'myu'] },
  { lang: 'RU', text: 'Развод оформили, но бывший муж два года не платит алименты, судебный исполнитель бездействует.', expect: ['myu', 'komitet-prinuditelnogo-ispolneniya'] },
  { lang: 'RU', text: 'Директор школы собирает деньги на охрану, а питание в столовой некачественное, дети жалуются на отравления.', expect: ['mp', 'komitet-sanitarno-epidemiologicheskogo-kontr', 'mz'] },
  { lang: 'KK', text: 'Ауылымызда газ құбыры тартылмаған, қыста баллонмен жылынуға мәжбүрміз.', expect: ['me', 'komitet-gosudarstvennogo-energeticheskogo-na'] },
  { lang: 'KK', text: 'Мектептегі асханада балаларға сапасыз тамақ беріледі, ата-аналар шағымданып жатыр.', expect: ['mp', 'komitet-sanitarno-epidemiologicheskogo-kontr', 'mz'] },
  { lang: 'KK', text: 'Жұмыс беруші мені ешқандай ескертусіз жұмыстан шығарды және еңбек шартын бұзды.', expect: ['mtszn', 'komitet-gosudarstvennoi-inspekcii-truda'] },
  { lang: 'KK', text: 'Көрші елден әкелген көлігіме кеден бажын дұрыс есептемеген, қосымша төлем талап етіп жатыр.', expect: ['mf', 'komitet-gosudarstvennyh-dohodov'] },
  { lang: 'KK', text: 'Біздің ауданда өрт сөндіру бөлімі жоқ, өрт шыққанда көмек кешігіп келеді.', expect: ['mchs', 'komitet-protivopozharnoi-sluzhby'] },
  { lang: 'KK', text: 'Ауладағы қоқыс контейнерлері тазаланбайды, үйдің маңынан жағымсыз иіс шығады.', expect: ['akimat', 'mepr'] },
  { lang: 'KK', text: 'Университетте жатақхана орны берілмеді, шәкіртақы екі ай төленбей жүр.', expect: ['mnvo', 'mp'] },
  { lang: 'KK', text: 'Мүгедек балама мемлекеттік көмекті рәсімдеуге ұзақ уақыт кедергі келтіріп жатыр.', expect: ['mtszn'] },
  { lang: 'KK', text: 'Ұшақ рейсі тоқтатылып, билеттің ақшасы қайтарылмады.', expect: ['mt', 'komitet-grazhdanskoi-aviacii', 'komitet-po-zaschite-prav-potrebitelei', 'mti'] },
  { lang: 'KK', text: 'Шекарада көліктер екі тәулік кезекте тұр, өткізу пункті өте баяу жұмыс істейді.', expect: ['pogranichnaya-sluzhba', 'mf', 'komitet-gosudarstvennyh-dohodov', 'mvd'] },
  { lang: 'KK', text: 'Дүкенде тауарға қымбат баға қойып, чек бермейді, тұтынушылардың құқығы бұзылуда.', expect: ['mti', 'komitet-po-zaschite-prav-potrebitelei', 'mf'] },
  { lang: 'KK', text: 'Ауылға мал дәрігері келмейді, мал арасында құтыру ауруы тарап жатыр.', expect: ['msh', 'komitet-veterinarnogo-kontrolya-i-nadzora'] },
  { lang: 'KK', text: 'Әкімдік біздің көшені жөндемейді, көшеде жарық жоқ, түнде қараңғы болады.', expect: ['akimat', 'me'] },
  { lang: 'KK', text: 'Жеке кәсіпкерге салық тексеруі туралы хабарламасыз келіп, қызметін тоқтатты.', expect: ['mf', 'komitet-gosudarstvennyh-dohodov', 'generalnaya-prokuratura', 'mne'] },
  { lang: 'KK', text: 'Емханада маман дәрігерге жазылу үшін екі айға кезек беріп отыр.', expect: ['mz'] },
  { lang: 'KK', text: 'Құрылыс компаниясы жобадан ауытқып салған үйдің қабырғалары жарылып кетті.', expect: ['mps', 'komitet-po-delam-stroitelstva-i-zhkh'] },
  { lang: 'KK', text: 'Судья істі қараусыз бір жылға созды, сот отырысы әлі тағайындалмады.', expect: ['sudebnaya-administraciya', 'generalnaya-prokuratura'] },
  { lang: 'KK', text: 'Ауыз су құбыры ескірген, шүмектен қоңыр түсті су ағады.', expect: ['mps', 'komitet-po-delam-stroitelstva-i-zhkh', 'akimat', 'komitet-sanitarno-epidemiologicheskogo-kontr'] },
  { lang: 'KK', text: 'Балабақшаға кезек келмей жатыр, үш жыл күттік, орын жоқ дейді.', expect: ['mp', 'akimat'] },
  { lang: 'KK', text: 'Кәсіпорын зиянды қалдықтарды өзенге төгіп жатыр, балықтар қырылды.', expect: ['mepr', 'komitet-ekologicheskogo-regulirovaniya-i-kon'] },
  // регион: назван населённый пункт
  { lang: 'RU', text: 'В Актау во дворе нашего дома не убирают мусор и открыты люки на тротуарах.', expect: ['org-', 'akimat'], region: '47' },
  { lang: 'RU', text: 'Жители Семея жалуются на ямы на городских улицах и отсутствие освещения.', expect: ['org-', 'akimat'], region: '10' },
  { lang: 'KK', text: 'Шымкент қаласында аулада қоқыс контейнері жоқ, көшеде жарық жоқ.', expect: ['org-', 'akimat'], region: '79' },
  { lang: 'RU', text: 'В Павлодарской области в нашем дворе стихийная свалка, акимат не реагирует.', expect: ['org-', 'akimat'], region: '55' },
  { lang: 'RU', text: 'Проблема с благоустройством двора.', expect: ['org-', 'akimat'], kato: '311010000', region: '31' },
];
