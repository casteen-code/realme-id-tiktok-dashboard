# GitHub 与在线页面

仓库：[casteen-code/realme-id-tiktok-dashboard](https://github.com/casteen-code/realme-id-tiktok-dashboard)

编辑器目录：`campaign-motion-studio/`。现有库存工具在仓库根目录，活动编辑器单独维护。

在线地址：[活动背景工坊](https://casteen-code.github.io/realme-id-tiktok-dashboard/campaign-motion-studio/)

## GitHub Pages

仓库已有从 `main` 根目录发布的 Pages 流程。提交编辑器目录中的 `index.html` 后，GitHub 会将子目录页面随主站一同发布；无需修改根目录首页。发布进度在仓库 Actions 中的 `pages build and deployment` 查看。

如需检查配置：Settings → Pages → Build and deployment，Source 为 `Deploy from a branch`，Branch 为 `main`，Folder 为 `/ (root)`。

## 日后维护

日常活动制作直接打开在线编辑器。上传图片、抠图、调整动效后，使用“保存项目”或“保存独立 HTML”保留修改。编辑器不会把你上传的素材自动同步到 GitHub。

需要让 GPT 继续修改工具时，把仓库链接发给 GPT，并说明修改 `campaign-motion-studio/` 子项目。

本地开发：

```bash
git clone https://github.com/casteen-code/realme-id-tiktok-dashboard.git
cd realme-id-tiktok-dashboard/campaign-motion-studio
npm ci
npm test
npm run build
```

把源码和生成后的 `index.html` 一起提交。根目录 `.github/workflows/campaign-motion-check.yml` 自动检查该子项目。子项目内附带的 `.github/workflows/check.yml` 用于将来迁移成独立仓库。

新活动素材放进 `assets/<campaign-name>/`，复制示例配置并修改文件路径和图层参数，再构建：

```bash
node scripts/build.cjs --project examples/your-campaign.campaign.json --out index.html
```
