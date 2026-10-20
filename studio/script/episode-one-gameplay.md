# الحلقة الأولى — مسار اللعب الكامل

**الحالة:** معالجة لعب وسيناريو تنفيذي قيد المراجعة، بالعربية أولاً. أحداث العالم الثابتة تتبع `studio/world/story-canon-ar.md` و`studio/world/chapter-plan.md` وقرارات المالك في `studio/npc/README.md`. هذه المعالجة تقارن التنفيذ بهذه المراجع؛ لا تدعي اعتماد Noor أو اعتماد الحوار العربي للتسجيل أو اكتمال البناء.

**النطاق:** افتتاحية جوزيف P ثم فصول لورينزو 1–3؛ نحو 41 دقيقة بحسب خطة الفصول. النهاية هي احتجاز لورينزو في اليوم الرابع بعد انتشار تسجيله. توجد الآن مسارات تنفيذية للفصول P و1 و2 و3 في `src/`، لكن وجود الكود أو نجاح البناء لا يثبت اكتمال الحلقة أو اجتيازها باللعب.

**قاعدة الحوار:** كل سطر حواري مقترح يظل مسودة للاختبار إلى أن تراجع Noor العربية وتعتمدها. سطور `[ref]` لا توزع على الفلاح أو زوجته أو غيرهما بالتخمين. الأدوار الثانوية بلا أسماء قصصية، ومعرفاتها الداخلية ثابتة.

---

## ما الذي يربط الحلقة؟

يلعب المستخدم أولاً جوزيف، فيرى حيوانات القرية تتجه إلى الجبل ويتبع بقرة الفلاح. لا يعرف جوزيف سر الجبل؛ يحاول فقط إعادة البقرة. بعد هجوم الجذور وتحوّل رجال الغربان، يفر عمر فاقداً ذاكرته. ثم تنتقل الرؤية إلى لورينزو في اليوم الأول، باحثاً عن والد سال. يتبع الأدلة إلى الجبل في الفصل الثاني، ويجد جوزيف والحيوانات في القاعة ويصورهما، ثم يخرج من فم الكهف. يجعل التسجيل الاختفاء مرئياً للناس، وينتهي الفصل الثالث بمصادرة الكاميرا واحتجاز لورينزو.

يظل هذا منظوراً شخصياً داخل العالم: لا مشاهد خارج منظور اللاعب، ولا كشف مبكر لأصل الجذور، ولا قتال في فصول لورينزو.

## تسلسل الأحداث الملزم

1. ليلة 0: الفلاح يبحث عن حيواناته؛ جوزيف يتبع البقرة والقطيع إلى الكهف، ثم تحفظه الجذور مع الحيوانات.
2. في خط الغربان، ليلة 0: يبدأ عمر في المقهى قبل الهجوم؛ تهاجم الجذور العصابة وتحوّل أفرادها، ثم يفر عمر فاقداً ذاكرته.
3. يوم 1: تعثر الشرطة على عمر قرب الجبل، وتنقله إلى المركز مكبلاً. يفك الضباط الأصفاد أثناء الفحص الطبي وتحت الحراسة؛ يبقى غير مكبل بعده وفي لقاءات إيليا.
4. بعد العثور على عمر: يكلّف مورينو إيليا بالمهمة السرية. تظهر إيليا في اليوم الثاني فقط، وتبدأ غطاء الحبيبة بعد التكليف؛ عمر غير مكبل في لقاءاته معها.
5. يوم 1: بعد تأخر جوزيف وتأكد مريم أنه لم يرجع، تخرج إلى الساحة. لا تذهب إليها قبل ذلك.
6. يوم 3: يتبع لورينزو الدليل إلى الكهوف، يصور جوزيف والحيوانات، ويخرج من فم الكهف.
7. ليلة اليوم 3 إلى 05:10 يوم 4: يصعد برج الأجراس ويرفع التسجيل. بعد انتشاره تصل الجهات الخارجية وتحتجزه وتأخذ مادته.

---

## المقدمة P — اتجاه واحد

**الزمن والمكان:** ليلة 0، 16:40؛ الحظيرة، المرعى، معبر الجدول، مسار القطيع، فم الكهف، القاعة.
**اللاعب:** جوزيف. **المدة المستهدفة:** 8 دقائق. **القتال والسلاح:** لا يوجد.

### بدء اللعب

- وفق تسلسل العالم، يظهر الفلاح باحثاً عن الحيوانات قبل أن يستطيع لورينزو محادثته لاحقاً؛ ليسا في المشهد نفسه. البناء الحالي يشغّل جوزيف في الحظيرة ويعرض مسار البقرة، لكنه لا يثبت أن بحث الفلاح المنفصل نُفّذ كمشهد كامل.
- هدف واضح: **اعثر على بقرة الفلاح**. يتعلم اللاعب النظر والمشي والتفاعل مع الأبواب والبوابات.
- تعطي الحظيرة إشارات بصرية: مرابط وسلاسل سليمة، قش وآثار حوافر. لا حوار جديد ولا تفسير لما حدث.
- عند العثور على البقرة، تتجه إلى المخرج؛ يقودها مسار الحوافر إلى المرعى ثم نحو الجدول.

### المسار القابل للعب

1. يتبع جوزيف البقرة بين المراعي. الكود يحركها حين يكون اللاعب على بعد أقل من 24 متراً وأكثر من 3.8 أمتار؛ إذا ابتعد أكثر تتوقف، وإذا لحق بها تتوقف أيضاً. يستعيدها اللاعب باتباع آثار الحوافر؛ طريقة الرجوع هذه تحتاج اختباراً على المسار الفعلي.
2. يتعلم اللاعب القفز عند جدار حجري، وينحني تحت عارضة سياج حيث توجد فتحة مصممة؛ موضع الفتحة على مسار القطيع يحتاج تثبيتاً في هندسة المستوى ومراجعة.
3. يعبر الجدول عبر أحجار العبور ويتبع القطيع. لا يظهر دليل أو أثر يوحي بأن جوزيف يحقق في الغربان.
4. يقود ضوء الغروب والصوت الطبيعي إلى فم الكهف. لا تنغلق البوابة خلف اللاعب ولا يوجد طريق فرعي مطلوب.
5. عند الوصول إلى القاعة، يرى اللاعب الحيوانات متجهة إلى البئر. آثار الحوافر تتوقف تحتها؛ بقرة الجرس صامتة.
6. يتقدم جوزيف نحو بقرة الفلاح. عندما يقترب، تبدأ الجذور بلف ساقيه وجذعه. تستمر الحركة ببطء في منظور الشخص الأول، ثم يبهت المشهد إلى الانتقال.

### الخروج والاستعادة

- السقوط أو الخروج من الحدود يعيد اللاعب إلى آخر لقطة آمنة متدرجة على الأرض، ويستعيد موضع البقرة الموافق لها. لا توجد أدلة على نقاط حفظ ثابتة عند الحظيرة والجدول وفم الكهف أو حفظ دائم.
- تنتهي السيطرة في القاعة بعد أن يبدأ التثبيت، ثم يظهر عنوان **الفصل 1 — الوصول** ومطالبة المتابعة إلى لورينزو.
- لا تضع أجساداً متحولة للغربان في القاعة كإشارة تمهيدية؛ كشف التحول موثق في أنفاق الغربان بالفصل الثاني. لا أسماء أو شرح أو حوار جديد من جوزيف.

