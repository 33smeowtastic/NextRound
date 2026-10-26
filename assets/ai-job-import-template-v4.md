# 岗位资料转换为可导入 JSON：通用 AI 指令（V4）

> 此文件面向所有求职者。将本说明和自己的职位链接、JD 文本、截图或公司资料一起交给 AI，让 AI 输出符合网站导入结构的 JSON。下方样例中的企业与职位均为**虚构**，不得照搬到真实个人档案。

## 给 AI 的任务

请将我提供的招聘资料，整理成**一个完整、合法的 JSON 对象**，字段结构与本文件附带的演示 JSON 一致。我将把输出直接导入求职管理前端。

1. **输出格式**：只输出 JSON，不要 Markdown 代码围栏、说明或评价段落；UTF-8，双引号合法转义，不要注释或尾随逗号。
2. **材料忠实性**：`jd_full_text` 必须保留我提供的完整岗位 JD 原文，包括职责、任职要求、加分项、福利及工作时间。禁止用摘要替代；禁止补写、猜测或者用同公司相似岗位的 JD 顶替。材料缺失时写空字符串，并用 `jd_fidelity` 解释缺失。
3. **前置摘要**：`jd_summary.core` 用一到两句话说明工作内容；`hard_requirements` 单独列出硬性资格；`preferred_conditions` 仅列明确优先/加分条件。不能把“加分项”擅自写成硬条件。
4. **公司资料**：提取公司全称、业务、规模、融资、简介及原始网址；查不到的字段用 `null` 或空数组，不能编造公司信息、员工口碑或福利。
5. **同岗位去重**：同公司同地点、职责相同且来源重复的岗位合并；同一招聘入口的不同职级用两条 `jobs`，它们应共用 `posting_group_id`。不同公司有不同 `company_id`；`jobs[].company_id` 必须指向 `companies[].id`。
6. **颜色与标签**：只用 `green`、`red`、`yellow`、`blue`；绿=有依据的正面条件，红=有依据的负面条件，黄=需注意或权衡，蓝=中性事实。优先使用 `tag_catalog` 的统一 ID；`tags[]` 的结构固定为 `{ "id": "...", "name": "...", "color": "..." }`，必要时可加 `detail`。没有明确证据就不要加标签。允许用户以后自行改色。
7. **评分**：如我没有提供个人偏好和择业标准，`companies[].score` 与 `jobs[].recommendation.score` 可先沿用 `3.0` 的**UI占位值**，但 `score_type` / `recommendation.type` 与推荐语必须明确“待个人评估”。不要声称评分是平台官方数据。如果我提供了筛选标准，再基于标准评分并解释依据。
8. **补强项**：`upskilling` 针对实际 JD 的能力门槛提出具体准备方向；缺乏本人履历时只能写“建议核实”的通用方向，不要声称我缺少某种能力。
9. **进度状态**：`status` 只能取 `未沟通`、`已沟通`、`简历已投递`、`约面试`、`面试完成`、`Offer`、`不通过`。如未提供任何联系/投递记录，默认填 `未沟通`；只有实际沟通后才填写 `已沟通`，不能根据收藏或浏览记录推定已联系。`未沟通` 是投递状态，前端可显示蓝色状态徽标，不属于业务标签词表。
10. **计数**：更新 `counts.active_conversations`（不同招聘入口）、`active_roles`（有效职位数）及 `distinct_companies`（去重公司数），与 `jobs`、`companies` 和 `posting_group_id` 保持一致。
11. **原始来源**：为每条职位填写 `source`（链接、上传截图或文本等），不把推断写成来源事实。提取失败时保留明确的缺失说明。
12. **保持字段兼容**：保留示例的顶层键名及每条公司、职位对象的主要字段，不要自创字段替代 `jd_full_text`、`jd_summary`、`tags`、`recommendation`、`upskilling` 或 `posting_group_id`。

## 状态补充说明

- `未沟通`：已收藏或整理，但尚未向招聘方打招呼、投递或联系；资料未给出投递记录时也使用此状态。
- `已沟通`：已经与招聘方发起联系，尚未进入附件简历提交/面试等后续阶段。
- 状态与四色业务标签分开管理；所有可选状态必须同时出现在顶层 `statuses` 和岗位的 `status_options` 中。

## 标签基准规则

