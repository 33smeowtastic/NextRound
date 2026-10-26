# 共享数据与本地可靠性

NextRound 使用纯前端 ES modules、IndexedDB 与 JSON 备份。正式数据库 `nextround-local` 与演示数据库 `nextround-demo` 物理隔离，各自的 `state/current` 在单个事务中保存完整状态。进入演示空间才初始化独立示例，不向正式库写入演示数据。音频以 data URL / base64 存在附件实体中，与引用记录一起原子保存、完整备份。大音频会增加备份和内存开销，建议及时导出。

## 实体及关联

所有实体使用稳定字符串 `id`、ISO 时间 `createdAt` / `updatedAt`、从 1 开始的整数 `revision`。`touch(record, patch)` 保留 ID 与创建时间，递增版本。未知 JSON 字段在保存与合并中保留。

- `companies`：企业或招录单位资料，`kind` 为 `enterprise` / `public`（缺省按企业解释）；`ratings` 为维度 ID 到 0—10 分的映射，`tags` 为 `{name,color,weight,veto}`，`feedback/strengths/weaknesses` 为明确记录的文本。
- `jobs`：`companyId` 指向组织；`track` 为 `enterprise`、`civil-service`、`public-institution`。企业保存JD、岗位、状态、月薪 `salaryMonthly`、年薪月数 `months`、每周工时 `hoursWeek` 及Offer；公招保存 `examName/examYear/positionCode/vacancies/eligibility/applicationDeadline/writtenDate/writtenScore/interviewScore/finalScore/rank/interviewFormat/examNotes` 等原始信息。显式类型与关联组织类型须匹配。
- `questions`：题库问题、类别、标签、回答与历史版本，`scope` 区分 `common`、`enterprise`、`public`；同一题由稳定 ID 在不同场景复用。
- `scripts`：自我介绍或项目介绍的版本，内容与目标时长。
- `interviews`：通过 `companyId` / `jobId` 关联公司岗位，`questions` 内的 `questionId` 指向题库；现场回答与优化回答保留在实录项中。
- `sessions`：训练记录，可引用 `companyId/jobId/scriptId/interviewId` 与 `questionIds`，通过 `attachmentIds` 引用本地录音。
- `attachments`：`name`、`mime`、`data`（base64 或 data URL）。备份包含完整音频，无需外部文件地址。
- `scheduleItems`：个人日程，保存 `title/startsAt/type/notes` 及可选的单位、面试和知识库弱关联；详情见下文。
- `settings`：关键词、同义词、评分维度与权重、上次备份日期；`conflicts` 保存冲突备份的完整候选版本。

系统可识别并校验 `companyId/jobId/questionId/scriptId/interviewId/sessionId/attachmentId`，以及 `companyIds/jobIds/questionIds/attachmentIds` 数组。可选关联为空字符串或 null 时表示未关联；其他强关联必须能在导入数据或现有数据中找到目标。日程的 `companyId/interviewId/knowledgeId` 是例外：只验证字段类型，不要求目标仍存在。禁止同一状态中跨集合重用 ID。

## 自动保存与跨窗口

`loadState({workspace})` 读取指定空间经验证的状态及数据库版本；`saveState(state,{workspace})` 对数据先验证、快照，再串行提交。必须先 load 再 save。写入排队前捕获空间、版本和载入代次，各空间独立排队；同一载入代次仅接受自身成功前序写入推进版本。写入事务读取当前空间最新版本并比较捕获版本，因此其他窗口写入后，旧窗口的写入返回 `code: CONCURRENT_WRITE`，原数据不变。

此时 UI 应提示保留当前未保存内容并导出，重新载入最新状态后增量导入，避免静默覆盖。`saveState` 成功返回 `{state, version, workspace, report}`。URL `?space=demo` 保存演示空间选择，正式空间移除此参数；刷新按参数重新加载。存储配额不足或事务中止时不能显示已保存。

## 异步文件操作互斥

导入、导出、附件上传、完成训练保存和麦克风权限等待共用独占任务锁，捕获开始时的workspace与state对象；异步继续前核对锁持有者及空间/状态身份，过期任务不能应用到新空间。只有持有任务可释放锁，期间主操作区标记inert与aria-busy，并阻止空间切换和重叠文件操作。附件上传另行捕获原面试ID，编辑器关闭或切换目标后仍只关联原记录。