**حالة التنفيذ:** الكود موجود في `src/prologueCow.ts`, `src/prologueRoots.ts`, `src/prologueHall.ts` و`src/villageMain.ts`. آخر تسليم يثبت بالمسبار هدف العثور على البقرة وتقدمها، واستعادة موضع خارج الحدود إلى نقطة آمنة مع استعادة موضع البقرة. المراجعة البصرية الكاملة ونقاط التوقف الثابتة عند الحظيرة/المجرى/فم الكهف والحفظ الدائم ما زالت غير متحققة أو غير منفذة بحسب الدليل المتاح.

---

## الفصل 1 — الوصول

**الزمن والمكان:** يوم 1، القرية؛ الحظيرة، المزرعة، الساحة، بيت مريم، الكنيسة، مركز الشرطة.
**اللاعب:** لورينزو. **المدة المستهدفة:** 12 دقيقة. **القتال:** لا يوجد.

### الدافع والأدوات

وصل لورينزو بحثاً عن والد سال المخطوف، بعد أن استعانت به عائلة سال. هدف الفصل حسب تخطيط القرية: **اعرض صورة والد سال على أربعة أشخاص، صوّر ثلاث إفادات، واعثر على مريم**. تسليم الصورة وموقعه غير مثبتين؛ بدء الفصل والصورة في يد لورينزو اختيار تصميمي. الصور والشهادات اختيارية ولا تمنع تقدم القصة.

- المشي والاستكشاف، الضغط على E للحديث أو فحص المعالم.
- الضغط المستمر على زر الفأرة الأيمن للتسجيل؛ البطارية مورد تصوير محدود. لقطة الإفادة تسجل إذا بقي الشخص داخل الإطار زمناً كافياً.
- لا سلاح. الشرطة تمنع الاقتراب من السيارة أو دخول المركز قبل الحدث المناسب، من دون قتال.

### إيقاع اللعب والأهداف

**1. ابدأ يوم 1 مع لورينزو.** يبدأ البناء الحالي في موقع الحظيرة بعد أحداث ليلة 0. لا يشاهد لورينزو ولا يسمع نشاط الغربان في المقهى قبل الهجوم؛ عمر في المقهى حدث سابق في خط العالم، لا مشهد للورينزو. لا توجد لقطة أو تسجيل مثبت له، فلا نضيف استرجاعاً. تسليم صورة الأب وموجز المهمة تفصيلان تصميميان لمصدرهما وموضعهما غير محسومين.

**2. افحص المزرعة.** الهدف: **تحقق من طريق القطيع**. يبحث اللاعب في الحظيرة وحول المعلف، ويجد السلاسل سليمة وآثار الحوافر متجهة شمالاً شرقيّاً. يستطيع محادثة الفلاح بعد ظهور البحث التمهيدي في المقدمة. سطره المنسوب إلى `[ref]` لا يستخدم حتى يحسم مصدره؛ يمكن تشغيل السطر المقترح الموجود في مواصفات NPC كمسودة فقط.

**3. اسأل القرية عن والد سال.** الهدف الاختياري: **اعرض الصورة لأربعة أشخاص وسجل ثلاث إفادات**. يضغط اللاعب P وهو يوجه النظر إلى الفلاح أو زوجته أو القسيس أو شرطي أو قروي؛ يحتسب الدفتر أربعة معرفات أدوار مختلفة. يسجل التصوير ثلاث ثنائيات NPC+سطر مختلفة، وقد يكرر قرويون مختلفون المعلومة العامة نفسها؛ لا يعني ذلك ثلاث حقائق سردية مختلفة. الحوار المقترح يبقى `proposed`. الشخصيات الثانوية تظهر بأوصافها ومعرفاتها الداخلية، ولا تكتسب أسماء. لا تنقل سطراً `[ref]` إلى الفلاح أو الزوجة بالتخمين.

**4. اعثر على مريم.** الهدف: **اذهب إلى بيت مريم**. تبدأ مريم في البيت وساحته. عند أول سؤال، لا تكشف سر ليلة اختفاء جوزيف. بعد مرور ثماني ثوانٍ من وقت اللعب، وعندما يتحدث إليها اللاعب ثانية، تؤكد أنها تفقدت البيت وأنه لم يرجع. عند سماع هذا التأكيد فقط تفتح البوابة وتذهب إلى طرف الساحة الشرقي؛ هناك يمكنها تعليق ملصقات جوزيف في مسار الفصل. لا تنتقل إلى الساحة بمجرد بدء اليوم.

**5. عمر في المركز بعد العثور والنقل.** ترتيب العالم ثابت: المقهى ونشاط الغربان ← الهجوم والتحول ← هروب عمر وفقدان الذاكرة ← العثور قرب الجبل ← نقله مكبلاً إلى المركز. لا يفترض النص أن لورينزو شاهد العثور أو النقل. البناء الحالي يبدأ شريحة يوم 1 بعمر عند المركز ضمن أحداث مهيأة مسبقاً؛ هذا ليس مشهد العثور والنقل، ولا يجوز أن يظهر عمر هناك قبل تسجيل الحدثين في اللعبة الكاملة.

**6. اقترب من المركز بحدود واضحة.** يستطيع لورينزو سماع مورينو يشك في فقدان ذاكرة عمر، ثم محادثة عمر. يبدأ الفحص الطبي تحت الحراسة؛ تزال الأصفاد فقط بعد اكتماله. لا يخرج عمر وحده ولا يلتقي إيليا في هذا اليوم. تكليف إيليا يأتي بعد العثور على عمر، وظهورها وبدء غطائها في اليوم الثاني. الكود الحالي يربط موجز مورينو باكتمال الفحص وبسماع عمر؛ شرط الفحص الإضافي ترتيب تنفيذي، لا قرار قصصي ثابت.

### الإكمال وحالات الرجوع

- بعد إفادة عمر والفحص المحروس، يعرض الكود سطر مورينو الذي يشكك بذاكرة عمر ثم ينقل إلى اليوم الثاني. يحمل يوم 2 حدث التكليف مسبقاً، وتذكر بطاقة الهدف أن مورينو كلّف إيليا؛ لا توجد لحظة لعب/مشهد تكليف منفصل. لا تصف الانتقال الحالي على أنه مشهد تكليف.
- إذا استنفد اللاعب بطارية الكاميرا، يظل يستطيع إكمال القصة. موضع الشحن غير محدد، ولا يوجد دليل على استمرار البطارية أو سجل التسجيل بعد إعادة تحميل صفحة فصل.
- يمنع الشرطي الاقتراب من سيارة النقل أو باب المركز حين تكون المنطقة مغلقة. لا توجد خسارة أو اشتباك؛ يعود اللاعب خطوة إلى الساحة.
- العثور والنقل خارج المشهد في البناء الحالي. لا تعرض هدفاً يوحي بأن اللاعب فوّت مشهداً لم يحدث. في تنفيذ القصة الكامل: لا تفتح حالة المركز إلا بعد حدث العثور والنقل.

