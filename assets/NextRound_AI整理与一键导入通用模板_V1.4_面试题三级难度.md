# NextRound｜AI 整理与统一导入模板（通用版 V1.4：面试题三级难度）

> **用途：** 任何求职者均可将本文件连同自己的岗位材料、知识笔记、真实面试记录、自我／项目介绍、训练安排交给 AI，请 AI 输出一份结构化 JSON，随后通过 NextRound 的统一导入入口导入。**这是数据整理与格式范本，不含真人履历和真实招聘信息。** 其中内容卡片特指可复用、可插入的具体答案段落，不承担训练规划、规则说明、知识清单的归档功能。
>
> **版本说明：** V1.4 沿用 V1.3 的内容卡语义与精简标签规则，新增面试题独立难度枚举「天堂／人间／地狱」及前端映射要求。**JSON 导入协议标识暂保留 `next-round-unified-1.2`**，但这不意味着当前前端已经支持新难度选项；需要同步修改字段校验与 UI。
>
> **实现边界：** 本模板的 `companies` / `jobs` 沿用 NextRound 岗位数据库 V4 字段；`questions` / `introductions` / `cards` / `schedules` / `interviews` 是本次约定的统一扩展格式。它们只有在网站导入器、字段映射与数据存储正式实现后，才能确保被一键导入。不能仅凭下载模板推定当前网站已支持这些功能。

## 第一部分：给 AI 的指令（可直接使用）

请阅读本文件，并将我随附的资料转换为 **一份可供 NextRound 使用的合法 JSON 数据文件**。

### 1. 输入与输出

- 我可能一次只提供某类资料，例如招聘截图、职位 JD、面试题目、已定稿自我介绍、项目材料或训练日程、面试通知、已发生的面试记录和面试后复盘。**只处理我确实提供的数据类型**，其他数组保留 `[]`，不用虚构内容凑齐全部模块。
- 仅输出 **一个完整 JSON 对象**。如可以生成文件，请直接给出 UTF-8 编码的 `.json` 文件；如只能输出文本，输出纯 JSON，不带 Markdown 代码围栏、额外解释或注释。
- 保持下文演示的固定字段名称。顶层使用扁平结构：`companies`、`jobs`、`questions`、`introductions`、`cards`、`schedules`、`interviews`，**不要擅自包进 `data` 或改名为其他字段**。
- 保留 `version: "4.0.1"` 及 `import_schema_version: "next-round-unified-1.2"`，直到网站发布新的正式兼容版本。
- 不要复制示例中的虚构公司、示例职称、例题、日期或分数。根据我的实际材料重新生成。

### 2. 真实性与内容保真

- **完整 JD：** `jobs[].jd_full_text` 保存原文全部可识别内容，包括职责、硬性要求、优先条件、薪资福利和作息；保留段落换行。摘要写在 `jd_summary`，不可覆盖正文。
- **缺失处理：** 若只有标题或职位卡片，则 `jd_full_text` 填已提供的原文片段或空字符串，`jd_fidelity` 如实写明「仅卡片」或「仅片段」。不得编造、拼接其他相似岗位。
- **硬性与优先分离：** `jd_summary.hard_requirements` 只放明确的必要条件；`preferred_conditions` 只放材料中明示的“优先、加分”。难以确定的条件不要强行归类，可保留在正文。
- **公司资料：** 使用材料中可核实的公司全称、行业、人数、融资与官网；缺失写 `null` / `[]` / 空字符串，不要编造公司口碑、融资或员工评价。
- **知识库：** 现成答案、介绍稿和内容卡原文应保持原样；没有答案就填空字符串。只可在独立的标题、摘要、分类或标签字段中作适度归纳。尤其不要改写用户标明“定稿”的介绍。
- **内容卡真实性：** 仅从资料中真实存在的、已经写出的**具体回答、案例说明、个人经历表述、已确认可复用的话术**生成卡片。允许按完整论点将定稿原文拆成可独立复用的小段，但必须保留原文字句与事实边界；不可在拆分中把「假设方案」「待验证数字」「可能回答」变为已完成业绩。若来源是未经用户确认的 AI 答案草稿，除非用户明确要求制作草稿卡，否则不作为定稿卡导入。
- **非卡片内容：** 训练排期写入 `schedules`；练习题写入 `questions`；完整介绍写入 `introductions`；课程纲要、流程规则、能力清单、核验标准、术语目录、空白记录模板等不得为了填充卡片数量而写入 `cards`。缺少现成回答时 `cards: []`。
- **日程：** 只有提供了明确日期才创建日程；缺少钟点时使用 `all_day: true`，不要擅自安排一个时间。明确有时间的事项使用带时区偏移的 ISO 8601 日期时间。面试、会议等未获确认的安排不可标记为已确认。
- **面试档案仅供面试后复盘：** 只有面试**实际进行并已结束**，且提供真实面试问题、本人复盘、面试纪要或招聘方真实反馈等后续记录，才可以创建 `interviews[]`。已预约、待面试、面试邀请、未确定时间、取消或缺席的面试均不得写入 `interviews`；这些信息应放在 `jobs` 流程状态或已明确安排的 `schedules` 中。
- **不得以预约替代面试复盘：** JD、模拟面试题、预测问题、准备笔记本身不能作为面试档案的生成依据。已经完成的面试可以附带历史准备资料作为上下文，但必须与真实问答、个人复盘和企业反馈区分；未提供真实面试后材料时 `interviews` 保持 `[]`。
- **来源：** 不编造链接或文件名；能引用的来源保留在 `source`，无法定位时用文字说明「用户提供的文本」或「用户提供的截图」。