## 增量与替换导入

`exportBackup(state,{workspace})` 返回JSON Blob，封装 `{format:'NextRound', workspace, exportedAt, state}`。`importBackup(file,state,{workspace,mode})` 接受 File/Blob、JSON 字符串或解析后的状态，返回 `{state,report}`，本身不写数据库；调用方确认有效后正常自动保存。

空间检查先于合并：显式备份空间必须与当前空间一致，跨空间返回 `WORKSPACE_MISMATCH`。旧备份无空间字段时，依据 `settings.demo` 或已知固定示例ID保守判定；显式formal封装中的demo标记仍会被识别。完整 `NextRoundLegacyRecovery` 包拒绝整包导入，未知空间也拒绝。拒绝时不写数据库。

1. 验证 schema、数组、实体 ID / 时间 / 类型、评分设置和引用完整性；整个导入失败时现有状态不变。
2. 新 ID 追加；相同 ID、相同内容计为 unchanged。
3. 相同 ID、不同内容保留现有记录，incoming 全量保存在 conflicts；时间或 revision 较新也不能覆盖现有记录。
4. 以集合 + 实体 ID + 规范化完整内容去重冲突；重复导入不会不断复制冲突版本。
5. 设置有差异时保留当前设置、保存导入设置的完整候选版本，避免备份改变现有评分规则。
6. 已导出的 conflicts 也会增量保留。所有集合与音频均参与同一次结果验证和原子写入。

冲突版本可由 UI 明确选用；选用应通过 `touch` 产生新的当前版本，并保留冲突证据。垃圾箱删除按关联打包，验证会阻止悬空引用。

## 机械统计与评分

`keywordCoverage` 使用 NFKC、大小写归一与自定义同义词；中文按子串，拉丁关键词保留词边界，避免将 JSON 误算作 JS。无关键词时返回 0%，而不是虚构覆盖率。输出 matched / missing 可追溯到关键词列表，不能当作能力评价。

`scoreCompany` 根据组织/岗位类型选择个人评价维度；`scoreJob` 仅对传入的单个岗位及其关联组织评分，避免同组织兄弟岗位影响单列比较。个人意向为维度百分制加权平均，再加减标签权重，限制在 0—100。一票否决单独显示、保留原评分供比较。企业分支按进展给出规则分：关注 0、沟通 15、待面试 30、面试中 50、Offer 90、结束 0；有记录的认可优势 +5，有记录的不足 −5。反馈文字不自动推断情感；此分数不是真实录用概率。每次返回 `reasons` 说明计算依据。

年包 = 月薪 × 薪资月数（默认 12），估算时薪 = 年包 ÷（每周工时 × 52）。不自动扣税、计入通勤或假期；缺少工时或薪资返回 null，避免将未知信息显示为 0。优先取 Offer 岗位，否则取首个有薪资记录的岗位。

## 验证

当前可复跑检查见 [测试说明](TESTING.md)。[异步空间回归](../tests/async-workspaces.test.js) 覆盖独占锁、过期任务、附件归属、训练完成与旧编辑器；真实 IndexedDB 事务、跨窗口 CAS、导入/迁移、垃圾箱与幂等性由现役浏览器 suite 核验。历史阶段报告保留本地，不作为当前通过依据。

## 可配置企业意向规则与状态边界

`jobs.status` 按track校验。企业为关注、沟通、待面试、面试中、Offer、结束；公务员与事业单位为关注、报名、资格审核、待笔试、资格复审、待面试、面试中、体检考察、公示、录用、结束。岗位流程中的“待面试”仍表示流程阶段。`interviews.status` 使用独立生命周期：新建只允许已完成、已取消；旧档案中的“待面试”迁移为“待确认”，保留原记录内容，由用户核实后再修改。已完成面试不能通过日程勾选取消完成。其他集合保留其文本状态字段，不借用招聘进展枚举。

`settings.stageScores` 保存六个招聘阶段各自的 0—100 规则分；`positiveFeedbackPoints` 与 `negativeFeedbackPoints` 保存 0—100 加减分。上述新字段在旧备份中缺失时使用原始默认值，部分 stageScores 仅覆盖所列状态。0 是有效配置，不会被默认值替换。企业意向最终仍限制在 0—100，每次返回的 reasons 包含实际配置的加减分。设置版本合并依旧不覆盖现有规则。

