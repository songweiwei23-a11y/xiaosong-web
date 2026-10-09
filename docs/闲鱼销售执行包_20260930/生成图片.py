from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import html

ROOT = Path(__file__).resolve().parent
OUT = ROOT / '图片'
OUT.mkdir(exist_ok=True)
REG = 'C:/Windows/Fonts/msyh.ttc'
BOLD = 'C:/Windows/Fonts/msyhbd.ttc'
BG = '#F6F2E9'
INK = '#202E2B'
MUTED = '#62716A'
ACC = '#BF5036'
LIGHT = '#E7E9DE'
BOUNDS = []

def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else REG, size)

def txt(draw, x, y, value, size=34, fill=INK, bold=False):
    box = draw.textbbox((x, y), value, font=font(size, bold))
    if box[2] > 1018 or box[3] > 1060:
        raise ValueError(f'Overflow: {value}: {box}')
    draw.text((x, y), value, font=font(size, bold), fill=fill)
    BOUNDS.append((value, box))

def base(num, label, dark=False):
    im = Image.new('RGB', (1080, 1080), INK if dark else BG)
    d = ImageDraw.Draw(im)
    color = BG if dark else INK
    txt(d, 68, 54, '开物', 43, color, True)
    txt(d, 730, 66, 'AI 编导工作台', 27, color)
    d.line((68, 123, 1012, 123), fill='#4B5C53' if dark else '#D5D9CD', width=2)
    txt(d, 68, 153, label, 27, '#D8A587' if dark else ACC, True)
    txt(d, 880, 994, f'{num:02d} / 08', 24, '#AAB5AA' if dark else MUTED)
    return im, d

def title(d, a, b, size=69):
    txt(d, 68, 224, a, size, INK, True)
    txt(d, 68, 316, b, size, INK, True)

def card(d, y, n, heading, sub):
    d.rounded_rectangle((68, y, 1012, y + 112), radius=24, fill='#FFFFFF')
    d.rounded_rectangle((90, y+24, 154, y+86), radius=15, fill=LIGHT)
    txt(d, 107, y+32, n, 31, ACC, True)
    txt(d, 184, y+15, heading, 35, INK, True)
    txt(d, 184, y+64, sub, 26, MUTED)

def save(im, name):
    im.save(OUT / name, optimize=True)
    return name

files=[]

def cover(price, plan, alternative=False):
    im,d=base(1, '短视频创作 · 选题 / 脚本 / 分镜', True)
    a,b=('今天拍什么？','从业务背景开始写') if alternative else ('选题、写稿、怎么拍','放进一个工作台')
    txt(d,68,238,a,65 if not alternative else 76,BG,True)
    txt(d,68,342,b,65 if not alternative else 70,BG,True)
    txt(d,68,469,'给编导、商家和单人代运营',36,'#CAD1C4')
    for i, s in enumerate(['按客户建档','整理创作草稿','保存继续创作']):
        x=68+i*318
        d.rounded_rectangle((x,564,x+300,636),radius=18,fill='#35463E')
        txt(d,x+20,581,s,30,BG)
    d.rounded_rectangle((68,700,1012,914),radius=28,fill=BG)
    txt(d,100,725,f'{plan}会员',32,INK,True)
    txt(d,94,775,f'¥{price}',84,ACC,True)
    txt(d,325,821,'/ 30天',38,INK)
    txt(d,646,765,'网页软件使用服务',29,INK,True)
    txt(d,646,814,'按套餐额度使用',28,MUTED)
    txt(d,68,972,'AI辅助创作，输出需核对；不保证流量效果',26,'#CAD1C4')
    return im