**حالة التنفيذ:** الكود موجود لمحادثات NPC والكاميرا وسجل الأدلة الاختياري. تحقق مسبار المتصفح من بطاقة الصورة وأربعة أدوار مختلفة، وثلاث ثنائيات NPC+سطر مختلفة عند 3/3 مع منع التكرار؛ قد تتكرر جملة الإفادة نفسها بين شخصيات مختلفة. الإثبات: `studio/reports/ch1-testimony-proof.png` وسجل التسليم. عمر والفحص موجودان في الشريحة المهيأة، لكن العثور والنقل غير معروضين، وتكليف إيليا لا يظهر كلحظة صريحة. الكود الحالي يشترط سماع إيليا قبل سطر عمر في يوم 2؛ ملاحظة التجاوز الأقدم لم تعد تنطبق. المسار الكامل غير متحقق. ارتفاعات المباني تبقى وفق قرارات المالك.

---

## الفصل 2 — طريق الغربان

**الزمن والمكان:** يوم 3؛ طريق المحجر، بوابة منجم الغربان، المستودع والممرات السفلى، القاعة وفم الكهف.
**اللاعب:** لورينزو. **المدة المستهدفة:** 15 دقيقة. **القتال:** لا يوجد.

### بداية التحقيق

- بعد نهاية يوم 1، ينتقل اللعب إلى اليوم 2 بهدف فعلي: التحدث إلى إيليا في شرفة المقهى. يجب أن يسمع لورينزو سطرها عن صورة الرجل المفقود، ثم يعود إلى عمر ويسمع سطره عن غطاء الحبيبة قبل انتقال الفصل 2. تظهر إيليا بعد تكليف مورينو فقط؛ لا يخترع اللاعب اسماً لغطائها.
- الكود الحالي لا يعرض لحظة التكليف: سطر مورينو الموجود يشكك بذاكرة عمر، ثم يحمل يوم 2 علامة التكليف مسبقاً. أضف beat واضحاً للتكليف بعد العثور على عمر؛ لا تضف نصاً حوارياً جديداً معتمداً، والحوار المقترح يبقى مسودة.
- عمر غير مكبل في اللقاء. موضعه الحالي بالمركز حالة مؤقتة في الكود؛ هدف العالم أن يقيم مع إيليا فوق المقهى، لكن هندسة/ارتفاع الغرفة العلوية لم يحسما. كما أن ترتيب التفاعل قابل للتخطي حالياً: حديث عمر أولاً قد ينقل إلى الفصل 2 قبل سماع إيليا. يلزم ربط انتقال Ch2 بسماع سطر إيليا أولاً مع بقاء الرجوع إليها متاحاً.
- هذا خيط موازٍ؛ لا يحول إيليا إلى رفيقة أو شاهدة تعرف ما حصل داخل الجبل.

### خطوة اللعب التالية القابلة للتنفيذ

يمكن إكمال ترتيب اليوم الثاني دون قرار قصصي من المالك أو كتابة حوار جديد. بطاقة الهدف الموجودة تذكر أن مورينو كلّف إيليا، ثم يتبع اللاعب: **قابل إيليا في الشرفة ← اسمع سطر `elia_photos` الموجود ← ارجع إلى عمر واسمع `omar_watcher` الموجود ← ابدأ الفصل الثاني**. اجعل سماع إيليا شرطاً لتفعيل انتقال عمر؛ إذا وصل اللاعب إلى عمر أولاً، أبقِ الهدف عند إيليا ولا تستهلك سطر عمر أو تنقل المرحلة. بعد سماع إيليا، يبقى الرجوع إلى عمر متاحاً. هذا يصلح فجوة ترتيب التفاعل فقط؛ لا يضيف مشهد تكليف مرئياً أو معلومة أو حواراً. أي تعديل للنص العربي المقترح يظل مسودة حتى اعتماد Noor.

### الاستكشاف داخل الجبل

1. هدف: **اتبع الطريق إلى المحجر**. يتبع لورينزو الطريق الموثق إلى المحجر وآثار الاستخدام البشري المذكورة في تخطيط المناطق؛ لا تضف اعترافاً أو خريطة أو مفتاحاً قصصياً جديداً. نقطة بدء الدليل التفصيلية من القرية ما زالت قراراً تصميمياً مفتوحاً، ويجب ربطها بعلامة موجودة في المشهد قبل التنفيذ.
2. هدف: **اعثر على مدخل ممرات الغربان**. يدخل من بوابة المنجم إلى ممرات مضاءة بخيط إنارة متعطل؛ لا وقود للمولد. يستخدم ضوء الكاميرا، مع بطارية الكاميرا المحدودة، لقراءة المكان.
3. يتعلم اللاعب قراءة التحذير: صرير الجذر وغبار يسقط قبل الاندفاع بـ0.6 ثانية. يختبئ أو يتراجع أو يمرّ بعد انتهاء الاندفاع. لا يملك سلاحاً ولا يستطيع قتل الجذور.
4. هدف: **اتبع أثر التمديدات إلى المستوى السفلي**. يتجاوز خشب التدعيم وممر زحف منخفض بالانحناء، ويستخدم إضاءة الكاميرا لتحديد الطريق.
5. في المستودع يجد مسجلاً صوتياً يحمل العبارة المثبتة في وصف المنطقة: «أغلقوا البوابة! الحيطان تتحرك!» تبقى هوية المتحدث غير محددة؛ لا ينسبها النص إلى عمر أو أي فرد بعينه.
6. يصل إلى القاعة. يجد جوزيف والحيوانات المحفوظة كما تصف منطقة الكهوف؛ لا يقترب بما يفك التثبيت ولا يفسر الظاهرة.
7. هدف: **صوّر جوزيف والحيوانات**. يصور المشهد من موضع آمن؛ لا يعرّف اللاعب الأجساد بأسماء ولا يضيف حواراً أو قتالاً. اللقطة شرط لإنهاء الفصل ورفعها لاحقاً؛ إذا فاتته يعود إلى القاعة. إذا نفدت البطارية قبل اللقطة، يتيح البناء إعادة الفصل بزر R.
8. بعد التصوير، يبدأ ممر الجذور/الزحف بالإغلاق خلفه. هدف: **اخرج من فم الكهف**. يقرأ تحذير الجذر، ينحني عبر الممر، ويتبع ضوء الفم المرئي. يخرج من فم الكهف؛ هذه نهاية الفصل الثاني، لا كشف مؤجل لفصل لاحق.

### الخروج والاستعادة

- ضربة الجذر تعيد اللاعب إلى نقطة آمنة قبل الممر وفق نظام الاستعادة الذي سيُنفذ؛ لا تخصم دليلاً مسجلاً.
- إذا اختار طريقاً مسدوداً، يتراجع الممر أو يعيد توجيهه عبر علامات السكة والتمديدات؛ لا توجد آلية قتال أو مورد إضافي.
- الفصل ينتهي بعد خروج لورينزو من فم الكهف ومعه تسجيل جوزيف والحيوانات، وهو دليل على استمرار الخطر والاختفاء. لا يستنتج النص أصل الجذور أو علاقتها بالمادة العلمية.