## 公招成绩与本地流程规则

`writtenScore/interviewScore/finalScore` 为非负原始记录，不预设满分或自动折算。`examYear/rank/vacancies` 为整数，年份和排名至少1、人数可为0；日期按既有日期规则校验。资格、公告与成绩来源由用户自行核实，应用不内置政策或录用判断。

`settings.publicStageScores` 为公务员和事业单位分别保存阶段到0–100的映射，默认进度为0/10/20/30/45/55/65/80/90/100/0，与上文流程顺序对应；`publicDimensions` 默认是岗位匹配40、地点生活30、发展稳定30。公招流程分仅来自该岗位阶段，不受优势、不足、反馈、自录分数或排名加减。企业薪酬比较与公招原始成绩比较使用各自字段，互不直接换算。

## 旧混合包清除与垃圾箱

正式库加载在同一 readwrite 事务中删除 `legacy-recovery-v1` 前缀键或 `NextRoundLegacyRecovery` 格式的旧混合包，并移除 `current.legacyRecoveryId`。此前已迁移的个人记录不改写；尚未迁移时沿用 `separateLegacyState` 保守分离规则，只保留个人记录及必要关联，不再创建混合快照。重复加载不重复迁移，不触及独立演示空间或无关历史键。

`state.trash` 为可选数组，旧备份缺失时视为空箱。`trash.js` 的 `moveToTrash`、`restoreTrash`、`deleteTrash`、`emptyTrash` 返回经校验的新状态。记录包保存移出的记录和附件、可选的关联冲突版本 `entry.conflicts`、恢复必需的父级依赖快照；不复制整份工作区。实体自身及其引用已删除记录的冲突版本也随包移走，恢复时完整内容去重；单位/岗位下关联的记录一并移入，仍被使用的题库或介绍稿删除会被阻止。恢复保留当前已存在的依赖；若实际恢复实体的同 ID 内容不同，整包拒绝恢复，保留垃圾条目供核对。

垃圾箱参与完整导出、增量合并与替换导入。替换模式 `mode: "replace"` 单独校验备份引用完整性，不能借用本机记录补全；UI 在校验完成后弹窗提示当前空间记录、附件、设置、冲突版本和垃圾箱将被替换，取消不写入。写入仍受空间任务锁、事务及跨窗口版本检查保护。

## 内容卡片与拼接快照

`contentCards` 是独立集合，字段为稳定 ID、时间/版本及 `title/content/category/variant/tags`。`normalizeState()` 为旧状态及旧垃圾包补缺失的新集合，不改写已有内容。完整导出、增量冲突、替换导入、空间隔离与垃圾箱均涵盖素材卡。

问题和介绍稿可保存 `composition: [{id, sourceCardId, title, text, variant?}]`。每个分段是内容副本；`sourceCardId` 仅作溯源，来源被删除也不产生悬空业务引用。非空分段使用两个换行拼成 `answer` 或 `content`，校验要求一致。空数组表示手写全文，继续添加卡片时先把全文保留为手写段。

`content-cards.js` 提供追加、移动、移除和修改分段的纯函数。UI 调整后沿用自动保存；题库历史存储并恢复 composition，面试复盘替换回答时清空当前分段，同时保留之前完整快照。拖拽绑定当前空间与编辑对象，切换空间或编辑对象后过期拖动不应用。

当前真实拖拽、长短稿、快捷删除、历史、手机与离线证据见 `content-cards-update/VERIFICATION.json`。

## 标签优先级与介绍稿历史清理

可选 `settings.contentCardTagOrder` 是无重复的非空标签字符串数组。标签来自类别、版本及自定义 tags；最早命中的标签决定卡片优先级，同优先级保持原数组顺序，无标签卡片排在最后。`card-tags.js` 负责标签提取、排序、筛选及移动，当前筛选只影响界面。排序随空间设置参与保存、备份和冲突处理。

介绍稿不再生成或保留 history。`script-history.js` 只清理 active scripts、垃圾包 scripts 及脚本冲突快照的历史，保留当前正文、composition、版本名称、题库历史和其他数据。两空间加载均在同一读写事务中清理，必要时版本前进一次；重复载入不重复写入。导入、导出与保存边界防止旧介绍稿历史回流。

