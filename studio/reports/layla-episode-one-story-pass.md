# Layla + Imad — Episode One story pass

**Status:** Script design proposal, 2026-10-21. No canon change or Noor dialogue approval. Scope: Prologue and Chapters 1–3 only. Sources: `studio/script/episode-one-gameplay.md`, `studio/reviews/imad-episode-one.md`, `studio/reviews/imad-quarry-clue.md`, `studio/world/story-canon-ar.md`, `studio/world/chapter-plan.md`, `studio/world/regions/village.md`, and `studio/npc/README.md`.

## Gaps that affect the player's story

| Priority | Gap | Evidence and bounded repair |
| --- | --- | --- |
| 1 | Moreno's assignment to Elia is silently seeded at the Day 2 load. | The current Day 1 line expresses doubt about Omar's memory; it does not assign the mission. Add a short first-person, overheard assignment beat after Omar's mountain discovery and before Elia's Day 2 entrance. Moreno, Elia, and Lorenzo must occupy plausible positions; Lorenzo must have a reason to hear it. If that staging cannot be supported, keep it off-screen and describe the assignment as a known event, not as a witnessed scene. |
| Resolved in current code | An older review said Omar could send the player to Chapter 2 before Elia's Day 2 line. | `src/npcData.ts` now requires `elia_cover_introduced` for `omar_watcher`; `src/villageMain.ts` sets that flag only on `elia_photos`. Preserve Elia → Omar → Chapter 2. A continuous natural playthrough remains useful evidence, but this is no longer an open source-level gap. |
| 1 | Lorenzo has no approved clue that motivates the quarry investigation. | Chapter 2 may use already-authored environmental landmarks for orientation, but none is an approved *reason* to investigate the quarry. Leave the clue source open for owner/Noor. The owner subsequently approved a southbound quarry route; the older `imad-quarry-clue.md` question about east versus south is historical, while the motivation gap remains. Do not author a map, confession, key, new witness claim, or directional line here. |
| 2 | Omar's café, attack, escape, finding, and transport are event flags rather than witnessed scenes. | State this honestly in chapter cards and script. Lorenzo cannot narrate events he did not see. A future first-person Omar scene would change the POV structure and needs separate approval; this pass proposes none. |
| 2 | The transition from Maryam's house to the square can read as automatic. | Keep her at home/yard until she confirms Joseph is late and has not returned; then let her leave. Her second conversation and walk require a recoverable interaction if Lorenzo leaves and returns. |
| 2 | The Prologue farmer search is asserted, but the full staging and Lorenzo's later conversation have not been visually verified together. | Establish the search through action and blocking, without assigning either disputed `[ref]` line. Let the later Day 1 conversation be available only after the Prologue event. |
| 3 | The camera upload climax has timing proof but limited felt escalation. | Keep the 20-second upload, its spread, then the 05:10 arrival and first-person seizure. Use sound, bell tower view, and existing agency vehicles to make the wait legible. Do not introduce named agents or a new platform for the upload. |

## Proposed next script beats (Arabic first)

These are scene directions, not approved dialogue or proof of implementation.

