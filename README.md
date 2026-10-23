# 时舟（CtimeApp）

一个把「任务 → 时间块 → 专注 → 复盘」串成一圈的本地时间管理 App。
Expo + React Native，iOS / Android / Web 同一套代码，数据只存在设备上（AsyncStorage），不依赖任何账号或后端。

## 功能

- **今日**：一天的时间轴，按 30 分钟粒度显示空闲/已排时段，点空隙即可插入时间块。
  「自动排程」会按优先级、截止时间、预计时长，把未排任务贪心填进当天的空闲窗口（今天的排程不会落在过去的时间点）。
- **日历**：月视图的「日程地图」。每格的底色深浅＝当天计划时长（相对本月最满的那一天，不是绝对小时数，否则真实数据下每格都是一样的淡色），底部细条＝当天实际专注，格子内小圆点＝占时长最多的三个分类，右上角数字＝当天到期的待办数，强调色药丸＝今天，2px 描边＝选中的那天。顶部吸顶栏用 `‹ ›` 翻月（翻页会把选中的「几号」带过去，月底自动截断），点月份标题回到本月。选中日下方展开当天明细（计划/专注/完成/到期 + 时间块列表），一键跳到今日页编排这天（共享 `selectedDate`）。页尾「本月地图」给出计划/专注/到期/完成汇总、最满的一天、执行率，以及有排程的天数占比。
- **任务**：标题 / 备注 / 分类 / 优先级（高中低）/ 预计时长 / 截止日期，支持「全部待办 · 今天 · 逾期 · 已完成」筛选，并显示每条任务是否已被排入日程（`已排 HH:MM` / `未排入日程`）。
- **专注**：番茄钟。倒计时以绝对截止时间（`endAt`）计算，切后台、熄屏、杀进程再打开都不会漂秒；到点结算由全局引擎在任何页面按真实墙钟完成（休息从专注实际结束、而不是 App 被唤醒的时刻起算），可提前停止（按实际分钟数记为 partial）。iOS / Android 会发送本地通知（网页端不会）。计时页可进入「息屏显示」：纯黑常亮的大字倒计时，每秒只更新文字、不跑动画，轻触任意位置退出。
- **复盘**：本周 / 上周 / 本月区间的专注时长、轮次、计划时长、完成任务与完成率，计划 vs 实际的柱状对比、分类时间去向、以及基于数据的建议；同一页可调整专注/休息时长、每天的计划起止时间，并切换外观（跟随系统 / 活力白天 / 素白 / 夜航）。

## 动效体系

统一走 Reanimated 4 + worklets，所有动画都跑在 UI 线程，React 不因动画重渲染；`transition`/`scale` 只碰 `transform` 与 `opacity`（例外：绝对定位且无子节点的进度条、分段胶囊、图表柱）。

- **按压**：`PressableScale` 全站唯一可按压组件，按下 scale 0.97 / 150ms，44pt 触控区靠 `hitSlop` 撑大。
- **底部弹层**：`Sheet` 用原生 Modal 的 slide 做层级，手势叠加手指跟随的下滑关闭（上推橡皮筋阻力、离开时按 velocity+distance 判定）。
- **分段控件**：`Segmented` 的胶囊靠 CSS transition 滑 `left`，切换标签栏下方的筛选器不重排。
- **列表与卡片**：`useEnter()` 做最多 6 项、每项 45ms 的错峰入场；`useReflow()` 用 `LinearTransition` 让删除/筛选后的行平滑归位；`useTransient()` 负责 toast、二次确认这类瞬态元素。
- **数据反馈**：进度条宽度、图表柱 `scaleY`、指标数字 `key + FadeInDown` 都有 200–420ms 的过渡。
- **触感**：一次用户动作一次触感（选择/落位/成功/警示），始终与视觉同帧、且从不单独出现。
- **降级**：每个动画都配 `useReducedMotion()`，降级后只保留解释状态变化的透明度变化，位移/缩放/回弹全部去掉。

> 手势跟随、速度接管和触感时机无法从代码或模拟器判断，必须在 release build + 最慢的量产 Android 上感受。Expo Go / 浏览器 dev 环境不算验证过。

## 视觉层：彩底 · 磨玻璃 · 外观

三套配色（`Colors.light` / `Colors.vivid` / `Colors.dark`）+ 每套对应的氛围彩底（`Ambient`）与玻璃材质（`Glass`）。**两套日间配色不含紫色**：`light` 走钴蓝＋青，`vivid` 走青绿＋海蓝＋落橙，连分类色也换成玫红；紫色只留给「夜航」。所有文字/前景色都按 WCAG 对比度校准过：正文与次要文字在三套配色的所有表面（卡片白底、页面底色、选中底色）上均 ≥ 4.25:1，渐变主卡与主按钮上的白字 ≥ 4.4:1。