### 3. 公司、岗位和评分

- 复用公司：每家公司一个 `companies[].id`，所有关联岗位的 `company_id` 必须存在于公司列表。
- **不同职级单独记录：** 同一个招聘入口同时招聘经理、助理等不同职级时，拆成两条 `jobs`，但使用同一个 `posting_group_id`。不同入口不能误合并。
- 跨平台同公司同岗位的重复信息，只有充分证明为同一招聘机会时才能合并；不确定时保留独立记录。
- `counts.active_conversations` 为去重后有效 `posting_group_id` 数量；`active_roles` 为 `jobs` 数量；`distinct_companies` 为 `companies` 数量。
- 岗位 `recommendation.score` 与公司 `score` 是**用户适配评估**，不是平台口碑分、招聘成功率或官方推荐度。如无用户择业标准与经历，只填演示用的 `3.0`，并明确 `score_type` / `recommendation.type` 为“待个人评估／占位”，不得编造个性化推荐理由。
- `upskilling` 只能根据真实 JD 概括适合准备的知识与能力；缺少用户个人履历时，不能断言用户一定缺少某项能力。
- `status` 只能为「未沟通」「已沟通」「简历已投递」「约面试」「面试完成」「Offer」「不通过」。未提供行动记录时默认「未沟通」，不得因为查看过职位就写成已沟通。

### 4. 四色标准标签

- 标签颜色仅支持 `green`（正向）、`red`（负向）、`yellow`（需要注意）、`blue`（普通事实）。
- 公司与岗位标签统一使用 `{ "id": "...", "name": "...", "color": "...", "detail": "可选" }`，同义表述统一为相同 `id`，同一记录同一 `id` 只出现一次。
- 默认使用 `tag_catalog` 中稳定 ID，例如「周末双休／双休」归为 `weekend_off`；13薪和14薪归为 `extra_months`，将具体数值写进 `detail`。
- 招聘材料没写双休，不能自行添加双休；没写加班，不能推断加班；薪资高也不自动生成绿色标签。
- 对于没有覆盖的新行业／职位类型，可增加中性的蓝色标签，但应使用通用且稳定的名称，避免每个岗位生成一次性标签。用户可在前端将单条标签颜色手动改成四色之一。
- **“未沟通”是岗位流程状态，不是职位属性标签**，不得混入 `tag_catalog`。
- 不预设某个行业、语言、工作形式对所有人都是正面或负面；必要时先标黄色等待用户自己修改颜色。

### 5. 知识库三个类型与内容卡的插入语义

- **面试题库 `questions`：** 每题独立条目；`question` 保存题目、`answer` 保存用户已有答案，允许空答案；未曾作答的训练题不要预填「标准答案」假装为本人答案。`related_job_ids` 指向已有 `jobs[].id`，未提供关联则 `[]`。
- **独立难度字段 `questions[].difficulty`：** 必填字符串，**只允许 `"天堂"`、`"人间"`、`"地狱"` 三个值**。该值是题目独立的难度选项，**禁止写入 `tags` 或另造难度标签**。不要使用「易／中／难」「低／中／高」、数字、英语同义词或其他取值。
  - **天堂**：基本事实回顾、个人介绍、定义阐述与直接经验陈述，通常无需多步骤推演。
  - **人间**：结合项目案例说明过程、权衡、优先级、执行方案和可验证的常规依据。
  - **地狱**：架构与系统边界推导、复杂业务或技术设计、异常应对、反事实推演、追责质疑、数据真实性挑战，通常需要多重约束与深度论证。
  - **判定依据**：优先根据题目的信息量、回答任务及证据要求分级；此为题目的预估挑战程度，**不代表用户能力分数或是否已经作答**。已有明确分级应原样保留；新增题目由 AI 初步分级，用户可在前端手动调整；上下文不足时可暂定「人间」，不得声称已经人工确认。仅迁移旧数据时，「易→天堂／中→人间／难→地狱」可以作为**建议映射**，应在预览或用户确认后应用，不能默默覆盖历史标记。
