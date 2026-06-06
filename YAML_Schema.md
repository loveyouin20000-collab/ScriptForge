YAML Schema 设计

metadata:
  title: 示例小说改编剧本
  author: 原作者
  generated_by: Novel2Script AI
  version: 1.0

source:
  chapter_count: 3
  chapters:
    - id: ch_001
      title: 第一章 雨夜归人
      summary: 本章讲述……
    - id: ch_002
      title: 第二章 旧案重启
      summary: 本章讲述……
    - id: ch_003
      title: 第三章 消失的证人
      summary: 本章讲述……

characters:
  - id: char_001
    name: 林晚
    role: protagonist
    description: 年轻小说作者
    motivation: 查清父亲失踪真相
    relationships:
      - target: char_002
        relation: 前恋人

locations:
  - id: loc_001
    name: 老城区咖啡馆
    type: interior
    description: 昏暗、安静、带有旧时代气息

timeline:
  - order: 1
    chapter_id: ch_001
    event: 林晚收到神秘短信
  - order: 2
    chapter_id: ch_001
    event: 周沉出现

scenes:
  - id: scene_001
    title: 雨夜重逢
    source:
      chapters:
        - ch_001
    setting:
      location: loc_001
      time: 夜晚
      atmosphere: 悬疑、压抑
    characters:
      - char_001
      - char_002
    purpose: 引出主线悬念
    beats:
      - 林晚独自等待
      - 周沉突然出现
      - 两人围绕短信发生冲突
    script:
      - type: action
        content: 雨水拍打着玻璃窗。
      - type: dialogue
        character: char_002
        content: 好久不见。
      - type: dialogue
        character: char_001
        content: 你为什么会在这里？
    notes:
      adaptation_strategy: 将原文心理描写转化为动作和对白。
      
Schema 设计原因

1. 为什么要有 metadata？

用于记录剧本标题、作者、版本和生成信息，方便后续管理多个改编版本。

2. 为什么要保留 source？

因为作者需要知道：

这个场景来自哪一章？
AI 改编时有没有遗漏？
原小说和剧本之间如何对应？

这对创作者非常重要。

3. 为什么要单独抽 characters？

剧本是人物驱动的。如果每个场景里都重复写人物信息，会导致不一致。

所以要先建立人物表，后面场景只引用 character id。

4. 为什么要单独抽 locations？

影视剧本非常依赖场景。地点独立出来后，可以：

复用地点
统一场景描述
支持后续分镜、拍摄计划、场景预算
5. 为什么要有 timeline？

小说改编成剧本时，经常会出现时间线错乱。

timeline 可以帮助作者检查剧情顺序，也能帮助 AI 生成更连贯的剧本。

6. 为什么 scenes 里要有 beats？

因为直接生成完整剧本容易跑偏。

先生成剧情节拍：

谁在场？
发生什么？
冲突是什么？
这个场景推动了什么？

再生成对白和动作，会更稳定。

7. 为什么 script 要区分 action / dialogue / transition？

因为剧本不是普通文章，需要结构化表达。

例如：

- type: action
- type: dialogue
- type: transition

这样后续可以扩展为：

导出标准剧本文档
生成分镜
生成拍摄计划
统计角色台词量