- **外观切换**：`设置 → 复盘 → 外观`，四选一（跟随系统 / 活力白天 / 素白 / 夜航），默认「活力白天」。持久化在 `settings.appearance`，`usePalette()` 把它和系统深浅色一起解析，标签栏与导航主题同步跟随。
- **氛围彩底**：`AmbientBackdrop` 是一层静态渐变（底色 + 三团径向色斑），玻璃面板才有东西可糊；它不随滚动移动，所以零帧开销。
- **磨玻璃**：用 `expo-blur`，不用 `expo-glass-effect`——后者只在 iOS 26+ 提供 Liquid Glass，在 Android 上直接退化成普通 View，而这个包的目标是 Android APK。Android 侧 `BlurView` 必须指向一个 `BlurTargetView` 才能采样，所以每屏用 `GlassTarget` 包住正文，面板作为它的兄弟节点叠在上面（面板在内容之后渲染，才能拿到最新一帧）。
- **预算**：每屏 1–2 个 `BlurView`（吸顶栏 + 瞬时 toast 药丸）。卡片不做玻璃——滚动内容下方每帧重新模糊，正是老 Android 上玻璃卡顿的来源。`intensity` 挂载时定死，从不动画；只有透明度参与动画。
- **降级**：Android 11 及以下 `blurMethod` 退化为 `'none'`，此时面板的半透明填充色就是材质本身，视觉不破。
- **网页预览**：web 回退标签栏自己画在**底部**（`app-tabs.web.tsx`），与手机一致；它用 `bottom: 0` 定位，因此不会把文档撑出 60px 让整屏可滚动。三屏共用的 `BottomTabInset` 在 web 上取 84，等于这条栏的高度，页面内容、吸底 toast 都靠它避让。
- **对比度自检**：`node scripts/contrast-audit.mjs` 直接读 `src/constants/theme.ts` 里的 `Colors`/`Gradients`，逐条算正文/次要文字在所有表面、白字在渐变主卡与主按钮上的对比度，改配色后跑一次即可。

## 环境