- **自我／项目介绍 `introductions`：** `kind` 为 `self` 或 `project`；短版、长版和其他版本放入 `versions`，逐字保存 `content`，不得合并覆盖；用户标为定稿的原版不能静默改写。
- **内容卡片 `cards`：** 是**答案片段库/可插入素材库**。一张卡保存一个相对完整、可以直接复用的**具体回答段落或项目证据表述**，可由用户自由嵌入 `questions[].answer` 和 `introductions[].versions[].content`；`body` 保存全文，`title` 概括可回答的问题，`category` 使用少量稳定大类。注意「可插入」描述的是内容用途，并不代表导入 JSON 后网站已经实现按钮或自动插入。
- **提取优先级：** 优先从用户已确认的自我介绍、项目介绍、真实面试回答和答案笔记中抽取；必要时一段形成一张卡，同一段不拆成大量句子碎片。可为了独立阅读在标题上补足上下文；正文如属于冻结定稿，直接摘取原文，不添写新结论。若只有训练计划、题目目录和待补知识点，则 `cards` 必须为空。
- **不要混装：** 「M1–M6 训练方法」「术语清单」「某项目的追问维度」「学习进度」「事实核验待办」等是管理资料，不属于已完成的具体答案。知识点只有在资料里已经给出可复用的完整解释/回答时才考虑制卡，且须符合用户的使用场景。
- **卡片标签精简规则：** `cards[].tags` 是简短的**字符串数组**，不要套用公司/职位四色标签对象。对同一份材料先建立一套稳定小词表，优先用已有主题/项目名归类；小型导入包通常控制在约 **5–8 个统一标签**，每张卡原则上 **1 个主标签**、确需交叉检索才给第 2 个。避免同时出现「AI产品」「AI 产品」「产品经验」等同义标签，也避免「已回答」「卡片」「面试」「可插入」「待核验」等无检索价值的批量标签。`category` 已表达的信息不要重复加成标签。
- **插入和同步：** 导入时不要因为某张卡涉及某题，就自动改写题目答案或介绍定稿；实际插入由用户在界面中明确操作，保存后的内容可独立编辑。若网站要支持「插入到光标处／追加到回答」，须由前端实现，模板数据格式本身不提供该交互或同步机制。

### 6. 日程 `schedules`

- `kind` 建议为 `training`（训练）、`interview`（面试）、`task`（任务）、`other`（其他）。
- 有时刻的事件使用 `start_at`、`end_at`，格式如 `2026-11-12T14:00:00+08:00`；同时设置符合实际所在地的 IANA `timezone`，例如 `Asia/Shanghai`。`end_at` 必须晚于 `start_at`。
- 全天事项设置 `all_day: true`，示例使用当天 00:00 开始、次日 00:00 结束（结束为排除边界）。
- 未提供结束时间时，**不要擅自推断时长**；可将 `end_at` 设 `null` 并交由前端提示用户补充，不要自动生成“可导入且时间无误”的结论。
- 没有重复规则时 `repeat` 为 `null`；如果用户明确要求重复，保留规则信息，按网站导入器实际支持的周期格式输出，不能擅自扩展为多个虚假日程。
- `related_question_ids`、`related_introduction_ids`、`related_job_ids` 可用于关联知识库与岗位。优先引用本次 JSON 的 ID；如果指向用户本地已有记录，需要导入器能解析并在预览中显示，否则保留待手动关联，不能虚构对应记录。没关联就用空数组。
- 同名同日同时间事项应检测重复，避免多次导入造成成倍记录。

### 7. 面试档案 `interviews`（仅面试结束后复盘）

