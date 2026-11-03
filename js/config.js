/* ============================================================
   我们的宇宙 — 文字内容（干净版，从零开始填）
   两种填法：
     A. 双击 edit.html，填完点「导出 config.js」，复制粘贴回来
     B. 用记事本直接改这个文件，只改双引号里的字

   规则：只改引号里的内容，引号、逗号、大括号不要动。
   照片不在这里，在 js/photos-data.js。
   ============================================================ */

window.SITE_CONFIG = {

  /* 浏览器标签 + 首屏大标题 */
  title: "恋瑄育记",

  /* 大标题上面那行小字 */
  subtitle: "写给大猪头屁屁瑄",

  /* 两个名字，页面显示成「你 & 我」 */
  names: { me: "张子龙", you: "田育瑄" },

  /* 在一起的第一天：格式必须是 年-月-日，例如 "2024-03-08" */
  startDate: "2026-03-08",

  /* ── 相册 ────────────────────────────────────────────────
     每一行 = 页面上的一整块照片区域。
     id 只能英文/数字且不能重复；title 是显示的名字。
     想加就复制一行，想删就删一整行（注意别丢逗号）。
     ─────────────────────────────────────────────────────── */
  albums: [
    { id: "我们的瞬间", icon: "💫", title: "我们的瞬间", desc: "" },
    { id: "日常碎片", icon: "🌿", title: "日常碎片", desc: "" },
    { id: "张子龙要跟田育瑄短暂分开啦", icon: "✈️", title: "张子龙要跟田育瑄短暂分开啦", desc: "" },
    { id: "一起旅行", icon: "🧳", title: "一起旅行", desc: "", cover: "assets/deco/travel-todo.svg" },
    { id: "沿途的风景", icon: "🏞️", title: "沿途的风景", desc: "" },
    { id: "美食地图", icon: "🍰", title: "美食地图", desc: "" },
    { id: "田育瑄小时候", icon: "🧸", title: "田育瑄小时候", desc: "" }
  ],

  /* 家里两位的名字 */
  pets: { cat: "多米", dog: "熊猫" },

  /* 照片：永远留空。照片在 js/photos-data.js */
  photos: [],

  /* ── 时间轴 ──────────────────────────────────────────────
     一条 = { date: "2024.03.08", title: "标题", text: "细节" },
     ─────────────────────────────────────────────────────── */
  timeline: [],

  /* ── 见面的日子（日历）─────────────────────────────────
     一次见面写一条，用 start / end 圈出连续的那几天（1～3 天都算一次），
     一次见面 = 日历上连在一起的一段，不是一天一条。

       { start: "2026-03-08", end: "2026-03-10", title: "一起过生日", note: "吃了蛋糕" }

     end 可以不写（等于只有一天）。
     这几天拍的照片会自动按文件名里的日期（2026_03_09_xxx.jpg）匹配进来；
     文件名不带日期的，可以在这里手写：photos: ["assets/photos/xxx.jpg"]
     ─────────────────────────────────────────────────────── */
  meetings: [
    { start: "2026-01-09", title: "第一次见面", note: "张子龙已经放寒假了" },
    { start: "2026-01-11", title: "第二次见面" },
    { start: "2026-02-13", title: "在老家" },
    { start: "2026-02-21", title: "老家第二次见面" },
    { start: "2026-03-07", title: "送宝子返校" },
    { start: "2026-03-14", end: "2026-03-15", title: "去沙面岛玩" },
    { start: "2026-03-20", end: "2026-03-21", title: "宝子去清吧喝醉了" },
    { start: "2026-04-04", end: "2026-04-05", title: "四月那两天" },
    { start: "2026-05-03", end: "2026-05-04", title: "宝子从老家回来" },
    { start: "2026-05-22", end: "2026-05-24", title: "骑自行车差点摔倒" },
    { start: "2026-06-06", end: "2026-06-07", title: "一起去当志愿者" },
    { start: "2026-07-08", title: "放暑假前最后一面" },
    { start: "2026-08-28", end: "2026-08-29", title: "开学去接她" },
    { start: "2026-09-18", end: "2026-09-19", title: "宝子给我过生日" },
    { start: "2026-09-24", end: "2026-09-25", title: "给她做饭吃" },
    { start: "2026-10-06", end: "2026-10-07", title: "广州塔和海心沙" },
    { start: "2026-10-24", end: "2026-10-25", title: "偷偷来见我被我拆穿" }
  ],

  /* ── 生日：日历上会单独点缀（金色 + 蛋糕）────────────────
     { date: "2026-02-17", who: "育瑄" }
     ─────────────────────────────────────────────────────── */
  birthdays: [
    { date: "2026-02-17", who: "育瑄" },
    { date: "2026-09-09", who: "子龙" }
  ],

  /* ── 下次见面倒计时 ──────────────────────────────────────
     date 填 年-月-日；留空就显示一句提示。
     label 是标题文字，note 是下面一行小字（可空）。
     ─────────────────────────────────────────────────────── */
  nextMeeting: { date: "2026-11-01", label: "下次见面", note: "" },

  /* ── 一起要做的事 ────────────────────────────────────────
     一条 = { text: "一起看一次日出" }；
     做过了就把 done 改成 true，也可以在页面上直接点勾。
     想加就复制一行，想删就删一整行（注意逗号）。
     ─────────────────────────────────────────────────────── */
  wishlist: [
    { text: "一起去看一次海", done: false },
    { text: "在同一个城市过生日", done: false },
    { text: "一起拍一张证件照风格的照片", done: false },
    { text: "坐着末班车回家", done: false },
    { text: "一起做一顿饭（不许点外卖）", done: false },
    { text: "半夜出去找一家还开着的店", done: false },
    { text: "养一只猫或者一只狗", done: false },
    { text: "一起看一场现场演出", done: false },
    { text: "把合照洗出来贴在墙上", done: false },
    { text: "一起存一笔旅行基金", done: false },
    { text: "一起看一次日出", done: false },
    { text: "一起看一次日落", done: false },
    { text: "下雨天共用一把伞", done: false },
    { text: "一起坐一次绿皮火车", done: false },
    { text: "给对方做一次早饭", done: false },
    { text: "一起逛一次早市", done: false },
    { text: "一起在沙发上睡着", done: false },
    { text: "一起看完一整部剧", done: false },
    { text: "一起拼一幅拼图", done: false },
    { text: "一起打一次羽毛球", done: false },
    { text: "一起去一次游乐园", done: false },
    { text: "一起坐一次摩天轮", done: false },
    { text: "一起去电影院看一场电影", done: false },
    { text: "一起看一场露天电影", done: false },
    { text: "一起去一次夜市", done: false },
    { text: "一起吃一次路边摊", done: false },
    { text: "一起包一次饺子", done: false },
    { text: "一起烤一次蛋糕", done: false },
    { text: "一起喝一次深夜奶茶", done: false },
    { text: "一起逛超市买满一车", done: false },
    { text: "一起在便利店吃关东煮", done: false },
    { text: "一起过一整个不出门的周末", done: false },
    { text: "一起给多米洗一次澡", done: false },
    { text: "一起带熊猫散步", done: false },
    { text: "一起给宠物过一次生日", done: false },
    { text: "一起拍一次全家福（带上两只）", done: false },
    { text: "一起种一盆植物", done: false },
    { text: "一起给这盆植物起名字", done: false },
    { text: "一起收拾一次房间", done: false },
    { text: "一起换一次床单", done: false },
    { text: "一起洗一次碗", done: false },
    { text: "一起叠一次衣服", done: false },
    { text: "一起逛一次家具店", done: false },
    { text: "一起幻想一次未来的家", done: false },
    { text: "一起画一次对方", done: false },
    { text: "一起写一封给一年后的信", done: false },
    { text: "一起去做一次体检", done: false },
    { text: "一起晨跑一次", done: false },
    { text: "一起爬一次山", done: false },
    { text: "一起去一次图书馆", done: false },
    { text: "一起泡一次温泉", done: false },
    { text: "去海边捡一次贝壳", done: false },
    { text: "一起堆一个雪人", done: false },
    { text: "一起打一次雪仗", done: false },
    { text: "一起淋一次雨", done: false },
    { text: "一起看一次烟花", done: false },
    { text: "一起放一次孔明灯", done: false },
    { text: "一起过一次中秋", done: false },
    { text: "一起过一次圣诞", done: false },
    { text: "一起跨一次年", done: false },
    { text: "一起过一次情人节", done: false },
    { text: "一起过一次七夕", done: false },
    { text: "一起守一次岁", done: false },
    { text: "一起记录一次彼此的体重变化", done: false },
    { text: "陪对方剪一次头发", done: false },
    { text: "一起做一次面膜", done: false },
    { text: "一起学一道新菜", done: false },
    { text: "一起学一首歌", done: false },
    { text: "一起去一次 KTV", done: false },
    { text: "一起跳一次广场舞", done: false },
    { text: "一起把一个游戏打到通关", done: false },
    { text: "一起做一次手工", done: false },
    { text: "一起拍一次 vlog", done: false },
    { text: "一起整理一次照片", done: false },
    { text: "一起做一本相册", done: false },
    { text: "一起写一份「我们的规矩」", done: false },
    { text: "吵一次架，然后当天和好", done: false },
    { text: "一起给对方读一段书", done: false },
    { text: "在阳台看一次星星", done: false },
    { text: "一起认一次星座", done: false },
    { text: "一起露营一次", done: false },
    { text: "一起看一次海上的日出", done: false },
    { text: "一起坐一次热气球", done: false },
    { text: "一起去一次别的城市", done: false },
    { text: "一起去一次对方的家乡", done: false },
    { text: "一起见一次对方的家人", done: false },
    { text: "一起给对方的家人带一次礼物", done: false },
    { text: "一起参加一次朋友的婚礼", done: false },
    { text: "认真过一次纪念日", done: false },
    { text: "一起坐一次长途火车", done: false },
    { text: "在陌生城市一起迷一次路", done: false },
    { text: "在陌生城市吃一顿饭", done: false },
    { text: "拍一张十年后还要看的照片", done: false },
    { text: "一起学会一句对方的方言", done: false },
    { text: "一起给对方写一首打油诗", done: false },
    { text: "比一次「谁先笑」", done: false },
    { text: "交换一次 50 块以内的礼物", done: false },
    { text: "一起挑战一周不吵架", done: false },
    { text: "列一份老了以后的清单", done: false },
    { text: "把这张清单一条一条划掉", done: false }
  ],

  /* ── 小游戏：死亡时用来复活的小问题 ──────────────────────
     { q: "问题", options: ["选项A", "选项B"], correct: 0 }   ← correct 是正确选项的序号（从 0 开始）
     答对满血复活，答错可以再选。想加几道加几道，每次随机抽。
     ─────────────────────────────────────────────────────── */
  gameQuestions: [
    {
      q: "张子龙的电话号码是多少？",
      answers: ["19575214114"],
      numeric: true,
      hint: "11 位手机号"
    },
    {
      q: "张子龙最喜欢的游戏是什么？",
      answers: ["cs", "csgo", "cs:go", "反恐精英"],
      hint: "两个字母"
    },
    {
      q: "张子龙最想去的地方是哪里？",
      answers: ["海边", "桔钓沙"],
      hint: "海边或者桔钓沙都算对"
    },
    {
      q: "张子龙曾经给你起过什么备注？",
      answers: [
        "大猪头屁屁瑄",
        "咪咪田鸡大王小学生版牛逼克拉斯",
        "傻不拉叽",
        "田育瑄",
        "咪咪大王",
        "秒睡大王",
        "咪咪小学生"
      ],
      hint: "想得起一个就算对"
    }
  ],

  /* ── 「有些话」的解锁密码 ────────────────────────────────
     通关小游戏会自动解锁；想直接看，就输入这个密码。
     （密码是明文写在文件里的，防的是随手翻，不是真的加密）
     ─────────────────────────────────────────────────────── */
  unlock: { password: "tyx200717" },

  /* ── 一封信：一个引号是一段，想写几段写几段 ───────────────
     例：letter: ["第一段……", "第二段……"],
     ─────────────────────────────────────────────────────── */
  letter: [],

  /* 信的落款，右对齐显示在信的末尾 */
  sign: "",

  /* 背景音乐：文件已经在 assets/ 里，改歌名就行。
     volume 是初始音量（0-100），页面上的滑块可以随时调 */
  music: { src: "assets/music.mp3", title: "情歌 - 梁静茹", volume: 50 },

  /* 页脚小字 */
  footer: ""
};