分段删除撤回只在当前编辑器中暂存被删分段及位置，恢复时保留其他分段的后续修改；不写成新的历史介绍版本，关闭编辑页后释放。


## 日程与弱关联

`scheduleItems` 与其他集合共用 `touch` 的稳定 ID、创建/更新时间和 revision。必填字段为非空文本 `title`、含时区的有效 ISO 日期时间 `startsAt`（例如 `2026-10-23T10:30:00.000Z`）、`type: "general" | "training" | "interview-prep" | "interview"`。`notes` 为可选文本。可选布尔字段 `completed` 记录完成状态：只有 `true` 视为已完成，`false` 或旧档案缺少该字段都表示未完成；显式的 null、字符串或数字不合法。normalization 不给旧记录凭空补写该字段，完整备份、增量冲突、替换导入及垃圾箱按完整实体保留该状态。编辑器使用本地日期时间时，保存前转换为 ISO 时间；时区显示由界面处理。

可选 `companyId`、`interviewId` 为字符串弱链接。知识库链接由 `knowledgeKind: "questions" | "scripts" | "contentCards"` 与 `knowledgeId` 成对提供，或同时为空。`companyName/interviewTitle/knowledgeTitle` 为可选文本快照，选择关联对象时可写入，用于目标移走后的日程显示。未知 JSON 字段照常保留。

这些链接不构成业务依赖：删除或移入垃圾箱的单位、面试、题目、介绍稿或素材卡不会阻止删除、级联日程或移走日程冲突版本。日程仍保留原始链接和快照，界面在目标不存在时展示已保存文字并避免打开不存在的记录。旧混合档案分离也不会仅因日程弱链接而继续保留示例目标。其他集合的强关联校验不受影响。

旧状态或旧垃圾包缺少 `scheduleItems` 时，`validateState` 兼容，`normalizeState` 补空数组且不改动其他数据。正式/演示各自保存完整日程；现有 `db.js` 的加载、保存和备份边界调用 normalization，因此无需额外数据库版本迁移或新增种子日程。完整备份、增量去重/冲突及替换导入均包含日程。

日程本身可移入垃圾箱，其记录和专属冲突版本一并打包。弱链接不复制单位、面试或知识库实体为恢复依赖；即使这些目标已不存在，垃圾包仍可独立校验和恢复。相同日程 ID 的不同当前内容仍阻止整包恢复，避免覆盖正式记录。

针对性证据为 `tests/schedule.test.js`：旧档案与旧垃圾包兼容、字段校验、强弱关联隔离、关联对象删除、日程独立恢复、冲突幂等、两类导入及正式/演示隔离。

## 清空当前档案与训练状态

设置的「清空当前档案」由 `clearCurrentArchive()` 执行。先拒绝进行中的独占任务、空间切换、训练或录音，结束有效编辑并捕获当前空间任务锁，等待保存队列完成、核对任务归属后显示确认。确认文字列出全部记录、录音、附件、设置、冲突与垃圾箱不可恢复，提示先备份，并明确另一空间不变。取消不写入清空结果（进入操作前已存在的编辑仍按正常保存规则完成）。

确认后以 `blankState()` 经现有 `saveState` 验证及单空间事务替换，继续沿用跨窗口版本检查；成功才更新界面状态。不会删除整个 IndexedDB、另一空间或浏览器来源数据。清空垃圾箱为独立动作，不等于清空当前档案。隔离演示库确认/取消与正式库不变由 `tests/settings-ai-archive-browser.mjs` 验证。

训练状态由 `createTrainingState()` 统一创建，包括 `tags`、`queue`、配置展开状态和录音附件等字段；首次启动、切换空间及清空成功均使用同一工厂。避免切换空间后缺少字段导致训练室路由渲染失败。导航回归见 `tests/navigation-training-browser.mjs`。

## 完成训练与空间一致性

完成训练从停止录音到保存和打开复盘编辑器期间持有空间任务锁，异步返回后核对开始时的空间与状态。保存失败保留训练和已保存的录音草稿，不打开成功编辑器。编辑器捕获所属空间，旧空间编辑器不能把记录写进新空间。相关回归见 `tests/async-workspaces.test.js` 与 `tests/training-finish-workspace-browser.mjs`。
