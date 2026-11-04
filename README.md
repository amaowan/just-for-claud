# 信以为真（I Believe）

一款关于“被相信的事物会成真”的叙事模拟游戏。你讲出的故事会在人们之间流传、变形，长成节日、地名和神灵。完整设计见 [docs/GDD.md](docs/GDD.md)。

当前进度：里程碑 1，纯文字传播沙盒（计划见 [docs/PLAN-M1.md](docs/PLAN-M1.md)）。

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm install
npm run dev     # 启动开发服务器
npm test        # 运行测试
npm run build   # 构建到 dist/
npm run example # 种子 42 示例：在渔村讲「山里住着会唱歌的巨人」，沉睡 5 年，打印变化报告和传话链
npm run balance # 平衡性报告：100 个种子各模拟 20 年（参数：npm run balance -- <种子数> <年数>）
```

## 目录

- `src/sim/`：模拟核心（纯逻辑，可在 Node 里直接运行）；可调数值都在 `src/sim/config.ts`
- `src/ui/`：纯文字界面
- `data/`：积木、村庄、NPC、对照表和全部中文文本模板
- `scripts/`：示例与平衡性报告脚本

## 在线试玩

https://amaowan.github.io/just-for-claud/

（合并到 main 后由 GitHub Actions 自动发布。）