**حالة التنفيذ:** يوجد مسار فصل قابل للدخول بـ`?chapter=2` في `src/chapterTwo.ts` و`src/villageMain.ts`. أثبت مسبار سابق المشي من البوابة إلى المستودع والقاعة والخروج مع تفويت التصوير؛ بعد ذلك أُغلق هذا التجاوز في الكود. فحص الأنواع والبناء نجحا بعد التعديل، لكن المسار الجديد وتصوير اللقطة والانتقال إلى الفصل الثالث لم تتحقق باللعب بعد. جولة بصرية كاملة ومراجعة توقيت خطر الجذور ما زالت مفتوحة.

---

## الفصل 3 — الإشارة

**الزمن والمكان:** ليلة يوم 3 حتى 05:10 يوم 4؛ القرية والكنيسة وبرج الأجراس.
**اللاعب:** لورينزو. **المدة المستهدفة:** 6 دقائق. **القتال:** لا يوجد.

### المشهد القابل للعب

1. يعود لورينزو إلى القرية. في الكنيسة سهر مع 14 شمعة في النوافذ كما في تخطيط القرية. لا يضيف الحوار سبباً جديداً أو شخصية غير مثبتة.
2. هدف: **اصعد برج الأجراس**. يطلب لورينزو الإذن من الكاهن ويصعد أربع طلعات. تحذير الدرجة الرابعة مسودة مقترحة. لا تفترض نقطة استعادة عند السقوط؛ هذه تحتاج تحققاً.
3. يبدأ كود الفصل الساعة 05:05 بمهلة فعلية 300 ثانية حتى 05:10، رغم مدة الفصل المستهدفة ست دقائق. عند أعلى البرج يمسك اللاعب E مدة 20 ثانية لرفع التسجيل. لا يضاف اسم خدمة أو منصة.
4. إذا انقطع الضغط بإفلات الزر أو مغادرة المنصة، يعود التقدم إلى الصفر ويظل الرفع قابلاً للمحاولة حتى 05:10. إذا انتهى الموعد قبل نجاح الرفع، يظهر فرع فشل قابل لإعادة الفصل؛ لا تعرضه كنهاية قصصية معتمدة.
5. بعد نجاح الرفع، يبقى لورينزو في أعلى البرج حتى 05:10 بينما ينتشر التسجيل. عند الموعد تظهر أربع مركبات للجهات الخارجية وكشافاتها على طريق الوادي. تحتجز الشخصيات غير المسماة لورينزو وتصادر مادته في منظور أول: تُربط يداه وتؤخذ الكاميرا. لا توجد مقاومة مسلحة.
6. نهاية الفصل: عنوان **الإشارة**، انتقال إلى الفصل التالي خارج نطاق الحلقة. لا يعرض النص ما صوّرته الجهات أو يكشف مصير لورينزو بعدها.

**حالة التنفيذ:** يوجد مسار فصل قابل للدخول بـ`?chapter=3` في `src/chapterThree.ts` و`src/villageMain.ts`. اختبار Chromium `tests/e2e/chapter-three-route.spec.ts` يحقق وصول اللاعب إلى القسيس والبرج، والرفع 20 ثانية، والانتظار حتى 05:10 دون احتجاز مبكر، ثم الاحتجاز والعنوان (1/1، 2026-10-20). إعادة الرفع بعد انقطاعه وقياس زمن الصعود طبيعياً ما زالا مفتوحين.

---

## نظام الحلقة وتدفق الأهداف

- الهدف الحالي دائماً فعل محدد («افحص الحظيرة»، «اسأل مريم»، «اتبع التمديدات»)، ومعه سبب قصصي مختصر. لا تعتمد الأهداف على حوار ما زال مفتوحاً كمرجع `[ref]`.
- مفاتيح التقدم المقترحة: `prologue_joseph_taken`، أحداث عمر بالترتيب، `maryam_joseph_late_confirmed`، `day2_elia_assigned`، `day2_elia_heard`، `day2_omar_cover_line_heard`، `lorenzo_filmed_joseph`، `footage_uploaded`، `lorenzo_detained`. هذه أسماء تصميمية وليست canon أو أعلاماً موجودة حالياً. لا يُكمل حوار عمر يوم 2 ولا ينتقل إلى Ch2 قبل سماع إيليا.
- إذا تعطل NPC أو ابتعد اللاعب، تبقى علامة الحدث والتفاعل في موضع آخر أو عند العودة. لا تتطلب إعادة حوار لم يره اللاعب كي تكمل القصة.
- لا تمنح جوزيف أو لورينزو سلاحاً. لا تجعل التصوير يقتل الجذر أو يفك الجذور عن جوزيف. الضوء أداة رؤية فقط؛ الكهرباء يكتشفها سال في الفصل الخامس.
- واجهة Ch1 تعرض عداد صورة العائلة والإفادات. دفتر موحد يجمع لاحقاً الصورة والآثار والمسجل وتصوير جوزيف اقتراح تصميمي؛ سجل الصفحة الحالي لا يثبت حفظ الأدلة عبر تحميل الفصول.
- يسمح للاعب بفحص اختياري وتسجيل إفادات إضافية. المحصلة تعطي اكتمالاً أفضل للملف، لكن الأحداث الحتمية تظل قابلة للتقدم ولا تتحول إلى نهاية بديلة غير موجودة في canon.

## خريطة تغطية البناء الحالي

| الجزء | موجود حسب الكود/الرسائل الحالية | يلزم للحلقة الكاملة |
|---|---|---|
| P | **الكود موجود؛ مسار مستمر متحقق:** اختبار Chromium يمشي جوزيف فعلياً من الحظيرة بمحاذاة البقرة، يعبر باب الحظيرة وفجوة الجدار، ويصل إلى هجوم الجذور ثم مدخل القاعة وعنوان النهاية (`tests/e2e/prologue-route.spec.ts`). | **مفتوح:** مراجعة المسار والنهاية بصرياً، ونقاط التوقف الثابتة عند الحظيرة/المجرى/فم الكهف، والحفظ الدائم. القاعة لا تعرض كشف تحوّل الغربان. |
| Ch1 | **الكود موجود؛ تحقق جزئي:** بطاقة الهدف تتبع الفلاح ← مريم/الانتظار والتأكيد ← الساحة ← عمر والفحص ← مورينو. اختبار Chromium يتحقق من الحوار والانتظار ثم حركة مريم على مسارها الفعلي حتى نقطة الساحة (`tests/e2e/chapter-one-objectives.spec.ts`). اختبارات مستقلة تحقق دفتر الأدلة وترتيب إيليا وعمر. | **مفتوح:** الاختبار يضع لورينزو قرب الشخصيات بأداة الاختبار؛ المسار الطبيعي الكامل وحدوده غير متحققين. العثور والنقل غير معروضين، والتكليف بطاقة يوم 2 وليس إحاطة قابلة للعب. |
| Ch2 | **الكود موجود؛ دليل المسبار سابق للتعديل:** وصل من بوابة المنجم إلى المستودع والقاعة ثم خرج مع تفويت التصوير. الكود الحالي يشترط اللقطة قبل الخروج ويحفظها لانتقال الحملة إلى Ch3. | **مفتوح:** إعادة تحقق المسار بعد التعديل، مراجعة بصرية كاملة، وتوقيت خطر الجذور. |
| Ch3 | **مسار E2E متحقق:** اختبار Chromium يمر بالقسيس ← أعلى البرج ← رفع 20 ثانية ← انتظار حتى 05:10 دون احتجاز مبكر ← الاحتجاز والعنوان (`tests/e2e/chapter-three-route.spec.ts`, 1/1). | **مفتوح:** إعادة الرفع بعد الانقطاع، قياس زمن الصعود طبيعياً، والجولة البصرية الكاملة. |