files.append(save(cover(49,'基础'),'01_基础版封面_49元.png'))
im,d=base(2,'创作流程')
title(d,'带着业务背景','一步一步完成创作')
for args in [(438,'1','整理客户档案','行业、产品、受众、真实卖点与拍摄条件'),(565,'2','选一个合适的题','按业务信息构思，选你实际能拍的方向'),(692,'3','写稿，再整理分镜','脚本草稿 → 拍摄安排 → 标题文字建议'),(819,'4','核对并保存','事实要真实，内容修改后再使用')]: card(d,*args)
txt(d,68,976,'各步骤按需使用；生成操作按对应额度计量',26,MUTED)
files.append(save(im,'02_创作流程.png'))

im,d=base(3,'内容示例 · 排版示意，非产品实测')
title(d,'一条餐饮视频','可以这样拆开写')
d.rounded_rectangle((68,442,1012,929),radius=28,fill='#FFFFFF')
for y,h,s in [(470,'选题方向','门店招牌菜，是怎么做出来的？'),(577,'口播开头','先给观众看制作过程，再讲真实卖点。'),(684,'拍摄安排','备料近景 → 制作过程 → 成品展示'),(791,'发布前核对','价格、原料、优惠和门店信息是否真实')]:
    txt(d,99,y,h,29,ACC,True)
    txt(d,99,y+43,s,34,INK)
txt(d,68,963,'示例为自写内容，用于说明结构，不代表生成效果',26,MUTED)
files.append(save(im,'03_内容结构示例_非实测.png'))

im,d=base(4,'适合谁使用')
title(d,'你了解自己的业务','开物辅助整理成稿')
for args in [(448,'1','独立编导','客户背景、选题方向、脚本与分镜'),(590,'2','实体商家','把真实产品卖点整理成能拍的内容'),(732,'3','单人代运营','按客户建档，保存和继续创作')]:card(d,*args)
txt(d,68,895,'先准备：行业 / 产品 / 受众 / 拍摄条件',31,INK,True)
txt(d,68,965,'工具提供创作草稿；不包含人工代写或代运营',26,MUTED)
files.append(save(im,'04_人群与用途.png'))

im,d=base(5,'套餐与价格')
title(d,'先按用量选择','功能主线一致')
for x,h,p,n,k in [(68,'基础会员',49,50,100),(552,'专业会员',99,120,300)]:
    d.rounded_rectangle((x,457,x+460,860),radius=28,fill='#FFFFFF')
    txt(d,x+30,490,h,42,INK,True)
    txt(d,x+27,556,f'¥{p}',80,ACC,True)
    txt(d,x+29,669,'开通后30天',31,INK)
    txt(d,x+29,727,f'创作类额度桶各{n}次',28,INK,True)
    txt(d,x+29,779,f'知识查询{k}次',29,MUTED)
txt(d,68,899,'定位与脚本部分页面共用额度，详情见下一张',28,INK)
txt(d,68,949,'到期未使用额度清零、不结转；无隐藏必购项目',26,MUTED)
files.append(save(im,'05_基础专业价格.png'))

im,d=base(6,'额度说明 · 购买前请看清')
title(d,'分功能计量','部分页面共用额度')
card(d,444,'1','定位额度共用','账号定位 / 商业定位 / 内容定位 / 创作简报')
card(d,575,'2','脚本额度共用','脚本生成 / 起号方案 / 开篇钩子')
card(d,706,'3','其他额度桶分别计量','选题 / 分镜 / 审稿 / 标题等；知识查询单独计量')
txt(d,68,858,'50 / 120次，不等于50 / 120条完整视频',34,INK,True)
txt(d,68,914,'一次完整创作可能使用多个桶，重复生成也可能计量',26,MUTED)
txt(d,68,965,'新账号免费额度为一次性体验，不按月补发',26,MUTED)
files.append(save(im,'06_额度共享说明.png'))

im,d=base(7,'交付与验收')
title(d,'在闲鱼下单','开通后逐项核对')
for args in [(438,'1','先确认用途和套餐','价格、30天期限、开通时限及售后说明'),(565,'2','通过闲鱼订单付款','按平台允许的方式办理软件服务开通'),(692,'3','核对会员页','检查档位、到期时间和剩余额度'),(819,'4','完成正常使用验收','登录 → 生成 → 保存；问题在订单聊天反馈')]:card(d,*args)
txt(d,68,976,'不索取密码或验证码；不要求提前确认收货',26,MUTED)
files.append(save(im,'07_交付验收.png'))

