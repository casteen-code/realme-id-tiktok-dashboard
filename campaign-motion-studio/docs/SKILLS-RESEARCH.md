# GitHub skills 研究与项目决策

查阅日期：2026-09-08。以下是官方仓库来源，项目吸收工作方法，没有复制其实现代码，也没有把运行环境迁移到 Remotion。

| Skill | 来源 | 在本项目采用的做法 |
| --- | --- | --- |
| remotion-markup | [官方 SKILL.md](https://github.com/remotion-dev/skills/blob/main/skills/remotion-markup/SKILL.md) | 以明确的帧 / 时间驱动动画；预览与导出使用同一套状态计算；资产和场景拆开组织 |
| remotion-interactivity | [官方 SKILL.md](https://github.com/remotion-dev/skills/blob/main/skills/remotion-interactivity/SKILL.md) | 为元素赋予清晰名称；让位置、尺寸、旋转、动画参数成为可编辑属性 |
| frontend-design | [官方 SKILL.md](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) | 以具体工作任务组织界面；保留用户认可的黑黄视觉；预览、图层和属性有清楚分工 |

Remotion 的技能针对 React 和其 Studio，因此这里借鉴“时间驱动”和“可编辑元素”的原则，没有照搬其特定组件或内联代码规则。用户需要双击 HTML、替换图片、直接出片，所以本项目采用无运行时依赖的 Canvas 编辑器，数据保存为 JSON。

本轮未额外安装这些 skills；其内容已用于项目设计并在这里保留来源。后续需要专业多镜头剪辑、音轨或 3D 场景时，可以根据需求再接入相应工具。