**دليل البناء واللعب:** أحدث التسليمات بتاريخ 2026-10-20 تحقق من `npm run typecheck` و`npm run build`، واختبار Prologue متصل يمشي جوزيف من الحظيرة إلى هجوم الجذور ومدخل القاعة وعنوان النهاية؛ بقيت اختبارات Ch1/Ch2/Ch3 الأخرى محدودة أو جزئية، مع تحذير حزمة materials كبيرة في البناء. لم يثبت مسار كامل للحلقة من البداية إلى النهاية. وجود الكود والتحقق الجزئي والجولة المتصلة لمقطع محدد حالات منفصلة. هذه ليست موافقة سردية.

## قرارات ثابتة نُفذت في التصميم

- ترتيب يوسف/جوزيف وعمر وإيليا كما أعلاه؛ مشهدان متوازيان متتابعان في ترتيب الحفظ، لا انعكاس ترتيب الوصول.
- عمر لا يظهر في المركز إلا بعد العثور عليه قرب الجبل؛ أصفاده تُزال في الفحص الطبي تحت الحراسة.
- إيليا تظهر يوم 2 بعد التكليف فقط، وغطاؤها يبدأ بعده. عمر بلا أصفاد في اللقاءات.
- مريم تخرج بعد تأخر جوزيف والتأكد من عدم عودته.
- الفلاح يظهر باحثاً في المقدمة، ثم يمكن محادثته لاحقاً. لا يعاد تمثيل بحثه مع لورينزو.
- القرويون والشرطة والكاهن والفلاح وزوجته يظلون بلا أسماء قصصية.
- الحوار المقترح يبقى مسودة. مرجع الفلاح والزوجة غير محسوم؛ لا تعيين أو نقل بالتخمين.

## مراجعة Imad وما عولج هنا

- فصلت حدث المقهى السابق للهجوم عن بداية لعب لورينزو؛ لا استرجاع أو شهادة غير موثقة. العثور على عمر ونقله خارج الشاشة في البناء الحالي.
- ثبتت أصفاد عمر حتى الفحص تحت الحراسة ثم إزالتها. تكليف إيليا بعد العثور ثابت؛ شرط الكود أن يسبق التكليف اكتمال الفحص اعتماد تنفيذي لا canon.
- أبقيت مسار Ch2 عبر القاعة وتصوير جوزيف والحيوانات ثم فم الكهف. طريق المحجر قابل للمشي، لكن دافعه القصصي ما زال مفتوحاً.
- وضحت أن عداد الإفادات يقيس أزواج NPC+سطر وقد تتكرر الجملة، وأن أهداف التصوير اختيارية.
- أضفت فجوة يوم 2: التكليف غير ظاهر صراحة، والكود يسمح بإكمال حوار عمر والانتقال قبل سماع إيليا. الترتيب المقصود يحتاج إصلاحاً.
- أظهرت فجوات استعادة البقرة، الحفظ بين الصفحات، ومهلة/فشل Ch3 وانتشار التسجيل. المسبارات المحدودة لا تثبت جولة كاملة.
- لا توجد موافقة Noor على الحوار العربي المقترح. أسطر `proposed` ومراجع `[ref]` تبقى مفتوحة.

## أسئلة/بوابات مفتوحة قبل اعتماد نصوص التنفيذ

1. مراجعة Noor واعتماد العربية لكل حوار مسودة، وتحديد من يقول أسطر `[ref]` بعد فتح المراجع الأصلية.
2. تحديد الدليل المشهدي الموجود الذي يقود لورينزو من القرية إلى طريق المحجر؛ لا يوجد مصدر قصصي محدد بعد.
3. حسم تقديم وصول عمر: بناء مشهد مرئي للنقل من الجبل بعد العثور عليه، أو الإبقاء عليه حدثاً خارج المشهد مع ظهوره في المركز بعد ذلك.
4. اختيار نقطة شحن للكاميرا إن ظلت البطارية محدودة في Ch1–3؛ لا تضف محطة غير موجودة في هندسة القرية.
5. قياس وقت صعود البرج وتعديل مساحة فصل 6 دقائق قبل تثبيت مؤقت 05:10.
6. توحيد أسماء علامات الحفظ وأهداف UI مع Subzero قبل تحويل المعالجة إلى مهام تنفيذ.
7. التأكد من تراخيص ملفات البيئة/الأصول قبل ضمها للمشروع؛ الأصول لا تغير القصة أو تمنح قدرات جديدة.

---

# Episode One — Complete Gameplay Treatment

**Status:** Arabic-first gameplay and script treatment under review. Fixed world events follow `studio/world/story-canon-ar.md`, `studio/world/chapter-plan.md`, and the owner's decisions in `studio/npc/README.md`. This treatment compares the current implementation with those references; it does not claim Noor's approval, Arabic dialogue approval for recording, or a complete game build.

**Scope:** Joseph's playable Prologue P plus Lorenzo's Chapters 1–3; about 41 minutes per the chapter plan. The end is Lorenzo's detention after his footage spreads on Day 4. Routes for all four parts are present, with bounded probes for selected transitions; none has a verified full visual playthrough.

**Dialogue rule:** Any proposed line stays a test draft until Noor reviews and approves its Arabic. `[ref]` lines are not assigned to the farmer, his wife, or anyone else by guess. Secondary roles keep role labels and stable internal IDs, not invented story names.

## What connects the episode

The player first controls Joseph, watches the animals head toward the mountain, and follows the farmer's cow. Joseph does not know the mountain's secret; he is simply trying to bring the cow home. After the roots attack and transform the Ravens, Omar escapes with amnesia. The viewpoint then shifts to Lorenzo on Day 1, looking for Sal's father. He follows evidence into the mountain in Chapter 2, finds and films Joseph and the animals in the Hall, then exits through the cave mouth. The recording makes the disappearance visible, and Chapter 3 ends with Lorenzo's camera seized and Lorenzo detained.

The story stays in the player's first-person view. It does not reveal the roots' origin early, and Lorenzo's chapters have no combat.

## Binding event order