- **准入规则：** 只收已经真实发生并结束的面试。招聘聊天、面试邀约、已约时间、待面试、未安排时间、已取消、未参加、仅有预测问题或仅有准备材料，均**禁止导入**面试档案。面试安排应放在 `schedules`；岗位进度应记录在 `jobs[].status`。
- **有效记录的最低条件：** 面试已结束，且提供至少一类面试后资料：真实提问/回答、面试纪要 `raw_notes`、本人复盘 `self_review`、可验证的招聘方反馈 `employer_feedback`。仅有日期、公司和岗位，或仅有 `preparation`，不满足导入条件。AI 不能替用户编写面试事实来凑条件。
- 一场**已完成**的实际面试为一条 `interviews[]` 记录；同一岗位不同轮次分别存档，使用不同 `id` 并共享 `job_id`。未进行的轮次不建立档案。
- `id` 稳定且唯一；`company_id`、`job_id` 可为 `null`，关联到本次文件时必须存在对应 ID。只导入已完成面试时，可用 `company_name`、`job_title` 供前端与现有岗位匹配，不得凭空创建公司或岗位。
- `round` 为实际轮次，不知道可填空字符串。外部导入的 `interviews[].status` **仅允许 `已完成`**，不接受 `待面试`、`已取消` 等值；它与岗位流程 `jobs[].status` 独立，导入时不得自动修改岗位状态。
- `interview_date` 为真实日期 `YYYY-MM-DD`，不确定时允许 `null`，但必须由真实的面试后记录确认这场面试已经结束；若提供的面试日期尚在未来，则不得标记为已完成档案。知道日期但不知钟点时，保留日期、`start_at`/`end_at` 为 `null`；不猜测时长，也不把日期空缺视为待面试。
- `format` 可保存电话、视频、现场等已知形式，不清楚填空字符串。`schedule_id` 可以为 `null`，只在确认为同一事件时关联既有日程；不能自动新建日程。
- `questions_asked` 只能放当场真实问题与原始回答，缺失时填 `[]`；不能从模拟题库、职位要求推测生成。`self_review` 保存面试后真实复盘，`employer_feedback` 只保存有来源的企业反馈，空缺不得臆造。
- `preparation` 在**已经完成的面试**中仅为可选的历史参考材料（如当时准备的内容）；不能因此创建面试档案。AI 推测题只允许留在历史准备字段，不能混入实际问题。`next_steps` 保存面试后实际后续行动。
- `raw_notes` 保留用户原始面试纪要与长文本，不能因拆字段删除原话；`source` 记录真实输入来源。
- 重复导入优先比较稳定 `id`，其次提示公司、岗位、实际轮次、日期与内容可能重复；不确定时交用户选择，更新不得静默覆盖原始复盘或企业反馈。
- **拒绝与纠错：** 如果文件包含 `interviews[].status != "已完成"`，或只有面试前资料，导入器必须标记该条无效，阻止写入并说明原因；不得把 `待面试` 偷偷改为 `已完成`，也不得静默移动、删除用户提供的数据。用户可在预览中取消该无效条目并继续导入其他有效模块。

### 8. 输出前必须自行检查

1. JSON 可用标准 JSON 解析器解析；不含注释、尾逗号、`undefined`、`NaN`。
2. `companies`、`jobs`、`questions`、`introductions`、`cards`、`schedules`、`interviews` 七个数组都存在，可为空。
3. 所有 ID 在各自集合中唯一，外键都可定位，计数与实际条目一致。
4. 职位的状态属于固定七项，标签颜色只属于四色；所有 `questions[].difficulty` 均为「天堂／人间／地狱」之一，且 `questions[].tags` 不包含难度选项或其同义词。
5. JD 原文和用户定稿文案完整，所有缺失内容明确标注；`cards[].body` 逐条检查是否为**具体可插入的回答正文**，不得以训练规则、目录、清单或未完成的计划冒充。
6. 仅有职位材料时，知识库与日程数组必须为空；仅有日程材料时，职位与公司数组必须为空。
7. 日期、时区、起止顺序正确；不能解析的时间不得伪装成合法时间。
8. 每条 `interviews` 均确认已实际结束，`status` 必须为 `已完成`，且至少包含一项真实的面试后记录；待面试、已取消及仅含准备内容的条目必须留在 `interviews` 之外。
9. 未经允许，不自动覆盖用户现存记录，也不在用户未要求时删除原有内容；卡片的存在不得自动覆盖 `questions` 或 `introductions` 的已有正文。
10. 统计 `cards[].tags` 的去重结果，合并同义词，优先每卡一个主标签；若标签过多，说明其检索价值并进一步精简。

## 第二部分：完整 JSON 范例（全部虚构）

此范例用于让 AI **学习结构**，并供开发者制作导入测试。示例中的公司、岗位、知识题、介绍稿、日程和已完成面试复盘全部虚构，禁止当成真实数据直接使用。面试档案只保留已结束且有复盘资料的记录。

