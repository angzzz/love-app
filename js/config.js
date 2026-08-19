// 配置常量

const cardTypes = [
  { key:'forgive', emoji:'🌸', title:'无条件原谅卡', desc:'无论什么事，这一次无条件原谅你', hint:'送给对方一个"豁免权"', color:'#FFE0EC' },
  { key:'meet', emoji:'✈️', title:'我来见你卡', desc:'下次见面，我去你的城市找你', hint:'路途我来走', color:'#D4ECFF' },
  { key:'hug', emoji:'🫂', title:'抱抱卡', desc:'下次见面先抱三分钟，不许撒手', hint:'把拥抱一次性兑现', color:'#FFF0D4' },
  { key:'massage', emoji:'💆', title:'超绝马杀鸡按摩卡', desc:'下次见面，给你一套全身按摩套餐', hint:'把想念揉进掌心', color:'#E8D4FF' },
  { key:'decide', emoji:'👑', title:'今天你说什么就是什么卡', desc:'今天你说什么就是什么，绝不反驳', hint:'皇帝体验卡', color:'#D4FFE8' },
  { key:'sssvip', emoji:'💎', title:'SSSVIP万能卡', desc:'至尊级万能卡，什么愿望都可以许', hint:'终极底牌', color:'#FFE8D4' }
]

const customColors = ['#FFE0EC','#D4ECFF','#FFF0D4','#E8D4FF','#D4FFE8','#FFE8D4','#E8FFD4','#D4D4FF','#FFD4D4','#D4FFFF']
const customEmojis = ['🌟','🍭','🎈','🧸','🌹','🍦','🦋','🍀','🎵','🍿','🎡','🍷','📚','🐱','🌈','⚡']

const moods = [
  { emoji:'🥰', label:'超幸福' }, { emoji:'😊', label:'开心' }, { emoji:'🤩', label:'惊喜' }, { emoji:'😌', label:'安心' },
  { emoji:'🥺', label:'舍不得' }, { emoji:'😜', label:'搞笑' }, { emoji:'😴', label:'放松' }, { emoji:'😭', label:'感动哭' }
]

// 纪念日类型预设
const anniversaryPresets = [
  { emoji:'💕', title:'在一起的纪念日', repeat:'yearly' },
  { emoji:'🎂', title:'生日', repeat:'yearly' }
]

// 随机美食库 —— 治好选择困难症（图标与名称一一对应）
const foodPool = [
  { emoji:'🍲', name:'火锅' }, { emoji:'🥩', name:'烤肉' }, { emoji:'🍣', name:'日料' },
  { emoji:'🍢', name:'烧烤' }, { emoji:'🌶️', name:'川菜' }, { emoji:'🐟', name:'湘菜' },
  { emoji:'🍵', name:'粤菜茶点' }, { emoji:'🍔', name:'麦当劳' }, { emoji:'🍗', name:'肯德基' },
  { emoji:'🍕', name:'披萨' }, { emoji:'🍜', name:'拉面' }, { emoji:'🥟', name:'饺子' },
  { emoji:'🥣', name:'麻辣烫' }, { emoji:'🐌', name:'螺蛳粉' }, { emoji:'🍛', name:'黄焖鸡米饭' },
  { emoji:'🥡', name:'沙县小吃' }, { emoji:'🦐', name:'海鲜' }, { emoji:'🍽️', name:'自助餐' },
  { emoji:'🍗', name:'韩式炸鸡' }, { emoji:'🧀', name:'部队火锅' }, { emoji:'🥗', name:'轻食沙拉' },
  { emoji:'🍰', name:'甜品下午茶' }, { emoji:'🧋', name:'奶茶配小吃' }, { emoji:'🥘', name:'麻辣香锅' },
  { emoji:'🍱', name:'便当简餐' }, { emoji:'🦆', name:'烤鸭' }, { emoji:'🍚', name:'砂锅粥' }
]