1. Night 0: the farmer searches for animals; Joseph follows the cow and herd to the cave, where the roots preserve him with the animals.
2. In the Ravens thread on Night 0, Omar starts at the café before the attack; the roots attack and transform the gang, then Omar escapes with amnesia.
3. Day 1: police find Omar near the mountain and transport him cuffed. Officers remove his cuffs during the guarded medical check; he stays uncuffed afterward, including at Elia's meetings.
4. After Omar is found, Moreno assigns Elia the covert task. She appears on Day 2 only, after the assignment, and only then starts her girlfriend cover. Omar is uncuffed at her meetings.
5. Day 1: after Joseph is late and Maryam confirms he did not return, she goes to the square. She does not go before then.
6. Day 3: Lorenzo follows clues into the caves, films Joseph and the animals, and exits through the cave mouth.
7. Night of Day 3 through 05:10 on Day 4: he climbs the bell tower and uploads the footage. After it spreads, outside agencies arrive, detain him, and take his material.

## Prologue P — Same Direction

**Time/place:** Night 0, 16:40; barn, pasture, stream crossing, herd trail, cave mouth, Hall.
**Player:** Joseph. **Target duration:** 8 minutes. **Combat/weapons:** none.

### Start

- In the world chronology, the farmer appears searching before Lorenzo can speak to him later; they are not in the same scene. The current build starts Joseph in the barn and shows the cow route, but does not prove that the farmer's separate search is a fully authored scene.
- Objective: **Find the farmer's cow.** Teach looking, walking, and using doors/gates.
- The barn gives visual clues: intact halters and chains, straw, and hoofprints. No new dialogue or explanation.
- The cow heads for the exit when found and leads the hoofprints through the pasture toward the stream.

### Playable route

1. Joseph follows the cow through the fields. Code moves it while the player is within 24 m and farther than 3.8 m; it pauses if the player is farther away or catches up. The player can follow hoofprints to rejoin it; that recovery needs testing on the actual route.
2. A dry-stone wall teaches jumping. A rail-fence opening/crouch gap is a proposed route beat; its presence and location are not verified in the level.
3. Cross the stream using the stepping stones and follow the herd. There is no clue suggesting Joseph is investigating the Ravens.
4. The sunset and natural sound lead to the cave mouth. No required side path or closed gate traps the player.
5. In the Hall, the animals face the Well. Hoofprints stop beneath them; the bell cow is silent.
6. Joseph reaches for the farmer's cow. When close, roots coil around his legs and torso. The movement slows in first person, then fades to transition.

### Failure and recovery

- Falling or leaving bounds returns the player to the latest rolling safe snapshot on the ground and restores the cow to its matching trail point. No fixed barn/stream/mouth checkpoints or persistent save are evidenced.
- Control ends in the Hall after the roots start taking Joseph. The title card reads **Chapter 1 — Arrival**, with a prompt to continue as Lorenzo.
- Do not place transformed Ravens in the Prologue Hall as a visual teaser; the documented transformation reveal belongs to the Ravens' tunnels in Chapter 2. No names, explanation, or new Joseph dialogue.

**Build status:** code for the cow route, root attack, and authored Hall transition is present in `src/prologueCow.ts`, `src/prologueRoots.ts`, `src/prologueHall.ts`, and `src/villageMain.ts`. The latest bounded probe verified the cow objective/progress and out-of-bounds recovery to a safe snapshot while restoring the cow route. The full visual route, authored barn/stream/cave-mouth checkpoint behavior, and persistent save remain unverified or unimplemented in the available evidence. The Hall is a story reveal, not an explorable cave.

## Chapter 1 — Arrival

**Time/place:** Day 1, village; barn, farm, square, Maryam's house, church, police post.
**Player:** Lorenzo. **Target duration:** 12 minutes. **Combat:** none.

### Motivation and tools

Lorenzo arrives to look for Sal's kidnapped father after Sal's family hired him. The chapter-plan objective is **show the father's photo to four people, film three testimonies, and find Maryam**. The photo handoff and location are not established; starting with the photo is a design choice. Photo and testimony goals are optional and do not gate story progress.

- Walk and explore; press E to talk or inspect places.
- Hold right mouse to record. Camera battery is limited. An interview is logged if the person stays in frame long enough.
- No weapon. Police keep the player away from the car or post until appropriate; there is no combat.

### Gameplay beats and objectives

**1. Start Day 1 as Lorenzo.** The current build starts him at the farm after Night 0. He does not witness or hear the Ravens' café activity before the attack; Omar's café activity is an earlier world event, not Lorenzo's scene. No source for a flashback or recording is established, so none is added. The father's-photo handoff and mission briefing are design details with unresolved source/location.

**2. Inspect the farm.** Objective: **Check the herd's route.** Search the barn and trough area; chains are intact and hoofprints lead northeast. Lorenzo can talk to the farmer after the prologue search. Do not use the farmer's `[ref]` line until its source is resolved; his proposed spec line may be used only as a draft.

**3. Ask the village about Sal's father.** Optional objective: **Show the photograph to four people and record three testimonies.** Press P while aiming at the farmer, his wife, priest, an officer, or a villager; the ledger counts four distinct role IDs. Recording counts three distinct NPC+line pairs, and different villagers may repeat the same general statement; this does not establish three different facts. Proposed dialogue remains `proposed`. Secondary roles keep descriptors and internal IDs; no `[ref]` line is guessed between the farmer and his wife.

**4. Find Maryam.** Objective: **Go to Maryam's house.** She starts in her house and yard. Her first answer does not reveal the secret of the night Joseph disappeared. Eight seconds of game time after the first question, and only when the player speaks to her again, she confirms she checked the house and he did not return. Only on hearing this does she open the gate and walk to the eastern edge of the square, where she can put up Joseph's poster during the chapter. She does not move to the square just because the day began.

**5. Omar at the post after discovery and transport.** Binding order: café and Ravens' activity → root attack/transformation → Omar escapes with amnesia → police find him near the mountain → cuffed transport to the post. Lorenzo is not assumed to witness discovery or transport. The current Day 1 slice seeds Omar at the post with earlier events already set; this is a slice shortcut, not the discovery/transport scene. In the full game, do not show him at the post until both events are recorded.

**6. Approach the post with clear boundaries.** Lorenzo can hear Moreno doubt Omar's amnesia, then speak to Omar. The guarded medical check begins; cuffs are removed only after it completes. Omar does not leave alone or meet Elia that day. Moreno's assignment must happen after Omar is found; Elia appears and starts her cover on Day 2. Current code also requires the medical check and Omar's line before Moreno's briefing; that extra gate is implementation, not locked canon.

### Completion and recovery

- After Omar's line and guarded check, current code plays Moreno's skepticism line and transitions to Day 2; it does not show the assignment. Day 2 starts with assignment event 6 pre-seeded. The medical-check prerequisite is a runtime choice, not a story rule.
- If the camera battery runs out, the story remains completable. A recharge point is unresolved, and there is no evidence that camera battery or film log persists across page-based chapter transitions.
- An officer redirects the player from the police car or post door while that area is closed. No penalty or fight; the player returns to the square.
- Discovery and transport are off-screen in the current build. Do not show an objective implying the player missed an event that did not play. In the full game, unlock the post state only after both story events.