im,d=base(8,'购买须知')
title(d,'把交付说清楚','用真实体验判断')
for args in [(438,'1','购买内容','网页软件限期使用，按所选套餐额度使用'),(565,'2','内容需要人工核对','AI辅助创作，不保证涨粉、播放或成交效果'),(692,'3','服务范围','不含源码、资料包、拍摄剪辑或人工代运营'),(819,'4','问题与退款','依适用法律、平台规则和下单约定处理')]:card(d,*args)
txt(d,68,976,'先看演示和额度说明，再选择适合自己的套餐',26,MUTED)
files.append(save(im,'08_购买与售后说明.png'))
files.append(save(cover(49,'基础',True),'09_基础版备选封面.png'))
files.append(save(cover(99,'专业'),'10_专业版封面_99元.png'))

sheet=Image.new('RGB',(900,1280),BG)
sd=ImageDraw.Draw(sheet)
for i,name in enumerate(files):
    x=(i%3)*300+12; y=(i//3)*320+12
    thumb=Image.open(OUT/name).resize((276,276),Image.Resampling.LANCZOS)
    sheet.paste(thumb,(x,y))
    label=name.split('_')[0]+' '+name.split('_')[1].replace('.png','')
    sd.text((x,y+282),label,font=font(17),fill=INK)
sheet.save(ROOT/'图片总览.png',optimize=True)

gallery=''.join(f'<figure><img src="图片/{html.escape(n)}" alt="{html.escape(n)}"><figcaption>{html.escape(n)}</figcaption></figure>' for n in files)
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>开物 · 闲鱼销售执行包</title><style>body{background:#f6f2e9;color:#202e2b;font-family:"Microsoft YaHei",sans-serif;margin:0;padding:40px;line-height:1.7}main{max-width:1250px;margin:auto}h1{font-size:36px}a{color:#a3422b}nav{display:flex;gap:24px;flex-wrap:wrap;margin:24px 0}.note{background:white;padding:24px;border-radius:16px}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:32px}figure{margin:0}img{width:100%;border-radius:16px}figcaption{font-size:14px;padding:8px}small{color:#62716a}</style><main><small>2026-09-30 · 本地准备稿</small><h1>开物 · 闲鱼销售执行包</h1><p>49元基础款为入口，99元专业款为主力。先核对准入、授权与售后，再完成实测和上架。</p><nav><a href="01_完整执行方案.md">完整执行方案</a><a href="02_可复制文案与客服话术.md">文案与客服话术</a><a href="03_订单与运营记录模板.md">执行记录模板</a><a href="图片总览.png">图片总览</a></nav><div class="note">已制作10张1080×1080图片。基础款使用01或09封面；专业款使用10封面，其余详情图可按平台允许的数量选择。03图为排版示意，非产品实测。建议正式上架前补真实演示截图。规则核查不等于账号类目准入确认，本包尚未发布。</div><div class="gallery">'''+gallery+'''</div><p><small>不含二维码、站外付款、假评价或流量收益承诺。所有使用服务、额度与售后须与实际产品和平台要求一致。</small></p></main></html>'''
(ROOT/'预览.html').write_text(page,encoding='utf-8')
(OUT/'图片索引.md').write_text('# 图片索引\n\n10张PNG均为1080×1080，自有文字排版。建议基础款01→02→03→04→05→06→07→08；09是基础备选封面；10用于专业款封面。可上传数量以实际发布入口为准。03为自写内容结构示意，不能称产品实测。补实测截图前不宣称演示效果已验证。\n\n'+'\n'.join(f'- `{n}`' for n in files)+'\n',encoding='utf-8')
print(f'Generated {len(files)} PNGs; checked {len(BOUNDS)} text bounds; preview and contact sheet ready.')
