# TikTok 手机经营总看板

面向 realme 印尼电商运营的经营数据查看入口。这个项目将日常更新的数据包与浏览器查看页面分开：运营同事打开固定网址，用管理员提供的密码查看已发布的经营看板。

[打开经营看板](https://casteen-code.github.io/realme-id-tiktok-dashboard/) · [查看源码](https://github.com/casteen-code/realme-id-tiktok-dashboard)

## 场景与我的角色

**需要解决的问题**：让运营团队有一个稳定的经营信息入口；更新经营数据时，不应覆盖库存工具或活动编辑器，也不应让已分享的链接失效。

**我的角色**：我是一名数字营销运营，从实际工作出发提出业务需求、报表口径和使用流程，并通过 AI 辅助开发、反馈和验收改进工具。这里展示的是运营问题拆解与工具落地过程，不以未经核实的增长数据证明效果。

**已实现的基础能力**：浏览器密码解锁、客户端解密展示、数据包与页面分离更新。它不是账号系统，没有团队成员权限管理、登录审计或云端协作编辑。具体经营指标取决于已发布的数据包；公开源码不展示真实报表内容。

## 三项工具，各有一个维护来源

| 工具 | 唯一维护仓库与入口 | 本仓库的职责 |
| --- | --- | --- |
| 经营看板 | [本仓库](https://github.com/casteen-code/realme-id-tiktok-dashboard) / [经营看板入口](https://casteen-code.github.io/realme-id-tiktok-dashboard/) | 维护和发布经营看板 |
| 库存周转 | [realme-inventory-turnover](https://github.com/casteen-code/realme-inventory-turnover) / [独立入口](https://casteen-code.github.io/realme-inventory-turnover/) | 保留旧分享地址的跳转，不再发布旧库存代码 |
| 活动背景工坊 | [campaign-motion-studio](https://github.com/casteen-code/campaign-motion-studio) / [独立入口](https://casteen-code.github.io/campaign-motion-studio/) | 保留旧分享地址的跳转 |

**迁移状态（2026-10-12）**：库存工具已独立发布，自动测试和线上发布清单核验通过；本仓库的新发布包保留旧链接跳转。三个工具分别维护，日常数据更新只影响经营看板。

`inventory-turnover.*`、`sku-core.js`、原库存测试与 `campaign-motion-studio/` 目录暂时保留，供版本追溯和恢复使用，**不是后续开发或发布的主版本**。新功能应在对应独立仓库维护，不在两处重复修改。

## 地址约定

- `/` 和 `/index.html`：经营看板，不能被库存首页替换。
- `/tiktok-dashboard/`：兼容历史经营看板地址，转到本网站首页。
- `/inventory-turnover.html` 和 `/inventory-turnover/`：兼容历史库存链接，转到库存独立入口。
- `/campaign-motion-studio/`：转到活动背景工坊独立入口。

跳转保留网址的查询参数和页面锚点。浏览器未启用 JavaScript 时，页面会提供可点击的新入口。

## 发布方式与防止再次互相覆盖

本仓库只使用 `.github/workflows/deploy-inventory-pages.yml` 这一条 GitHub Pages 发布流程；文件名暂时保留方便追溯，流程显示名称为 **Publish operating dashboard**。

GitHub 仓库的 **Settings → Pages → Source 必须选择 GitHub Actions**，不能同时采用从 `main` 根目录直接发布的方式。该设置属于 GitHub 站点配置，代码测试不能替代人工或接口核验。

发布步骤先运行合成数据测试，再执行 `node sites-build.mjs`，只上传 `dist/client`。输出白名单只有：

```text
index.html
dashboard.enc.json
.nojekyll
tiktok-dashboard/index.html
inventory-turnover.html
inventory-turnover/index.html
campaign-motion-studio/index.html
```

原始报表、工作说明、测试、配置和其他工具源码不进入这个网页发布包。构建脚本从自身位置确定路径，不会因为在别的文件夹运行而清理错误的目录，并拒绝将链接目录作为输出位置。

本地验证（只使用虚构测试内容，不读取业务数据包）：

```sh
node --check sites-build.mjs
node tests/site-build-regression.mjs
```

测试覆盖首页身份、完整发布清单、经营数据文件配对、旧链接及参数保留、重复构建、目录保护和唯一发布工作流。发布后仍须在线打开经营看板、库存工具、活动工坊及旧链接逐一验证；测试通过不等于线上部署已经完成。

## 数据与安全边界

`dashboard.enc.json` 是公开托管的**密文**，查看页面在浏览器中解密。不要向仓库提交密码、密钥、未加密业务报表、原始订单或客户资料；也不要把访问密码写进作品集截图或说明。

客户端加密不是企业级身份认证或权限管理。拿到密码的人可以解密已取得的数据包；公开托管内容也可能被下载或缓存。仓库里已有的密文不代表可以发布原始数据。

库存规则与历史记录、活动草稿由对应工具保存在使用者浏览器中，不由本经营看板仓库备份。同一 `casteen-code.github.io` 域名、同一浏览器环境中只更换仓库路径，通常仍可使用原存储；不要因此清空缓存或修改数据库名称。跨浏览器或换域名时须使用工具提供的导出与恢复功能。

## 备份与恢复

1. **代码与发布配置**：保留 Git 提交历史和上一次验证通过的提交编号。整理期间不删除旧工具源码；需要回退时，恢复对应文件并通过同一条发布流程重新部署。
2. **经营数据包**：只恢复已审核的密文版本，不从原始业务文件重新公开拷贝；密码由管理员在仓库之外妥善保管。
3. **个人浏览器数据**：库存迁移前先导出规则与重要结果；活动工坊先“保存项目”或“保存独立 HTML”。旧库存代码仅提供规则 JSON 恢复及历史结果 CSV 导出，不承诺它已经具备完整历史 JSON 备份恢复。
4. **回退后验收**：检查经营看板首页、数据包地址、库存和活动新入口、所有兼容地址。不要通过启用第二套 Pages 发布流程来回退。

后续可以增加不含真实业务数据的公开示例，以及更完整的发布后自动检查。没有验收完成的功能不列为已实现能力。