1. **P — الفلاح يبحث، جوزيف يتبع.** يبدأ الفلاح البحث عن قطيعه عند الحظيرة. يراه جوزيف يتفقد المكان، ثم يتجه جوزيف خلف البقرة نحو الجبل. وظيفة المشهد أن يظهر فقدان الحيوانات قبل محادثة لورينزو مع الفلاح، من دون شرح الجذور أو كشف مصير الغربان.
2. **1 — لورينزو يصل بسبب والد سال.** يُعرّف هدف الصورة/التصوير على أنه بحثه عن الرجل المخطوف. يتفقد آثار الحظيرة ويسأل أصحاب الأدوار المحددة؛ شهاداتهم اختيارية. لا يعيد اللاعب تمثيل اختفاء جوزيف من منظور لورينزو.
3. **1 — مريم تتحقق ثم تخرج.** السؤال الأول يبقيها في البيت أو ساحته. بعد التأخر والتأكد وعدم رجوع جوزيف، تسمع منها عبارة التأكيد الموجودة بوصفها `proposed` ثم يفتح مسارها إلى الساحة. لا تكشف سر ليلة الاختفاء.
4. **1 — عمر في المركز نتيجة أحداث سابقة.** لا يظهر عمر هناك قبل العثور عليه قرب الجبل ونقله مكبلاً. خلال الفحص الطبي المحروس تفك الأصفاد؛ عند اللقاء اللاحق مع إيليا يبقى غير مكبل. شك مورينو في فقد الذاكرة منفصل عن تكليف إيليا.
5. **وصلة اليوم الثاني — التكليف ثم الغطاء.** يقع تكليف مورينو بعد العثور على عمر وقبل ظهور إيليا. إذا أُخرج مشهد منظور أول يسمعه لورينزو، تُكتب تفاصيله بعد تثبيت الموضع والسبب؛ وإلا تذكر بطاقة اليوم الثاني التكليف من دون ادعاء أنه عُرض. تقابل إيليا لورينزو أولاً بسطر الصورة الموجود، ثم يستطيع عمر التعبير عن شكه بالغطاء. الكود الحالي يفرض ترتيب السطرين؛ حافظ عليه.
6. **2 — التحقيق نحو الجبل.** يتبع لورينزو دليلاً يوافق عليه المالك/Noor لاحقاً إلى مسار المحجر، ثم يقرأ الممرات ويبلغ القاعة ويصور جوزيف والحيوانات ويخرج من فم الكهف. لا يخمّن هذه المسودة الدليل أو يغيّر مسار المحجر المعتمد جنوباً.
7. **3 — التسجيل والعاقبة.** يصل إلى أعلى البرج، يرفع التسجيل، يرى/يسمع أن المادة انتشرت، ثم تصل الجهات الخارجية في موعدها؛ تقع مصادرة الكاميرا واحتجازه في منظوره الشخصي.

## Dialogue policy and draft line slots

- جميع أسطر الحوار الجديدة أدناه **`proposed`** للاختبار فقط، ولا تصلح للتسجيل الصوتي حتى تراجع Noor النص العربي النهائي.
- **موضع تكليف مورينو — `proposed`, غير مكتوب بعد:** يحتاج أولاً قراراً إخراجياً بشأن سماع لورينزو للتكليف. لا نضع نصاً يوهم بمعرفة لورينزو السرية من دون سبب.
- **إيليا/عمر يوم 2:** استخدم السطرين الموجودين `elia_photos` ثم `omar_watcher` كمسودتين، من دون صياغة جديدة أو تغيير المعنى. ولا يبدأ غطاء الحبيبة قبل التكليف.
- **الفلاح/زوجته:** لا تنسب أي سطر `[ref]` إلى أحدهما قبل فحص مرجع `characters.md` ومصادره. تبقى الشخصيات الثانوية بأوصافها ومعرفاتها الداخلية: الفلاح، زوجته، القسيس، الشرطي الأول والثاني، والقرويون.

## Decision and implementation handoff

**Owner/Noor:** approve a specific in-world clue that motivates the quarry investigation; review/approve final Arabic dialogue; decide whether Moreno's assignment should be heard by Lorenzo or remain off-screen. The southbound route itself is already approved and is not reopened here.

**Rajaie/Zurub:** preserve the implemented Day 2 Elia → Omar gate and the locked event order; add a legible assignment beat only after staging approval; distinguish unseen Omar backstory from playable events. When scene geometry is available, set café and school floor heights from it; zero remains a test value.

**QA:** prove the Prologue farmer search precedes Lorenzo's conversation, Maryam reaches the square only after confirmation, Omar is cuffed only through transport/guarded check, Elia is absent before Day 2 and assignment, and Chapter 2 cannot start from Omar's line before Elia's. This report itself provides no new playthrough evidence.