**Build status:** NPC, camera, and optional evidence-ledger code is present. A browser probe verified the photo card, four distinct roles, and three distinct NPC+line pairs at 3/3 with duplicate suppression; different NPCs may have repeated the same line. See `studio/reports/ch1-testimony-proof.png` and the handoff log. Omar's sequence is in a pre-seeded slice; there is no explicit assignment beat, and the Day 2 route can currently skip Elia. The full ordered Day 1 run and discovery/transport scene are not verified or shown.

## Chapter 2 — The Ravens' Road

**Time/place:** Day 3; quarry track, Ravens' mine gate, depot and lower galleries, Hall and cave mouth.
**Player:** Lorenzo. **Target duration:** 15 minutes. **Combat:** none.

### Investigation begins

- After Omar is found, Moreno assigns Elia; this is a required story beat after the existing Day 1 sequence. In current code, Moreno's `moreno_said` line only questions Omar's memory, then Day 2 loads with assignment event 6 seeded and an objective card stating that he assigned her. There is no separate playable assignment moment. Do not describe the existing transition as that scene; no new dialogue is needed for the next beat.
- Day 2 should begin the cover task with Elia. Current objective points Lorenzo to her café balcony; after her missing-man-photo line, the intended order is return to Omar for his existing cover line, then transition to Chapter 2 on Day 3. Omar is uncuffed at the meeting. His temporary post placement in current code conflicts with the world plan placing him with Elia upstairs at the café; room geometry/height remains unresolved.
- Current code allows talking to Omar first and transitioning to Chapter 2 before hearing Elia's `elia_photos` line. This is a confirmed skip path. Proposed progression: require Elia's line before Omar's watcher line can complete, while keeping Elia available on return. Elia is not a companion and does not know what happened in the mountain.
- This remains a parallel story thread; Elia is not a companion and does not know what happened in the mountain.

### Next playable beat with no new canon decision

The existing Day 2 objective card already states that Moreno assigned Elia. Complete the playable order using existing interactions and lines only: **meet Elia on the balcony → hear `elia_photos` → return to Omar and hear `omar_watcher` → enter Chapter 2**. Gate Omar's transition on Elia's line. If Lorenzo reaches Omar first, keep the objective on Elia and do not consume Omar's line or advance the chapter; after Elia's line, leave the return interaction available. This closes the current skip path without adding a visible assignment scene, story fact, or dialogue. Any Arabic dialogue change remains a draft pending Noor's approval.

### Mountain exploration

1. Objective: **Follow the road east toward the quarry.** The current build has a walkable east road, but no established story clue yet explains why Lorenzo follows it to the mine. Tie the objective to a visible existing clue before treating his motivation as complete; add no confession, map, or key.
2. Objective: **Find the Ravens' mine entrance.** The gate is open and string lights are dead; the inspectable description says the cable runs inward. The camera light works only while recording and consumes the same battery. A fresh chapter load starts with a full battery, but film/battery do not persist across chapter page loads.
3. Learn the warning sign: a root creak and falling dust precede a lash by 0.6 seconds. Hide, retreat, or cross after the lash. Lorenzo has no weapon and cannot kill roots.
4. Objective: **Follow the wiring to the lower level.** Pass timber supports and a low crawlway by crouching; use camera light to locate the way forward.
5. In the depot, find a recorder with the established region line: «أغلقوا البوابة! الحيطان تتحرك!» Its speaker is unspecified; do not attribute it to Omar or another gang member.
6. Reach the Hall. Find Joseph and the preserved animals as described in the cave-region plan; do not disturb the preservation or explain the phenomenon.
7. Objective: **Film Joseph and the animals.** Record the scene from a safe position. Do not identify bodies by name or add dialogue/combat. The required shot gates chapter completion and the later campaign upload. The player can return to the Hall if it is missed; an empty battery before the shot permits a chapter restart with R.
8. After filming, the root crawlway begins closing behind Lorenzo. Objective: **Exit through the cave mouth.** Read the warning, crouch through, and follow the visible light of the mouth. He exits the cave; this ends Chapter 2, rather than deferring the Hall reveal.

### Exit and recovery

- Root-hit recovery and repeated attempts still need visual testing; do not promise a checkpoint or reset rule before verifying it. The current code requires Hall filming before the exit completion.
- No power puzzle is required in this chapter. Use wire, timber supports, crawlway and lash warning as clear direction cues; test wrong turns and return before calling it a complete navigation puzzle.
- The chapter ends after Lorenzo exits the cave mouth with footage of Joseph and the animals, evidence that the danger and disappearance continue. The script does not conclude the roots' origin or their connection to the scientist's material.

**Build status:** `?chapter=2` has a route in `src/chapterTwo.ts` and `src/villageMain.ts`. A bounded state probe reached the depot/recorder, Hall, and cave exit with filming missed before the new gate. The current code requires the Hall shot and carries a session flag into campaign Chapter 3; typecheck/build passed, but this changed route has not been replayed in-browser. Open-cut trench presentation and hazard timing remain under review.

## Chapter 3 — Signal

**Time/place:** Night of Day 3 until 05:10 Day 4; village, church, bell tower.
**Player:** Lorenzo. **Target duration:** 6 minutes. **Combat:** none.

### Playable sequence

1. Lorenzo returns to the village. A vigil is held in the church, with 14 candles in the windows. Do not add an unsupported reason for the vigil or introduce a new character.
2. Objective: **Climb the bell tower.** Lorenzo asks the priest for access and climbs four ladder flights to the top. The priest's warning about the fourth flight is proposed draft dialogue. A fall returns the player to an earlier landing, not a fatal drop.
3. The tower top is the valley's only signal point. Objective: **Upload the footage before the vehicles arrive.** The current route starts at 05:05 with a 300-second deadline to 05:10; hold Use for 20 seconds to upload. Do not specify a new phone service or cloud platform.
4. If upload is interrupted by releasing the button or leaving the landing, progress resets and upload remains available until 05:10. If the deadline passes first, the failure branch offers a chapter replay; it is not an approved story ending.
5. After successful upload, Lorenzo holds at the tower until 05:10 while the footage spreads. Four outside-agency vehicles and floodlights then appear on the valley road. Unnamed agents take the camera/material and detain Lorenzo in first person: his hands are tied and the camera is removed. There is no armed resistance.
6. End card: **Signal**. Transition out of scope; do not show what the agencies do with the footage or reveal Lorenzo's later fate.

**Build status:** code for the `?chapter=3` route, priest interaction, four-flight ladder, 20-second upload/deadline, vehicles and first-person detention is present in `src/chapterThree.ts` and `src/villageMain.ts`. `tests/e2e/chapter-three-route.spec.ts` passed in Chromium (1/1): it reaches the ladder top, uploads, confirms no early detention during the hold, advances to 05:10, then confirms detention/end card. Retry after interruption and natural climb time remain unverified.

## Episode systems and objective flow