- Node 20+（开发用 v24）
- 手机装 [Expo Go](https://expo.dev/go)（SDK 57 对应版本）即可预览，**不需要** Android Studio / Xcode。
- 出正式 APK 需要 JDK 17 + Android SDK，本机装在 `F:\Android\`（见下面的「构建正式包 · 路线 A」）。

## 运行

```bash
npm install
npx expo start
```

- 扫终端里的二维码 → 在 Expo Go 中打开（真机需与电脑在同一网络；跨网络可加 `--tunnel`）。
- 浏览器预览：按 `w`，或直接访问终端显示的 web 地址。
- 别用 `CI=1 npx expo start` 起开发服务器：CI 模式下 Metro 不监听文件改动，会一直吐旧 bundle（页面看起来改了没生效，实际缓存没刷新）。
- 跑过本机 `gradle assembleRelease` 之后，同一个 8081 端口上的开发服务器常常会被打乱（浏览器只拿到 HTML，bundle 请求根本不发出、控制台一片空白）。这时先 `netstat -ano | grep :8081` 找到 PID，`taskkill //PID <pid> //T //F` 杀干净（`TaskStop` 只杀父进程，子 node 会继续占端口），再重新 `npx expo start --web --port 8081 --clear`。

常用校验命令：

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

## 构建正式包

### 路线 A：本机 Gradle（不用 EAS / Expo 账号）

工具链全部装在 F:（刻意不占 C 盘）：

| 用途 | 路径 |
| --- | --- |
| JDK 17 (Temurin) | `F:\Android\jdk17` |
| Android SDK（platform-tools、platforms;android-36、build-tools;36、ndk;27.1.12297006、cmake;3.22.1） | `F:\Android\Sdk` |
| Gradle 9.3.1（已解压，绕过 wrapper 下载） | `F:\Android\gradle-dist\gradle-9.3.1` |
| `GRADLE_USER_HOME` | `F:\Android\.gradle` |

```bash
# 0. 改过图标/启动图才需要：从 scripts/app-icon-art.mjs 的 SVG 几何重出全部 PNG
node scripts/gen-app-icon.mjs

# 1. 生成原生工程（android/ 由 expo prebuild 生成，不要手写；图标会被转成 mipmap-* 的自适应三层）
npx expo prebuild --platform android --no-clean --no-install

# 2. 打 release APK（只编 arm64-v8a，包体更小）
cd android
JAVA_HOME='F:\Android\jdk17' ANDROID_HOME='F:\Android\Sdk' ANDROID_SDK_ROOT='F:\Android\Sdk' \
GRADLE_USER_HOME='F:\Android\.gradle' \
PATH="/f/Android/gradle-dist/gradle-9.3.1/bin:$PATH" \
gradle assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain

# 产物：android/app/build/outputs/apk/release/app-release.apk（拷到 builds/ 下方便分发）
```

本机已产出的包：`builds/ctime-v1.0.4-arm64-v8a.apk`（47 MB，`com.ctime.app` 1.0.4 / versionCode 4，minSdk 24、targetSdk 36，只含 arm64-v8a，已含 `expo-blur` 原生模块、磨玻璃界面、五个标签页（今日 · 日历 · 任务 · 专注 · 复盘）、按墙钟结算的专注计时与息屏显示、不含紫色的日间配色；`builds/` 已在 `.gitignore` 里，旧版本包也留在同一目录）。

安装到手机：把 APK 传过去直接点开（需在系统里允许「安装未知应用」），或连着数据线执行

```bash
/f/Android/Sdk/platform-tools/adb.exe install -r builds/ctime-v1.0.4-arm64-v8a.apk
```

两个必须保留的 workaround，都在 `F:\Android\.gradle` 里（仓库外，换机器要重建）：

- `gradle.properties` → `systemProp.javax.net.ssl.trustStore=NUL` + `systemProp.javax.net.ssl.trustStoreType=Windows-ROOT`。JDK 自带的 cacerts 不信任 Gradle/GitHub 的 CDN 证书，改走 Windows 系统证书库才能下载 `gradle-9.3.1-bin.zip` 等产物。
- `init.d/mirrors.gradle` → 把 `google()` 仓库重写到 `https://maven.aliyun.com/repository/google`。本机访问 `dl.google.com` / `maven.google.com` 直接连接超时，AGP 与 androidx 依赖只能走镜像。构建日志里仍会打印若干条 `dl.google.com/android/repository/addons_list-*.xml` 超时，那是 SDK 自动补件的探测，因为所需组件已装齐，可以忽略。
- `init.d/buildtools.gradle` → 把所有模块的 `buildToolsVersion` 固定成已安装的 `36.0.0`。这版 AGP 给库模块的默认值是 `35.0.0`，本机没装也无法自动下载，否则 `:react-native-gesture-handler:compileReleaseJavaWithJavac` 会报 `Failed to find Build Tools revision 35.0.0`。这样写是为了不去手改 `prebuild` 生成的 `android/`。

**签名**：`prebuild` 生成的 `android/app/build.gradle` 里 release 变体默认复用 `android/app/debug.keystore`，所以这条路线产出的 APK 能直接安装自用，但不能上 Google Play、也不能和将来的版本做无缝升级。正式发布请自建 keystore 并配置 `signingConfigs`，或改用路线 B。

### 路线 B：EAS 云构建

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview   # 产出可分享的 .apk
npx eas-cli build --platform ios     --profile production
npx eas-cli submit --platform ios                        # 提交 App Store
```

`eas.json` 已配置好三个 profile：`development`（Expo Go 一样的开发客户端）、`preview`（Android 直接产出可分享的 .apk）、`production`（上架用，自动递增版本号）。iOS 构建需要（免费的或付费的）Apple 开发者账号，Android 需要 Google Play Console 才能上架，测试包本身不需要。

## 目录结构

```
src/
  app/            # Expo Router 路由：index(今日) · calendar(日历地图) · tasks · focus · stats
  components/     # kit(基础组件+Segmented) · glass(GlassTarget/GlassPanel/AmbientBackdrop/滚动吸顶分割线)
                  # sheet(可拖拽底部弹层) · timer-ring(SVG 进度环) · task-form · block-form · app-tabs(.web) · themed-*
  constants/      # theme：三套配色 + Glass/Ambient/Gradients、间距、圆角、字号 · motion：时长/缓动曲线/回弹与惯性投影
  hooks/          # use-theme(usePalette/useTheme/useGradients/useGlass/useAmbient) · use-color-scheme
                  # use-enter(错峰入场、瞬时元素、重排过渡) · use-system-insets(状态栏/挖孔/手势条留白)
  lib/            # types · catalog · date · schedule(排程算法与统计) · store(zustand 持久化) · notifications · haptics
assets/           # 图标、启动图、底部标签图标
scripts/          # app-icon-art(图标 SVG 几何，唯一真源) · gen-app-icon(sharp 出全部 PNG) · contrast-audit
```

数据模型与持久化都在 `src/lib/store.ts`，storage key 为 `ctime-store-v1`；「复盘 → 清空所有数据」会重置它。

## 已知限制

- v1 只有本地存储，没有多设备同步。
- 通知为本地通知。Android 12+ 未申请精确闹钟权限，系统可能把提醒延后几分钟。
- 第三方 App 无法在系统级 AOD（真正熄屏后由系统绘制的那层）上作画；这里的「息屏显示」是 App 内的纯黑常亮环境屏，只在 App 位于前台时生效。
- Web 端用于开发预览，`Alert` 在 react-native-web 上不可用，因此所有确认操作都改成了页内两步确认。
- `builds/*.apk` 只含 arm64-v8a（现代手机均可），用 debug keystore 签名，未装到真机验证过安装与运行时行为。
- 磨玻璃的真实质感（Android 上 `dimezisBlurViewSdk31Plus` 的采样、模糊边缘、掉帧情况）无法在浏览器里判断——网页端只是 CSS `backdrop-filter` 近似，必须在 release 包 + 量产机上验收。
- 动效的跟手度、速度接管与触感时机无法在 Expo Go / 模拟器 / 浏览器里判断，需要在 release 包和最慢的量产机上感受。