```json
{
  "version": "4.0.1",
  "import_schema_version": "next-round-unified-1.2",
  "created_at": "2026-10-24",
  "timezone": "Asia/Shanghai",
  "description": "仅供格式演示：全部公司、岗位、知识、日程及面试档案均为虚构。请完全替换为使用者资料。",
  "counts": {
    "active_conversations": 1,
    "active_roles": 2,
    "distinct_companies": 1
  },
  "statuses": [
    "未沟通",
    "已沟通",
    "简历已投递",
    "约面试",
    "面试完成",
    "Offer",
    "不通过"
  ],
  "tag_colors": {
    "green": {
      "name": "绿色",
      "hex": "#268765",
      "meaning": "有原文依据的正面条件"
    },
    "red": {
      "name": "红色",
      "hex": "#CB4553",
      "meaning": "有原文依据的负面条件"
    },
    "yellow": {
      "name": "黄色",
      "hex": "#C28A24",
      "meaning": "需要关注或视个人偏好权衡的条件"
    },
    "blue": {
      "name": "蓝色",
      "hex": "#3476B8",
      "meaning": "行业、类别和技术等一般事实"
    }
  },
  "note": "虚构数据演示；未提供使用者标准时，3.0/5 是UI占位值，不代表真实公司或岗位评价。",
  "companies": [
    {
      "id": "demo-company-001",
      "key": "示例企业甲（虚构）",
      "full_name": "示例企业甲有限公司（虚构）",
      "industry": "企业软件服务（示例）",
      "size": "100–499人（示例）",
      "financing_display": null,
      "description": "虚构的企业软件服务公司。此条用于演示公司字段，非真实企业资料。",
      "tags": [
        {
          "id": "enterprise_services",
          "name": "企业服务",
          "color": "blue"
        }
      ],
      "tag_names": [
        "企业服务"
      ],
      "score": 3.0,
      "reason": "演示占位分。尚无使用者的求职偏好或客观企业评估材料。",
      "urls": [],
      "score_type": "演示占位评分，非真实企业评价",
      "score_basis": "使用者未提供匹配标准，仅展示字段；不得作为推荐结论。"
    }
  ],
  "jobs": [
    {
      "id": "demo-job-001",
      "company_id": "demo-company-001",
      "company": "示例企业甲（虚构）",
      "role": "产品运营专员（虚构演示）",
      "platform": "虚构示例",
      "posting_group_id": "demo-posting-001",
      "city": "示例城市",
      "location": "示例城市·示例区域",
      "salary": "9–13K",
      "experience": "1–3年",
      "education": "本科",
      "applied_date": null,
      "status": "约面试",
      "status_options": [
        "未沟通",
        "已沟通",
        "简历已投递",
        "约面试",
        "面试完成",
        "Offer",
        "不通过"
      ],
      "jd_summary": {
        "core": "面向企业软件的用户反馈、运营方案与产品协同。",
        "hard_requirements": [
          "本科及以上学历",
          "一年以上产品运营或用户运营经验",
          "基础数据整理与跨部门沟通"
        ],
        "preferred_conditions": [
          "企业软件相关经验"
        ]
      },
      "jd_full_text": "职位名称：产品运营专员（虚构演示）\n【工作职责】\n1. 维护企业软件的帮助文档与操作指南。\n2. 整理用户反馈，协助产品团队评估需求。\n3. 跟踪功能使用情况并提出改进建议。\n【任职要求】\n1. 本科及以上学历。\n2. 具有一年以上产品运营或用户运营经验。\n3. 能整理基础业务数据并进行跨部门沟通。\n【加分项】\n有企业软件相关经验者优先。\n【工作条件】\n双休、五险一金。",
      "jd_fidelity": "虚构演示完整文本；并非真实招聘信息",
      "source": {
        "type": "fictional_demo",
        "image_file": null,
        "pdf_page": null,
        "description": "仅用于说明数据结构的虚构案例",
        "url": null
      },
      "tags": [
        {
          "id": "product_operations",
          "name": "产品运营",
          "color": "blue"
        },
        {
          "id": "weekend_off",
          "name": "双休",
          "color": "green"
        },
        {
          "id": "benefits",
          "name": "五险一金",
          "color": "green"
        }
      ],
      "tag_names": [
        "产品运营",
        "双休",
        "五险一金"
      ],
      "tag_color_override_allowed": true,
      "recommendation": {
        "score": 3.0,
        "max": 5,
        "type": "演示占位评分，尚未结合使用者经历",
        "comment": "仅供展示。需由使用者提供职业目标和履历后再评估。"
      },
      "upskilling": [
        "根据实际履历与完整JD核对能力差距，未给履历时不作个人能力断言"
      ],
      "status_notes": "虚构演示流程状态，用于展示面试档案关联；并非真实招聘或沟通记录。"
    },
    {
      "id": "demo-job-002",
      "company_id": "demo-company-001",
      "company": "示例企业甲（虚构）",
      "role": "高级产品运营（虚构演示）",
      "platform": "虚构示例",
      "posting_group_id": "demo-posting-001",
      "city": "示例城市",
      "location": "示例城市·示例区域",
      "salary": "16–23K·13薪",
      "experience": "3–5年",
      "education": "本科",
      "applied_date": null,
      "status": "面试完成",
      "status_options": [
        "未沟通",
        "已沟通",
        "简历已投递",
        "约面试",
        "面试完成",
        "Offer",
        "不通过"
      ],
      "jd_summary": {
        "core": "承担产品运营计划、指标分析、跨团队交付与版本运营。",
        "hard_requirements": [
          "本科及以上学历",
          "三年以上相关经验",
          "独立推动运营方案落地"
        ],
        "preferred_conditions": [
          "企业服务产品经验"
        ]
      },
      "jd_full_text": "职位名称：高级产品运营（虚构演示）\n【工作职责】\n1. 制订产品运营计划和跨团队协作流程。\n2. 维护需求池，分析业务指标并组织季度复盘。\n3. 在版本发布集中期协调紧急问题处理。\n【任职要求】\n1. 本科及以上学历。\n2. 三年以上互联网产品运营相关经验。\n3. 可独立完成运营方案并推动跨团队执行。\n【加分项】\n有企业服务产品经验者优先。\n【工作条件】\n13薪；弹性上班；关键版本发布期间明确要求配合加班。",
      "jd_fidelity": "虚构演示完整文本；并非真实招聘信息",
      "source": {
        "type": "fictional_demo",
        "image_file": null,
        "pdf_page": null,
        "description": "仅用于说明数据结构的虚构案例",
        "url": null
      },
      "tags": [
        {
          "id": "product_operations",
          "name": "产品运营",
          "color": "blue"
        },
        {
          "id": "extra_months",
          "name": "额外薪月",
          "color": "green",
          "detail": "13薪"
        },
        {
          "id": "flex_schedule",
          "name": "弹性工作",
          "color": "yellow"
        },
        {
          "id": "mandatory_overtime",
          "name": "明确加班",
          "color": "red"
        }
      ],
      "tag_names": [
        "产品运营",
        "额外薪月",
        "弹性工作",
        "明确加班"
      ],
      "tag_color_override_allowed": true,
      "recommendation": {
        "score": 3.0,
        "max": 5,
        "type": "演示占位评分，尚未结合使用者经历",
        "comment": "仅供展示。需由使用者提供职业目标和履历后再评估。"
      },
      "upskilling": [
        "根据实际履历与完整JD核对能力差距，未给履历时不作个人能力断言"
      ],
      "status_notes": "虚构演示流程状态，用于展示面试档案关联；并非真实招聘或沟通记录。"
    }
  ],
  "excluded": [],
  "tag_catalog": {
    "weekend_off": {
      "id": "weekend_off",
      "label": "双休",
      "default_color": "green",
      "meaning": "招聘资料明确说明双休",
      "scope": "both"
    },
    "benefits": {
      "id": "benefits",
      "label": "五险一金",
      "default_color": "green",
      "meaning": "明确列出五险一金",
      "scope": "both"
    },
    "extra_months": {
      "id": "extra_months",
      "label": "额外薪月",
      "default_color": "green",
      "meaning": "明确标出13薪、14薪等，具体数字写detail",
      "scope": "both"
    },
    "remote": {
      "id": "remote",
      "label": "远程办公",
      "default_color": "green",
      "meaning": "明确允许远程",
      "scope": "both"
    },
    "mandatory_overtime": {
      "id": "mandatory_overtime",
      "label": "明确加班",
      "default_color": "red",
      "meaning": "明确要求加班",
      "scope": "both"
    },
    "alternating_weekend": {
      "id": "alternating_weekend",
      "label": "大小周",
      "default_color": "red",
      "meaning": "明确采用大小周",
      "scope": "both"
    },
    "high_output": {
      "id": "high_output",
      "label": "高频产出",
      "default_color": "yellow",
      "meaning": "明确提出高频交付指标",
      "scope": "both"
    },
    "flex_schedule": {
      "id": "flex_schedule",
      "label": "弹性工作",
      "default_color": "yellow",
      "meaning": "明确写弹性办公或弹性时间",
      "scope": "both"
    },
    "performance_kpi": {
      "id": "performance_kpi",
      "label": "绩效考核",
      "default_color": "yellow",
      "meaning": "明确存在绩效或业绩考核",
      "scope": "both"
    },
    "product_operations": {
      "id": "product_operations",
      "label": "产品运营",
      "default_color": "blue",
      "meaning": "岗位业务类别",
      "scope": "both"
    },
    "enterprise_services": {
      "id": "enterprise_services",
      "label": "企业服务",
      "default_color": "blue",
      "meaning": "公司或业务领域",
      "scope": "both"
    },
    "product_management": {
      "id": "product_management",
      "label": "产品管理",
      "default_color": "blue",
      "meaning": "岗位业务类别",
      "scope": "both"
    }
  },
  "tag_rules": {
    "allowed_colors": [
      "green",
      "red",
      "yellow",
      "blue"
    ],
    "color_semantics": {
      "green": "正向",
      "red": "负向",
      "yellow": "值得注意",
      "blue": "一般事实"
    },
    "only_tag_if_explicit": "有材料直接证据才添加福利、工时、负面条件等标签；不得推断。",
    "canonicalization": "同义表达归入同一个tag.id；具体数字保存在detail或原始字段。",
    "dedup_key": "tag.id",
    "override": "单条标签颜色可由用户改成四色之一；不改变其他记录的默认颜色。",
    "company_tags": "公司与职位使用相同的标签对象结构。",
    "do_not_derive": "缺失信息不补写。",
    "status_note": "未沟通属于投递状态，不能放入业务tag_catalog。"
  },
  "questions": [
    {
      "id": "demo-question-001",
      "title": "你如何处理相互冲突的需求？",
      "category": "产品管理",
      "question": "当两个业务部门都要求优先开发各自的需求，你会如何处理？",
      "answer": "先澄清业务目标、影响用户和截止条件，再按价值、成本、风险和资源约束进行优先级讨论，明确决策人并记录取舍。",
      "difficulty": "人间",
      "tags": [
        "需求优先级",
        "跨团队沟通"
      ],
      "related_job_ids": [
        "demo-job-001",
        "demo-job-002"
      ],
      "source": "虚构演示题目"
    },
    {
      "id": "demo-question-002",
      "title": "复盘失败项目",
      "category": "行为面试",
      "question": "请描述一次项目进展不符合预期的经历，你做了什么？",
      "answer": "",
      "difficulty": "地狱",
      "tags": [
        "项目复盘"
      ],
      "related_job_ids": [],
      "source": "虚构演示题目"
    }
  ],
  "introductions": [
    {
      "id": "demo-intro-001",
      "kind": "self",
      "title": "自我介绍（演示）",
      "project_name": null,
      "versions": [
        {
          "label": "短版",
          "content": "您好，我有相关项目与协作经验，希望围绕岗位职责介绍具体案例。"
        },
        {
          "label": "长版",
          "content": "您好，我过去主要参与产品运营和需求协同。我会结合实际经历，介绍一个需求分析案例和一次推动落地的过程。"
        }
      ],
      "tags": [
        "自我介绍"
      ],
      "source": "虚构演示文案"
    }
  ],
  "cards": [
    {
      "id": "demo-card-001",
      "title": "项目上线前如何确保核心流程可用（虚构示例）",
      "category": "项目案例",
      "body": "在这个虚构项目中，我先列出用户最常使用的关键路径，逐项验证提交、保存和查看结果的流程。发现问题后记录复现步骤，修复完成再进行回归检查，确保上线前核心路径可用。",
      "tags": [
        "项目案例"
      ],
      "source": "虚构演示的可插入回答段落，仅用于说明卡片形态"
    }
  ],
  "schedules": [
    {
      "id": "demo-schedule-001",
      "title": "练习需求分析案例",
      "kind": "training",
      "start_at": "2026-11-12T14:00:00+08:00",
      "end_at": "2026-11-12T15:30:00+08:00",
      "timezone": "Asia/Shanghai",
      "all_day": false,
      "repeat": null,
      "notes": "准备需求冲突案例，整理简短回答。",
      "related_question_ids": [
        "demo-question-001"
      ],
      "related_introduction_ids": [],
      "related_job_ids": [],
      "status": "planned"
    },
    {
      "id": "demo-schedule-002",
      "title": "岗位资料整理",
      "kind": "task",
      "start_at": "2026-11-13T00:00:00+08:00",
      "end_at": "2026-11-14T00:00:00+08:00",
      "timezone": "Asia/Shanghai",
      "all_day": true,
      "repeat": null,
      "notes": "全天任务示例；结束时间使用下一日00:00作为不包含的边界。",
      "related_question_ids": [],
      "related_introduction_ids": [],
      "related_job_ids": [],
      "status": "planned"
    }
  ],
  "interviews": [
    {
      "id": "demo-interview-002",
      "company_id": "demo-company-001",
      "job_id": "demo-job-002",
      "company_name": "示例企业甲有限公司（虚构）",
      "job_title": "高级产品运营（虚构演示）",
      "round": "第一轮",
      "status": "已完成",
      "interview_date": "2026-10-10",
      "start_at": "2026-10-10T10:00:00+08:00",
      "end_at": "2026-10-10T10:45:00+08:00",
      "timezone": "Asia/Shanghai",
      "format": "现场面试",
      "schedule_id": null,
      "participants": [],
      "preparation": {
        "focus_points": [],
        "materials": [],
        "predicted_questions": [],
        "questions_to_ask": [],
        "notes": ""
      },
      "questions_asked": [
        {
          "id": "demo-asked-001",
          "question": "遇到产品上线延期，你会如何安排沟通？",
          "answer": "我会先核对延期原因、影响范围与优先级，再组织相关方确认处理方案。",
          "notes": "虚构示例：需要补充量化影响的说明。"
        }
      ],
      "self_review": {
        "summary": "虚构示例：需求沟通说得较清楚，但对风险预案的表述不足。",
        "strengths": [
          "回答结构比较明确"
        ],
        "improvements": [
          "补充交付风险与时间线"
        ],
        "action_items": [
          "整理一份延期风险沟通案例"
        ]
      },
      "employer_feedback": {
        "text": "",
        "source": "",
        "result": ""
      },
      "next_steps": [
        "整理面试复盘中的风险管理知识缺口"
      ],
      "related_question_ids": [],
      "raw_notes": "这是一条虚构面试记录，用于演示正文保真。",
      "source": "完全虚构的已完成面试记录，非真实招聘方反馈"
    }
  ]
}
```