- Every active objective names a concrete action and short story reason. Do not make `[ref]` dialogue an objective gate.
- Suggested save/event keys follow causes: `prologue_joseph_taken`, distinct ordered Omar events for café, attack/transformation, escape/amnesia, discovery, cuffed transport, and medical check; `day2_elia_assigned`, `elia_photos`, `omar_watcher`, `maryam_joseph_late_confirmed`, `lorenzo_filmed_joseph`, `footage_uploaded`, `lorenzo_detained`. These are proposed keys, not proof that the full event chain is implemented or canon terms.
- If an NPC is blocked or the player leaves, the event/interaction remains available in its designated area or on return. The story should not require replaying an unseen conversation.
- Joseph and Lorenzo get no weapons. Recording does not kill roots or free Joseph. Light is for seeing; Sal discovers electricity in Chapter 5.
- An evidence log collects the father's photo, village testimonies, herd traces, Ravens' recorder, and footage of Joseph and the animals. Record source/date; do not make the player voice unsupported conclusions.
- Optional exploration and extra testimony improve the evidence file, but deterministic canon events remain completable and do not create unsupported endings.

## Current build coverage

| Part | Current code/reports | Needed for complete episode |
|---|---|---|
| P | **Code present; continuous route verified:** Chromium walks Joseph from the barn alongside the cow, through the barn door and wall gap, then verifies the roots attack, Hall entrance, and ending title (`tests/e2e/prologue-route.spec.ts`). | **Open:** visual review, authored fixed checkpoints, and persistent save are not verified. The Prologue Hall has no Ravens transformation reveal. |
| Ch1 | **Code present; bounded runtime proof:** NPC conversations, film log/evidence ledger, Maryam's wait/move, Omar's guarded check/cuff removal, and a Day 2 slice; the farmer → Maryam/wait/confirmation objective trail and Maryam's actual walk to the square endpoint are tested (`tests/e2e/chapter-one-objectives.spec.ts`). | **Open:** Chapter 1 test positions Lorenzo with the test hook; natural full route and bounds remain unverified. Omar's mountain discovery/transport scene is absent; the assignment remains a Day 2 card, not a playable briefing. |
| Ch2 | **Code present; earlier bounded runtime proof:** quarry connector, mine gate/tunnels, crawlway, root hazard, recorder, Hall and cave exit. An older probe exited with footage missed; the current code now requires filming and carries the shot to campaign Ch3. | **Open:** replay the changed route, full visual review and root-hazard timing. |
| Ch3 | **E2E route verified:** Chromium test walks to priest and ladder, uploads 20 seconds, verifies no early detention, advances to 05:10, then checks detention/end card (`tests/e2e/chapter-three-route.spec.ts`, 1/1). | **Open:** upload retry after interruption, measured natural climb time, and full visual review. |

**Build/runtime evidence:** newest handoff (2026-10-20) reports `npm run typecheck`, `npm run build` and `git diff --check` passed (83 modules; existing 641 kB materials-chunk warning). It also reports bounded browser/state probes for Prologue recovery, four photo roles, three distinct Ch1 testimony recordings (3/3) with duplicate suppression, Ch2 depot-to-exit progress, and Ch3 upload-to-seizure/end-card. These probes cover specific transitions, not a full-episode visual playthrough. Code presence, bounded runtime proof, and full verification are separate states. This is not narrative approval.

## Fixed decisions reflected here

- Joseph, Omar and Elia follow the owner's event order. They are separate story threads with ordered save events, not interchangeable arrival scenes.
- Omar appears at the post only after discovery near the mountain; cuffs are removed during a guarded medical check.
- Elia appears Day 2 only after assignment; the cover starts after assignment. Omar is uncuffed at meetings.
- Maryam goes to the square only after Joseph is late and she confirms he did not return.
- The farmer appears searching in the prologue and may be spoken to later. The search is not replayed alongside Lorenzo.
- Farmer, farmer's wife, villagers, officers, and priest remain unnamed.
- Proposed dialogue remains draft. Farmer/wife reference-line attribution remains unresolved.

## Review findings and status

- **Layla — scriptwriting:** drafted the initial Episode One gameplay treatment; proposed dialogue remains draft.
- **Imad — narrative/gameplay review:** found that Chapter 2 skipped the Hall, Lorenzo's opening was mixed with Omar's Night 0 café events, cuff/transport staging was inconsistent, and some claims exceeded the current build.
- **Canon cross-check:** the treatment follows the cited owner decisions and world plan: Omar is at the café on Night 0 before the attack; Lorenzo starts on Day 1 afterward and cannot witness the past without an established source; Omar is cuffed for first transport and uncuffed during a guarded medical check; Elia follows Moreno's assignment on Day 2; Chapter 2 reaches the Hall, films Joseph and the animals, then exits through the cave mouth. This is not a claim that Noor reviewed or approved this revision.
- **Imad review:** previously flagged Chapter 2 Hall sequencing, Lorenzo's opening being mixed with Omar's Night 0 events, cuff/transport staging, and overclaims about build coverage; those are corrected or explicitly labeled. Latest runtime audit found the Day 2 assignment is seeded and stated on the objective card, but has no separate playable moment; Omar's watcher interaction can also skip Elia's photo line. This treatment distinguishes the card from a scene and proposes the existing-line progression gate; runtime is unchanged.
- **Authoring gaps:** choose the established on-screen clue that leads Lorenzo from the village to the quarry road; decide whether to stage Omar's discovery/transport visibly while retaining the locked chronology; implement the existing-line gate so Elia's photo line precedes Omar's cover line; resolve Omar's post/café placement and room geometry. Day 2 already seeds and states Moreno's assignment on the objective card, but has no separate playable assignment moment; any added scene/dialogue is optional proposed authoring and not needed for the next sequencing fix. Do not add a Night 0 flashback/recording without an established source. `[ref]` speakers, `proposed` dialogue, and unresolved building elevations remain open under the existing decisions.
- **Build status:** the treatment is design, not proof of episode completion. Current code contains routes for P and Chapters 1–3, with bounded runtime proof for Prologue recovery, photo display/counting, three distinct Chapter 1 testimony recordings at 3/3 with duplicate suppression, Ch2 depot-to-exit progress, and Ch3 priest-to-seizure/end-card. Omar's find/transport scene is absent, and no full-episode visual playthrough is evidenced. Do not label the episode complete from build success or bounded probes alone.

## Open approvals and implementation gates

1. Noor reviews/approves every proposed Arabic line before any dialogue is treated as recording-ready and resolves original `[ref]` speakers after source references are available.
2. Decide which existing scene clue leads Lorenzo from the village to the quarry road; no specific story source is established yet.
3. Decide whether to build a visible arrival/transport from the mountain or keep the police discovery/transport off-screen before Omar appears at the post.
4. Choose a camera recharge point if battery remains limited in Chapters 1–3; do not add a station absent from the village layout.
5. Measure the tower climb and adjust the six-minute chapter before fixing the 05:10 timer.
6. Agree save-key and UI objective names with Subzero before implementation.
7. Verify licenses before adding researched environment/assets; assets do not alter canon or grant new player abilities.