- **绿色：** 双休、远程办公、五险一金、额外薪月、带薪休假等，前提是资料明确写出。
- **红色：** 单休、大小周、明确加班、无偿加班、无偿试岗等，前提是资料明确写出。
- **黄色：** 弹性工作、绩效考核、高频产出、频繁出差等，标记需关注，不能断言这些条件对所有人都是坏事。
- **蓝色：** 产品运营、软件测试、用户运营、企业服务等岗位/业务事实，可按真实资料归一化扩展标签词表。

## JSON 演示结构

以下 JSON 完整可用作格式参照；**请根据我提供的真实材料重新生成数据，不保留这些虚构职位、企业、日期与占位评价。**

```json
{
  "version": "4.0.1-demo",
  "created_at": "2026-01-15",
  "timezone": "Asia/Shanghai",
  "description": "通用公开导入范本：所有公司、岗位、JD和投递状态均为虚构。供其他求职者的AI模仿结构生成可导入JSON，禁止把演示数据当真实岗位。",
  "counts": {
    "active_conversations": 2,
    "active_roles": 3,
    "distinct_companies": 2
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
      "meaning": "有明确文字依据的正面条件，如双休、五险一金"
    },
    "red": {
      "name": "红色",
      "hex": "#CB4553",
      "meaning": "有明确文字依据的负面条件，如单休、大小周、强制加班"
    },
    "yellow": {
      "name": "黄色",
      "hex": "#C28A24",
      "meaning": "值得注意或视个人偏好权衡的条件，如弹性工作、绩效考核、高频产出"
    },
    "blue": {
      "name": "蓝色",
      "hex": "#3476B8",
      "meaning": "行业、岗位类别、业务方向、工作内容等客观信息"
    }
  },
  "note": "纯虚构格式范例，无任何求职者的个性化偏好、经历、联系方式或真实企业数据；推荐评分为占位演示值。",
  "companies": [
    {
      "id": "demo-company-01",
      "key": "示例企业A（虚构）",
      "full_name": "示例企业A有限公司（虚构）",
      "industry": "企业软件服务（演示）",
      "size": "100–499人（演示）",
      "financing_display": "未披露",
      "description": "本条为虚构的企业介绍，用于展示公司名称、规模、行业、业务简介等字段。",
      "tags": [
        {
          "id": "software_services",
          "name": "软件服务",
          "color": "blue"
        },
        {
          "id": "enterprise_services",
          "name": "企业服务",
          "color": "blue"
        }
      ],
      "tag_names": [
        "软件服务",
        "企业服务"
      ],
      "score": 3.0,
      "reason": "演示占位分；用户尚未提供个人偏好，不应据此判断企业优劣。",
      "urls": [],
      "score_type": "演示占位评分（非真实企业评价）",
      "score_basis": "无个人求职目标和真实企业证据时，仅作为UI示例。"
    },
    {
      "id": "demo-company-02",
      "key": "示例企业B（虚构）",
      "full_name": "示例企业B有限公司（虚构）",
      "industry": "软件研发（演示）",
      "size": "20–99人（演示）",
      "financing_display": "未披露",
      "description": "本条为虚构的软件研发服务企业，用来演示一家公司对应一条招聘职位的常见结构。",
      "tags": [
        {
          "id": "software_services",
          "name": "软件服务",
          "color": "blue"
        }
      ],
      "tag_names": [
        "软件服务"
      ],
      "score": 3.0,
      "reason": "演示占位分；没有可验证的企业口碑或个人偏好数据。",
      "urls": [],
      "score_type": "演示占位评分（非真实企业评价）",
      "score_basis": "无个人求职目标和真实企业证据时，仅作为UI示例。"
    }
  ],
  "jobs": [
    {
      "id": "demo-job-001",
      "company_id": "demo-company-01",
      "company": "示例企业A（虚构）",
      "role": "产品运营专员（演示）",
      "platform": "演示招聘平台",
      "posting_group_id": "demo-entry-001",
      "city": "示例城市",
      "location": "示例城市·示例区域",
      "salary": "8–12K（演示）",
      "experience": "1年以上",
      "education": "本科",
      "applied_date": null,
      "status": "已沟通",
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
        "core": "基础产品运营、用户反馈整理、功能数据分析",
        "hard_requirements": [
          "本科及以上",
          "1年以上相关经验",
          "基础数据与沟通能力"
        ],
        "preferred_conditions": [
          "企业软件产品经验"
        ]
      },
      "jd_full_text": "职位名称：产品运营专员（虚构演示）\n【工作职责】\n1. 维护产品功能介绍、帮助文档和操作流程。\n2. 汇总用户反馈，按问题类别整理需求清单，定期与产品团队沟通。\n3. 跟踪功能使用数据，提出可执行的优化建议。\n【任职要求】\n1. 本科及以上学历。\n2. 具备一年以上相关产品运营或用户运营经验。\n3. 具备基本的数据整理与跨团队沟通能力。\n【优先条件】\n熟悉企业软件产品者优先。\n【工作安排】\n周末双休，五险一金，弹性工作。",
      "jd_fidelity": "全部为虚构演示文本，无真实招聘来源。",
      "source": {
        "type": "synthetic_demo",
        "image_file": null,
        "pdf_page": null,
        "description": "通用公开模板的虚构演示JD",
        "url": null
      },
      "tags": [
        {
          "id": "product_ops",
          "name": "产品运营",
          "color": "blue"
        },
        {
          "id": "customer_ops",
          "name": "用户运营",
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
        },
        {
          "id": "flex_schedule",
          "name": "弹性工作",
          "color": "yellow"
        }
      ],
      "tag_names": [
        "产品运营",
        "用户运营",
        "双休",
        "五险一金",
        "弹性工作"
      ],
      "tag_color_override_allowed": true,
      "recommendation": {
        "score": 3.0,
        "max": 5,
        "type": "未提供候选人背景，演示占位评分",
        "comment": "占位推荐语：请根据实际岗位要求、个人目标和证据重写，切勿复制演示评价。"
      },
      "upskilling": [
        "产品运营指标体系",
        "用户反馈分类方法"
      ],
      "status_notes": "虚构演示记录，请用真实投递进度替换。"
    },
    {
      "id": "demo-job-002",
      "company_id": "demo-company-01",
      "company": "示例企业A（虚构）",
      "role": "高级产品运营（演示）",
      "platform": "演示招聘平台",
      "posting_group_id": "demo-entry-001",
      "city": "示例城市",
      "location": "示例城市·示例区域",
      "salary": "15–22K·14薪（演示）",
      "experience": "3年以上",
      "education": "本科",
      "applied_date": null,
      "status": "已沟通",
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
        "core": "企业产品运营策略、跨部门项目和指标复盘",
        "hard_requirements": [
          "本科及以上",
          "3年以上产品运营或相关经验",
          "跨团队项目管理和数据分析"
        ],
        "preferred_conditions": [
          "企业服务经验",
          "团队指导经验"
        ]
      },
      "jd_full_text": "职位名称：高级产品运营（虚构演示）\n【工作职责】\n1. 负责企业软件产品运营策略、用户反馈机制及版本推广方案。\n2. 设计跨部门运营项目并跟踪交付进度，维护核心运营指标。\n3. 指导产品运营专员建立流程、模板与定期复盘机制。\n【任职要求】\n1. 本科及以上学历。\n2. 具备三年以上产品运营或互联网产品相关经验。\n3. 有跨团队项目管理与数据分析能力。\n【优先条件】\n有企业服务产品运营经验或团队指导经验者优先。\n【工作安排】\n周末双休，五险一金，14薪。",
      "jd_fidelity": "全部为虚构演示文本，无真实招聘来源。",
      "source": {
        "type": "synthetic_demo",
        "image_file": null,
        "pdf_page": null,
        "description": "通用公开模板的虚构演示JD",
        "url": null
      },
      "tags": [
        {
          "id": "product_ops",
          "name": "产品运营",
          "color": "blue"
        },
        {
          "id": "project_management",
          "name": "项目管理",
          "color": "blue"
        },
        {
          "id": "team_management",
          "name": "团队管理",
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
        },
        {
          "id": "extra_months",
          "name": "额外薪月",
          "color": "green",
          "detail": "14薪"
        }
      ],
      "tag_names": [
        "产品运营",
        "项目管理",
        "团队管理",
        "双休",
        "五险一金",
        "额外薪月"
      ],
      "tag_color_override_allowed": true,
      "recommendation": {
        "score": 3.0,
        "max": 5,
        "type": "未提供候选人背景，演示占位评分",
        "comment": "占位推荐语：请根据实际岗位要求、个人目标和证据重写，切勿复制演示评价。"
      },
      "upskilling": [
        "跨团队项目计划",
        "运营指标复盘方法"
      ],
      "status_notes": "虚构演示记录，请用真实投递进度替换。"
    },
    {
      "id": "demo-job-003",
      "company_id": "demo-company-02",
      "company": "示例企业B（虚构）",
      "role": "软件测试工程师（演示）",
      "platform": "演示招聘平台",
      "posting_group_id": "demo-entry-002",
      "city": "示例城市",
      "location": "示例城市·示例区域",
      "salary": "10–16K（演示）",
      "experience": "经验不限",
      "education": "大专及以上",
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
        "core": "功能测试、缺陷管理与版本质量保障",
        "hard_requirements": [
          "大专及以上",
          "软件测试流程",
          "缺陷问题描述和复现能力"
        ],
        "preferred_conditions": [
          "接口测试经验"
        ]
      },
      "jd_full_text": "职位名称：软件测试工程师（虚构演示）\n【工作职责】\n1. 编写测试用例，执行功能测试与回归测试，记录并跟踪缺陷。\n2. 与研发和产品人员协作，完成版本验收。\n3. 每周参与两次版本测试交付，提交质量报告。\n【任职要求】\n1. 大专及以上学历。\n2. 熟悉常见软件测试流程与缺陷管理工具。\n3. 能清晰描述问题并提出复现步骤。\n【优先条件】\n熟悉接口测试者优先。\n【工作安排】\n实行大小周，岗位包含明确的晚间加班安排；设有绩效考核。",
      "jd_fidelity": "全部为虚构演示文本，无真实招聘来源。",
      "source": {
        "type": "synthetic_demo",
        "image_file": null,
        "pdf_page": null,
        "description": "通用公开模板的虚构演示JD",
        "url": null
      },
      "tags": [
        {
          "id": "software_testing",
          "name": "软件测试",
          "color": "blue"
        },
        {
          "id": "alternating_weekend",
          "name": "大小周",
          "color": "red"
        },
        {
          "id": "mandatory_overtime",
          "name": "明确加班",
          "color": "red"
        },
        {
          "id": "performance_kpi",
          "name": "绩效考核",
          "color": "yellow"
        }
      ],
      "tag_names": [
        "软件测试",
        "大小周",
        "明确加班",
        "绩效考核"
      ],
      "tag_color_override_allowed": true,
      "recommendation": {
        "score": 3.0,
        "max": 5,
        "type": "未提供候选人背景，演示占位评分",
        "comment": "占位推荐语：请根据实际岗位要求、个人目标和证据重写，切勿复制演示评价。"
      },
      "upskilling": [
        "测试用例编写",
        "缺陷复现与质量报告"
      ],
      "status_notes": "虚构演示记录，请用真实投递进度替换。"
    }
  ],
  "excluded": [],
  "tag_catalog": {
    "weekend_off": {
      "id": "weekend_off",
      "label": "双休",
      "default_color": "green",
      "meaning": "招聘材料明确标注每周休息两天或双休",
      "scope": "both"
    },
    "remote": {
      "id": "remote",
      "label": "远程办公",
      "default_color": "green",
      "meaning": "招聘材料明确允许远程办公",
      "scope": "both"
    },
    "benefits": {
      "id": "benefits",
      "label": "五险一金",
      "default_color": "green",
      "meaning": "招聘材料明确承诺五险一金",
      "scope": "both"
    },
    "extra_months": {
      "id": "extra_months",
      "label": "额外薪月",
      "default_color": "green",
      "meaning": "招聘材料明确写13薪、14薪等；具体值填detail",
      "scope": "both"
    },
    "paid_leave": {
      "id": "paid_leave",
      "label": "带薪休假",
      "default_color": "green",
      "meaning": "招聘材料明确写带薪年假等",
      "scope": "both"
    },
    "no_overtime": {
      "id": "no_overtime",
      "label": "不加班",
      "default_color": "green",
      "meaning": "招聘材料明确承诺不加班",
      "scope": "both"
    },
    "single_weekend": {
      "id": "single_weekend",
      "label": "单休",
      "default_color": "red",
      "meaning": "招聘材料明确写单休",
      "scope": "both"
    },
    "alternating_weekend": {
      "id": "alternating_weekend",
      "label": "大小周",
      "default_color": "red",
      "meaning": "招聘材料明确写大小周",
      "scope": "both"
    },
    "mandatory_overtime": {
      "id": "mandatory_overtime",
      "label": "明确加班",
      "default_color": "red",
      "meaning": "招聘材料明确写固定或强制加班",
      "scope": "both"
    },
    "unpaid_overtime": {
      "id": "unpaid_overtime",
      "label": "无偿加班",
      "default_color": "red",
      "meaning": "招聘材料明确写不补偿加班",
      "scope": "both"
    },
    "unpaid_trial": {
      "id": "unpaid_trial",
      "label": "无偿试岗",
      "default_color": "red",
      "meaning": "招聘材料明确要求无偿工作试岗",
      "scope": "both"
    },
    "high_output": {
      "id": "high_output",
      "label": "高频产出",
      "default_color": "yellow",
      "meaning": "招聘材料明确要求高频次产出/交付",
      "scope": "both"
    },
    "flex_schedule": {
      "id": "flex_schedule",
      "label": "弹性工作",
      "default_color": "yellow",
      "meaning": "招聘材料明确标注弹性工作安排",
      "scope": "both"
    },
    "performance_kpi": {
      "id": "performance_kpi",
      "label": "绩效考核",
      "default_color": "yellow",
      "meaning": "招聘材料明确披露考核目标或绩效工资",
      "scope": "both"
    },
    "frequent_travel": {
      "id": "frequent_travel",
      "label": "频繁出差",
      "default_color": "yellow",
      "meaning": "招聘材料明确要求频繁出差",
      "scope": "both"
    },
    "multi_role": {
      "id": "multi_role",
      "label": "职责宽泛",
      "default_color": "yellow",
      "meaning": "职责明确跨越多个职能且工作量需权衡；仅在有具体依据时标注",
      "scope": "both"
    },
    "product_ops": {
      "id": "product_ops",
      "label": "产品运营",
      "default_color": "blue",
      "meaning": "岗位涉及产品功能运营、用户流程或产品数据",
      "scope": "both"
    },
    "customer_ops": {
      "id": "customer_ops",
      "label": "用户运营",
      "default_color": "blue",
      "meaning": "岗位涉及用户服务、用户反馈和运营",
      "scope": "both"
    },
    "software_testing": {
      "id": "software_testing",
      "label": "软件测试",
      "default_color": "blue",
      "meaning": "岗位涉及软件测试与质量保障",
      "scope": "both"
    },
    "data_analysis": {
      "id": "data_analysis",
      "label": "数据分析",
      "default_color": "blue",
      "meaning": "岗位涉及数据分析和指标体系",
      "scope": "both"
    },
    "enterprise_services": {
      "id": "enterprise_services",
      "label": "企业服务",
      "default_color": "blue",
      "meaning": "公司或岗位面向企业客户",
      "scope": "both"
    },
    "software_services": {
      "id": "software_services",
      "label": "软件服务",
      "default_color": "blue",
      "meaning": "公司业务为软件产品或技术服务",
      "scope": "both"
    },
    "project_management": {
      "id": "project_management",
      "label": "项目管理",
      "default_color": "blue",
      "meaning": "岗位涉及项目规划、跨团队协作与交付",
      "scope": "both"
    },
    "team_management": {
      "id": "team_management",
      "label": "团队管理",
      "default_color": "blue",
      "meaning": "岗位明确有带团队或管理职责",
      "scope": "both"
    },
    "onsite": {
      "id": "onsite",
      "label": "现场办公",
      "default_color": "blue",
      "meaning": "招聘材料明确要求线下办公",
      "scope": "both"
    },
    "hybrid": {
      "id": "hybrid",
      "label": "混合办公",
      "default_color": "blue",
      "meaning": "招聘材料明确为线下加远程的混合方式",
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
      "green": "明确正面",
      "red": "明确负面",
      "yellow": "需注意/需权衡",
      "blue": "一般事实"
    },
    "only_tag_if_explicit": "仅根据材料中明确出现的条件加标签，未披露不能推断。",
    "canonicalization": "同义词映射同一tag.id，具体数值保留在结构化字段或tag.detail；优先复用tag_catalog词表。",
    "priority_order": [
      "red",
      "yellow",
      "green",
      "blue"
    ],
    "dedup_key": "tag.id",
    "override": "允许单条职位/公司的tag.color独立修改，且只能是green、red、yellow、blue。",
    "company_tags": "公司和职位标签均使用{id,name,color,detail?}结构；公司标签仅据公司业务资料添加。",
    "do_not_derive": "不从公司名称猜测福利、工时、资历；未明确写双休/加班时不添加对应标签。",
    "personalized_cautions": []
  }
}
```