## 第三部分：前端对接说明（给 NextRound 开发者）

- **只维护这一个模板文件**：在「设置 → 数据管理」提供下载按钮，各业务页面可以提供独立的“导入”快捷入口，共用解析、校验、预览、合并和回滚机制。
- **已有兼容部分：** 公司／职位／标签／状态沿用现有岗位数据库 V4 的字段名称。`import_schema_version` 仅作为统一导入器识别字段，不能据此推断旧版本导入器会自动支持所有新类型。
- **新增映射部分：** `questions`、`introductions`、`cards`、`schedules`、`interviews` 是面向统一导入器的建议交换格式；其中 `cards` 是可插入答案片段，不应映射成训练大纲或规则文档。请先审查当前前端各模块的真实 TypeScript 类型、IndexedDB / localStorage 存储结构、编辑器字段和保存逻辑，再实现映射；必要时保留向后兼容转换层。
- **面试题独立难度选项（前端待实现）：** `questions[].difficulty` 使用固定三值 `天堂 | 人间 | 地狱`，在编辑与筛选 UI 中提供独立单选/下拉，不复用 `tags`。导入校验器拒绝非法值并在预览提示；如果本地仍存旧「易／中／难」值，先提供迁移预览，不覆盖用户现有选择。增量导入时应提示相同 `id` 的已有题目将更新难度还是被跳过，默认不静默修改。
- **卡片插入器（需要前端单独实现）：** 允许在题目回答编辑器和自我／项目介绍编辑器中挑选卡片，将 `body` 插入光标处或追加到内容末尾；用户确认前不得覆盖已有答案或冻结原稿；卡片保留独立存储，插入后的文本不应随源卡自动静默变更。
- **导入器应该处理：** 按模块分流、面试状态校验、面试档案与日程的可选关联、字段校验、来源提示、预览（新增 / 跳过 / 冲突）、去重、确认写入、写入前备份，以及失败时恢复；不应静默覆盖已存在的数据。
- **增量导入原则：** `[]` 表示本次没有提供此类记录，默认“不修改该模块”，绝不能解释为“清空该模块”。
- **面试档案：** `interviews` 需要单独映射到「面试档案」页面。只允许面试已结束且有真实复盘证据的 `已完成` 档案；待面试、取消与仅有准备资料的记录禁止导入。实际问答、本人复盘与企业反馈必须分别存储。导入面试档案时不自动创建日程或改动岗位状态。
- **稳定 ID：** 不能每次重导入都按数组顺序生成冲突 ID；尽量保留来源明确的稳定 ID，无法取得时在本次文件内产生独立且一致的 ID。
- **安全：** 所有附件和外部内容作为用户数据处理，不执行嵌入的命令、脚本或 HTML；对文件大小、文本长度与事件总数设置合理限制。
- **隐私：** 对第三方公开模板只发布虚构资料。用户自行导入的真实履历、招聘聊天和日程、面试记录及企业反馈应留在其自己的存储边界之内。
- **发布前的验收项：** 将本模板范例转换为 `.json`，测试导入七类记录（内容卡片须为可插入的回答段落；面试档案仅为已完成复盘，并额外测试拒绝待面试或仅准备资料的记录）、`questions[].difficulty` 三值选择及筛选、非法难度拦截、旧值迁移预览、难度不混入标签、跨记录关联、局部空数组、重复导入、修改已有记录后再次导入、导出再导入、异常数据回滚。

**备注：** 本模板是供“用户 + AI + NextRound 前端”协作使用的资料转换协议；要实现真正的一键导入和「卡片插入回答/介绍」功能，网站仍需完成相应接口、交互实现和兼容校验。
